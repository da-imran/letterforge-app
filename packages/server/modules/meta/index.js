const metaRoutes = require('./route');
const { ROUTE_PREPEND, VERSION } = require('../../utilities/env');

module.exports = async (app, _config) => {
    app.use(
        `/${ROUTE_PREPEND}/${VERSION}`,
        metaRoutes
    );
};
