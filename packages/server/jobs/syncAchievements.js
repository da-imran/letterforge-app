require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongodb = require('../utilities/mongodb');
const GameService = require('../modules/game/service');
const MilestoneService = require('../modules/milestones/service');
const { logger, LOG_LEVELS } = require('../utilities/logger');

// Run every 6 hours. Pass `--once` to run a single pass and exit.
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RUN_ONCE = process.argv.includes('--once');

/**
 * Sync achievements for every user.
 */
async function syncAchievements() {
    const client = await mongodb.clientConnect(process.env.MONGO_URI);
    await mongodb.ensureIndexes(client);

    let usersScanned = 0;
    let usersAffected = 0;
    let achievementsAffected = 0;
    let errors = 0;

    try {
        const milestoneService = new MilestoneService(client);
        await milestoneService.initializeMilestones();
        const gameService = new GameService(client);

        const users = await mongodb.find(client, 'users', {});

        for (const user of users) {
            const userId = user._id.toString();
            usersScanned++;

            try {
                const stats = await gameService.getUserStatsForMilestones(userId);
                // Skips already-achieved milestones; adds newly met ones only.
                const newlyUnlocked = await milestoneService.checkAndUnlockMilestones(userId, stats);

                if (newlyUnlocked.length > 0) {
                    usersAffected++;
                    achievementsAffected += newlyUnlocked.length;
                    logger.log({
                        level: LOG_LEVELS.INFO,
                        message: `Synced achievements for user ${userId}: ${newlyUnlocked.length} unlocked`,
                        module: 'sync-achievements',
                        service: 'jobs',
                    });
                }
            } catch (err) {
                errors++;
                logger.log({
                    level: LOG_LEVELS.ERROR,
                    message: `Failed to sync achievements for user ${userId}: ${err.message || err}`,
                    module: 'sync-achievements',
                    service: 'jobs',
                });
            }
        }

        const summary = { usersScanned, usersAffected, achievementsAffected, errors };
        logger.log({
            level: LOG_LEVELS.INFO,
            message: `Achievement sync complete - ${usersAffected} users affected, ${achievementsAffected} achievements affected`,
            module: 'sync-achievements',
            service: 'jobs',
            data: summary,
        });
        return summary;
    } finally {
        await client.close();
    }
}

async function runOnce() {
    try {
        await syncAchievements();
    } catch (err) {
        logger.log({
            level: LOG_LEVELS.ERROR,
            message: err.message || err,
            status: 500,
            service: 'sync-achievements',
        });
    }
}

(async () => {
    if (RUN_ONCE) {
        await runOnce();
        process.exit(0);
        return;
    }

    await runOnce();

    logger.log({
        level: LOG_LEVELS.INFO,
        message: `Achievement sync scheduler armed - running every 6 hours`,
        module: 'sync-achievements',
        service: 'jobs',
    });

    const interval = setInterval(runOnce, SYNC_INTERVAL_MS);

    function shutdown(signal) {
        logger.log({
            level: LOG_LEVELS.INFO,
            message: `${signal} received - shutting down achievement sync`,
        });
        clearInterval(interval);
        process.exit(0);
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
})();
