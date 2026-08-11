const crypto = require('crypto');
const { EventEmitter } = require('events');
const mongo = require('../../utilities/mongodb');
const { HttpError } = require('../../utilities/http-error');
const { GAME_CONFIG } = require('../../utilities/constant');

const DUEL_LETTER_COUNT = 3;
const DUEL_BATCH_SIZE = 10;
const DUEL_MAX_ROUNDS = 10;

// Connection-resilience window: how long we wait before considering a
// participant disconnected, then before forfeiting the duel on their behalf.
const DISCONNECT_GRACE_MS = 45 * 1000;
const FORFEIT_TIMEOUT_MS = 90 * 1000;
const WATCHDOG_INTERVAL_MS = 10 * 1000;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Codes are user-typed, so we accept any 4-8 uppercase letters or digits.
const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

function generateCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    }
    return code;
}

function randomLetters(count) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    return Array.from(
        { length: count },
        () => alphabet[crypto.randomInt(alphabet.length)]
    );
}

function emptyParticipant(userId = null) {
    return {
        userId: userId ? mongo.getObjectId(userId) : null,
        gameId: null,
        score: null,
        submittedAt: null,
        lastActiveAt: new Date(),
        disconnectedAt: null,
        forfeited: false,
    };
}

function lastActiveMs(participant, fallback = Date.now()) {
    if (!participant) return fallback;
    return participant.lastActiveAt ? new Date(participant.lastActiveAt).getTime() : fallback;
}

class DuelService extends EventEmitter {
    constructor(client, gameService = null) {
        super();
        this.client = client;
        this.collection = 'duels';
        this.gameService = gameService;
        this._watchdog = null;
    }

    async _load(duelId) {
        const objectId = mongo.getObjectId(duelId);
        if (!objectId) throw new HttpError(400, 'Invalid duel ID');

        const duel = await mongo.findOne(this.client, this.collection, { _id: objectId });
        if (!duel) throw new HttpError(404, 'Duel not found');
        return duel;
    }

    async _loadByCode(code) {
        if (!code) throw new HttpError(400, 'code is required');
        const normalized = this._normalizeCode(code);
        const duel = await mongo.findOne(this.client, this.collection, { code: normalized });
        if (!duel) throw new HttpError(404, 'Duel not found');
        return duel;
    }

    async _save(duel) {
        duel.updatedAt = new Date();
        const result = await mongo.updateOne(
            this.client,
            this.collection,
            { _id: duel._id },
            { $set: {
                status: duel.status,
                mode: duel.mode,
                letters: duel.letters,
                letterBatch: duel.letterBatch,
                challenger: duel.challenger,
                opponent: duel.opponent,
                winnerId: duel.winnerId,
                result: duel.result,
                startedAt: duel.startedAt,
                updatedAt: duel.updatedAt,
            } }
        );
        this.emit('duel:updated', duel._id.toString());
        return result;
    }

    /**
     * Record proof of life for a participant (from REST calls or WS heartbeats).
     * Reconnecting clears any prior disconnected marker.
     */
    async touchActivity(duelId, userId) {
        const duel = await this._load(duelId);
        const slot = this._slotForUser(duel, userId);
        if (!slot) return;

        const participant = duel[slot];
        participant.lastActiveAt = new Date();
        participant.disconnectedAt = null;

        await mongo.updateOne(
            this.client,
            this.collection,
            { _id: duel._id, [`${slot}.userId`]: mongo.getObjectId(userId) },
            { $set: {
                [`${slot}.lastActiveAt`]: participant.lastActiveAt,
                [`${slot}.disconnectedAt`]: null,
            } }
        );
    }

    /**
     * Identify a participant slot for a userId, or null if not a participant.
     */
    _slotForUser(duel, userId) {
        const id = userId ? mongo.getObjectId(userId)?.toString() : null;
        if (!id) return null;
        if (duel.challenger?.userId?.toString() === id) return 'challenger';
        if (duel.opponent?.userId?.toString() === id) return 'opponent';
        return null;
    }

    /**
     * Mark the caller's activity as fresh. Used by the realtime hub on ping.
     */
    async onHeartbeat(duelId, userId) {
        await this.touchActivity(duelId, userId);
    }

    /**
     * Start the connection watchdog. Scans active duels and marks
     * disconnected participants, forfeiting when the grace window elapses.
     */
    startWatchdog(intervalMs = WATCHDOG_INTERVAL_MS) {
        if (this._watchdog) return;
        this._watchdog = setInterval(() => {
            this.checkDisconnections().catch((err) => {
                console.error('Duel watchdog error:', err.message);
            });
        }, intervalMs);
        if (typeof this._watchdog.unref === 'function') this._watchdog.unref();
    }

