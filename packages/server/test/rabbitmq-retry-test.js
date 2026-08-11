const { expect } = require('chai');
const sinon = require('sinon');
const rabbitmq = require('../utilities/rabbitmq');

describe('RabbitMQ consumeWithRetry', () => {
    afterEach(() => sinon.restore());

    it('[RQ01] retries until the broker becomes available', async () => {
        const fakeCh = {
            on: sinon.stub(),
            close: sinon.stub().resolves(),
        };
        const consumeStub = sinon
            .stub(rabbitmq, 'consume')
            .onFirstCall().resolves(null)
            .onSecondCall().resolves(fakeCh);

        const clock = sinon.useFakeTimers();
        const controller = rabbitmq.consumeWithRetry('test.queue', () => {}, { baseDelayMs: 50, maxDelayMs: 100 });
        await clock.runAllAsync();
        clock.restore();

        expect(consumeStub.callCount).to.be.gte(2);
        controller.stop();
    });

    it('[RQ02] stop() cancels pending retries', async () => {
        const consumeStub = sinon.stub(rabbitmq, 'consume').resolves(null);

        const clock = sinon.useFakeTimers();
        const controller = rabbitmq.consumeWithRetry('test.queue', () => {}, { baseDelayMs: 5000, maxDelayMs: 5000 });
        controller.stop();
        await clock.runAllAsync();
        clock.restore();

        expect(consumeStub.callCount).to.equal(1);
    });
});
