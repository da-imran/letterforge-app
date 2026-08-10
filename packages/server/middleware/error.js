function errorMiddleware(err, req, res, _next) {
    const requestId = req.id || 'unknown';
    const isExpected = typeof err.status === 'number' && err.status >= 400 && err.status < 500;

    if (!isExpected) {
        console.error(`[${requestId}]`, err);
    }

    // express.json body-parser errors (malformed JSON) carry status 400
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
        return res.status(err.status || 400).json({
            status: err.status || 400,
            message: err.type === 'entity.too.large' ? 'Request body too large' : 'Malformed JSON in request body',
            requestId,
        });
    }

    if (err.status && err.errors) {
        return res.status(err.status).json({
            status: err.status,
            message: 'Request validation failed',
            requestId,
            errors: err.errors,
        });
    }

    const status = typeof err.status === 'number' ? err.status : 500;
    res.status(status).json({
        status,
        message: err.message || 'Internal Server Error',
        requestId,
    });
}

module.exports = { errorMiddleware };
