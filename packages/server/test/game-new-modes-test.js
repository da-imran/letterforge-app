const { expect } = require('chai');

const GameService = require('../modules/game/service');
const mongodb = require('../utilities/mongodb');
const { loadDictionary } = require('../modules/dictionary/service');
const { getWordsContainingLetters, words } = require('./helper/dictionary-helper');

const { MONGO_URI } = require('../utilities/env');

// Get some valid 4-letter words for testing
const FOUR_LETTER_WORDS = ['sand', 'area', 'care', 'date', 'ease', 'fame', 'gate', 'have', 'item', 'jazz', 'keep'];
const FIVE_LETTER_WORDS = ['about', 'brick', 'cabin', 'daily', 'eagle', 'fairy', 'glass', 'heart', 'ideal', 'jewel'];

describe('Endless Mode (lives)', () => {
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

    it('[SURVIVAL / SV01] - Game starts with 5 lives', async () => {
        const game = await gameService.createGame({ mode: 'survival_mode' });

        expect(game.mode).to.equal('survival_mode');
        expect(game.lives).to.equal(5);
        expect(game.maxLives).to.equal(5);
        expect(game.letterCount).to.equal(4);
        expect(game.maxRounds).to.be.null;
    });

    it('[SURVIVAL / SV02] - Invalid word costs 1 life', async () => {
        const game = await gameService.createGame({ mode: 'survival_mode', letters: ['t', 'e', 's', 't'] });
        const initialLives = game.lives;

        const result = await gameService.submitWord(game._id, 'invalid');

        expect(result.valid).to.be.false;
        expect(result.reason).to.equal('invalid_word');
        expect(result.lives).to.equal(initialLives - 1);
    });

    it('[SURVIVAL / SV03] - Valid word restores 1 life (capped at max)', async () => {
        const game = await gameService.createGame({ mode: 'survival_mode', letters: ['t', 'e', 's', 't'] });

        // Lose a life first
        await gameService.submitWord(game._id, 'invalid');

        const gameAfterLoss = await gameService.loadGame(game._id);
        const livesAfterLoss = gameAfterLoss.lives;

        // Submit a valid word with matching letters
        await gameService.resetLetters(game._id, 4, ['t', 'e', 's', 't']);
        await gameService.submitWord(game._id, 'test');

        const gameAfterRestore = await gameService.loadGame(game._id);
        expect(gameAfterRestore.lives).to.equal(Math.min(5, livesAfterLoss + 1));
    });

    it('[SURVIVAL / SV04] - Game ends when lives reach 0', async () => {
        const game = await gameService.createGame({ mode: 'survival_mode', letters: ['t', 'e', 's', 't'] });

        // Lose all 5 lives
        for (let i = 0; i < 5; i++) {
            await gameService.submitWord(game._id, 'invalid');
        }

        const result = await gameService.loadGame(game._id);
        expect(result.isCompleted).to.be.true;
        expect(result.lives).to.equal(0);
    });

    it('[SURVIVAL / SV05] - Cannot submit word when lives are 0', async () => {
        const game = await gameService.createGame({ mode: 'survival_mode', letters: ['t', 'e', 's', 't'] });

        // Lose all lives
        for (let i = 0; i < 5; i++) {
            await gameService.submitWord(game._id, 'invalid');
        }

        // Try to submit more words - should trigger no_lives on each submission check
        let errorThrown = false;
        try {
            await gameService.submitWord(game._id, 'test');
        } catch (err) {
            errorThrown = true;
            expect(err.message).to.equal('Game is already completed');
        }
        expect(errorThrown).to.be.true;
    });

    it('[SURVIVAL / SV06] - Life restoration caps at maxLives', async () => {
        const game = await gameService.createGame({ mode: 'survival_mode', letters: ['t', 'e', 's', 't'] });

        // Submit 6 valid words - should only get 5 lives max
        for (let i = 0; i < 6; i++) {
            await gameService.resetLetters(game._id, 4, ['t', 'e', 's', 't']);
            await gameService.submitWord(game._id, 'test');
        }

        const result = await gameService.loadGame(game._id);
        expect(result.lives).to.equal(5);
    });
});