    stopWatchdog() {
        if (this._watchdog) {
            clearInterval(this._watchdog);
            this._watchdog = null;
        }
    }

    /**
     * Scan active duels for participants who stopped reporting activity.
     *  - after DISCONNECT_GRACE_MS of silence: mark `disconnectedAt`
     *  - after FORFEIT_TIMEOUT_MS of silence: forfeit the duel
     * Idempotent, safe to run on every tick.
     */
    async checkDisconnections(now = Date.now()) {
        const active = await mongo.find(this.client, this.collection, { status: 'playing' });
        for (const duel of active) {
            const challenger = duel.challenger;
            const opponent = duel.opponent;
            if (!challenger || !opponent) continue;

            const cLast = lastActiveMs(challenger, duel.updatedAt);
            const oLast = lastActiveMs(opponent, duel.updatedAt);

            const cInactive = now - cLast;
            const oInactive = now - oLast;

            // Forfeit when a participant has been silent past the timeout.
            if (cInactive >= FORFEIT_TIMEOUT_MS || oInactive >= FORFEIT_TIMEOUT_MS) {
                await this._forfeit(duel, now);
                continue;
            }

            // Mark as disconnected when past the grace window.
            if (cInactive >= DISCONNECT_GRACE_MS && !challenger.disconnectedAt) {
                challenger.disconnectedAt = new Date();
                await this._save(duel);
            }
            if (oInactive >= DISCONNECT_GRACE_MS && !opponent.disconnectedAt) {
                opponent.disconnectedAt = new Date();
                await this._save(duel);
            }
        }
    }

    /**
     * End a duel because a participant stopped reporting. The silent player
     * loses; the other participant (when present) wins. Persisted so both
     * clients converge deterministically.
     */
    async _forfeit(duel, now) {
        const challengerInactive = now - lastActiveMs(duel.challenger);
        const opponentInactive = now - lastActiveMs(duel.opponent);

        const cForfeit = challengerInactive >= FORFEIT_TIMEOUT_MS;
        const oForfeit = opponentInactive >= FORFEIT_TIMEOUT_MS;

        duel.status = 'completed';
        duel.updatedAt = new Date();

        if (cForfeit && oForfeit) {
            // Both silent — no winner.
            duel.result = 'draw';
            duel.winnerId = null;
            duel.challenger.forfeited = true;
            duel.opponent.forfeited = true;
        } else if (cForfeit) {
            duel.result = 'opponent';
            duel.winnerId = duel.opponent.userId;
            duel.challenger.forfeited = true;
        } else {
            duel.result = 'challenger';
            duel.winnerId = duel.challenger.userId;
            duel.opponent.forfeited = true;
        }

        await mongo.updateOne(
            this.client,
            this.collection,
            { _id: duel._id },
            { $set: {
                status: duel.status,
                challenger: duel.challenger,
                opponent: duel.opponent,
                winnerId: duel.winnerId,
                result: duel.result,
                updatedAt: duel.updatedAt,
            } }
        );
        this.emit('duel:updated', duel._id.toString());
    }

    /**
     * Enrich a duel with player nicknames and a per-caller `gameId`.
     */
    async _toPublic(duel, actorUserId) {
        const userIds = [duel.challenger?.userId, duel.opponent?.userId].filter(Boolean);
        const nicknames = {};

        if (userIds.length > 0) {
            const users = await mongo.find(
                this.client,
                'users',
                { _id: { $in: userIds } },
                { nickname: 1 }
            );
            for (const u of users) {
                nicknames[u._id.toString()] = u.nickname || 'Unknown';
            }
        }

        const actorId = actorUserId ? actorUserId.toString() : null;
        const myGameId =
            (actorId && duel.challenger?.userId?.toString() === actorId && duel.challenger?.gameId) ||
            (actorId && duel.opponent?.userId?.toString() === actorId && duel.opponent?.gameId) ||
            null;

        return {
            _id: duel._id,
            code: duel.code,
            letterCount: duel.letterCount,
            letters: duel.letters || (duel.letterBatch ? duel.letterBatch[0] : null),
            mode: duel.mode,
            maxRounds: duel.maxRounds,
            status: duel.status,
            result: duel.result || null,
            winnerId: duel.winnerId ? duel.winnerId.toString() : null,
            createdAt: duel.createdAt,
            updatedAt: duel.updatedAt,
            startedAt: duel.startedAt || null,
            challenger: {
                userId: duel.challenger?.userId ? duel.challenger.userId.toString() : null,
                nickname: nicknames[duel.challenger?.userId?.toString()] || 'Unknown',
                score: duel.challenger?.score,
                submittedAt: duel.challenger?.submittedAt || null,
                lastActiveAt: duel.challenger?.lastActiveAt || duel.updatedAt || null,
                disconnectedAt: duel.challenger?.disconnectedAt || null,
                forfeited: Boolean(duel.challenger?.forfeited),
            },
            opponent: {
                userId: duel.opponent?.userId ? duel.opponent.userId.toString() : null,
                nickname: nicknames[duel.opponent?.userId?.toString()] || 'Unknown',
                score: duel.opponent?.score,
                submittedAt: duel.opponent?.submittedAt || null,
                lastActiveAt: duel.opponent?.lastActiveAt || duel.updatedAt || null,
                disconnectedAt: duel.opponent?.disconnectedAt || null,
                forfeited: Boolean(duel.opponent?.forfeited),
            },
            myGameId,
        };
    }

