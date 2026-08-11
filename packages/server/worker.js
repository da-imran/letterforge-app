require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const mongodb = require('./utilities/mongodb');
const ScoreService = require('./modules/scores/service');
const { ScoreWorker } = require('./modules/scoring/worker');
const { logger, LOG_LEVELS } = require('./utilities/logger');

/**
 * Standalone score worker process. Consumes `score.submitted` tasks from
 * RabbitMQ and persists them to MongoDB, fully decoupled from the HTTP API.
 * Run with `npm run start:worker`.
 */
(async () => {
    try {
        const mongoClient = await mongodb.clientConnect(process.env.MONGO_URI);
        await mongodb.ensureIndexes(mongoClient);

        const scoreService = new ScoreService(mongoClient);
        const worker = new ScoreWorker(scoreService);
        await worker.start();

        function shutdown(signal) {
            logger.log({
                level: LOG_LEVELS.INFO,
                message: `${signal} received - shutting down score worker`,
            });

            const forceExit = setTimeout(() => {
                console.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
            forceExit.unref();

            worker.stop().finally(async () => {
                try {
                    await mongoClient.close();
                } catch (closeErr) {
                    console.error('Error closing MongoDB connection:', closeErr);
                }
                process.exit(0);
            });
        }

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (error) {
        logger.log({
            level: LOG_LEVELS.CRITICAL,
            message: error.message || error,
            status: 500,
            service: 'score-worker',
        });
        process.exit(1);
    }
})();
