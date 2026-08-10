const express = require('express');
const { optionalAuth, authRequired } = require('../../middleware/auth');
const { PERIODS } = require('../../utilities/constant');
const { getTodayChallenge } = require('../../utilities/daily-challenge');

module.exports = (gameService, scoreService) => {
    const router = express.Router();

    // Daily challenge: today's shared clue (the answer word is never exposed).
    router.get('/challenge/today', async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Get today\'s daily challenge'
        // #swagger.description = 'Returns the meaning clue and attempt count for today\'s daily challenge'
        try {
            const { word, ...publicChallenge } = getTodayChallenge();
            res.json(publicChallenge);
        } catch (err) {
            next(err);
        }
    });

    router.post('/games', optionalAuth, async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Create a new game'
        // #swagger.description = 'Creates a new game with auto-generated letters. Mode is required.'
        const { mode, letters, letterCount } = req.body;

        try {
            // Authenticated users are bound to their own account; anonymous
            // callers create ownerless guest games. A client-supplied userId is
            // never trusted.
            const userId = req.userId || null;
            const game = await gameService.createGame({ mode, letters, letterCount, userId });
            res.status(201).json(game);
        } catch (err) {
            next(err);
        }
    });

    router.get('/games/:gameId', optionalAuth, async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Load a game'
        // #swagger.description = 'Loads an existing game by its ID'
        try {
            const { gameId } = req.params;
            const game = await gameService.loadGame(gameId, req.userId);
            res.json(gameService.toPublicGame(game));
        } catch (err) {
            next(err);
        }
    });

    router.post('/games/:gameId/submit', optionalAuth, async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Submit a word'
        // #swagger.description = 'Submits a word for a specific game'
        try {
            const body = req.body || {};
            const result = await gameService.submitWord(
                req.params.gameId,
                body.word,
                req.userId
            );
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Reset letters for time-attack mode
    router.post('/games/:gameId/reset', optionalAuth, async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Reset letters for time-attack mode'
        // #swagger.description = 'Generates new random letters and clears used words'
        try {
            const { gameId } = req.params;
            const { letterCount = null } = req.body || {};

            const result = await gameService.resetLetters(gameId, letterCount, null, req.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Complete the game
    router.post('/games/:gameId/complete', optionalAuth, async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Complete the game'
        // #swagger.description = 'Marks the game as completed'
        try {
            const { gameId } = req.params;
            const result = await gameService.completeGame(gameId, req.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Refill letter batch for batch-enabled modes
    router.post('/games/:gameId/batch', optionalAuth, async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Refill letter batch'
        // #swagger.description = 'Generates a new batch of 10 letter sets for batch-enabled modes when current batch is nearly exhausted'
        try {
            const { gameId } = req.params;
            const result = await gameService.refillBatch(gameId, req.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Get game result
    router.get('/games/:gameId/result', optionalAuth, async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Get game result'
        // #swagger.description = 'Returns the final result of the game'
        try {
            const { gameId } = req.params;
            const result = await gameService.getGameResult(gameId, req.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Submit score to leaderboard
    router.post('/games/:gameId/leaderboard', authRequired, async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Submit game score to leaderboard'
        // #swagger.description = 'Submits the final game score to the leaderboard'
        try {
            const { gameId } = req.params;
            const { period = 'all_time' } = req.body || {};

            if (!PERIODS.includes(period)) {
                return res.status(400).json({ status: 400, message: 'Invalid period', requestId: req.id });
            }

            const gameResult = await gameService.getGameResult(gameId, req.userId);

            if (!gameResult.isCompleted) {
                return res.status(400).json({ status: 400, message: 'Game is not completed', requestId: req.id });
            }

            if (!gameResult.userId || gameResult.userId.toString() !== req.userId) {
                return res.status(403).json({ status: 403, message: 'You can only submit your own scores', requestId: req.id });
            }

            // Submit to scores collection (leaderboard aggregates from this)
            const score = await scoreService.createScore({
                userId: gameResult.userId,
                gameId: gameId,
                mode: gameResult.mode,
                points: gameResult.score
            });

            res.json({
                message: 'Score submitted to leaderboard',
                score: score
            });
        } catch (err) {
            next(err);
        }
    });

    // Delete game (abandoned games with no submissions)
    router.delete('/games/:gameId', optionalAuth, async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Delete a game'
        // #swagger.description = 'Permanently deletes an in-progress game. Completed games cannot be deleted.'
        try {
            const { gameId } = req.params;
            const result = await gameService.deleteGame(gameId, req.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    return router;
};
