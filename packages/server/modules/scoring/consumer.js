const rabbitmq = require('../../utilities/rabbitmq');
const { RABBITMQ_QUEUE_SCORE_RECORDED } = require('../../utilities/env');
const { logger, LOG_LEVELS } = require('../../utilities/logger');

/**
 * API-side consumer of `score.recorded` messages. Scores are persisted by the
 * background worker process, so API instances cannot rely on the in-process
 * `onCreated` hook to invalidate their leaderboard cache. This listener
 * restores that invalidation across process boundaries. Mounted after the
 * leaderboard service is available on `config`.
 */
module.exports = async (app, config) => {
    if (!config.leaderboardService) return null;

    if (!rabbitmq.isEnabled()) {
        logger.log({
            level: LOG_LEVELS.WARNING,
            message: 'RabbitMQ is disabled (RABBITMQ_ENABLED=false) - leaderboard cache invalidation listener is idle',
            module: 'cache-invalidator',
        });
        return null;
    }

    // Retries in the background until the broker is reachable, so a broker
    // that starts after the API (or restarts) does not need a process restart.
    return rabbitmq.consumeWithRetry(RABBITMQ_QUEUE_SCORE_RECORDED, async (payload) => {
        const { type, mode } = payload || {};
        if (type !== 'score.recorded') return;

        if (mode) {
            config.leaderboardService.invalidateCache(mode);
        }
        logger.log({
            level: LOG_LEVELS.INFO,
            message: `Leaderboard cache invalidated for mode ${mode}`,
            module: 'cache-invalidator',
        });
    });
};
