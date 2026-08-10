require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongodb = require('./utilities/mongodb');
const swaggerConfig = require('./swagger/swagger-config');
const { logger, LOG_LEVELS } = require('./utilities/logger');
const { requestIdMiddleware } = require('./middleware/request-id');
const { accessLogMiddleware } = require('./middleware/access-log');
const { errorMiddleware } = require('./middleware/error');
const { HOSTNAME, ROUTE_PREPEND, VERSION, NODE_ENV: ENVIRONMENT, PORT, SERVICE_NAME, API_VERSION, APP_VERSION } = require('./utilities/env');

(async () => {
	try {
		const mongoClient = await mongodb.clientConnect(process.env.MONGO_URI);
		await mongodb.ensureIndexes(mongoClient);

		const config = { mongoClient };

		const app = express();
		app.disable('x-powered-by');
		app.set('trust proxy', 1);

		app.use(requestIdMiddleware);
		app.use(accessLogMiddleware);
		app.use(helmet());

		app.use(express.urlencoded({ extended: true }));
		app.use(express.json({ limit: '1mb' }));

		app.use(cors({
			origin: '*',
			methods: 'PATCH, POST, GET, DELETE, PUT',
			allowedHeaders: 'Origin, X-Requested-With, Content-disposition, Content-Type, Accept, Authorization, x-api-key'
		}));

		const apiLimiter = rateLimit({
			windowMs: 60 * 1000,
			max: 300,
			standardHeaders: true,
			legacyHeaders: false,
			message: { status: 429, message: 'Too many requests, please try again later' },
		});
		app.use(`/${ROUTE_PREPEND}/${VERSION}`, apiLimiter);

		const authLimiter = rateLimit({
			windowMs: 60 * 1000,
			max: 20,
			standardHeaders: true,
			legacyHeaders: false,
			message: { status: 429, message: 'Too many authentication attempts, please try again later' },
		});
		app.use(`/${ROUTE_PREPEND}/${VERSION}/auth`, authLimiter);

		app.get(`/${ROUTE_PREPEND}/${VERSION}`, (_, res) => {
			res.status(200).json({
				status: 200,
				message: 'Route is working',
				data: { apiVersion: API_VERSION, appVersion: APP_VERSION },
			});
		});

		await require('./index')(app, config);

		const { loadDictionary } = require('./modules/dictionary/service');
		loadDictionary();

		swaggerConfig(app);

		// 404 handler for unmatched API routes (JSON, not HTML)
		app.use(`/${ROUTE_PREPEND}/${VERSION}`, (req, res) => {
			res.status(404).json({ status: 404, message: `Route not found: ${req.method} ${req.originalUrl}` });
		});

		app.use(errorMiddleware);

		const server = app.listen(PORT, '0.0.0.0', () => {
			logger.log({
				level: LOG_LEVELS.INFO,
				message: `Backend running on http://${HOSTNAME}:${PORT}/${ROUTE_PREPEND}/${VERSION} in ${ENVIRONMENT} mode`,
			});
		});

		// WebSocket endpoint for realtime duel updates (attached to the HTTP server).
		require('./modules/realtime')(server, config.duelService);

		server.on('error', (err) => {
			if (err.code === 'EADDRINUSE') {
				console.error(`Port ${PORT} is already in use`);
			} else {
				console.error('Server error:', err);
			}
			process.exit(1);
		});

		function shutdown(signal) {
			logger.log({
				level: LOG_LEVELS.INFO,
				message: `${signal} received - shutting down gracefully`,
			});

			const forceExit = setTimeout(() => {
				console.error('Forced shutdown after timeout');
				process.exit(1);
			}, 10000);
			forceExit.unref();

			server.close(async () => {
				try {
					await mongoClient.close();
				} catch (closeErr) {
					console.error('Error closing MongoDB connection:', closeErr);
				}
				process.exit(0);
			});
		}

		process.on('SIGINT', () => shutdown('SIGINT'));
		process.on('SIGTERM', () => shutdown('SIGTERM'));

	} catch (error) {
		logger.log({
			level: LOG_LEVELS.CRITICAL,
			message: error.message || error,
			status: 500,
			service: SERVICE_NAME,
		});
		process.exit(1);
	}
})();
