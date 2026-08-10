const { logger, LOG_LEVELS } = require('../utilities/logger');

function accessLogMiddleware(req, res, next) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        logger.log({
            level: res.statusCode >= 500 ? LOG_LEVELS.ERROR : LOG_LEVELS.INFO,
            message: `${req.method} ${req.originalUrl} ${res.statusCode}`,
            method: req.method,
            status: res.statusCode,
            traceId: req.id,
            module: 'http',
            data: { durationMs: Math.round(durationMs * 10) / 10 },
        });
    });

    next();
}

module.exports = { accessLogMiddleware };
