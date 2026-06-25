const UserService = require('./service');
const userRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

module.exports = async (app, config) => {
    const userService = new UserService(config.mongoClient);

    app.use(
        `/${ROUTE_PREPEND}/${VERSION}/users`,
        userRoutes(userService)
    );
};
