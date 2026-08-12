const { expect } = require('chai');

const GameService = require('../modules/game/service');
const mongodb = require('../utilities/mongodb');
const { loadDictionary } = require('../modules/dictionary/service');

const { MONGO_URI } = require('../utilities/env');

describe('Fade Mode (memorize the fading letters)', () => {
    let gameService;
    let mongoClient;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        gameService = new GameService(mongoClient);
        loadDictionary();
    });

    after(async () => {
        await mongodb.deleteMany(mongoClient, 'games');
        await mongoClient.close();
    });

    it('[FADE / FM01] - Game starts with correct properties', async () => {
        const game = await gameService.createGame({ mode: 'fade_mode' });

        expect(game.mode).to.equal('fade_mode');
        expect(game.letterCount).to.equal(3);
        expect(game.round).to.equal(1);
        expect(game.maxRounds).to.equal(10);
        expect(game.expiresAt).to.be.null;
        expect(game.lives).to.be.null;
        expect(game.isCompleted).to.be.false;
        expect(game.score).to.equal(0);
    });

    it('[FADE / FM02] - Fade mode is batch-enabled with a letter batch', async () => {
        const game = await gameService.createGame({ mode: 'fade_mode' });

        expect(game.letterBatch).to.be.an('array').with.lengthOf(10);
        expect(game.batchIndex).to.equal(0);
        expect(game.letters).to.deep.equal(game.letterBatch[0]);
    });

    it('[FADE / FM03] - Submit valid word increases round and scores points', async () => {
        const game = await gameService.createGame({ mode: 'fade_mode', letters: ['s', 'e', 'a'] });

        const result = await gameService.submitWord(game._id, 'sea');

        expect(result.valid).to.be.true;
        expect(result.points).to.equal(10);
        expect(result.round).to.equal(2);
        expect(result.totalScore).to.equal(10);
    });

    it('[FADE / FM04] - Longer words earn bonus points (same scoring)', async () => {
        const game = await gameService.createGame({ mode: 'fade_mode', letters: ['p', 'r', 'e', 't', 't', 'y'] });

        const result = await gameService.submitWord(game._id, 'pretty');

        expect(result.valid).to.be.true;
        expect(result.points).to.equal(15);
    });

    it('[FADE / FM05] - Invalid word does not advance round', async () => {
        const game = await gameService.createGame({ mode: 'fade_mode', letters: ['a', 'b', 'c'] });

        const result = await gameService.submitWord(game._id, 'xyz');

        expect(result.valid).to.be.false;
        expect(result.reason).to.equal('invalid_word');
        expect(result.round).to.equal(1);
        expect(result.totalScore).to.equal(0);
    });

    it('[FADE / FM06] - Duplicate word does not advance round', async () => {
        // Use a predetermined batch so the letters stay the same across rounds,
        // letting the pre-existing submission surface as a duplicate.
        const sameLetters = ['t', 'e', 's', 't'];
        const game = await gameService.createGame({
            mode: 'fade_mode',
            letters: sameLetters,
            letterBatch: Array.from({ length: 10 }, () => sameLetters),
        });

        await gameService.submitWord(game._id, 'test');
        const result = await gameService.submitWord(game._id, 'test');

        expect(result.valid).to.be.false;
        expect(result.reason).to.equal('duplicate');
        expect(result.round).to.equal(2);
        expect(result.totalScore).to.equal(10);
    });

    it('[FADE / FM07] - Game auto-completes after 10 rounds', async () => {
        const game = await gameService.createGame({ mode: 'fade_mode' });

        for (let i = 0; i < 10; i++) {
            await gameService.resetLetters(game._id, 3, ['s', 'e', 'a']);
            await gameService.submitWord(game._id, 'sea');
        }

        const finalGame = await gameService.loadGame(game._id);
        expect(finalGame.isCompleted).to.be.true;
        expect(finalGame.round).to.equal(11);
    });

    it('[FADE / FM08] - Reset letters works in fade mode', async () => {
        const game = await gameService.createGame({ mode: 'fade_mode', letters: ['a', 'n'] });

        const result = await gameService.resetLetters(game._id, 2);

        expect(result.letters).to.have.lengthOf(2);
        expect(result.usedWords).to.have.lengthOf(0);
    });

    it('[FADE / FM09] - Refill batch works in fade mode', async () => {
        const game = await gameService.createGame({ mode: 'fade_mode' });

        const result = await gameService.refillBatch(game._id);

        expect(result.letterBatch).to.be.an('array').with.lengthOf(10);
        expect(result.batchIndex).to.equal(0);
        expect(result.letters).to.deep.equal(result.letterBatch[0]);
    });

    it('[FADE / FM10] - Completed fade games count toward fade_mode stats', async () => {
        const userId = '000000000000000000000001';
        const game = await gameService.createGame({ mode: 'fade_mode', userId });

        await gameService.completeGame(game._id, userId);

        const stats = await gameService.getUserStats(userId);
        expect(stats.fade_mode.gameCount).to.equal(1);
        expect(stats.fade_mode.totalScore).to.equal(0);
    });

    it('[FADE / FM11] - Invalid mode is still rejected', async () => {
        let errorThrown = false;
        try {
            await gameService.createGame({ mode: 'not_a_mode' });
        } catch (err) {
            errorThrown = true;
            expect(err.status).to.equal(400);
        }
        expect(errorThrown).to.be.true;
    });
});
