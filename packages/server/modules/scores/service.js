const mongo = require('../../utilities/mongodb');

class ScoreService {
    constructor(client) {
        this.client = client;
        this.collection = 'scores';
    }

    /**
     * Create a new score entry
     * @param {Object} params
     * @param {string} params.userId - User's ObjectId as string
     * @param {string} params.gameId - Game's ObjectId as string
     * @param {string} params.mode - Game mode (normal_mode, time_attack)
     * @param {number} params.points - Points earned
     * @returns {Object} Created score entry
     */
    async createScore({ userId, gameId, mode, points }) {
        const score = {
            userId: mongo.getObjectId(userId),
            gameId: mongo.getObjectId(gameId),
            mode,
            points,
            createdAt: new Date(),
        };

        const result = await mongo.insertOne(this.client, this.collection, score);

        return {
            ...score,
            _id: result.insertedId,
        };
    }

    /**
     * Get all scores for a specific game
     * @param {string} gameId - Game's ObjectId as string
     * @returns {Array} Array of score entries
     */
    async getScoresByGameId(gameId) {
        const scores = await mongo.find(
            this.client,
            this.collection,
            { gameId: mongo.getObjectId(gameId) }
        );
        return scores;
    }

    /**
     * Get all scores for a specific user
     * @param {string} userId - User's ObjectId as string
     * @returns {Array} Array of score entries
     */
    async getScoresByUserId(userId) {
        const scores = await mongo.find(
            this.client,
            this.collection,
            { userId: mongo.getObjectId(userId) }
        );
        return scores;
    }

    /**
     * Get total score for a user within a specific mode and period
     * @param {string} userId - User's ObjectId as string
     * @param {string} mode - Game mode
     * @param {string} period - Period (daily, weekly, all_time)
     * @returns {Object} Total score and game count
     */
    async getTotalScoreByUser(userId, mode, period) {
        const { startDate, endDate } = this._getPeriodDateRange(period);

        const matchStage = {
            userId: mongo.getObjectId(userId),
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
            return { totalPoints: 0, gameCount: 0 };
        }

        return {
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
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));

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
}

module.exports = ScoreService;
