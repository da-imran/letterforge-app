const ProgressionService = require('./service');
const progressionRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

module.exports = async (app, config) => {
    const progressionService = new ProgressionService(config.mongoClient);

    app.use(
        `/${ROUTE_PREPEND}/${VERSION}/progression`,
        progressionRoutes(progressionService)
    );

    return progressionService;
};
