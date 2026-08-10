const { expect } = require('chai');

const UserService = require('../modules/users/service');
const LeaderboardService = require('../modules/leaderboards/service');
const ScoreService = require('../modules/scores/service');
const mongodb = require('../utilities/mongodb');

const {
	MONGO_URI
} = require('../utilities/env');

describe('Users', () => {
    let userService;
    let mongoClient;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        userService = new UserService(mongoClient);
    });

    after(async () => {
        await mongodb.deleteMany(mongoClient, 'users');
        await mongoClient.close();
    });

    // US01: Create a new user
    it('[USERS / US01] - Create a new user with nickname', async () => {
        const user = await userService.createUser({ nickname: 'testuser1' });

        expect(user).to.have.property('_id');
        expect(user.nickname).to.equal('testuser1');
        expect(user).to.have.property('createdAt');
    });

    // US02: Get user by ID
    it('[USERS / US02] - Get user by ID', async () => {
        const created = await userService.createUser({ nickname: 'testuser2' });
        const user = await userService.getUserById(created._id.toString());

        expect(user).to.not.be.null;
        expect(user.nickname).to.equal('testuser2');
    });

    // US03: Get user by nickname
    it('[USERS / US03] - Get user by nickname', async () => {
        await userService.createUser({ nickname: 'testuser3' });
        const user = await userService.getUserByNickname('testuser3');

        expect(user).to.not.be.null;
        expect(user.nickname).to.equal('testuser3');
    });

    // US04: Update user nickname
    it('[USERS / US04] - Update user nickname', async () => {
        const created = await userService.createUser({ nickname: 'oldname' });
        const updated = await userService.updateUser(created._id.toString(), { nickname: 'newname' });

        expect(updated.nickname).to.equal('newname');
    });

    // US05: Delete user
    it('[USERS / US05] - Delete user', async () => {
        const created = await userService.createUser({ nickname: 'deleteuser' });
        const deleted = await userService.deleteUser(created._id.toString());

        expect(deleted).to.be.true;
    });
});

describe('Leaderboards (via Scores Collection)', () => {
    let userService;
    let leaderboardService;
    let scoreService;
    let mongoClient;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        userService = new UserService(mongoClient);
        leaderboardService = new LeaderboardService(mongoClient);
        scoreService = new ScoreService(mongoClient);
    });

    after(async () => {
        await mongodb.deleteMany(mongoClient, 'scores');
        await mongodb.deleteMany(mongoClient, 'users');
        await mongoClient.close();
    });

    // LB01: Submit score to scores collection
    it('[LEADERBOARD / LB01] - Submit score to scores collection', async () => {
        const user = await userService.createUser({ nickname: 'player1' });
        const userId = user._id.toString();
        const gameId = '507f1f77bcf86cd799439011';

        const result = await scoreService.createScore({
            userId,
            gameId,
            mode: 'normal_mode',
            points: 100
        });

        expect(result).to.have.property('_id');
        expect(result.points).to.equal(100);
    });

    // LB02: Get scores by user ID
    it('[LEADERBOARD / LB02] - Get scores by user ID', async () => {
        const user = await userService.createUser({ nickname: 'player2' });
        const userId = user._id.toString();

        await scoreService.createScore({
            userId,
            gameId: '507f1f77bcf86cd799439012',
            mode: 'normal_mode',
            points: 50
        });

        await scoreService.createScore({
            userId,
            gameId: '507f1f77bcf86cd799439013',
            mode: 'normal_mode',
            points: 75
        });

        const scores = await scoreService.getScoresByUserId(userId);

        expect(scores).to.have.lengthOf(2);
        expect(scores[0].points).to.equal(50);
        expect(scores[1].points).to.equal(75);
    });

    // LB03: Get leaderboard rankings from scores
    it('[LEADERBOARD / LB03] - Get leaderboard rankings aggregated from scores', async () => {
        const user1 = await userService.createUser({ nickname: 'topplayer2' });
        const user2 = await userService.createUser({ nickname: 'midplayer2' });
        const user3 = await userService.createUser({ nickname: 'lowplayer2' });

        // Store scores in scores collection
        await scoreService.createScore({
            userId: user1._id.toString(),
            gameId: '607f1f77bcf86cd799439021',
            mode: 'normal_mode',
            points: 200
        });

        await scoreService.createScore({
            userId: user2._id.toString(),
            gameId: '607f1f77bcf86cd799439022',
            mode: 'normal_mode',
            points: 150
        });

        await scoreService.createScore({
            userId: user3._id.toString(),
            gameId: '607f1f77bcf86cd799439023',
            mode: 'normal_mode',
            points: 100
        });

        const leaderboard = await leaderboardService.getLeaderboard({
            mode: 'normal_mode',
            period: 'all_time',
            limit: 10,
            offset: 0
        });

        // Filter to only our test users
        const testNicknames = ['topplayer2', 'midplayer2', 'lowplayer2'];
        const filteredLeaderboard = leaderboard.filter(entry => testNicknames.includes(entry.nickname));

        expect(filteredLeaderboard).to.have.lengthOf(3);
        expect(filteredLeaderboard[0].nickname).to.equal('topplayer2');
        expect(filteredLeaderboard[0].totalScore).to.equal(200);
        expect(filteredLeaderboard[1].nickname).to.equal('midplayer2');
        expect(filteredLeaderboard[2].nickname).to.equal('lowplayer2');
    });

    // LB04: Get total score by user
    it('[LEADERBOARD / LB04] - Get total score by user', async () => {
        const user = await userService.createUser({ nickname: 'totalscorer' });

        await scoreService.createScore({
            userId: user._id.toString(),
            gameId: '507f1f77bcf86cd799439031',
            mode: 'time_attack',
            points: 80
        });

        const total = await scoreService.getTotalScoreByUser(user._id.toString(), 'time_attack', 'all_time');

        expect(total.totalPoints).to.equal(80);
        expect(total.gameCount).to.equal(1);
    });
});
