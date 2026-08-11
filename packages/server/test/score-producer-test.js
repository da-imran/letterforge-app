const { expect } = require('chai');
const sinon = require('sinon');
const rabbitmq = require('../utilities/rabbitmq');
const { RABBITMQ_QUEUE_SCORES } = require('../utilities/env');
const ScoreProducer = require('../modules/scoring/producer');

describe('Score Producer (RabbitMQ)', () => {
    let producer;
    let publishStub;

    beforeEach(() => {
        producer = new ScoreProducer();
        publishStub = sinon.stub(rabbitmq, 'publish').resolves(true);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('[SP01] publishes a score.submitted task to the score queue', async () => {
        const payload = { userId: 'u1', gameId: 'g1', mode: 'normal_mode', points: 25 };
        const result = await producer.publishScoreSubmitted(payload);

        expect(result).to.be.true;
        expect(publishStub.calledOnce).to.be.true;

        const [queue, message] = publishStub.firstCall.args;
        expect(queue).to.equal(RABBITMQ_QUEUE_SCORES);
        expect(message).to.include({ type: 'score.submitted', ...payload });
        expect(message.submittedAt).to.be.a('string');
    });

    it('[SP02] returns false when the broker is unavailable', async () => {
        publishStub.resolves(false);
        const result = await producer.publishScoreSubmitted({
            userId: 'u1',
            gameId: 'g1',
            mode: 'normal_mode',
            points: 10,
        });
        expect(result).to.be.false;
    });
});
