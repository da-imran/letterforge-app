const ScoreProducer = require('./producer');

/**
 * Scoring module. There are no HTTP routes here; instead the module wires the
 * RabbitMQ producer (and, via consumer.js, the leaderboard cache invalidator)
 * into the shared `config`. The request path publishes `score.submitted` tasks
 * and returns 202; a separate worker process persists them.
 */
module.exports = async (app, config) => {
    const scoreProducer = new ScoreProducer();
    config.scoreProducer = scoreProducer;
    return scoreProducer;
};
