const LeaderboardService = require('./service');
const leaderboardRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

module.exports = async (app, config, scoreService) => {
    const leaderboardService = new LeaderboardService(config.mongoClient);

    app.use(
        `/${ROUTE_PREPEND}/${VERSION}/leaderboard`,
        leaderboardRoutes(leaderboardService)
    );

    // Every new score invalidates the matching leaderboard rows. This is the
    // single write path (both /leaderboard/submit and /games/:id/leaderboard
    // funnel through ScoreService.createScore).
    if (scoreService) {
        scoreService.onCreated = (mode) => leaderboardService.invalidateCache(mode);
    }

    return leaderboardService;
};
