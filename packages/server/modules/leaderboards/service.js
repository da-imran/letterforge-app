const mongo = require('../../utilities/mongodb');
const { HttpError } = require('../../utilities/http-error');
const { MODES, PERIODS } = require('../../utilities/constant');

// In-process read cache. Leaderboard aggregations are expensive and are
// re-read by every client refresh; a short TTL absorbs read amplification.
// Writes invalidate the cache immediately via `onCreated`. Replace with a
// Redis-backed cache when running multiple API instances.
const CACHE_TTL_MS = 30 * 1000;

class LeaderboardService {
    constructor(client) {
        this.client = client;
        this.collection = 'scores';
        this.cache = new Map();
    }

    /**
     * Drop cached leaderboard rows (optionally scoped to a mode).
     */
    invalidateCache(mode = null) {
        for (const key of this.cache.keys()) {
            if (!mode || key.startsWith(`${mode}:`)) {
                this.cache.delete(key);
            }
        }
    }

    async _cached(key, fetchFn) {
        const hit = this.cache.get(key);
        if (hit && hit.expiresAt > Date.now()) {
            return hit.value;
        }
        const value = await fetchFn();
        this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return value;
    }

    /**
     * Submit or update a user's score in the leaderboard.
     * The `scores` collection is the single source of truth; `period` only
     * narrows the date window used by rankings. Idempotent per `gameId`.
     */
    async submitScore({ userId, mode, period, score, gameId }) {
        if (!MODES.includes(mode)) throw new HttpError(400, 'Invalid mode');
        if (!PERIODS.includes(period)) throw new HttpError(400, 'Invalid period');

        const userObjectId = mongo.getObjectId(userId);
        if (!userObjectId) throw new HttpError(400, 'Invalid userId');

        const entry = {
            userId: userObjectId,
            mode,
            points: score,
            createdAt: new Date(),
        };

        if (gameId) {
            const gameObjectId = mongo.getObjectId(gameId);
            if (!gameObjectId) throw new HttpError(400, 'Invalid gameId');
            entry.gameId = gameObjectId;

            const existing = await mongo.findOne(this.client, this.collection, { gameId: gameObjectId });
            if (existing) {
                return existing;
            }
        }

        try {
            const result = await mongo.insertOne(this.client, this.collection, entry);
            this.invalidateCache(mode);
            return { ...entry, _id: result.insertedId };
        } catch (err) {
            // Concurrent submission for the same game: return the winning row.
            if (err && err.code === 11000) {
                const winner = await mongo.findOne(this.client, this.collection, { gameId: entry.gameId });
                if (winner) return winner;
            }
            throw err;
        }
    }

    /**
     * Get leaderboard rankings (aggregated from scores collection), cached
     * in-process for CACHE_TTL_MS.
     */
    async getLeaderboard({ mode, period, limit = 10, offset = 0 }) {
        const cacheKey = `${mode}:${period}:${limit}:${offset}`;
        return this._cached(cacheKey, () => this._getLeaderboard({ mode, period, limit, offset }));
    }

    async _getLeaderboard({ mode, period, limit = 10, offset = 0 }) {
        const { startDate, endDate } = this._getPeriodDateRange(period);

        const matchStage = {
            mode,
            createdAt: { $gte: startDate }
        };

        if (endDate) {
            matchStage.createdAt.$lte = endDate;
        }

        const pipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: '$userId',
                    totalScore: { $sum: '$points' },
                    gameCount: { $sum: 1 },
                    lastPlayedAt: { $max: '$createdAt' }
                }
            },
            { $sort: { totalScore: -1 } },
            { $skip: offset },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: {
                    path: '$user',
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    nickname: { $ifNull: ['$user.nickname', '$user.email', 'Unknown'] },
                    totalScore: 1,
                    gameCount: 1,
                    lastPlayedAt: 1
                }
            }
        ];

        return mongo.aggregate(this.client, this.collection, pipeline);
    }

    /**
     * Get date range for a period
     * @private
     */
    _getPeriodDateRange(period) {
        const now = new Date();

        switch (period) {
            case 'daily': {
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                return { startDate: startOfDay, endDate: endOfDay };
            }
            case 'weekly': {
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                return { startDate: startOfWeek, endDate: null };
            }
            case 'all_time':
            default:
                return { startDate: new Date(0), endDate: null };
        }
    }

    /**
     * Get user's rank in a specific leaderboard (computed from scores)
     */
    async getUserRank(userId, mode, period) {
        if (!MODES.includes(mode)) throw new HttpError(400, 'Invalid mode');
        if (!PERIODS.includes(period)) throw new HttpError(400, 'Invalid period');

        const objectId = mongo.getObjectId(userId);
        if (!objectId) throw new HttpError(400, 'Invalid userId');

        const { startDate, endDate } = this._getPeriodDateRange(period);
        const match = { mode, createdAt: { $gte: startDate } };
        if (endDate) {
            match.createdAt.$lte = endDate;
        }

        const userRows = await mongo.aggregate(this.client, this.collection, [
            { $match: { ...match, userId: objectId } },
            { $group: { _id: null, totalScore: { $sum: '$points' }, gameCount: { $sum: 1 } } }
        ]);

        if (userRows.length === 0) {
            return null;
        }

        const { totalScore, gameCount } = userRows[0];

        const higher = await mongo.aggregate(this.client, this.collection, [
            { $match: match },
            { $group: { _id: '$userId', totalScore: { $sum: '$points' } } },
            { $match: { totalScore: { $gt: totalScore } } },
            { $count: 'count' }
        ]);

        const rank = (higher.length > 0 ? higher[0].count : 0) + 1;

        return {
            rank,
            totalScore,
            gameCount,
            mode,
            period
        };
    }
}

module.exports = LeaderboardService;
