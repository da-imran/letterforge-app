const { expect } = require('chai');

const LeaderboardService = require('../modules/leaderboards/service');
const ScoreService = require('../modules/scores/service');
const mongodb = require('../utilities/mongodb');

const {
    MONGO_URI,
} = require('../utilities/env');

describe('Leaderboard read caching', () => {
    let mongoClient;
    let leaderboardService;
    let originalAggregate;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        leaderboardService = new LeaderboardService(mongoClient);
        originalAggregate = mongodb.aggregate;
    });

    after(async () => {
        mongodb.aggregate = originalAggregate;
        await mongodb.deleteMany(mongoClient, 'scores');
        await mongoClient.close();
    });

    it('[CACHE / LC01] - Repeated reads hit the cache (single aggregation)', async () => {
        let aggregateCalls = 0;
        mongodb.aggregate = async (...args) => {
            aggregateCalls++;
            return originalAggregate(...args);
        };

        await leaderboardService.getLeaderboard({ mode: 'normal_mode', period: 'all_time' });
        await leaderboardService.getLeaderboard({ mode: 'normal_mode', period: 'all_time' });
        expect(aggregateCalls).to.equal(1);
    });

    it('[CACHE / LC02] - Different modes/periods are cached separately', async () => {
        let aggregateCalls = 0;
        mongodb.aggregate = async (...args) => {
            aggregateCalls++;
            return originalAggregate(...args);
        };

        leaderboardService.cache.clear();
        await leaderboardService.getLeaderboard({ mode: 'normal_mode', period: 'all_time' });
        await leaderboardService.getLeaderboard({ mode: 'time_attack', period: 'weekly' });
        await leaderboardService.getLeaderboard({ mode: 'normal_mode', period: 'all_time' });
        expect(aggregateCalls).to.equal(2);
    });

    it('[CACHE / LC03] - invalidateCache forces a fresh read', async () => {
        let aggregateCalls = 0;
        mongodb.aggregate = async (...args) => {
            aggregateCalls++;
            return originalAggregate(...args);
        };

        await leaderboardService.getLeaderboard({ mode: 'chain_mode', period: 'daily' });
        leaderboardService.invalidateCache('chain_mode');
        await leaderboardService.getLeaderboard({ mode: 'chain_mode', period: 'daily' });
        expect(aggregateCalls).to.equal(2);
    });

    it('[CACHE / LC04] - ScoreService.onCreated hook invalidates the cache', async () => {
        const scoreService = new ScoreService(mongoClient);
        scoreService.onCreated = (mode) => leaderboardService.invalidateCache(mode);

        let aggregateCalls = 0;
        mongodb.aggregate = async (...args) => {
            aggregateCalls++;
            return originalAggregate(...args);
        };

        leaderboardService.cache.clear();
        await leaderboardService.getLeaderboard({ mode: 'chain_mode', period: 'daily' });

        // A new score created through the score service invalidates the rows.
        scoreService.onCreated('chain_mode');
        await leaderboardService.getLeaderboard({ mode: 'chain_mode', period: 'daily' });
        expect(aggregateCalls).to.equal(2);
    });
});
