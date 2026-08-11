const rabbitmq = require('../../utilities/rabbitmq');
const { RABBITMQ_QUEUE_SCORES } = require('../../utilities/env');

/**
 * Publishes `score.submitted` tasks to the shared RabbitMQ queue. A background
 * worker consumes these and persists the final score so the request handler
 * can return 202 immediately instead of blocking on the database write.
 */
class ScoreProducer {
    /**
     * Queue a final score for background persistence.
     * @returns {Promise<boolean>} true when the broker accepted the message,
     *   false when RabbitMQ is disabled/unavailable (caller should fall back
     *   to the synchronous write).
     */
    async publishScoreSubmitted({ userId, gameId, mode, points }) {
        return rabbitmq.publish(RABBITMQ_QUEUE_SCORES, {
            type: 'score.submitted',
            userId,
            gameId,
            mode,
            points,
            submittedAt: new Date().toISOString(),
        });
    }
}

module.exports = ScoreProducer;
