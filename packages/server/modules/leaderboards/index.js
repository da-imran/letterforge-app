const LeaderboardService = require('./service');
const leaderboardRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

module.exports = async (app, config) => {
    const leaderboardService = new LeaderboardService(config.mongoClient);

    app.use(
        `/${ROUTE_PREPEND}/${VERSION}/leaderboard`,
        leaderboardRoutes(leaderboardService)
    );
};