describe('Chain Mode (letter linking)', () => {
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

    it('[CHAIN / CH01] - Game starts with no lastLetter', async () => {
        const game = await gameService.createGame({ mode: 'chain_mode' });

        expect(game.mode).to.equal('chain_mode');
        expect(game.lastLetter).to.be.null;
        expect(game.letterCount).to.equal(2);
        expect(game.maxRounds).to.equal(10);
    });

    it('[CHAIN / CH02] - Words are accepted when no lastLetter (first word)', async () => {
        const game = await gameService.createGame({ mode: 'chain_mode', letters: ['t', 'e', 's', 't'] });

        const result = await gameService.submitWord(game._id, 'test');

        expect(result.valid).to.be.true;
        expect(result.lastLetter).to.equal('t');
    });

    it('[CHAIN / CH03] - Word must start with previous word\'s last letter', async () => {
        const game = await gameService.createGame({ mode: 'chain_mode', letters: ['t', 'e', 's', 't'] });

        // First word 'test' ends with 't'
        let result = await gameService.submitWord(game._id, 'test');
        expect(result.valid).to.be.true;
        expect(result.lastLetter).to.equal('t');

        // Second word must start with 't' - 'tear' starts with 't' and ends with 'r'
        await gameService.resetLetters(game._id, 4, ['t', 'e', 'a', 'r']);
        result = await gameService.submitWord(game._id, 'tear');

        expect(result.valid).to.be.true;
        expect(result.lastLetter).to.equal('r');
    });

    it('[CHAIN / CH04] - Rejects word that breaks the chain', async () => {
        const game = await gameService.createGame({ mode: 'chain_mode', letters: ['t', 'e', 's', 't'] });

        // First word ends with 't'
        await gameService.submitWord(game._id, 'test');

        // Second word starts with 'x' - should fail
        const failWord = words.find(w => w.length === 4 && !w.startsWith('t'));
        if (failWord) {
            await gameService.resetLetters(game._id, 4, failWord.split(''));
            const result = await gameService.submitWord(game._id, failWord);

            expect(result.valid).to.be.false;
            expect(result.reason).to.equal('break_chain');
        }
    });

    it('[CHAIN / CH05] - Chain continues through multiple words', async () => {
        const game = await gameService.createGame({ mode: 'chain_mode', letters: ['t', 'e', 's', 't'] });

        // First: 'test' -> ends with 't'
        let result = await gameService.submitWord(game._id, 'test');
        expect(result.lastLetter).to.equal('t');

        // Second: 'tops' -> starts with 't', ends with 's'
        await gameService.resetLetters(game._id, 4, ['t', 'o', 'p', 's']);
        result = await gameService.submitWord(game._id, 'tops');
        expect(result.valid).to.be.true;
        expect(result.lastLetter).to.equal('s');

        // Third: 'stop' -> starts with 's', ends with 'p'
        await gameService.resetLetters(game._id, 4, ['s', 't', 'o', 'p']);
        result = await gameService.submitWord(game._id, 'stop');
        expect(result.valid).to.be.true;
        expect(result.lastLetter).to.equal('p');
    });

    it('[CHAIN / CH06] - Game auto-completes after maxRounds', async () => {
        const game = await gameService.createGame({ mode: 'chain_mode', letters: ['t', 'e', 's', 't'] });

        // Submit maxRounds (10) valid words
        for (let i = 0; i < 10; i++) {
            await gameService.resetLetters(game._id, 4, ['t', 'e', 's', 't']);
            await gameService.submitWord(game._id, 'test');
        }

        const result = await gameService.loadGame(game._id);
        expect(result.isCompleted).to.be.true;
        expect(result.round).to.equal(11);
    });

    it('[CHAIN / CH07] - round counter increments with each valid submission', async () => {
        const game = await gameService.createGame({ mode: 'chain_mode', letters: ['t', 'e', 's', 't'] });

        let result = await gameService.submitWord(game._id, 'test');
        expect(result.round).to.equal(2);
        expect(result.lastLetter).to.equal('t');

        await gameService.resetLetters(game._id, 4, ['t', 'o', 'p', 's']);
        result = await gameService.submitWord(game._id, 'tops');
        expect(result.round).to.equal(3);
        expect(result.lastLetter).to.equal('s');
    });
});

