const express = require('express');

module.exports = (scoreService) => {
    const router = express.Router();

    // Create a new score
    router.post('/', async (req, res, next) => {
        // #swagger.tags = ['scores']
        // #swagger.summary = 'Create a new score'
        try {
            const { userId, gameId, mode, points } = req.body || {};

            if (!userId || !gameId || !mode || points === undefined) {
                return res.status(400).json({ error: 'userId, gameId, mode, and points are required' });
            }

            if (typeof points !== 'number' || points < 0) {
                return res.status(400).json({ error: 'Points must be a non-negative number' });
            }

            const validModes = ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'];
            if (!validModes.includes(mode)) {
                return res.status(400).json({ error: 'Invalid mode' });
            }

            const score = await scoreService.createScore({ userId, gameId, mode, points });
            res.status(201).json(score);
        } catch (err) {
            next(err);
        }
    });

    // Get scores by game ID
    router.get('/game/:gameId', async (req, res, next) => {
        // #swagger.tags = ['scores']
        // #swagger.summary = 'Get scores by game ID'
        try {
            const { gameId } = req.params;
            const scores = await scoreService.getScoresByGameId(gameId);
            res.json(scores);
        } catch (err) {
            next(err);
        }
    });

    // Get scores by user ID
    router.get('/user/:userId', async (req, res, next) => {
        // #swagger.tags = ['scores']
        // #swagger.summary = 'Get scores by user ID'
        try {
            const { userId } = req.params;
            const scores = await scoreService.getScoresByUserId(userId);
            res.json(scores);
        } catch (err) {
            next(err);
        }
    });

    // Get total score by user
    router.get('/user/:userId/total', async (req, res, next) => {
        // #swagger.tags = ['scores']
        // #swagger.summary = 'Get total score by user'
        try {
            const { userId } = req.params;
            const { mode, period } = req.query;

            if (!mode || !period) {
                return res.status(400).json({ error: 'mode and period query parameters are required' });
            }

            const validModes = ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'];
            const validPeriods = ['daily', 'weekly', 'all_time'];

            if (!validModes.includes(mode)) {
                return res.status(400).json({ error: 'Invalid mode' });
            }

            if (!validPeriods.includes(period)) {
                return res.status(400).json({ error: 'Invalid period' });
            }

            const result = await scoreService.getTotalScoreByUser(userId, mode, period);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    return router;
};
