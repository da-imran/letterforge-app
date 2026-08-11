const { expect } = require('chai');
const sinon = require('sinon');
const rabbitmq = require('../utilities/rabbitmq');
const { RABBITMQ_QUEUE_SCORE_RECORDED } = require('../utilities/env');
const { ScoreWorker } = require('../modules/scoring/worker');
const { HttpError } = require('../utilities/http-error');

describe('Score Worker (RabbitMQ consumer)', () => {
    let handler;
    let scoreService;
    let worker;

    beforeEach(async () => {
        scoreService = {
            createScore: sinon.stub().resolves({ _id: 'score-id' }),
            onCreated: null,
        };
        worker = new ScoreWorker(scoreService);

        handler = null;
        sinon.stub(rabbitmq, 'consumeWithRetry').callsFake((queue, cb) => {
            handler = cb;
            return { stop: sinon.stub() };
        });

        await worker.start();
    });

    afterEach(() => sinon.restore());

    it('[SW01] persists a valid score.submitted message', async () => {
        await handler(
            { type: 'score.submitted', userId: 'u1', gameId: 'g1', mode: 'normal_mode', points: 25 },
            { content: Buffer.from('{}') }
        );

        expect(scoreService.createScore.calledOnce).to.be.true;
        expect(scoreService.createScore.firstCall.args[0]).to.deep.include({
            userId: 'u1',
            gameId: 'g1',
            mode: 'normal_mode',
            points: 25,
        });
    });

    it('[SW02] ignores unknown message types', async () => {
        await handler(
            { type: 'something.else', userId: 'u1', gameId: 'g1', mode: 'normal_mode', points: 25 },
            { content: Buffer.from('{}') }
        );
        expect(scoreService.createScore.called).to.be.false;
    });

    it('[SW03] throws HttpError for a malformed payload (dropped, not requeued)', async () => {
        let err;
        try {
            await handler(
                { type: 'score.submitted', userId: 'u1', gameId: 'g1' },
                { content: Buffer.from('{}') }
            );
        } catch (e) {
            err = e;
        }

        expect(err).to.be.instanceOf(HttpError);
        expect(scoreService.createScore.called).to.be.false;
    });

    it('[SW04] announces persisted scores via score.recorded (onCreated hook)', () => {
        expect(scoreService.onCreated).to.be.a('function');

        const pub = sinon.stub(rabbitmq, 'publish').resolves(true);
        scoreService.onCreated('time_attack');

        expect(pub.calledOnce).to.be.true;
        const [queue, message] = pub.firstCall.args;
        expect(queue).to.equal(RABBITMQ_QUEUE_SCORE_RECORDED);
        expect(message).to.include({ type: 'score.recorded', mode: 'time_attack' });

        pub.restore();
    });
});
