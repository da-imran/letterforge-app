const express = require('express');
const { authRequired, optionalAuth } = require('../../middleware/auth');

module.exports = (duelService) => {
    const router = express.Router();

    // Create a duel (challenger's game is created server-side)
    router.post('/', authRequired, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Create a duel'
        // #swagger.description = 'Creates a duel (optionally with a chosen code) and a game for the challenger with shared letters'
        try {
            const { opponentId = null, letterCount, code } = req.body || {};
            const duel = await duelService.createDuel({
                userId: req.userId,
                opponentId,
                letterCount,
                code,
            });
            res.status(201).json(duel);
        } catch (err) {
            next(err);
        }
    });

    // Fetch a duel by ID (with per-caller gameId when authenticated)
    router.get('/:duelId', optionalAuth, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Get a duel'
        // #swagger.description = 'Returns duel details including both players\' scores'
        try {
            const { duelId } = req.params;
            const duel = await duelService.getDuel(duelId, req.userId);
            res.json(duel);
        } catch (err) {
            next(err);
        }
    });

    // Enter a duel and get (or create) the caller's game
    router.post('/:duelId/enter', authRequired, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Enter a duel'
        // #swagger.description = 'Returns or creates the caller\'s game for the duel. An open duel\'s first joiner becomes the opponent.'
        try {
            const { duelId } = req.params;
            const result = await duelService.enterDuel(duelId, req.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Join a duel by invite code
    router.post('/join', authRequired, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Join a duel by code'
        // #swagger.description = 'Joins an open duel using its invite code and creates the caller\'s game'
        try {
            const { code } = req.body || {};
            const result = await duelService.enterDuelByCode(code, req.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Fetch a duel by invite code (public preview)
    router.get('/code/:code', optionalAuth, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Get a duel by code'
        // #swagger.description = 'Returns duel details for a given invite code'
        try {
            const { code } = req.params;
            const duel = await duelService.getDuelByCode(code, req.userId);
            res.json(duel);
        } catch (err) {
            next(err);
        }
    });

    // Start the duel for both players (admin picks the mode first)
    router.post('/:duelId/start', authRequired, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Start a duel'
        // #swagger.description = 'The creator selects a game mode and starts the duel; both players\' games are created together. Wawasan 2020 also needs `columns` (3-10 custom names).'
        try {
            const { duelId } = req.params;
            const { mode, columns } = req.body || {};
            const duel = await duelService.startDuel(duelId, req.userId, mode, { columns });
            res.json(duel);
        } catch (err) {
            next(err);
        }
    });

    // Submit answers for the open Wawasan 2020 row
    router.post('/:duelId/wawasan/answer', authRequired, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Submit Wawasan 2020 answers'
        // #swagger.description = 'Submits the caller\'s answers for the currently open letter row (empty string skips a column). Both players submitting closes the row.'
        try {
            const { duelId } = req.params;
            const { answers } = req.body || {};
            const duel = await duelService.submitWawasanAnswers(duelId, req.userId, answers);
            res.json(duel);
        } catch (err) {
            next(err);
        }
    });

    // Stop a Wawasan 2020 game (owner only, any time)
    router.post('/:duelId/wawasan/stop', authRequired, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Stop a Wawasan 2020 game'
        // #swagger.description = 'Only the duel creator can stop. The open row is discarded and totals are calculated from completed rows.'
        try {
            const { duelId } = req.params;
            const duel = await duelService.stopWawasan(duelId, req.userId);
            res.json(duel);
        } catch (err) {
            next(err);
        }
    });

    // Challenge (omit) a specific opponent answer during review
    router.post('/:duelId/wawasan/challenge', authRequired, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Challenge an opponent answer in Wawasan 2020'
        // #swagger.description = 'During the review phase, mark one of the opponent\'s column answers as invalid. The opponent scores 0 for that column; your own scoring is unaffected.'
        try {
            const { duelId } = req.params;
            const { columnIndex } = req.body || {};
            const duel = await duelService.challengeWawasanAnswer(duelId, req.userId, columnIndex);
            res.json(duel);
        } catch (err) {
            next(err);
        }
    });

    // Confirm the review phase is complete (both must confirm to advance)
    router.post('/:duelId/wawasan/confirm', authRequired, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Confirm Wawasan 2020 review phase'
        // #swagger.description = 'Signal that you\'ve finished reviewing the opponent\'s answers. When both players confirm, the round locks and the next letter opens.'
        try {
            const { duelId } = req.params;
            const duel = await duelService.confirmWawasanReview(duelId, req.userId);
            res.json(duel);
        } catch (err) {
            next(err);
        }
    });

    // Reset the shared letters for both players in a duel
    router.post('/:duelId/reset', authRequired, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Reset shared letters'
        // #swagger.description = 'Deals a fresh, identical set of letters to both players and notifies them live'
        try {
            const { duelId } = req.params;
            const duel = await duelService.resetLetters(duelId, req.userId);
            res.json(duel);
        } catch (err) {
            next(err);
        }
    });

    // Submit the caller's final score for a duel game
    router.post('/:duelId/submit', authRequired, async (req, res, next) => {
        // #swagger.tags = ['duels']
        // #swagger.summary = 'Submit a duel score'
        // #swagger.description = 'Records the caller\'s completed game score for the duel'
        try {
            const { duelId } = req.params;
            const { gameId } = req.body || {};

            if (!gameId) {
                return res.status(400).json({ status: 400, message: 'gameId is required' });
            }

            const duel = await duelService.submitScore(duelId, req.userId, gameId);
            res.json(duel);
        } catch (err) {
            next(err);
        }
    });

    return router;
};
