const MilestoneService = require('./service');
const milestoneRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

module.exports = async (app, config) => {
    const { mongoClient } = config;
    const milestoneService = new MilestoneService(mongoClient);

    await milestoneService.initializeMilestones();

    app.use(
        `/${ROUTE_PREPEND}/${VERSION}/milestones`,
        milestoneRoutes(milestoneService)
    );

    return milestoneService;
};