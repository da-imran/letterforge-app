const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const RealtimeHub = require('./hub');
const { JWT_SECRET } = require('../../utilities/env');

/**
 * Attach a WebSocket endpoint to the existing HTTP server.
 *
 * Clients connect to `/ws?token=<jwt>`. The token is verified once on
 * connect; the authenticated subject is attached to the hub so duel updates
 * can be scoped per user.
 */
module.exports = (server, duelService) => {
    const wss = new WebSocketServer({ server, path: '/ws' });
    const hub = new RealtimeHub(duelService);

    wss.on('connection', (socket, req) => {
        let userId = null;
        try {
            const url = new URL(req.url, 'http://localhost');
            const token = url.searchParams.get('token');
            if (token) {
                const payload = jwt.verify(token, JWT_SECRET);
                userId = payload.sub || null;
            }
        } catch {
            userId = null;
        }

        hub.onConnect(socket, userId);
    });

    wss.on('error', (err) => {
        console.error('WebSocket server error:', err.message);
    });

    return { wss, hub };
};
