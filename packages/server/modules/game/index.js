const GameService = require('./service');
const gameRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

let scoreService = null;
let milestoneService = null;

module.exports = async (app, config, scoreServiceParam, milestoneServiceParam) => {
    if (scoreServiceParam) {
        scoreService = scoreServiceParam;
    }
    if (milestoneServiceParam) {
        milestoneService = milestoneServiceParam;
    }

    const gameService = new GameService(config.mongoClient, milestoneService);

    app.use(
        `/${ROUTE_PREPEND}/${VERSION}`,
        gameRoutes(gameService, scoreService)
    );
};
