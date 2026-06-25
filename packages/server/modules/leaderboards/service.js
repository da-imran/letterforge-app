const mongo = require('../../utilities/mongodb');

class LeaderboardService {
    constructor(client) {
        this.client = client;
        this.collection = 'leaderboards';
    }

    /**
     * Submit or update a user's score in the leaderboard
     * @param {Object} params
     * @param {string} params.userId - User's ObjectId as string
     * @param {string} params.mode - Game mode (normal_mode, time_attack)
     * @param {string} params.period - Period (daily, weekly, all_time)
     * @param {number} params.score - Score to add
     * @returns {Object} Updated leaderboard entry
     */
    async submitScore({ userId, mode, period, score }) {
        const userObjectId = mongo.getObjectId(userId);
        const now = new Date();

        const existing = await mongo.findOne(
            this.client,
            this.collection,
            { userId: userObjectId, mode, period }
        );

        if (existing) {
            await mongo.findOneAndUpdateInc(
                this.client,
                this.collection,
                { userId: userObjectId, mode, period },
                { totalScore: score, gameCount: 1 },
            );

            await mongo.findOneAndUpdate(
                this.client,
                this.collection,
                { userId: userObjectId, mode, period },
                { lastPlayedAt: now, updatedAt: now }
            );

            const updated = await mongo.findOne(
                this.client,
                this.collection,
                { userId: userObjectId, mode, period }
            );

            return updated;
        } else {
            const newEntry = {
                userId: userObjectId,
                mode,
                period,
                totalScore: score,
                gameCount: 1,
                lastPlayedAt: now,
                createdAt: now,
                updatedAt: now
            };

            const result = await mongo.insertOne(this.client, this.collection, newEntry);
            return { ...newEntry, _id: result.insertedId };
        }
    }

    /**
     * Get leaderboard rankings (aggregated from scores collection)
     * @param {Object} params
     * @param {string} params.mode - Game mode
     * @param {string} params.period - Period (daily, weekly, all_time)
     * @param {number} params.limit - Number of results (default 10)
     * @param {number} params.offset - Pagination offset (default 0)
     * @returns {Array} Leaderboard entries with user info
     */
    async getLeaderboard({ mode, period, limit = 10, offset = 0 }) {
        const { startDate, endDate } = this._getPeriodDateRange(period);

        const matchStage = {
            mode,
            createdAt: { $gte: startDate }
        };

        if (endDate) {
            matchStage.createdAt.$lte = endDate;
        }

        const pipeline = [
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: '$userId',
                    totalScore: { $sum: '$points' },
                    gameCount: { $sum: 1 },
                    lastPlayedAt: { $max: '$createdAt' }
                }
            },
            {
                $sort: { totalScore: -1 }
            },
            {
                $skip: offset
            },
            {
                $limit: limit
            },
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
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    nickname: { $ifNull: ['$user.nickname', 'Unknown'] },
                    totalScore: 1,
                    gameCount: 1,
                    lastPlayedAt: 1
                }
            }
        ];

        const results = await mongo.aggregate(this.client, 'scores', pipeline);
        return results;
    }

    /**
     * Get date range for a period
     * @private
     */
    _getPeriodDateRange(period) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        switch (period) {
            case 'daily':
                return { startDate: startOfDay, endDate: endOfDay };
            case 'weekly':
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                return { startDate: startOfWeek, endDate: null };
            case 'all_time':
            default:
                return { startDate: new Date(0), endDate: null };
        }
    }

    /**
     * Get user's rank in a specific leaderboard
     * @param {string} userId - User's ObjectId as string
     * @param {string} mode - Game mode
     * @param {string} period - Period
     * @returns {Object|null} User's rank and score
     */
    async getUserRank(userId, period) {
        const userObjectId = mongo.getObjectId(userId);
        const now = new Date();

        let startDate;
        switch (period) {
            case 'daily':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'weekly':
                startDate = new Date(now.setDate(now.getDate() - now.getDay()));
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'all_time':
            default:
                startDate = new Date(0);
                break;
        }

        const userEntry = await mongo.findOne(
            this.client,
            this.collection,
            { userId: userObjectId }
        );

        if (!userEntry) {
            return null;
        }

        const higherRankCount = await mongo.aggregate(this.client, this.collection, [
            {
                $match: {
                    mode: userEntry.mode,
                    period: period,
                    totalScore: { $gt: userEntry.totalScore }
                }
            },
            {
                $count: 'count'
            }
        ]);

        const rank = (higherRankCount.length > 0 ? higherRankCount[0].count : 0) + 1;

        return {
            rank,
            totalScore: userEntry.totalScore,
            gameCount: userEntry.gameCount,
            mode: userEntry.mode,
            period
        };
    }

    /**
     * Reset daily leaderboard scores (called by scheduler)
     * @returns {Object} Delete result
     */
    async resetDaily() {
        const result = await mongo.deleteMany(
            this.client,
            this.collection,
            { period: 'daily' }
        );
        return result;
    }

    /**
     * Reset weekly leaderboard scores (called by scheduler)
     * @returns {Object} Delete result
     */
    async resetWeekly() {
        const result = await mongo.deleteMany(
            this.client,
            this.collection,
            { period: 'weekly' }
        );
        return result;
    }

    /**
     * Get a specific leaderboard entry for a user
     * @param {string} userId - User's ObjectId as string
     * @param {string} mode - Game mode
     * @param {string} period - Period
     * @returns {Object|null}
     */
    async getUserEntry(userId, mode, period) {
        const entry = await mongo.findOne(
            this.client,
            this.collection,
            {
                userId: mongo.getObjectId(userId),
                mode,
                period
            }
        );
        return entry;
    }
}

module.exports = LeaderboardService;
