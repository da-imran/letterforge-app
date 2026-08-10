const mongo = require('../../utilities/mongodb');
const { HttpError } = require('../../utilities/http-error');
const { MODES, PERIODS } = require('../../utilities/constant');

class ScoreService {
    constructor(client) {
        this.client = client;
        this.collection = 'scores';
        this.onCreated = null;
    }

    /**
     * Create a new score entry. Idempotent per game: submitting the same game
     * twice returns the existing row instead of double-counting. Fires
     * `onCreated` (a cache-invalidation hook) whenever a new row is inserted.
     */
    async createScore({ userId, gameId, mode, points }) {
        const userObjectId = mongo.getObjectId(userId);
        const gameObjectId = mongo.getObjectId(gameId);
        if (!userObjectId) throw new HttpError(400, 'Invalid userId');
        if (!gameObjectId) throw new HttpError(400, 'Invalid gameId');

        const score = {
            userId: userObjectId,
            gameId: gameObjectId,
            mode,
            points,
            createdAt: new Date(),
        };

        const existing = await mongo.findOne(this.client, this.collection, { gameId: gameObjectId });
        if (existing) {
            return existing;
        }

        try {
            const result = await mongo.insertOne(this.client, this.collection, score);
            if (typeof this.onCreated === 'function') {
                this.onCreated(mode);
            }
            return {
                ...score,
                _id: result.insertedId,
            };
        } catch (err) {
            // Concurrent submission for the same game: the unique gameId index
            // makes the second insert collide (E11000). Return the winner's row.
            if (err && err.code === 11000) {
                const winner = await mongo.findOne(this.client, this.collection, { gameId: gameObjectId });
                if (winner) return winner;
            }
            throw err;
        }
    }

    /**
     * Get all scores for a specific game
     */
    async getScoresByGameId(gameId) {
        const objectId = mongo.getObjectId(gameId);
        if (!objectId) throw new HttpError(400, 'Invalid gameId');
        return mongo.find(this.client, this.collection, { gameId: objectId });
    }

    /**
     * Get all scores for a specific user
     */
    async getScoresByUserId(userId) {
        const objectId = mongo.getObjectId(userId);
        if (!objectId) throw new HttpError(400, 'Invalid userId');
        return mongo.find(this.client, this.collection, { userId: objectId });
    }

    /**
     * Get total score for a user within a specific mode and period
     */
    async getTotalScoreByUser(userId, mode, period) {
        const objectId = mongo.getObjectId(userId);
        if (!objectId) throw new HttpError(400, 'Invalid userId');
        if (!MODES.includes(mode)) throw new HttpError(400, 'Invalid mode');
        if (!PERIODS.includes(period)) throw new HttpError(400, 'Invalid period');

        const { startDate, endDate } = this._getPeriodDateRange(period);

        const matchStage = {
            userId: objectId,
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
                    _id: null,
                    totalPoints: { $sum: '$points' },
                    gameCount: { $sum: 1 }
                }
            }
        ];

        const results = await mongo.aggregate(this.client, this.collection, pipeline);

        if (results.length === 0) {
            return { totalScore: 0, totalPoints: 0, gameCount: 0 };
        }

        return {
            totalScore: results[0].totalPoints,
            totalPoints: results[0].totalPoints,
            gameCount: results[0].gameCount
        };
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
}

module.exports = ScoreService;
