function errorMiddleware(err, req, res, next) {
    const requestId = req.id || 'unknown';
    console.error(`[${requestId}]`, err);

    if (err.status && err.errors) {
        return res.status(err.status).json({
        status: err.status,
        message: 'Request validation failed',
        requestId,
        errors: err.errors,
        });
    }

    res.status(err.status || 500).json({
        status: err.status || 500,
        message: err.message || 'Internal Server Error',
        requestId,
    });
}

module.exports = { errorMiddleware };
