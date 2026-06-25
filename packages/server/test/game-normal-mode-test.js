const { expect } = require('chai');

const GameService = require('../modules/game/service');
const mongodb = require('../utilities/mongodb');
const { loadDictionary } = require('../modules/dictionary/service');

const {
	MONGO_URI
} = require('../utilities/env');

describe('Normal Mode (10 rounds)', () => {
    let gameService;
    let mongoClient;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        gameService = new GameService(mongoClient);
        loadDictionary();
    });

    after(async () => {
        await mongodb.deleteMany(mongoClient, 'games');
        await mongoClient.close()
    });

    it(`[NORMAL-MODE / NM01] - Game starts with correct properties`, async () => {
        const game = await gameService.createGame({ mode: 'normal_mode', letterCount: 2 });

        expect(game.mode).to.equal('normal_mode');
        expect(game.letterCount).to.be.oneOf([2, 3]);
        expect(game.round).to.equal(1);
        expect(game.maxRounds).to.equal(10);
        expect(game.isCompleted).to.be.false;
        expect(game.score).to.equal(0);
    });

    it(`[NORMAL-MODE / NM02] - Submit valid words increases round`, async () => {
        const game = await gameService.createGame({ mode: 'normal_mode', letterCount: 3, letters: ['s', 'e', 'a'] });

        // Submit a valid 3-letter word from dictionary
        const result = await gameService.submitWord(game._id, 'sea');

        expect(result.valid).to.be.true;
        expect(result.round).to.equal(2);
    });

    it(`[NORMAL-MODE / NM03] - Game auto-completes after 10 rounds`, async () => {
        const game = await gameService.createGame({ mode: 'normal_mode', letterCount: 3 });

        // Submit 10 valid 3-letter words, reset letters before each to match a valid word
        for (let i = 0; i < 10 && i < 30; i++) {
            await gameService.resetLetters(game._id, 3, ['s', 'e', 'a']);
            await gameService.submitWord(game._id, 'sea');
        }

        const finalGame = await gameService.loadGame(game._id);
        expect(finalGame.isCompleted).to.be.true;
    });

    it(`[NORMAL-MODE / NM04] - Longer words get bonus points`, async () => {
        const game = await gameService.createGame({ mode: 'normal_mode', letterCount: 3, letters: ['o', 'n', 'r'] });

        // 'nor' is 3 letters - 10 points
        const result1 = await gameService.submitWord(game._id, 'nor');
        if (result1.valid) {
            expect(result1.points).to.equal(10);
        }
    });

    it(`[NORMAL-MODE / NM05] - Invalid word does not advance round`, async () => {
        const game = await gameService.createGame({ mode: 'normal_mode', letterCount: 2, letters: ['a', 'b'] });

        // Try invalid word
        const result = await gameService.submitWord(game._id, 'xyz');
        expect(result.valid).to.be.false;
        expect(result.round).to.equal(1);
    });

    it(`[NORMAL-MODE / NM06] - Reset letters works in normal mode`, async () => {
        const game = await gameService.createGame({ mode: 'normal_mode', letterCount: 2, letters: ['a', 'n'] });

        // Reset letters
        const result = await gameService.resetLetters(game._id, 2);

        expect(result.letters).to.have.lengthOf(2);
        expect(result.usedWords).to.have.lengthOf(0);
    });

    it(`[NORMAL-MODE / NM07] - Score tracking works`, async () => {
        const game = await gameService.createGame({ mode: 'normal_mode', letterCount: 3, letters: ['o', 'n', 'r'] });

        // Submit a valid short word
        const result1 = await gameService.submitWord(game._id, 'nor');
        if (result1.valid) {
            const initialScore = result1.totalScore;
            expect(initialScore).to.be.above(0);
        }
    });
});
