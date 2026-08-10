const express = require('express');
const { authRequired } = require('../../middleware/auth');

module.exports = (milestoneService) => {
    const router = express.Router();

    // Initialize milestones (seed data)
    router.post('/initialize', async (req, res, next) => {
        // #swagger.tags = ['milestones']
        // #swagger.summary = 'Initialize milestones'
        // #swagger.description = 'Seed milestones data if not exists'
        try {
            const milestones = await milestoneService.initializeMilestones();
            res.json({ message: 'Milestones initialized', count: milestones.length });
        } catch (err) {
            next(err);
        }
    });

    // Get user's completed milestones (must come before /:milestoneId)
    router.get('/user/:userId', async (req, res, next) => {
        // #swagger.tags = ['milestones']
        // #swagger.summary = 'Get user milestones'
        // #swagger.description = 'Returns completed milestones for a user'
        try {
            const { userId } = req.params;
            const milestones = await milestoneService.getUserMilestones(userId);
            res.json(milestones);
        } catch (err) {
            next(err);
        }
    });

    // Get all milestones
    router.get('/', async (req, res, next) => {
        // #swagger.tags = ['milestones']
        // #swagger.summary = 'Get all milestones'
        // #swagger.description = 'Returns all milestone templates'
        try {
            const milestones = await milestoneService.getAllMilestones();
            res.json(milestones);
        } catch (err) {
            next(err);
        }
    });

    // Get milestone by ID
    router.get('/:milestoneId', async (_req, res, next) => {
        // #swagger.tags = ['milestones']
        // #swagger.summary = 'Get milestone by ID'
        // #swagger.description = 'Returns a specific milestone'
        try {
            const { milestoneId } = _req.params;
            const milestone = await milestoneService.getMilestoneById(milestoneId);
            if (!milestone) {
                return res.status(404).json({ status: 404, message: 'Milestone not found' });
            }
            res.json(milestone);
        } catch (err) {
            next(err);
        }
    });

    // Check and unlock milestones for user
    router.post('/check/:userId', authRequired, async (req, res, next) => {
        // #swagger.tags = ['milestones']
        // #swagger.summary = 'Check and unlock milestones'
        // #swagger.description = 'Check user stats and unlock any achieved milestones'
        try {
            const { userId } = req.params;
            if (req.userId !== userId) {
                return res.status(403).json({ status: 403, message: 'You can only check milestones for your own account' });
            }

            if (typeof milestoneService.statsProvider !== 'function') {
                return res.status(400).json({ status: 400, message: 'Milestone stats are not available' });
            }

            const stats = await milestoneService.statsProvider(userId);
            const newlyUnlocked = await milestoneService.checkAndUnlockMilestones(userId, stats);
            res.json({
                newlyUnlocked,
                count: newlyUnlocked.length
            });
        } catch (err) {
            next(err);
        }
    });

    return router;
};