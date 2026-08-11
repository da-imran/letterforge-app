const rabbitmq = require('../../utilities/rabbitmq');
const { HttpError } = require('../../utilities/http-error');
const { RABBITMQ_QUEUE_SCORES, RABBITMQ_QUEUE_SCORE_RECORDED } = require('../../utilities/env');
const { logger, LOG_LEVELS } = require('../../utilities/logger');

/**
 * Background worker that consumes `score.submitted` messages and persists the
 * final score via ScoreService.createScore. Runs in its own process
 * (`node worker.js`), decoupled from the HTTP request lifecycle.
 */
class ScoreWorker {
    constructor(scoreService) {
        this.scoreService = scoreService;
        this.queue = RABBITMQ_QUEUE_SCORES;
        this.recordedQueue = RABBITMQ_QUEUE_SCORE_RECORDED;
    }

    async start() {
        // Announce each persisted score so API instances (which hold the
        // in-memory leaderboard cache) can invalidate it. Falls back to a no-op
        // when the broker is unavailable.
        this.scoreService.onCreated = (mode) => {
            rabbitmq.publish(this.recordedQueue, {
                type: 'score.recorded',
                mode,
                recordedAt: new Date().toISOString(),
            });
        };

        if (!rabbitmq.isEnabled()) {
            logger.log({
                level: LOG_LEVELS.WARNING,
                message: 'RabbitMQ is disabled (RABBITMQ_ENABLED=false) - score worker is idle; scores will be recorded synchronously by the API',
                module: 'score-worker',
            });
            return null;
        }

        // Retries in the background until the broker is reachable, so starting
        // the worker before RabbitMQ (or a broker restart) does not need a
        // process restart.
        this.consumer = rabbitmq.consumeWithRetry(this.queue, async (payload) => {
            const { type, userId, gameId, mode, points } = payload || {};
            if (type !== 'score.submitted') {
                logger.log({
                    level: LOG_LEVELS.WARNING,
                    message: `Ignoring unknown message type: ${type}`,
                    module: 'score-worker',
                });
                return;
            }

            if (!userId || !gameId || !mode || typeof points !== 'number') {
                throw new HttpError(400, 'Invalid score.submitted payload: userId, gameId, mode, and points are required');
            }

            const score = await this.scoreService.createScore({ userId, gameId, mode, points });
            logger.log({
                level: LOG_LEVELS.INFO,
                message: `Score recorded for game ${gameId}`,
                module: 'score-worker',
                data: { mode, points },
            });
            return score;
        });

        logger.log({
            level: LOG_LEVELS.INFO,
            message: `Score worker listening on queue ${this.queue}`,
            module: 'score-worker',
        });
        return this.consumer;
    }

    async stop() {
        if (this.consumer && typeof this.consumer.stop === 'function') {
            this.consumer.stop();
        }
        await rabbitmq.close();
    }
}

module.exports = { ScoreWorker };
