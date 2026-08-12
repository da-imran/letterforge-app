const { expect } = require('chai');

const LeaderboardService = require('../modules/leaderboards/service');
const ScoreService = require('../modules/scores/service');
const UserService = require('../modules/users/service');
const mongodb = require('../utilities/mongodb');

const {
    MONGO_URI,
} = require('../utilities/env');

const SEED_NICKNAME = 'cache-seed-user';

describe('Leaderboard read caching', () => {
    let mongoClient;
    let leaderboardService;
    let originalAggregate;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        leaderboardService = new LeaderboardService(mongoClient);
        originalAggregate = mongodb.aggregate;

        // Seed a real user + scores across modes so every read returns rows
        // (the leaderboard pipeline joins scores -> users). A leaderboard read
        // issues two aggregations: the per-mode rows and the all-modes
        // cumulative score (allScore).
        const user = await new UserService(mongoClient).createUser({ nickname: SEED_NICKNAME });
        const userObjectId = mongodb.getObjectId(user._id.toString());
        await mongodb.insertOne(mongoClient, 'scores', {
            userId: userObjectId,
            mode: 'normal_mode',
            points: 100,
            createdAt: new Date(),
        });
        await mongodb.insertOne(mongoClient, 'scores', {
            userId: userObjectId,
            mode: 'time_attack',
            points: 80,
            createdAt: new Date(),
        });
        await mongodb.insertOne(mongoClient, 'scores', {
            userId: userObjectId,
            mode: 'chain_mode',
            points: 50,
            createdAt: new Date(),
        });
    });

    after(async () => {
        mongodb.aggregate = originalAggregate;
        await mongodb.deleteMany(mongoClient, 'scores');
        await mongodb.deleteOne(mongoClient, 'users', { nickname: SEED_NICKNAME });
        await mongoClient.close();
    });

    it('[CACHE / LC01] - Repeated reads hit the cache', async () => {
        let aggregateCalls = 0;
        mongodb.aggregate = async (...args) => {
            aggregateCalls++;
            return originalAggregate(...args);
        };

        await leaderboardService.getLeaderboard({ mode: 'normal_mode', period: 'all_time' });
        const callsAfterColdRead = aggregateCalls;
        await leaderboardService.getLeaderboard({ mode: 'normal_mode', period: 'all_time' });
        expect(aggregateCalls).to.equal(callsAfterColdRead);
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
        // Two cold reads (cached third) x two aggregations each.
        expect(aggregateCalls).to.equal(4);
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
        // Two cold reads x two aggregations each.
        expect(aggregateCalls).to.equal(4);
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
        // Two cold reads x two aggregations each.
        expect(aggregateCalls).to.equal(4);
    });
});
