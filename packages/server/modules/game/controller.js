const gameService = require('./service');

async function startGame(req, res, next) {
    try {
        const game = gameService.createGame(req.body);
        res.status(201).json(game);
    } catch (err) {
        next(err);
    }
}

async function submitWord(req, res, next) {
    try {
        const { gameId } = req.params;
        const result = gameService.submitWord(gameId, req.body.word);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

async function endGame(req, res, next) {
    try {
        const { gameId } = req.params;
        const result = gameService.endGame(gameId);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    startGame,
    submitWord,
    endGame,
};
