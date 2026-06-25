const { HOSTNAME, PORT, ROUTE_PREPEND, VERSION } = require('../utilities/env');

module.exports = {
	info: {
		title: 'Letter Forge Engine API',
		description: 'API Documentation for Letter Forge Engine',
		version: '1.0.0'
	},
	host: `${HOSTNAME}:${PORT}`,
	basePath: `/${ROUTE_PREPEND}/${VERSION}`,
	schemes: ['http'],
	consumes: ['application/json'],
	produces: ['application/json'],
};
