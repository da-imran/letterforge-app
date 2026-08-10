const AuthService = require('./service');
const authRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

module.exports = async (app, config) => {
    const authService = new AuthService(config.mongoClient);

    app.use(
        `/${ROUTE_PREPEND}/${VERSION}/auth`,
        authRoutes(authService)
    );

    return authService;
};
