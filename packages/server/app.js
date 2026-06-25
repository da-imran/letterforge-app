require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const mongodb = require('./utilities/mongodb');
const swaggerConfig = require('./swagger/swagger-config');
const { logger, LOG_LEVELS } = require('./utilities/logger');
const { HOSTNAME, ROUTE_PREPEND, VERSION, NODE_ENV: ENVIRONMENT, PORT, SERVICE_NAME } = require('./utilities/env');

// const { checkSecretObjectNull, secrets } = require('./utilities/secrets');

(async () => {
	try {
		// const secretsLoaded = await checkSecretObjectNull();
		// if (!secretsLoaded) throw new Error('Critical secrets not loaded');

		// Read MONGO_URI from process.env (populated by dotenv above) for local/dev
		// environments. In a future production deploy a secrets manager can replace
		// this branch — until then we fall back to process.env.MONGO_URI to avoid a
		// ReferenceError when the secrets module is absent.
		const mongoUri = ['local', 'dev', 'development'].includes(ENVIRONMENT)
			? process.env.MONGO_URI
			: (process.env.MONGO_URI || (typeof secrets !== 'undefined' ? secrets.MONGO_URI.value : undefined));

		const mongoClient = await mongodb.clientConnect(mongoUri);
		const config = { mongoClient };

		const app = express();
		app.use(express.urlencoded({ extended: true }));
		app.use(express.json({ limit: '50mb' }));

		app.use(cors({
			origin: '*',
			methods: 'PATCH, POST, GET, DELETE, PUT',
			allowedHeaders: 'Origin, X-Requested-With, Content-disposition, Content-Type, Accept, Authorization, x-api-key'
		}));

		app.use((req, res, next) => {
			req.id = crypto.randomUUID();
			res.setHeader('X-Request-Id', req.id);
			next();
		});

		app.get(`/${ROUTE_PREPEND}/${VERSION}`, (_, res) => {
			res.status(200).json({
				status: 200,
				message: 'Route is working',
				data: { apiVersion: process.env.API_VERSION, appVersion: process.env.APP_VERSION },
			});
		});

		await require('./index')(app, config);

		const { loadDictionary } = require('./modules/dictionary/service'); 
		loadDictionary();

		swaggerConfig(app);

		app.listen(PORT, '0.0.0.0', () => {
		console.log(`Backend running on http://${HOSTNAME}:${PORT}/${ROUTE_PREPEND}/${VERSION} in ${ENVIRONMENT} mode`);
		});

	} catch (error) {
		console.error('Failed to start engine:', error);
		logger?.log?.({
			level: LOG_LEVELS.CRITICAL,
			message: error.message || error,
			status: 500,
			service: SERVICE_NAME,
		});
		process.exit(1);
	}
})();