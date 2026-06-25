const express = require('express');

module.exports = (userService) => {
    const router = express.Router();

    // Create user
    router.post('/', async (req, res, next) => {
        // #swagger.tags = ['users']
        // #swagger.summary = 'Create a new user'
        // #swagger.description = 'Creates a new user with the provided email'
        /* #swagger.security = [] */
        try {
            const { email, nickname } = req.body || {};

            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            const existingUser = await userService.getUserByEmail(email);
            if (existingUser) {
                return res.status(409).json({ error: 'Email already exists' });
            }

            const user = await userService.createUser({ email, nickname });
            res.status(201).json(user);
        } catch (err) {
            next(err);
        }
    });

    // Get user by email
    router.get('/', async (req, res, next) => {
        // #swagger.tags = ['users']
        // #swagger.summary = 'Get user by email'
        // #swagger.description = 'Returns a user by their email'
        try {
            const { email } = req.query;

            if (!email) {
                return res.status(400).json({ error: 'Email query parameter is required' });
            }

            const user = await userService.getUserByEmail(email);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
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
        // #swagger.description = 'Returns a user by their ID'
        try {
            const { userId } = req.params;

            const user = await userService.getUserById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(user);
        } catch (err) {
            next(err);
        }
    });

    // Update user
    router.put('/:userId', async (req, res, next) => {
        // #swagger.tags = ['users']
        // #swagger.summary = 'Update user'
        // #swagger.description = 'Updates a user\'s information'
        try {
            const { userId } = req.params;
            const { nickname } = req.body || {};

            if (nickname) {
                const existingUser = await userService.getUserByNickname(nickname);
                if (existingUser && existingUser._id.toString() !== userId) {
                    return res.status(409).json({ error: 'Nickname already exists' });
                }
            }

            const user = await userService.updateUser(userId, { nickname });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(user);
        } catch (err) {
            next(err);
        }
    });

    // Delete user
    router.delete('/:userId', async (req, res, next) => {
        // #swagger.tags = ['users']
        // #swagger.summary = 'Delete user'
        // #swagger.description = 'Deletes a user by their ID'
        try {
            const { userId } = req.params;

            const deleted = await userService.deleteUser(userId);
            if (!deleted) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ message: 'User deleted successfully' });
        } catch (err) {
            next(err);
        }
    });

    return router;
};
