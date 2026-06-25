const { expect } = require('chai');
const sinon = require('sinon');

const GameService = require('../modules/game/service');
const mongodb = require('../utilities/mongodb');
const { loadDictionary } = require('../modules/dictionary/service');

const {
	MONGO_URI
} = require('../utilities/env');

describe('Time Attack Mode (30s)', () => {
    let gameService;
    let mongoClient;
    let clock;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        gameService = new GameService(mongoClient);
        loadDictionary();
    });

    beforeEach(() => {
        clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
    });

    afterEach( async () => {
        if (clock) clock.restore();
    });

    after(async () => {
        await mongodb.deleteMany(mongoClient, 'games');
        await mongoClient.close();
    });

    async function submitWithReset(game, words) {
        const results = [];
        for (const word of words) {
            clock.tick(100);
            // Reset to keep letters valid for the word
            await gameService.resetLetters(game._id, 2);
            const res = await gameService.submitWord(game._id, word);
            results.push(res);
        }
        return results;
    }

    it('[TIME-ATTACK / TA01] - Game has correct properties', async () => {
        const game = await gameService.createGame({ mode: 'time_attack', letterCount: 2, letters: ['a', 'e'] });

        expect(game.mode).to.equal('time_attack');
        expect(game.round).to.equal(1);
        expect(game.maxRounds).to.be.null;
        expect(game.expiresAt).to.be.not.null;
    });

    it('[TIME-ATTACK / TA02] - Submit words within time limit', async () => {
        const game = await gameService.createGame({ mode: 'time_attack', letterCount: 3, letters: ['s', 'e', 'a'] });

        // Submit a valid 3-letter word from dictionary
        const result1 = await gameService.submitWord(game._id, 'sea');
        expect(result1.valid).to.be.true;
    });

    it('[TIME-ATTACK / TA03] - Rejects submissions after time expired', async () => {
        const game = await gameService.createGame({ mode: 'time_attack', letterCount: 2, letters: ['a', 'e'] });
        clock.tick(60_001);

        let errorThrown = false;
        try {
            await gameService.submitWord(game._id, 'ea');
        } catch (err) {
            errorThrown = true;
            expect(err.message).to.equal('Game expired');
        }
        expect(errorThrown).to.be.true;
    });

    it('[TIME-ATTACK / TA04] - Reset letters works in time attack', async () => {
        const game = await gameService.createGame({ mode: 'time_attack', letterCount: 2, letters: ['a', 'e'] });

        const result = await gameService.resetLetters(game._id, 2);

        expect(result.letters).to.have.lengthOf(2);
        expect(result.usedWords).to.have.lengthOf(0);
    });

});
