const GameService = require('./service');
const gameRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

let scoreService = null;
let milestoneService = null;
let progressionService = null;

module.exports = async (app, config, scoreServiceParam, milestoneServiceParam, progressionServiceParam) => {
    if (scoreServiceParam) {
        scoreService = scoreServiceParam;
    }
    if (milestoneServiceParam) {
        milestoneService = milestoneServiceParam;
    }
    if (progressionServiceParam) {
        progressionService = progressionServiceParam;
    }

    const gameService = new GameService(config.mongoClient, milestoneService, progressionService);

    app.use(
        `/${ROUTE_PREPEND}/${VERSION}`,
        gameRoutes(gameService, scoreService, config.scoreProducer)
    );

    return gameService;
};
