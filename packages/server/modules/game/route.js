const express = require('express');

module.exports = (gameService, scoreService) => {
    const router = express.Router();

    router.post('/games', async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Create a new game'
        // #swagger.description = 'Creates a new game with auto-generated letterCount (3 or 4 randomly). Mode is required: normal_mode or time_attack.'
        const { mode, letters, userId } = req.body;

        try {
            const game = await gameService.createGame({ mode, letters, userId });
            res.status(201).json(game);
        } catch (err) {
            next(err);
        }
    });

    router.get('/games/:gameId', async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Load a game'
        // #swagger.description = 'Loads an existing game by its ID'
        try {
            const { gameId } = req.params;
            const game = await gameService.loadGame(gameId);
            res.json(game);
        } catch (err) {
            next(err);
        }
    });

    router.post('/games/:gameId/submit', async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Submit a word'
        // #swagger.description = 'Submits a word for a specific game'
        try {
            const body = req.body || {};
            const result = await gameService.submitWord(
                req.params.gameId,
                body.word
            );
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Reset letters for time-attack mode
    router.post('/games/:gameId/reset', async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Reset letters for time-attack mode'
        // #swagger.description = 'Generates new random letters and clears used words'
        try {
            const { gameId } = req.params;
            const { letterCount = 3 } = req.body || {};

            const result = await gameService.resetLetters(gameId, letterCount);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Complete the game
    router.post('/games/:gameId/complete', async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Complete the game'
        // #swagger.description = 'Marks the game as completed'
        try {
            const { gameId } = req.params;
            const result = await gameService.completeGame(gameId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Refill letter batch for batch-enabled modes
    router.post('/games/:gameId/batch', async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Refill letter batch'
        // #swagger.description = 'Generates a new batch of 10 letter sets for batch-enabled modes when current batch is nearly exhausted'
        try {
            const { gameId } = req.params;
            const result = await gameService.refillBatch(gameId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Get game result
    router.get('/games/:gameId/result', async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Get game result'
        // #swagger.description = 'Returns the final result of the game'
        try {
            const { gameId } = req.params;
            const result = await gameService.getGameResult(gameId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // Submit score to leaderboard
    router.post('/games/:gameId/leaderboard', async (req, res, next) => {
        // #swagger.tags = ['games']
        // #swagger.summary = 'Submit game score to leaderboard'
        // #swagger.description = 'Submits the final game score to the leaderboard'
        try {
            const { gameId } = req.params;
            const { period = 'all_time' } = req.body || {};

            // Get the game result first
            const gameResult = await gameService.getGameResult(gameId);

            if (!gameResult) {
                return res.status(404).json({ error: 'Game not found' });
            }

            if (!gameResult.isCompleted) {
                return res.status(400).json({ error: 'Game is not completed' });
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

    return router;
};
