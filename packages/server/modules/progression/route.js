const express = require('express');
const { authRequired } = require('../../middleware/auth');

module.exports = (progressionService) => {
    const router = express.Router();

    // Get a user's progression snapshot (XP, level, titles, power-ups)
    router.get('/:userId', async (req, res, next) => {
        // #swagger.tags = ['progression']
        // #swagger.summary = 'Get user progression'
        // #swagger.description = 'Returns XP, level, titles and power-ups for a user'
        try {
            const { userId } = req.params;
            const progression = await progressionService.getProgression(userId);
            res.json(progression);
        } catch (err) {
            next(err);
        }
    });

    // Consume a power-up (ownership required)
    router.post('/:userId/powerups/use', authRequired, async (req, res, next) => {
        // #swagger.tags = ['progression']
        // #swagger.summary = 'Use a power-up'
        // #swagger.description = 'Consumes a power-up owned by the authenticated user'
        try {
            const { userId } = req.params;
            const { type } = req.body || {};

            if (req.userId !== userId) {
                return res.status(403).json({ status: 403, message: 'You can only use your own power-ups' });
            }

            if (!type) {
                return res.status(400).json({ status: 400, message: 'type is required' });
            }

            const result = await progressionService.usePowerUp(userId, type);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    return router;
};
