const DuelService = require('./service');
const duelRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

module.exports = async (app, config, gameService) => {
    const duelService = new DuelService(config.mongoClient, gameService);

    app.use(
        `/${ROUTE_PREPEND}/${VERSION}/duels`,
        duelRoutes(duelService)
    );

    // Expose for the realtime layer (WebSocket) after the server starts.
    config.duelService = duelService;

    return duelService;
};
