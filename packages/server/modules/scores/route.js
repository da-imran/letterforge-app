const express = require('express');
const { authRequired, optionalAuth } = require('../../middleware/auth');
const { MODES } = require('../../utilities/constant');

module.exports = (scoreService) => {
    const router = express.Router();

    // Create a new score (authenticated users are bound to their own account)
    router.post('/', authRequired, async (req, res, next) => {
        // #swagger.tags = ['scores']
        // #swagger.summary = 'Create a new score'
        try {
            const { userId, gameId, mode, points } = req.body || {};

            if (userId && userId !== req.userId) {
                return res.status(403).json({ status: 403, message: 'You can only submit scores for your own account' });
            }

            if (!gameId || !mode || points === undefined) {
                return res.status(400).json({ status: 400, message: 'userId, gameId, mode, and points are required' });
            }

            if (typeof points !== 'number' || points < 0) {
                return res.status(400).json({ status: 400, message: 'Points must be a non-negative number' });
            }

            if (!MODES.includes(mode)) {
                return res.status(400).json({ status: 400, message: 'Invalid mode' });
            }

            const score = await scoreService.createScore({ userId: req.userId, gameId, mode, points });
            res.status(201).json(score);
        } catch (err) {
            next(err);
        }
    });

    // Get scores by game ID
    router.get('/game/:gameId', optionalAuth, async (req, res, next) => {
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
                return res.status(400).json({ status: 400, message: 'mode and period query parameters are required' });
            }

            const result = await scoreService.getTotalScoreByUser(userId, mode, period);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    return router;
};
