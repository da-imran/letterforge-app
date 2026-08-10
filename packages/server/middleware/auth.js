const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../utilities/env');

function extractToken(req) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
        return header.slice(7);
    }
    return null;
}

/**
 * Require a valid Bearer token. On success sets `req.userId`.
 */
function authRequired(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ status: 401, message: 'Authentication required', requestId: req.id });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = payload.sub;
        return next();
    } catch {
        return res.status(401).json({ status: 401, message: 'Invalid or expired token', requestId: req.id });
    }
}

/**
 * Attach `req.userId` when a valid token is present; never blocks the request.
 */
function optionalAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return next();
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = payload.sub;
    } catch {
        // Invalid token: treat as anonymous rather than blocking reads.
    }
    return next();
}

module.exports = { authRequired, optionalAuth };
