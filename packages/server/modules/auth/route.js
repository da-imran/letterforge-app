const express = require('express');
const { authRequired } = require('../../middleware/auth');

module.exports = (authService) => {
    const router = express.Router();

    // Register a new account
    router.post('/register', async (req, res, next) => {
        // #swagger.tags = ['auth']
        // #swagger.summary = 'Register a new account'
        try {
            const { email, nickname, password } = req.body || {};
            const result = await authService.register({ email, nickname, password });
            res.status(201).json(result);
        } catch (err) {
            next(err);
        }
    });

    // Login
    router.post('/login', async (req, res, next) => {
        // #swagger.tags = ['auth']
        // #swagger.summary = 'Log in and receive a token'
        try {
            const { email, password } = req.body || {};
            const result = await authService.login({ email, password });
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Current user
    router.get('/me', authRequired, async (req, res, next) => {
        // #swagger.tags = ['auth']
        // #swagger.summary = 'Get the authenticated user'
        try {
            const user = await authService.getUserById(req.userId);
            res.json(user);
        } catch (err) {
            next(err);
        }
    });

    return router;
};
