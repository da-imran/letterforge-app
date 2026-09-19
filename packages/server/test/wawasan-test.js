const { expect } = require('chai');

const DuelService = require('../modules/duels/service');
const GameService = require('../modules/game/service');
const UserService = require('../modules/users/service');
const mongodb = require('../utilities/mongodb');

const {
    MONGO_URI,
} = require('../utilities/env');

async function makeDuelWithOpponent(duelService, userService, tag) {
    const u1 = await userService.createUser({ nickname: `wawasan-${tag}a` });
    const u2 = await userService.createUser({ nickname: `wawasan-${tag}b` });
    const duel = await duelService.createDuel({ userId: u1._id.toString() });
    await duelService.enterDuelByCode(duel.code, u2._id.toString());
    return { duel, u1: u1._id.toString(), u2: u2._id.toString() };
}

async function submitBothAndConfirm(duelService, duelId, u1, u2, a1, a2) {
    await duelService.submitWawasanAnswers(duelId, u1, a1);
    await duelService.submitWawasanAnswers(duelId, u2, a2);
    await duelService.confirmWawasanReview(duelId, u1);
    return duelService.confirmWawasanReview(duelId, u2);
}

describe('Wawasan 2020 (duel-only category mode)', () => {
    let duelService;
    let gameService;
    let userService;
    let mongoClient;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        gameService = new GameService(mongoClient);
        duelService = new DuelService(mongoClient, gameService);
        userService = new UserService(mongoClient);
    });

    after(async () => {
        await mongodb.deleteMany(mongoClient, 'duels');
        await mongodb.deleteMany(mongoClient, 'games');
        await mongodb.deleteMany(mongoClient, 'users');
        await mongoClient.close();
    });

    it('[WAWASAN / WZ01] - Starting needs 3-10 unique columns', async () => {
        const { duel, u1 } = await makeDuelWithOpponent(duelService, userService, '01');

        await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', { columns: ['Makanan', 'Minuman'] })
            .then(() => { throw new Error('should have rejected 2 columns'); })
            .catch((err) => expect(err.status).to.equal(400));

        const eleven = Array.from({ length: 11 }, (_, i) => `Kolum${i}`);
        await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', { columns: eleven })
            .then(() => { throw new Error('should have rejected 11 columns'); })
            .catch((err) => expect(err.status).to.equal(400));

        await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', { columns: ['Makanan', 'makanan', 'Minuman'] })
            .then(() => { throw new Error('should have rejected duplicates'); })
            .catch((err) => expect(err.status).to.equal(400));

        await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode')
            .then(() => { throw new Error('should have rejected missing columns'); })
            .catch((err) => expect(err.status).to.equal(400));
    });

    it('[WAWASAN / WZ02] - Only the creator can start', async () => {
        const { duel, u2 } = await makeDuelWithOpponent(duelService, userService, '02');

        await duelService.startDuel(duel._id.toString(), u2, 'wawasan_mode', { columns: ['Makanan', 'Minuman', 'Negara'] })
            .then(() => { throw new Error('should have rejected non-owner start'); })
            .catch((err) => expect(err.status).to.equal(403));
    });

    it('[WAWASAN / WZ03] - Start shuffles A-Z and opens the first row', async () => {
        const { duel, u1 } = await makeDuelWithOpponent(duelService, userService, '03');
        const columns = ['Makanan', 'Minuman', 'Negara'];

        const started = await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', { columns });

        expect(started.status).to.equal('playing');
        expect(started.mode).to.equal('wawasan_mode');
        expect(started.maxRounds).to.equal(26);
        // No letter-rack games are dealt for Wawasan duels.
        expect(started.myGameId).to.be.null;

        const w = started.wawasan;
        expect(w.columns).to.deep.equal(columns);
        expect(w.letters).to.have.lengthOf(26);
        expect([...w.letters].sort()).to.deep.equal('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
        expect(w.currentRound).to.equal(0);
        expect(w.pointsPerColumn).to.equal(33); // Math.round(100 / 3)
        expect(w.rounds).to.have.lengthOf(1);
        expect(w.rounds[0].letter).to.equal(w.letters[0]);
        expect(w.rounds[0].status).to.equal('open');
    });

    it('[WAWASAN / WZ04] - Answers must match the column count and row letter', async () => {
        const { duel, u1 } = await makeDuelWithOpponent(duelService, userService, '04');
        const started = await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', {
            columns: ['Makanan', 'Minuman', 'Negara'],
        });
        const letter = started.wawasan.rounds[0].letter.toLowerCase();
        const wrongLetter = letter === 'q' ? 'w' : 'q';

        await duelService.submitWawasanAnswers(duel._id.toString(), u1, ['a', 'b'])
            .then(() => { throw new Error('should have rejected wrong count'); })
            .catch((err) => expect(err.status).to.equal(400));

        await duelService.submitWawasanAnswers(duel._id.toString(), u1, [`${letter}rot`, `${wrongLetter}teh`, `${letter}mesir`])
            .then(() => { throw new Error('should have rejected wrong-letter answer'); })
            .catch((err) => {
                expect(err.status).to.equal(400);
                expect(err.message).to.contain('Minuman');
            });
    });

    it('[WAWASAN / WZ05] - Review phase: both submit then confirm to score and advance', async () => {
        const { duel, u1, u2 } = await makeDuelWithOpponent(duelService, userService, '05');
        const started = await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', {
            columns: ['Makanan', 'Minuman', 'Negara'],
        });
        const L = started.wawasan.rounds[0].letter.toLowerCase();

        // Independent scoring: same word -> 0 each; different -> score;
        // skip only penalises the skipper, not the opponent.
        // Column 0: same word (case-insensitive) -> 0 each.
        // Column 1: different words -> 33 each.
        // Column 2: challenger skips -> challenger 0, opponent scores (provided valid answer).
        await duelService.submitWawasanAnswers(duel._id.toString(), u1, [`${L}roti`, `${L}teh`, '']);
        const afterBoth = await duelService.submitWawasanAnswers(duel._id.toString(), u2, [`${L}ROTI `, `${L}kopi`, `${L}libya`]);

        // Both submitted -> review, not yet done.
        expect(afterBoth.wawasan.rounds[0].status).to.equal('review');
        expect(afterBoth.status).to.equal('playing');
        // One confirm is not enough to advance.
        const afterOneConfirm = await duelService.confirmWawasanReview(duel._id.toString(), u1);
        expect(afterOneConfirm.wawasan.rounds[0].status).to.equal('review');
        expect(afterOneConfirm.status).to.equal('playing');

        const afterConfirm = await duelService.confirmWawasanReview(duel._id.toString(), u2);
        expect(afterConfirm.wawasan.rounds[0].status).to.equal('done');
        expect(afterConfirm.wawasan.currentRound).to.equal(1);
        expect(afterConfirm.wawasan.rounds).to.have.lengthOf(2);
        expect(afterConfirm.wawasan.rounds[1].status).to.equal('open');
        expect(afterConfirm.status).to.equal('playing');

        // Stop now: challenger 33 (col1 only), opponent 66 (col1 + col2 where challenger skipped).
        const stopped = await duelService.stopWawasan(duel._id.toString(), u1);
        expect(stopped.status).to.equal('completed');
        expect(stopped.challenger.score).to.equal(33);
        expect(stopped.opponent.score).to.equal(66);
        expect(stopped.result).to.equal('opponent');
    });

    it('[WAWASAN / WZ06] - Open-row answers are masked until both submit, then visible in review', async () => {
        const { duel, u1, u2 } = await makeDuelWithOpponent(duelService, userService, '06');
        const started = await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', {
            columns: ['Makanan', 'Minuman', 'Negara'],
        });
        const L = started.wawasan.rounds[0].letter.toLowerCase();

        const afterOne = await duelService.submitWawasanAnswers(
            duel._id.toString(), u1, [`${L}satu`, `${L}dua`, `${L}tiga`]
        );
        // Challenger's own view: opponent answers hidden.
        expect(afterOne.wawasan.rounds[0].answers.opponent).to.deep.equal([null, null, null]);
        expect(afterOne.wawasan.rounds[0].answers.challenger[0]).to.equal(`${L}satu`);

        // Opponent's view before submitting: challenger answers hidden.
        const oppView = await duelService.getDuel(duel._id.toString(), u2);
        expect(oppView.wawasan.rounds[0].answers.challenger).to.deep.equal([null, null, null]);

        // After both submit -> review -> both answers visible.
        await duelService.submitWawasanAnswers(duel._id.toString(), u2, [`${L}aaa`, `${L}bbb`, `${L}ccc`]);
        const reviewView = await duelService.getDuel(duel._id.toString(), u1);
        expect(reviewView.wawasan.rounds[0].status).to.equal('review');
        expect(reviewView.wawasan.rounds[0].answers.challenger[0]).to.equal(`${L}satu`);
        expect(reviewView.wawasan.rounds[0].answers.opponent[0]).to.equal(`${L}aaa`);
    });

    it('[WAWASAN / WZ07] - Only the owner can stop; review row is discarded', async () => {
        const { duel, u1, u2 } = await makeDuelWithOpponent(duelService, userService, '07');
        await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', {
            columns: ['Makanan', 'Minuman', 'Negara', 'Haiwan'],
        });

        await duelService.stopWawasan(duel._id.toString(), u2)
            .then(() => { throw new Error('should have rejected non-owner stop'); })
            .catch((err) => expect(err.status).to.equal(403));

        // Owner stops with zero completed rows -> 0-0 draw (open row discarded).
        const stopped = await duelService.stopWawasan(duel._id.toString(), u1);
        expect(stopped.status).to.equal('completed');
        expect(stopped.challenger.score).to.equal(0);
        expect(stopped.opponent.score).to.equal(0);
        expect(stopped.result).to.equal('draw');
        expect(stopped.wawasan.rounds).to.have.lengthOf(0);
    });

    it('[WAWASAN / WZ07b] - Stopping during review discards that row', async () => {
        const { duel, u1, u2 } = await makeDuelWithOpponent(duelService, userService, '07b');
        const started = await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', {
            columns: ['Makanan', 'Minuman', 'Negara'],
        });
        const L = started.wawasan.rounds[0].letter.toLowerCase();
        await duelService.submitWawasanAnswers(duel._id.toString(), u1, [`${L}aaa`, `${L}bbb`, `${L}ccc`]);
        await duelService.submitWawasanAnswers(duel._id.toString(), u2, [`${L}xxx`, `${L}yyy`, `${L}zzz`]);
        // In review, stopping discards it.
        const stopped = await duelService.stopWawasan(duel._id.toString(), u1);
        expect(stopped.wawasan.rounds).to.have.lengthOf(0);
        expect(stopped.challenger.score).to.equal(0);
    });

    it('[WAWASAN / WZ08] - Playing all 26 rows auto-completes', async () => {
        const { duel, u1, u2 } = await makeDuelWithOpponent(duelService, userService, '08');
        const columns = ['Makanan', 'Minuman', 'Negara', 'Haiwan'];
        let view = await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', { columns });
        expect(view.wawasan.pointsPerColumn).to.equal(25); // 100 / 4

        for (let r = 0; r < 26; r++) {
            const letter = view.wawasan.rounds[view.wawasan.currentRound].letter.toLowerCase();
            await duelService.submitWawasanAnswers(duel._id.toString(), u1, [
                `${letter}aaa`, `${letter}bbb`, `${letter}ccc`, `${letter}ddd`,
            ]);
            view = await duelService.submitWawasanAnswers(duel._id.toString(), u2, [
                '', `${letter}xxx`, `${letter}yyy`, `${letter}zzz`,
            ]);
            // In review, both must confirm.
            expect(view.wawasan.rounds[view.wawasan.currentRound].status).to.equal('review');
            await duelService.confirmWawasanReview(duel._id.toString(), u1);
            view = await duelService.confirmWawasanReview(duel._id.toString(), u2);
            if (r < 25) expect(view.status).to.equal('playing');
        }

        expect(view.status).to.equal('completed');
        // Independent: challenger provided all 4 cols, opponent skipped col0.
        // Challenger: all 4 cols score (even col0 where opponent empty -> challenger still scores) = 100 per row = 25*4
        // Opponent: only cols 1-3 score (col0 empty = 0) = 75 per row
        expect(view.challenger.score).to.equal(100 * 26);
        expect(view.opponent.score).to.equal(75 * 26);
        expect(view.result).to.equal('challenger');
    });

    it('[WAWASAN / WZ09] - Review can independently omit invalid answers before confirming', async () => {
        const { duel, u1, u2 } = await makeDuelWithOpponent(duelService, userService, '09a');
        const columns = ['Makanan', 'Minuman', 'Negara'];
        let view = await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', { columns });
        const L = view.wawasan.rounds[0].letter.toLowerCase();

        await duelService.submitWawasanAnswers(duel._id.toString(), u1, [`${L}roti`, `${L}teh`, `${L}bar`]);
        view = await duelService.submitWawasanAnswers(duel._id.toString(), u2, [`${L}roti lain`, `${L}kopi`, `${L}bar lain`]);
        expect(view.wawasan.rounds[0].status).to.equal('review');

        // Challenger omits opponent col0 (thinks it's invalid)
        await duelService.challengeWawasanAnswer(duel._id.toString(), u1, 0);
        const afterChallenge = await duelService.getDuel(duel._id.toString(), u1);
        expect(afterChallenge.wawasan.rounds[0].challenges.challenger['0']).to.equal(true);

        await duelService.confirmWawasanReview(duel._id.toString(), u1);
        view = await duelService.confirmWawasanReview(duel._id.toString(), u2);

        // Challenger omitted opponent col0: opponent should NOT get points for col0,
        // challenger still should? Let's verify independent scoring:
        // col0: challenger roti vs opponent roti lain (different) but opponent challenged -> opponent 0, challenger gets 33? Actually challenger challenged opponent, so opponent 0, challenger not challenged so challenger 33
        // col1: different, no challenge -> both 33
        // col2: different, no challenge -> both 33
        // So challenger 99, opponent 66
        const stopped = await duelService.stopWawasan(duel._id.toString(), u1);
        // Wait view already done? No we advanced to round 1 playing, stopped counts only done rows (1 row)
        expect(stopped.challenger.score).to.equal(99);
        expect(stopped.opponent.score).to.equal(66);
    });

    it('[WAWASAN / WZ10] - Multi-word answers with spaces compare by words, not spacing', async () => {
        const { duel, u1, u2 } = await makeDuelWithOpponent(duelService, userService, '10');
        const started = await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', {
            columns: ['Minuman', 'Makanan', 'Negara'],
        });
        const L = started.wawasan.rounds[0].letter.toLowerCase();

        // Independent scoring: same phrase -> 0 each; different -> score;
        // skip only penalises the skipper.
        // Column 0: same phrase, different spacing/case -> 0 each.
        // Column 1: different phrases -> 33 each.
        // Column 2: challenger skips -> challenger 0, opponent (provided) scores 33.
        await duelService.submitWawasanAnswers(duel._id.toString(), u1, [`${L}eh o ais`, `${L}oh sem`, '']);
        await duelService.submitWawasanAnswers(duel._id.toString(), u2, [`${L}EH  O   AIS`, `${L}oh lain`, `${L}ain`]);
        await duelService.confirmWawasanReview(duel._id.toString(), u1);
        await duelService.confirmWawasanReview(duel._id.toString(), u2);

        const stopped = await duelService.stopWawasan(duel._id.toString(), u1);
        expect(stopped.status).to.equal('completed');
        expect(stopped.challenger.score).to.equal(33);
        expect(stopped.opponent.score).to.equal(66);
        expect(stopped.result).to.equal('opponent');
    });

    it('[WAWASAN / WZ12] - Full sheet scores full marks independent of opponent skip', async () => {
        const { duel, u1, u2 } = await makeDuelWithOpponent(duelService, userService, '12');
        const started = await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', {
            columns: ['Makanan', 'Minuman', 'Negara'],
        });
        const L = started.wawasan.rounds[0].letter.toLowerCase();
        // A fills all 3, B skips last column (langkau). Independent: A should get 99 (33*3), B 66 (33*2)
        await duelService.submitWawasanAnswers(duel._id.toString(), u1, [`${L}aaa`, `${L}bbb`, `${L}ccc`]);
        await duelService.submitWawasanAnswers(duel._id.toString(), u2, [`${L}xxx`, `${L}yyy`, '']);
        await duelService.confirmWawasanReview(duel._id.toString(), u1);
        await duelService.confirmWawasanReview(duel._id.toString(), u2);

        const stopped = await duelService.stopWawasan(duel._id.toString(), u1);
        expect(stopped.challenger.score).to.equal(99);
        expect(stopped.opponent.score).to.equal(66);
        expect(stopped.result).to.equal('challenger');
    });

    it('[WAWASAN / WZ11] - Classic duel endpoints reject Wawasan games', async () => {
        const { duel, u1 } = await makeDuelWithOpponent(duelService, userService, '11');
        await duelService.startDuel(duel._id.toString(), u1, 'wawasan_mode', {
            columns: ['Makanan', 'Minuman', 'Negara'],
        });

        await duelService.resetLetters(duel._id.toString(), u1)
            .then(() => { throw new Error('reset should have been rejected'); })
            .catch((err) => expect(err.status).to.equal(400));

        await duelService.submitScore(duel._id.toString(), u1, '012345678901234567890123')
            .then(() => { throw new Error('submit should have been rejected'); })
            .catch((err) => expect(err.status).to.equal(400));
    });
});