    /**
     * Create a duel. The challenger (admin) is the inviter; the mode is not
     * chosen yet and no games are created — the admin picks the mode and
     * startDuel deals games to BOTH players so they begin together.
     */
    async createDuel({ userId, opponentId = null, letterCount = DUEL_LETTER_COUNT, code = null }) {
        const finalLetterCount = this._validateLetterCount(letterCount);

        if (opponentId) {
            const opponent = await mongo.findOne(
                this.client,
                'users',
                { _id: mongo.getObjectId(opponentId) },
                { _id: 1 }
            );
            if (!opponent) throw new HttpError(404, 'Opponent not found');
        }

        const duelCode = code ? this._normalizeCode(code) : await this._uniqueCode();

        const letterBatch = Array.from(
            { length: DUEL_BATCH_SIZE },
            () => randomLetters(finalLetterCount)
        );

        const duel = {
            code: duelCode,
            // Mode is not decided yet — the admin picks it before starting.
            mode: null,
            letterCount: finalLetterCount,
            letters: letterBatch[0],
            letterBatch,
            maxRounds: null,
            status: 'open',
            startedAt: null,
            challenger: emptyParticipant(userId),
            opponent: emptyParticipant(opponentId),
            winnerId: null,
            result: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        let result;
        try {
            result = await mongo.insertOne(this.client, this.collection, duel);
        } catch (err) {
            if (err && err.code === 11000) {
                throw new HttpError(409, 'A duel with this code already exists — join it instead');
            }
            throw err;
        }
        duel._id = result.insertedId;

        // No games are created yet — both are dealt together by startDuel so
        // the two players begin at the same time.
        await this._save(duel);

        return this._toPublic(duel, userId);
    }

    async _uniqueCode() {
        for (let i = 0; i < 5; i++) {
            const code = generateCode();
            const existing = await mongo.findOne(this.client, this.collection, { code });
            if (!existing) return code;
        }
        throw new HttpError(500, 'Could not generate a unique duel code');
    }

    /**
     * Start the duel for both players at once. Only the challenger (admin) can
     * start, and they must pick a mode first. Both participants' games are
     * created in the same call, so neither player can begin before the other.
     */
    async startDuel(duelId, userId, mode) {
        const duel = await this._load(duelId);

        if (this._slotForUser(duel, userId) !== 'challenger') {
            throw new HttpError(403, 'Only the duel creator can start the game');
        }
        if (duel.status === 'completed') {
            throw new HttpError(409, 'Duel already completed');
        }
        if (!duel.opponent?.userId) {
            throw new HttpError(400, 'Waiting for your opponent to join before you can start');
        }
        if (duel.status === 'playing') {
            return this._toPublic(duel, userId);
        }

        const allowedModes = ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'];
        if (!mode || !allowedModes.includes(mode)) {
            throw new HttpError(400, 'Select a game mode before starting the duel');
        }

        duel.mode = mode;
        duel.maxRounds = (mode === 'time_attack' || mode === 'survival_mode') ? null : DUEL_MAX_ROUNDS;

        // Deal to BOTH players in the same request so they start together.
        for (const slot of ['challenger', 'opponent']) {
            const participant = duel[slot];
            if (!participant.gameId) {
                const game = await this._createDuelGame(duel, slot, participant.userId.toString());
                participant.gameId = game._id;
                participant.score = 0;
            }
        }

        duel.status = 'playing';
        duel.startedAt = new Date();
        await this._save(duel);
        return this._toPublic(duel, userId);
    }

    async _createDuelGame(duel, slot, userId) {
        if (!this.gameService) {
            throw new HttpError(500, 'Game service unavailable');
        }
        return this.gameService.createGame({
            mode: duel.mode || 'normal_mode',
            letterCount: duel.letterCount,
            letterBatch: duel.letterBatch,
            userId,
        });
    }

    /**
     * Enter a duel: returns (or creates) the caller's game. A caller who is
     * not yet a participant becomes the opponent when the duel is open.
     */
    async enterDuel(duelId, userId) {
        const duel = await this._load(duelId);
        return this._enter(duel, userId);
    }

    /**
     * Join a duel by invite code. Both players type the same code to connect:
     * if a duel with that code exists and is open, the caller becomes the
     * opponent; if no duel exists yet, the caller creates it (challenger).
     */
    async enterDuelByCode(code, userId) {
        const normalized = this._normalizeCode(code);

        let duel;
        try {
            duel = await this._loadByCode(normalized);
        } catch (err) {
            if (err.status !== 404) throw err;
            // No duel with this code yet — the caller is the first to enter.
            return this.createDuel({ userId, code: normalized });
        }

        return this._enter(duel, userId);
    }

    async _enter(duel, userId) {
        if (duel.status === 'completed') {
            throw new HttpError(409, 'Duel already completed');
        }

        const challengerId = duel.challenger.userId?.toString();
        const opponentId = duel.opponent.userId?.toString();

        let slot;
        if (challengerId === userId) {
            slot = 'challenger';
        } else if (opponentId === userId) {
            slot = 'opponent';
        } else if (!opponentId && duel.status === 'open') {
            slot = 'opponent';
            duel.opponent = emptyParticipant(userId);
            duel.status = 'active';
        } else {
            throw new HttpError(403, 'You are not a participant in this duel');
        }

        const participant = duel[slot];

        // Activity proof — reconnecting/entering counts as alive. Games are
        // not created here: both are dealt together by startDuel.
        participant.lastActiveAt = new Date();
        participant.disconnectedAt = null;

        await this._save(duel);
        return this._toPublic(duel, userId);
    }

    /**
     * Record a participant's final score from their completed duel game.
     *
     * Completing your game ends the duel for both players immediately: your
     * opponent's game is auto-completed with its current score so both sides
     * settle on a level playing field (the higher final score wins).
     */
    async submitScore(duelId, userId, gameId) {
        const duel = await this._load(duelId);

        // A completed (or forfeited) duel is final — no score submission can
        // change the outcome. Return the settled view to the caller.
        if (duel.status === 'completed') {
            return this._toPublic(duel, userId);
        }

        const slot = this._slotForUser(duel, userId);
        if (!slot) throw new HttpError(403, 'You are not a participant in this duel');

        if (duel.status !== 'playing') {
            throw new HttpError(400, 'The duel has not started yet');
        }

        const participant = duel[slot];

        if (participant.submittedAt) {
            throw new HttpError(400, 'Score already submitted for this duel');
        }

        const registeredGameId = participant.gameId ? participant.gameId.toString() : null;
        if (!registeredGameId || registeredGameId !== gameId) {
            throw new HttpError(400, 'Game does not belong to this duel');
        }

        if (!this.gameService) {
            throw new HttpError(500, 'Game service unavailable');
        }

        const game = await this.gameService.loadGame(gameId, userId);
        if (!game.isCompleted) {
            throw new HttpError(400, 'Game must be completed before submitting a score');
        }

        participant.score = game.score;
        participant.submittedAt = new Date();
        participant.lastActiveAt = new Date();
        participant.disconnectedAt = null;

        const otherSlot = slot === 'challenger' ? 'opponent' : 'challenger';
        const other = duel[otherSlot];

        // When the first player ends the game, end the opponent's game too so
        // both sides settle: freeze their current score without submitting it.
        if (other && other.userId && !other.submittedAt) {
            await this._autoCompleteParticipant(duel, other);
        }

        // Both scores are now decided (a missing opponent score counts as 0),
        // so the duel concludes on the first submission.
        duel.status = 'completed';
        const challengerScore = duel.challenger.score ?? 0;
        const opponentScore = duel.opponent.score ?? 0;
        if (challengerScore > opponentScore) {
            duel.result = 'challenger';
            duel.winnerId = duel.challenger.userId;
        } else if (opponentScore > challengerScore) {
            duel.result = 'opponent';
            duel.winnerId = duel.opponent.userId;
        } else {
            duel.result = 'draw';
            duel.winnerId = null;
        }

        await this._save(duel);
        return this._toPublic(duel, userId);
    }

    /**
     * Freeze the partner participant's game so the duo settles on a level
     * playing field: their game is completed (if still open) and their score
     * is captured without submitting on their behalf.
     */
    async _autoCompleteParticipant(duel, participant) {
        if (!participant || !participant.userId || !participant.gameId) return;
        if (!this.gameService) return;
        try {
            const userId = participant.userId.toString();
            const game = await this.gameService.loadGame(participant.gameId, userId);
            if (!game.isCompleted) {
                const completed = await this.gameService.completeGame(participant.gameId, userId);
                participant.score = completed.score ?? 0;
            } else {
                participant.score = game.score ?? 0;
            }
            participant.lastActiveAt = new Date();
            participant.disconnectedAt = null;
        } catch (err) {
            console.error('Failed to auto-complete duel participant game:', err.message);
        }
    }

    /**
     * Reset the shared letters for a duel so both players receive an identical
     * new rack. The caller's reset is applied across both participants' games
     * (same predetermined letters) and broadcast live via `duel:updated`.
     */
    async resetLetters(duelId, userId) {
        const duel = await this._load(duelId);

        const slot = this._slotForUser(duel, userId);
        if (!slot) throw new HttpError(403, 'You are not a participant in this duel');
        if (duel.status === 'completed') throw new HttpError(409, 'Duel already completed');
        if (duel.status !== 'playing') throw new HttpError(400, 'The duel has not started yet');

        const newLetters = randomLetters(duel.letterCount);

        for (const s of ['challenger', 'opponent']) {
            const participant = duel[s];
            if (participant && participant.userId && participant.gameId && this.gameService) {
                try {
                    const existing = await this.gameService.loadGame(participant.gameId, participant.userId.toString());
                    if (!existing.isCompleted) {
                        await this.gameService.resetLetters(
                            participant.gameId,
                            duel.letterCount,
                            newLetters,
                            participant.userId.toString()
                        );
                    }
                } catch (err) {
                    console.error(`Failed to reset duel game for slot ${s}:`, err.message);
                }
            }
        }

        // Keep the shared preview (duel.letters) in sync so the WS snapshot
        // carries the freshly dealt letters to the waiting player.
        if (Array.isArray(duel.letterBatch)) {
            duel.letterBatch[0] = newLetters;
        }
        duel.letters = newLetters;

        const actor = duel[slot];
        if (actor) {
            actor.lastActiveAt = new Date();
            actor.disconnectedAt = null;
        }

        await this._save(duel);
        return this._toPublic(duel, userId);
    }

    /**
     * Fetch a duel by ID or invite code.
     *
     * NOTE: polling this endpoint does NOT count as liveness proof — a
     * tab left open but with a dead WebSocket must eventually be forfeited.
     * Connection liveness is proven by WS heartbeats (`ping`) and by in-game
     * actions that route through the DuelService (e.g. `submitScore`).
     */
    async getDuel(duelId, actorUserId = null) {
        const duel = await this._load(duelId);
        return this._toPublic(duel, actorUserId);
    }

    async getDuelByCode(code, actorUserId = null) {
        const duel = await this._loadByCode(code);
        return this._toPublic(duel, actorUserId);
    }

    /**
     * Validate and normalize a user-typed duel code.
     */
    _normalizeCode(code) {
        if (typeof code !== 'string') {
            throw new HttpError(400, 'code is required');
        }
        const normalized = code.trim().toUpperCase();
        if (!CODE_PATTERN.test(normalized)) {
            throw new HttpError(400, 'code must be 4-8 uppercase letters or digits');
        }
        return normalized;
    }

    /**
     * Validate a letter count is an integer in [MIN_LETTERS, MAX_LETTERS].
     */
    _validateLetterCount(letterCount) {
        if (typeof letterCount !== 'number' || !Number.isInteger(letterCount)) {
            throw new HttpError(400, 'letterCount must be an integer');
        }
        if (letterCount < GAME_CONFIG.MIN_LETTERS || letterCount > GAME_CONFIG.MAX_LETTERS) {
            throw new HttpError(400, `Letter count must be ${GAME_CONFIG.MIN_LETTERS}-${GAME_CONFIG.MAX_LETTERS}`);
        }
        return letterCount;
    }
}

module.exports = DuelService;
module.exports.generateCode = generateCode;
