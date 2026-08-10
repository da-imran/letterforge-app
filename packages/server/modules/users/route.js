const express = require('express');
const { authRequired } = require('../../middleware/auth');

module.exports = (userService, gameService) => {
    const router = express.Router();

    // Create user (legacy email-only flow; prefer POST /auth/register)
    router.post('/', async (req, res, next) => {
        // #swagger.tags = ['users']
        // #swagger.summary = 'Create a new user'
        // #swagger.description = 'Creates a new user with the provided email'
        try {
            const { email, nickname } = req.body || {};

            if (!email) {
                return res.status(400).json({ status: 400, message: 'Email is required' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                return res.status(400).json({ status: 400, message: 'Invalid email format' });
            }

            const existingUser = await userService.getUserByEmail(email);
            if (existingUser) {
                return res.status(409).json({ status: 409, message: 'Email already exists' });
            }

            const user = await userService.createUser({ email, nickname });
            res.status(201).json(user);
        } catch (err) {
            next(err);
        }
    });

    // Get user by nickname
    router.get('/', async (req, res, next) => {
        // #swagger.tags = ['users']
        // #swagger.summary = 'Get user by nickname'
        try {
            const { nickname } = req.query;

            if (!nickname) {
                return res.status(400).json({ status: 400, message: 'nickname query parameter is required' });
            }

            const user = await userService.getUserByNickname(nickname);
            if (!user) {
                return res.status(404).json({ status: 404, message: 'User not found' });
            }

            res.json(user);
        } catch (err) {
            next(err);
        }
    });

    // Get user by ID
    router.get('/:userId', async (req, res, next) => {
        // #swagger.tags = ['users']
        // #swagger.summary = 'Get user by ID'
        try {
            const { userId } = req.params;
            const user = await userService.getUserById(userId);
            if (!user) {
                return res.status(404).json({ status: 404, message: 'User not found' });
            }
            res.json(user);
        } catch (err) {
            next(err);
        }
    });

    // Get aggregate stats for a user
    router.get('/:userId/stats', async (req, res, next) => {
        // #swagger.tags = ['users']
        // #swagger.summary = 'Get aggregate stats for a user'
        // #swagger.description = 'Returns per-mode total score and game count for completed games'
        try {
            const { userId } = req.params;
            const stats = await gameService.getUserStats(userId);
            res.json(stats);
        } catch (err) {
            next(err);
        }
    });

    // Update user (ownership required)
    router.put('/:userId', authRequired, async (req, res, next) => {
        // #swagger.tags = ['users']
        // #swagger.summary = 'Update user'
        try {
            const { userId } = req.params;
            const { nickname } = req.body || {};

            if (req.userId !== userId) {
                return res.status(403).json({ status: 403, message: 'You can only update your own account' });
            }

            if (nickname) {
                const existingUser = await userService.getUserByNickname(nickname);
                if (existingUser && existingUser._id.toString() !== userId) {
                    return res.status(409).json({ status: 409, message: 'Nickname already exists' });
                }
            }

            const user = await userService.updateUser(userId, { nickname });
            if (!user) {
                return res.status(404).json({ status: 404, message: 'User not found' });
            }

            res.json(user);
        } catch (err) {
            next(err);
        }
    });

    // Delete user (ownership required)
    router.delete('/:userId', authRequired, async (req, res, next) => {
        // #swagger.tags = ['users']
        // #swagger.summary = 'Delete user'
        try {
            const { userId } = req.params;

            if (req.userId !== userId) {
                return res.status(403).json({ status: 403, message: 'You can only delete your own account' });
            }

            const deleted = await userService.deleteUser(userId);
            if (!deleted) {
                return res.status(404).json({ status: 404, message: 'User not found' });
            }

            res.json({ message: 'User deleted successfully' });
        } catch (err) {
            next(err);
        }
    });

    return router;
};
