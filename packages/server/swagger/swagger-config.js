const swaggerUi = require('swagger-ui-express');
const { ROUTE_PREPEND, VERSION, PORT, HOSTNAME } = require('../utilities/env');

module.exports = (app) => {
    const swaggerFile = require('./swagger-output.json');

    const swaggerPath = `/${ROUTE_PREPEND}/${VERSION}/api-docs`;
    app.use(swaggerPath, swaggerUi.serve, swaggerUi.setup(swaggerFile, {
        explorer: true,
        swaggerOptions: {
            docExpansion: 'list',
            filter: true,
            showRequestDuration: true,
            tryItOutEnabled: true,
        }
    }));

    console.log(`Swagger docs available at http://${HOSTNAME}:${PORT}${swaggerPath}`);
};