const { expect } = require('chai');

const DuelService = require('../modules/duels/service');
const GameService = require('../modules/game/service');
const UserService = require('../modules/users/service');
const RealtimeHub = require('../modules/realtime/hub');
const mongodb = require('../utilities/mongodb');
const { loadDictionary } = require('../modules/dictionary/service');

const {
    MONGO_URI,
} = require('../utilities/env');

// Deal both players' games so they start together (admin-only action).
async function startDuel(service, duel, byUser, mode) {
    return service.startDuel(duel._id.toString(), byUser, mode);
}

describe('Duels (multiplayer)', () => {
    let duelService;
    let gameService;
    let userService;
    let mongoClient;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        gameService = new GameService(mongoClient);
        duelService = new DuelService(mongoClient, gameService);
        userService = new UserService(mongoClient);
        loadDictionary();
    });

    after(async () => {
        await mongodb.deleteMany(mongoClient, 'duels');
        await mongodb.deleteMany(mongoClient, 'games');
        await mongodb.deleteMany(mongoClient, 'users');
        await mongoClient.close();
    });

    it('[DUEL / DU01] - Create a duel waits for the admin to pick a mode and start', async () => {
        const user = await userService.createUser({ nickname: 'duelist01' });
        const duel = await duelService.createDuel({ userId: user._id.toString() });

        expect(duel.code).to.have.lengthOf(6);
        expect(duel.status).to.equal('open');
        expect(duel.mode).to.be.null;
        expect(duel.maxRounds).to.be.null;
        expect(duel.myGameId).to.be.null;
        expect(duel.challenger.userId).to.equal(user._id.toString());
        expect(duel.opponent.userId).to.be.null;
    });

    it('[DUEL / DU02] - Opponent joins by code; both start together via startDuel', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist02a' });
        const u2 = await userService.createUser({ nickname: 'duelist02b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });

        const joined = await duelService.enterDuelByCode(duel.code, u2._id.toString());
        expect(joined.status).to.equal('active');
        expect(joined.opponent.userId).to.equal(u2._id.toString());
        expect(joined.opponent.userId).to.not.equal(joined.challenger.userId);
        // No games before the admin starts.
        expect(joined.myGameId).to.be.null;

        // Admin starts — BOTH players get games in the same call.
        const started = await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');
        expect(started.status).to.equal('playing');
        expect(started.mode).to.equal('normal_mode');
        expect(started.myGameId).to.be.ok;
        expect(started.startedAt).to.be.ok;
    });

    it('[DUEL / DU03] - Both players share the identical letter batch', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist03a' });
        const u2 = await userService.createUser({ nickname: 'duelist03b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        const started = await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');
        const joined = await duelService.getDuel(duel._id.toString(), u2._id.toString());

        const challengerGame = await gameService.loadGame(started.myGameId, u1._id.toString());
        const opponentGame = await gameService.loadGame(joined.myGameId, u2._id.toString());

        expect(challengerGame.letterBatch).to.deep.equal(opponentGame.letterBatch);
        expect(challengerGame.letterBatch[0]).to.deep.equal(started.letters);
    });

    it('[DUEL / DU04] - First player to submit ends the duel for both sides', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist04a' });
        const u2 = await userService.createUser({ nickname: 'duelist04b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        const started = await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');
        const joined = await duelService.getDuel(duel._id.toString(), u2._id.toString());

        // Challenger scores by playing a round
        const cGame = await gameService.loadGame(started.myGameId, u1._id.toString());
        await gameService.completeGame(cGame._id, u1._id.toString());
        const afterChallenger = await duelService.submitScore(
            duel._id.toString(),
            u1._id.toString(),
            cGame._id.toString()
        );

        // The first submission ends the duel immediately for both players.
        expect(afterChallenger.status).to.equal('completed');
        expect(afterChallenger.challenger.submittedAt).to.be.ok;
        expect(afterChallenger.result).to.be.ok;

        // The opponent's game was auto-completed so their score is captured.
        const oGame = await gameService.loadGame(joined.myGameId, u2._id.toString());
        expect(oGame.isCompleted).to.equal(true);
    });

    it('[DUEL / DU05] - A game outside the duel cannot be submitted', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist05a' });
        const u2 = await userService.createUser({ nickname: 'duelist05b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');

        const rogue = await gameService.createGame({ mode: 'normal_mode', userId: u2._id.toString() });
        await gameService.completeGame(rogue._id, u2._id.toString());

        const err = await duelService
            .submitScore(duel._id.toString(), u2._id.toString(), rogue._id.toString())
            .catch(e => e);

        expect(err.status).to.equal(400);
    });

    it('[DUEL / DU06] - Scores cannot be submitted twice', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist06a' });
        const u2 = await userService.createUser({ nickname: 'duelist06b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        const started = await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');

        const cGame = await gameService.loadGame(started.myGameId, u1._id.toString());
        await gameService.completeGame(cGame._id, u1._id.toString());
        const first = await duelService.submitScore(
            duel._id.toString(),
            u1._id.toString(),
            cGame._id.toString()
        );

        // Second submission by the same player is ignored (duel already settled).
        const second = await duelService.submitScore(
            duel._id.toString(),
            u1._id.toString(),
            cGame._id.toString()
        );

        expect(second.status).to.equal('completed');
        expect(second.result).to.equal(first.result);
        expect(second.winnerId).to.equal(first.winnerId);
    });

    it('[DUEL / DU07] - Both players connect by entering the same code', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist07a' });
        const u2 = await userService.createUser({ nickname: 'duelist07b' });

        // First to enter the code creates the duel as challenger.
        const first = await duelService.enterDuelByCode('FORGE', u1._id.toString());
        expect(first.code).to.equal('FORGE');
        expect(first.status).to.equal('open');
        expect(first.challenger.userId).to.equal(u1._id.toString());
        expect(first.opponent.userId).to.be.null;

        // Second to enter the same code (case-insensitive) joins as opponent.
        const second = await duelService.enterDuelByCode('forge', u2._id.toString());
        expect(second.code).to.equal('FORGE');
        expect(second.status).to.equal('active');
        expect(second.challenger.userId).to.equal(u1._id.toString());
        expect(second.opponent.userId).to.equal(u2._id.toString());

        // Once the admin starts, both are dealt from the identical batch.
        const started = await startDuel(duelService, { _id: first._id }, u1._id.toString(), 'normal_mode');
        expect(started.status).to.equal('playing');
        const secondAfterStart = await duelService.getDuel(first._id.toString(), u2._id.toString());
        expect(secondAfterStart.myGameId).to.not.equal(started.myGameId);

        const cGame = await gameService.loadGame(started.myGameId, u1._id.toString());
        const oGame = await gameService.loadGame(secondAfterStart.myGameId, u2._id.toString());
        expect(cGame.letterBatch).to.deep.equal(oGame.letterBatch);
    });

    it('[DUEL / DU08] - Entering an invalid code is rejected', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist08a' });

        const err = await duelService.enterDuelByCode('A!!#', u1._id.toString()).catch(e => e);
        expect(err.status).to.equal(400);

        const tooLong = await duelService.enterDuelByCode('ABCDEFGHIJ', u1._id.toString()).catch(e => e);
        expect(tooLong.status).to.equal(400);
    });

    it('[DUEL / DU17] - Only the duel creator can start', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist17a' });
        const u2 = await userService.createUser({ nickname: 'duelist17b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());

        const err = await startDuel(duelService, duel, u2._id.toString(), 'normal_mode').catch(e => e);
        expect(err.status).to.equal(403);
    });

    it('[DUEL / DU18] - Cannot start before the opponent joins', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist18a' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });

        const err = await startDuel(duelService, duel, u1._id.toString(), 'normal_mode').catch(e => e);
        expect(err.status).to.equal(400);
    });

    it('[DUEL / DU19] - The admin must select a mode before starting', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist19a' });
        const u2 = await userService.createUser({ nickname: 'duelist19b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());

        const missing = await startDuel(duelService, duel, u1._id.toString(), undefined).catch(e => e);
        expect(missing.status).to.equal(400);

        const invalid = await startDuel(duelService, duel, u1._id.toString(), 'unknown_mode').catch(e => e);
        expect(invalid.status).to.equal(400);

        const daily = await startDuel(duelService, duel, u1._id.toString(), 'daily_challenge').catch(e => e);
        expect(daily.status).to.equal(400);
    });

    it('[DUEL / DU20] - startDuel deals both players at once', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist20a' });
        const u2 = await userService.createUser({ nickname: 'duelist20b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        const joined = await duelService.enterDuelByCode(duel.code, u2._id.toString());

        const started = await startDuel(duelService, duel, u1._id.toString(), 'time_attack');

        expect(started.status).to.equal('playing');
        expect(started.mode).to.equal('time_attack');
        expect(started.maxRounds).to.be.null;
        expect(started.myGameId).to.be.ok;
        expect(joined.myGameId).to.be.null;

        // The opponent's game now exists server-side.
        const oPublic = await duelService.getDuel(duel._id.toString(), u2._id.toString());
        expect(oPublic.myGameId).to.be.ok;
        expect(oPublic.opponent.score).to.equal(0);
    });

    it('[DUEL / DU09] - Real-time hub broadcasts duel updates to subscribers', async () => {
        const hub = new RealtimeHub(duelService);
        const received = [];
        const socket = {
            readyState: 1,
            on() {},
            send: (raw) => received.push(JSON.parse(raw)),
        };

        hub.onConnect(socket, 'player-1');
        hub.subscribe(socket, 'duel-live-1');

        const originalGetDuel = duelService.getDuel.bind(duelService);
        duelService.getDuel = async (id) => ({ _id: id, status: 'completed', result: 'challenger' });
        duelService.emit('duel:updated', 'duel-live-1');
        await new Promise((resolve) => setImmediate(resolve));
        duelService.getDuel = originalGetDuel;

        const updates = received.filter((m) => m.type === 'duel:update');
        expect(updates.length).to.equal(1);
        expect(updates[0].duel.status).to.equal('completed');
    });

    it('[DUEL / DU10] - Mark participant disconnected after the grace window', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist10a' });
        const u2 = await userService.createUser({ nickname: 'duelist10b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');

        // Simulate the opponent going silent well past the grace window (45s)
        // but before the forfeit threshold (90s).
        await mongodb.updateOne(
            mongoClient,
            'duels',
            { _id: mongodb.getObjectId(duel._id.toString()) },
            { $set: { 'opponent.lastActiveAt': new Date(Date.now() - 50_000) } }
        );

        await duelService.checkDisconnections();

        const refreshed = await duelService.getDuel(duel._id.toString(), u2._id.toString());
        expect(refreshed.opponent.disconnectedAt).to.not.be.null;
        expect(refreshed.status).to.equal('playing');
    });

    it('[DUEL / DU11] - Watchdog forfeits a silent participant and ends the match', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist11a' });
        const u2 = await userService.createUser({ nickname: 'duelist11b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');

        // Opponent silent past the forfeit threshold (90s).
        await mongodb.updateOne(
            mongoClient,
            'duels',
            { _id: mongodb.getObjectId(duel._id.toString()) },
            { $set: { 'opponent.lastActiveAt': new Date(Date.now() - 100_000) } }
        );

        await duelService.checkDisconnections();

        const refreshed = await duelService.getDuel(duel._id.toString(), u2._id.toString());
        expect(refreshed.status).to.equal('completed');
        expect(refreshed.result).to.equal('challenger');
        expect(refreshed.winnerId).to.equal(u1._id.toString());
        expect(refreshed.opponent.forfeited).to.equal(true);
    });

    it('[DUEL / DU12] - touchActivity clears a disconnected marker', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist12a' });
        const u2 = await userService.createUser({ nickname: 'duelist12b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');

        await mongodb.updateOne(
            mongoClient,
            'duels',
            { _id: mongodb.getObjectId(duel._id.toString()) },
            { $set: { 'opponent.lastActiveAt': new Date(Date.now() - 50_000) } }
        );
        await duelService.checkDisconnections();
        const before = await duelService.getDuel(duel._id.toString(), u2._id.toString());
        expect(before.opponent.disconnectedAt).to.not.be.null;

        // Opponent comes back and reports for life.
        await duelService.touchActivity(duel._id.toString(), u2._id.toString());
        const after = await duelService.getDuel(duel._id.toString(), u2._id.toString());
        expect(after.opponent.disconnectedAt).to.be.null;
        expect(after.opponent.forfeited).to.equal(false);
    });

    it('[DUEL / DU13] - Submitting to a forfeited duel is a no-op', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist13a' });
        const u2 = await userService.createUser({ nickname: 'duelist13b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');

        await mongodb.updateOne(
            mongoClient,
            'duels',
            { _id: mongodb.getObjectId(duel._id.toString()) },
            { $set: { 'opponent.lastActiveAt': new Date(Date.now() - 100_000) } }
        );
        await duelService.checkDisconnections();

        // The challenger wins; the forfeiting opponent trying to submit
        // afterwards is ignored (duel is already settled).
        const res = await duelService.submitScore(
            duel._id.toString(),
            u2._id.toString(),
            '000000000000000000000000'
        );
        expect(res.status).to.equal('completed');
        expect(res.result).to.equal('challenger');
    });

    it('[DUEL / DU14] - Reset letters deals an identical rack to both players', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist14a' });
        const u2 = await userService.createUser({ nickname: 'duelist14b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        const started = await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');
        const joined = await duelService.getDuel(duel._id.toString(), u2._id.toString());

        const resetter = await duelService.resetLetters(duel._id.toString(), u1._id.toString());
        expect(resetter.letters).to.be.an('array');

        // Both games must now surface the identical letter rack.
        const cGame = await gameService.loadGame(started.myGameId, u1._id.toString());
        const oGame = await gameService.loadGame(joined.myGameId, u2._id.toString());
        expect(cGame.letters).to.deep.equal(oGame.letters);
        expect(cGame.letters).to.deep.equal(resetter.letters);
        expect(oGame.usedWords).to.deep.equal([]);
    });

    it('[DUEL / DU15] - Both players see the shared reset through the live update', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist15a' });
        const u2 = await userService.createUser({ nickname: 'duelist15b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        const started = await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');
        const joined = await duelService.getDuel(duel._id.toString(), u2._id.toString());

        // The reset is broadcast via `duel:updated`.
        let broadcast = null;
        duelService.once('duel:updated', (id) => { broadcast = id; });

        const resetter = await duelService.resetLetters(duel._id.toString(), u1._id.toString());
        await new Promise((resolve) => setImmediate(resolve));

        expect(broadcast).to.equal(duel._id.toString());

        // The shared letters propagate to BOTH players' games.
        const cGame = await gameService.loadGame(started.myGameId, u1._id.toString());
        const oGame = await gameService.loadGame(joined.myGameId, u2._id.toString());
        expect(cGame.letters).to.deep.equal(resetter.letters);
        expect(oGame.letters).to.deep.equal(resetter.letters);

        // Non-participants cannot reset a duel.
        const rogue = await userService.createUser({ nickname: 'rogue15' });
        const err = await duelService
            .resetLetters(duel._id.toString(), rogue._id.toString())
            .catch((e) => e);
        expect(err.status).to.equal(403);
    });

    it('[DUEL / DU16] - Completed duel reset is rejected', async () => {
        const u1 = await userService.createUser({ nickname: 'duelist16a' });
        const u2 = await userService.createUser({ nickname: 'duelist16b' });
        const duel = await duelService.createDuel({ userId: u1._id.toString() });
        await duelService.enterDuelByCode(duel.code, u2._id.toString());
        const started = await startDuel(duelService, duel, u1._id.toString(), 'normal_mode');
        const joined = await duelService.getDuel(duel._id.toString(), u2._id.toString());

        const cGame = await gameService.loadGame(started.myGameId, u1._id.toString());
        await gameService.completeGame(cGame._id, u1._id.toString());
        await duelService.submitScore(duel._id.toString(), u1._id.toString(), cGame._id.toString());

        const err = await duelService
            .resetLetters(duel._id.toString(), u1._id.toString())
            .catch((e) => e);
        expect(err.status).to.equal(409);

        // Opponent's game was auto-completed by the first submission.
        const oGame = await gameService.loadGame(joined.myGameId, u2._id.toString());
        expect(oGame.isCompleted).to.equal(true);

        const after = await duelService.getDuel(duel._id.toString(), u1._id.toString());
        expect(after.status).to.equal('completed');
    });
});
