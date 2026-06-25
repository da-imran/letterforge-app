const express = require('express');

module.exports = (leaderboardService) => {
    const router = express.Router();

    /**
     * @swagger
     * /leaderboard:
     *   get:
     *     tags: [leaderboard]
     *     summary: Get leaderboard rankings
     *     description: Returns paginated leaderboard rankings for a specific mode and period
     *     parameters:
     *       - in: query
     *         name: mode
     *         required: true
     *         schema:
     *           type: string
     *           enum: [normal_mode, time_attack, survival_mode, chain_mode]
     *         description: Game mode
     *       - in: query
     *         name: period
     *         required: true
     *         schema:
     *           type: string
     *           enum: [daily, weekly, all_time]
     *         description: Leaderboard period
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of results
     *       - in: query
     *         name: offset
     *         schema:
     *           type: integer
     *           default: 0
     *         description: Pagination offset
     *     responses:
     *       200:
     *         description: Leaderboard data
     */
    router.get('/', async (req, res, next) => {
        try {
            const { mode, period, limit = 10, offset = 0 } = req.query;

            if (!mode || !period) {
                return res.status(400).json({ error: 'mode and period are required' });
            }

            const validModes = ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'];
            const validPeriods = ['daily', 'weekly', 'all_time'];

            if (!validModes.includes(mode)) {
                return res.status(400).json({ error: 'Invalid mode' });
            }

            if (!validPeriods.includes(period)) {
                return res.status(400).json({ error: 'Invalid period' });
            }

            const leaderboard = await leaderboardService.getLeaderboard({
                mode,
                period,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json(leaderboard);
        } catch (err) {
            next(err);
        }
    });

    /**
     * @swagger
     * /leaderboard/submit:
     *   post:
     *     tags: [leaderboard]
     *     summary: Submit game score
     *     description: Submit or update a user's score in the leaderboard
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               userId:
     *                 type: string
     *                 description: User's ObjectId
     *               mode:
     *                 type: string
     *                 enum: [normal_mode, time_attack, survival_mode, chain_mode]
     *               period:
     *                 type: string
     *                 enum: [daily, weekly, all_time]
     *               score:
     *                 type: integer
     *     responses:
     *       200:
     *         description: Score submitted successfully
     */
    router.post('/submit', async (req, res, next) => {
        try {
            const { userId, mode, period, score } = req.body || {};

            if (!userId || !mode || !period || score === undefined) {
                return res.status(400).json({
                    error: 'userId, mode, period, and score are required'
                });
            }

            if (typeof score !== 'number' || score < 0) {
                return res.status(400).json({ error: 'Score must be a non-negative number' });
            }

            const validModes = ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'];
            const validPeriods = ['daily', 'weekly', 'all_time'];

            if (!validModes.includes(mode)) {
                return res.status(400).json({ error: 'Invalid mode' });
            }

            if (!validPeriods.includes(period)) {
                return res.status(400).json({ error: 'Invalid period' });
            }

            const result = await leaderboardService.submitScore({
                userId,
                mode,
                period,
                score
            });

            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    /**
     * @swagger
     * /leaderboard/rank/{userId}:
     *   get:
     *     tags: [leaderboard]
     *     summary: Get user's rank
     *     description: Returns user's rank in a specific leaderboard
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: string
     *         description: User's ObjectId
     *       - in: query
     *         name: period
     *         required: true
     *         schema:
     *           type: string
     *           enum: [daily, weekly, all_time]
     *     responses:
     *       200:
     *         description: User rank data
     */
    router.get('/rank/:userId', async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { period } = req.query;

            if (!period) {
                return res.status(400).json({ error: 'period is required' });
            }

            const rank = await leaderboardService.getUserRank(userId, period);

            if (!rank) {
                return res.status(404).json({ error: 'User not found in leaderboard' });
            }

            res.json(rank);
        } catch (err) {
            next(err);
        }
    });

    /**
     * @swagger
     * /leaderboard/all:
     *   get:
     *     tags: [leaderboard]
     *     summary: Get all leaderboard data
     *     description: Returns all leaderboard rankings for all modes and periods in a single response
     *     parameters:
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of results per leaderboard
     *     responses:
     *       200:
     *         description: All leaderboard data
     */
    router.get('/all', async (req, res, next) => {
        try {
            const { limit = 10 } = req.query;
            const parsedLimit = parseInt(limit);

            const modes = ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'];
            const periods = ['daily', 'weekly', 'all_time'];

            const allLeaderboards = {};

            for (const mode of modes) {
                allLeaderboards[mode] = {};
                for (const period of periods) {
                    const leaderboard = await leaderboardService.getLeaderboard({
                        mode,
                        period,
                        limit: parsedLimit,
                        offset: 0
                    });
                    allLeaderboards[mode][period] = leaderboard;
                }
            }

            res.json(allLeaderboards);
        } catch (err) {
            next(err);
        }
    });

    return router;
};