const { expect } = require('chai');

const GameService = require('../modules/game/service');
const UserService = require('../modules/users/service');
const mongodb = require('../utilities/mongodb');
const { loadDictionary } = require('../modules/dictionary/service');
const {
    getDateKey,
    buildDailyPool,
    getTodayChallenge,
} = require('../utilities/daily-challenge');

const {
    MONGO_URI,
} = require('../utilities/env');

describe('Daily Challenge', () => {
    let gameService;
    let userService;
    let mongoClient;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        gameService = new GameService(mongoClient);
        userService = new UserService(mongoClient);
        loadDictionary();
    });

    after(async () => {
        await mongodb.deleteMany(mongoClient, 'games');
        await mongodb.deleteMany(mongoClient, 'users');
        await mongoClient.close();
    });

    it('[DAILY / DC01] - Today\'s challenge is deterministic and has a word + clue', () => {
        const a = getTodayChallenge();
        const b = getTodayChallenge();

        expect(a.date).to.equal(getDateKey());
        expect(a.word).to.be.a('string');
        expect(a.clue).to.be.a('string');
        expect(a.attempts).to.equal(5);
        expect(a).to.deep.equal(b);
    });

    it('[DAILY / DC02] - The answer word comes from the daily pool', () => {
        const challenge = getTodayChallenge();
        const pool = buildDailyPool();

        expect(pool.length).to.be.greaterThan(1000);
        expect(pool.some(e => e.word === challenge.word)).to.be.true;
        const entry = pool.find(e => e.word === challenge.word);
        expect(entry.meanings).to.be.an('array');
        expect(entry.meanings).to.include(challenge.clue);
        expect(challenge.meanings).to.deep.equal(entry.meanings);
    });

    it('[DAILY / DC03] - Game creation uses the clue, 5 rounds, no letters, and hides the answer', async () => {
        const user = await userService.createUser({ nickname: 'daily03' });
        const game = await gameService.createGame({ mode: 'daily_challenge', userId: user._id.toString() });

        expect(game.mode).to.equal('daily_challenge');
        expect(game.maxRounds).to.equal(5);
        expect(game.round).to.equal(1);
        expect(game.clue).to.be.ok;
        expect(game.letters).to.deep.equal([]);
        expect(game).to.not.have.property('dailyAnswer');

        // The answer stays hidden on reload too.
        const reloaded = await gameService.loadGame(game._id.toString(), user._id.toString());
        expect(reloaded.dailyAnswer).to.equal(getTodayChallenge().word);
        const publicGame = gameService.toPublicGame(reloaded);
        expect(publicGame).to.not.have.property('dailyAnswer');
    });

    it('[DAILY / DC04] - The daily challenge cannot be recreated', async () => {
        const user = await userService.createUser({ nickname: 'daily04' });
        const first = await gameService.createGame({ mode: 'daily_challenge', userId: user._id.toString() });
        const second = await gameService.createGame({ mode: 'daily_challenge', userId: user._id.toString() });

        expect(first._id.toString()).to.equal(second._id.toString());
    });

    it('[DAILY / DC05] - Correct word on the first attempt scores 50 points', async () => {
        const user = await userService.createUser({ nickname: 'daily05' });
        const challenge = getTodayChallenge();
        const game = await gameService.createGame({ mode: 'daily_challenge', userId: user._id.toString() });

        const result = await gameService.submitWord(game._id.toString(), challenge.word, user._id.toString());

        expect(result.valid).to.be.true;
        expect(result.points).to.equal(50);
        expect(result.totalScore).to.equal(50);
        expect(result.isCompleted).to.be.true;
    });

    it('[DAILY / DC06] - Wrong attempts advance the round; correct on the 3rd scores 30', async () => {
        const user = await userService.createUser({ nickname: 'daily06' });
        const challenge = getTodayChallenge();
        const game = await gameService.createGame({ mode: 'daily_challenge', userId: user._id.toString() });

        const w1 = await gameService.submitWord(game._id.toString(), 'aaaa', user._id.toString());
        expect(w1.valid).to.be.false;
        expect(w1.reason).to.equal('incorrect');
        expect(w1.round).to.equal(2);
        expect(w1.attemptsLeft).to.equal(4);

        const w2 = await gameService.submitWord(game._id.toString(), 'bbbb', user._id.toString());
        expect(w2.round).to.equal(3);

        const win = await gameService.submitWord(game._id.toString(), challenge.word, user._id.toString());
        expect(win.valid).to.be.true;
        expect(win.points).to.equal(30);
        expect(win.totalScore).to.equal(30);
        expect(win.isCompleted).to.be.true;
    });

    it('[DAILY / DC07] - Five wrong answers end the game with 0 points', async () => {
        const user = await userService.createUser({ nickname: 'daily07' });
        const game = await gameService.createGame({ mode: 'daily_challenge', userId: user._id.toString() });

        let last;
        for (let i = 0; i < 5; i++) {
            last = await gameService.submitWord(game._id.toString(), 'zzzz', user._id.toString());
        }

        expect(last.valid).to.be.false;
        expect(last.isCompleted).to.be.true;
        expect(last.attemptsLeft).to.equal(0);
        expect(last.totalScore).to.equal(0);

        const doc = await gameService.loadGame(game._id.toString(), user._id.toString());
        expect(doc.score).to.equal(0);

        // No more attempts after completion.
        const rejected = await gameService
            .submitWord(game._id.toString(), 'zzzz', user._id.toString())
            .catch(e => e);
        expect(rejected.status).to.equal(409);
    });

    it('[DAILY / DC08] - Ending the game early awards 0 points', async () => {
        const user = await userService.createUser({ nickname: 'daily08' });
        const game = await gameService.createGame({ mode: 'daily_challenge', userId: user._id.toString() });

        await gameService.completeGame(game._id.toString(), user._id.toString());

        const result = await gameService.getGameResult(game._id.toString(), user._id.toString());
        expect(result.isCompleted).to.be.true;
        expect(result.score).to.equal(0);
    });
});
