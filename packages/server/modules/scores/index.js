const ScoreService = require('./service');
const scoreRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

module.exports = async (app, config) => {
    const scoreService = new ScoreService(config.mongoClient);

    app.use(
        `/${ROUTE_PREPEND}/${VERSION}/scores`,
        scoreRoutes(scoreService)
    );

    return scoreService;
};
