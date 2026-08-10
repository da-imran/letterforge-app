const { expect } = require('chai');

const ProgressionService = require('../modules/progression/service');
const UserService = require('../modules/users/service');
const mongodb = require('../utilities/mongodb');

const {
    MONGO_URI,
} = require('../utilities/env');

const { xpForGame, levelInfo, titlesForLevel } = ProgressionService;

describe('Progression (XP / levels / titles / power-ups)', () => {
    let progressionService;
    let userService;
    let mongoClient;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        progressionService = new ProgressionService(mongoClient);
        userService = new UserService(mongoClient);
    });

    after(async () => {
        await mongodb.deleteMany(mongoClient, 'users');
        await mongoClient.close();
    });

    it('[PG01] - xpForGame scales with score and mode', () => {
        expect(xpForGame(0, 'normal_mode')).to.equal(5);
        expect(xpForGame(250, 'normal_mode')).to.equal(15); // 5 + floor(250/25)
        expect(xpForGame(250, 'survival_mode')).to.equal(30); // x2
        expect(xpForGame(0, 'time_attack')).to.equal(8); // round(5 * 1.5)
    });

    it('[PG02] - levelInfo grows level with XP on the curve', () => {
        expect(levelInfo(0).level).to.equal(1);
        expect(levelInfo(99).level).to.equal(1);
        expect(levelInfo(100).level).to.equal(2);
        expect(levelInfo(250).level).to.equal(3);
        expect(levelInfo(450).level).to.equal(4);
        expect(levelInfo(450).xpToNext).to.equal(250);
    });

    it('[PG03] - titlesForLevel unlocks milestones progressively', () => {
        expect(titlesForLevel(1)).to.deep.equal(['Word Initiate']);
        expect(titlesForLevel(5)).to.include('Wordsmith');
        expect(titlesForLevel(10)).to.include('Word Artisan');
        expect(titlesForLevel(50)).to.include('Eternal Forger');
    });

    it('[PG04] - awardGameXp adds XP without leveling at low scores', async () => {
        const user = await userService.createUser({ nickname: 'progressor01' });
        const result = await progressionService.awardGameXp(user._id.toString(), {
            mode: 'normal_mode',
            score: 500,
        });

        expect(result.xpAwarded).to.equal(25);
        expect(result.level).to.equal(1);
        expect(result.leveledUp).to.be.false;
        expect(result.hintsGranted).to.equal(0);

        const prog = await progressionService.getProgression(user._id.toString());
        expect(prog.xp).to.equal(25);
        expect(prog.powerUps.hint).to.equal(0);
    });

    it('[PG05] - Leveling up grants a hint power-up and a title', async () => {
        const user = await userService.createUser({ nickname: 'progressor02' });
        const result = await progressionService.awardGameXp(user._id.toString(), {
            mode: 'normal_mode',
            score: 2500,
        });

        expect(result.xpAwarded).to.equal(105);
        expect(result.level).to.equal(2);
        expect(result.leveledUp).to.be.true;
        expect(result.hintsGranted).to.equal(1);

        const prog = await progressionService.getProgression(user._id.toString());
        expect(prog.powerUps.hint).to.equal(1);
        expect(prog.currentTitle).to.equal('Word Initiate');
    });

    it('[PG06] - usePowerUp consumes hints and errors when empty', async () => {
        const user = await userService.createUser({ nickname: 'progressor03' });
        await progressionService.awardGameXp(user._id.toString(), {
            mode: 'normal_mode',
            score: 2500,
        });

        const used = await progressionService.usePowerUp(user._id.toString(), 'hint');
        expect(used.remaining).to.equal(0);

        const err = await progressionService.usePowerUp(user._id.toString(), 'hint').catch(e => e);
        expect(err.status).to.equal(400);
    });

    it('[PG07] - Unknown power-up types are rejected', async () => {
        const user = await userService.createUser({ nickname: 'progressor04' });
        const err = await progressionService.usePowerUp(user._id.toString(), 'nuke').catch(e => e);
        expect(err.status).to.equal(400);
    });
});
