const { EventEmitter } = require('events');

const OPEN = 1; // ws.OPEN

/**
 * Tracks WebSocket subscriptions per duel and broadcasts live updates.
 *
 * Decoupled from the raw `ws` server so the room/broadcast logic can be
 * unit-tested with mock sockets. Incoming connections are registered via
 * `onConnect`; the hub listens for `duel:updated` events emitted by the
 * DuelService and pushes a fresh snapshot to every subscriber.
 */
class RealtimeHub extends EventEmitter {
constructor(duelService) {
        super();
        this.duelService = duelService;
        this.rooms = new Map(); // duelId -> Set<socket>
        this.socketRooms = new Map(); // socket -> Set<duelId>
        this.socketUsers = new Map(); // socket -> userId (string | null)

        this._onDuelUpdated = this._onDuelUpdated.bind(this);

        if (duelService && typeof duelService.on === 'function') {
            duelService.on('duel:updated', this._onDuelUpdated);
        }
    }

    /**
     * Register a connected socket. `userId` is the authenticated JWT subject
     * (or null for anonymous connections).
     */
    onConnect(socket, userId) {
        this.socketUsers.set(socket, userId);
        socket.on('message', (data) => this._onSocketMessage(socket, data));
        socket.on('close', () => this._onSocketClose(socket));
        this.send(socket, { type: 'connected', userId });
    }

    _onSocketMessage(socket, data) {
        let msg;
        try {
            msg = JSON.parse(data.toString());
        } catch {
            return;
        }

        if (msg.type === 'subscribe' && msg.duelId) {
            this.subscribe(socket, msg.duelId);
        } else if (msg.type === 'unsubscribe' && msg.duelId) {
            this.unsubscribe(socket, msg.duelId);
        } else if (msg.type === 'ping') {
            this.send(socket, { type: 'pong' });
            // Treat a valid heartbeat as proof of life for every subscribed
            // duel the user is a participant of.
            const userId = this.socketUsers.get(socket);
            if (userId && this.duelService) {
                const rooms = this.socketRooms.get(socket);
                if (rooms) {
                    for (const duelId of rooms) {
                        this.duelService.onHeartbeat(duelId, userId).catch((err) => {
                            console.error('Heartbeat touch failed:', err.message);
                        });
                    }
                }
            }
        }
    }

    _onSocketClose(socket) {
        this.disconnect(socket);
    }

    subscribe(socket, duelId) {
        if (!this.rooms.has(duelId)) this.rooms.set(duelId, new Set());
        this.rooms.get(duelId).add(socket);

        if (!this.socketRooms.has(socket)) this.socketRooms.set(socket, new Set());
        this.socketRooms.get(socket).add(duelId);

        this.send(socket, { type: 'subscribed', duelId });
    }

    unsubscribe(socket, duelId) {
        const room = this.rooms.get(duelId);
        if (room) {
            room.delete(socket);
            if (room.size === 0) this.rooms.delete(duelId);
        }
        this.socketRooms.get(socket)?.delete(duelId);
    }

    disconnect(socket) {
        const rooms = this.socketRooms.get(socket);
        if (rooms) {
            for (const duelId of rooms) {
                const room = this.rooms.get(duelId);
                if (room) {
                    room.delete(socket);
                    if (room.size === 0) this.rooms.delete(duelId);
                }
            }
        }
        this.socketRooms.delete(socket);
        this.socketUsers.delete(socket);
    }

    /**
     * Broadcast the latest duel snapshot to all subscribers. Each subscriber
     * gets a view scoped to their own user id (so `myGameId` is correct).
     */
    async _onDuelUpdated(duelId) {
        const room = this.rooms.get(duelId);
        if (!room || room.size === 0) return;

        const payloads = new Map(); // userId -> JSON string
        for (const socket of room) {
            if (!socket || socket.readyState !== OPEN) continue;
            const userId = this.socketUsers.get(socket) || null;
            const key = userId || 'anon';
            if (!payloads.has(key)) {
                try {
                    const duel = await this.duelService.getDuel(duelId, userId);
                    payloads.set(key, JSON.stringify({ type: 'duel:update', duel }));
                } catch {
                    payloads.set(key, null);
                }
            }
            const payload = payloads.get(key);
            if (payload) this.sendRaw(socket, payload);
        }
    }

    send(socket, payload) {
        if (socket && socket.readyState === OPEN) {
            socket.send(JSON.stringify(payload));
        }
    }

    sendRaw(socket, raw) {
        if (socket && socket.readyState === OPEN) {
            socket.send(raw);
        }
    }
}

module.exports = RealtimeHub;
