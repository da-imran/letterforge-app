const amqp = require('amqplib');
const { logger, LOG_LEVELS } = require('./logger');
const {
    RABBITMQ_ENABLED,
    RABBITMQ_URI,
    RABBITMQ_QUEUE_SCORES,
    RABBITMQ_PREFETCH,
} = require('./env');

// All functions hang off a shared `api` object so internal cross-calls go
// through the same reference that consumers of this module stub with sinon
// (stubbing `module.exports` only works when internal callers use `api.x`).
const api = {};

// Lazily-initialized shared connection + channel. Reconnects transparently on
// channel/connection close so a broker restart doesn't break a long-running
// API or worker process.
let connection = null;
let channel = null;
let connectingPromise = null;

/**
 * amqplib rejects with an Error whose `message` is empty (e.g. "ECONNREFUSED"
 * is only on `err.code`). Prefer whatever is actually populated.
 */
function describeError(err) {
    if (!err) return 'unknown error';
    return err.message || err.code || String(err);
}

api.connect = async function connect() {
    if (!RABBITMQ_ENABLED) return null;
    if (connection && channel) return channel;
    // Collapse concurrent connect attempts onto a single in-flight promise.
    if (connectingPromise) return connectingPromise;

    connectingPromise = (async () => {
        const conn = await amqp.connect(RABBITMQ_URI);
        try {
            const ch = await conn.createChannel();
            ch.prefetch(RABBITMQ_PREFETCH);

            ch.on('error', (err) => {
                logger.log({
                    level: LOG_LEVELS.ERROR,
                    message: `RabbitMQ channel error: ${describeError(err)}`,
                    module: 'rabbitmq',
                });
            });
            ch.on('close', () => {
                channel = null;
            });
            conn.on('close', () => {
                connection = null;
                channel = null;
            });

            connection = conn;
            channel = ch;
            return ch;
        } catch (err) {
            try { await conn.close(); } catch (_) { /* already closed */ }
            throw err;
        }
    })();

    try {
        return await connectingPromise;
    } finally {
        connectingPromise = null;
    }
};

/**
 * Ensure a durable queue exists and return the shared channel.
 * Returns null when RabbitMQ is disabled or unreachable, so callers (both the
 * API boot path and the worker) degrade gracefully instead of crashing.
 * Set `logFailures` false to suppress per-attempt warnings (used by the
 * background retry loop).
 */
api.assertQueue = async function assertQueue(queue = RABBITMQ_QUEUE_SCORES, options = {}, logFailures = true) {
    let ch;
    try {
        ch = await api.connect();
    } catch (err) {
        if (logFailures) {
            logger.log({
                level: LOG_LEVELS.WARNING,
                message: `RabbitMQ unavailable (queue ${queue}): ${describeError(err)}. Is the broker running?`,
                module: 'rabbitmq',
            });
        }
        return null;
    }
    if (!ch) return null;

    try {
        await ch.assertQueue(queue, { durable: true, ...options });
    } catch (err) {
        if (logFailures) {
            logger.log({
                level: LOG_LEVELS.WARNING,
                message: `RabbitMQ assertQueue failed (${queue}): ${describeError(err)}`,
                module: 'rabbitmq',
            });
        }
        return null;
    }
    return ch;
};

/**
 * Publish a JSON message to a queue. Best-effort: returns false (never
 * throws) when the broker is unavailable so callers can fall back to
 * synchronous processing.
 */
api.publish = async function publish(queue, message, options = {}) {
    try {
        const ch = await api.assertQueue(queue);
        if (!ch) return false;
        return ch.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
            persistent: true,
            ...options,
        });
    } catch (err) {
        logger.log({
            level: LOG_LEVELS.WARNING,
            message: `RabbitMQ publish failed (falling back to sync): ${describeError(err)}`,
            module: 'rabbitmq',
        });
        return false;
    }
};

/**
 * Consume messages from a queue. The handler receives the parsed JSON payload
 * and the raw message. Handler errors are treated as transient — the message
 * is nacked with requeue so it is retried (callers should ack/skip messages
 * they cannot process permanently).
 */
api.consume = async function consume(queue, handler, { silent = false } = {}) {
    const ch = await api.assertQueue(queue, {}, !silent);
    if (!ch) return null;

    try {
        await ch.consume(queue, async (msg) => {
            if (!msg) return;

            let payload;
            try {
                payload = JSON.parse(msg.content.toString());
            } catch (err) {
                logger.log({
                    level: LOG_LEVELS.ERROR,
                    message: `RabbitMQ malformed message dropped: ${describeError(err)}`,
                    module: 'rabbitmq',
                });
                return ch.ack(msg);
            }

            try {
                await handler(payload, msg);
                ch.ack(msg);
            } catch (err) {
                logger.log({
                    level: LOG_LEVELS.ERROR,
                    message: `RabbitMQ message handler failed (requeueing): ${describeError(err)}`,
                    module: 'rabbitmq',
                });
                ch.nack(msg, false, true);
            }
        });
    } catch (err) {
        logger.log({
            level: LOG_LEVELS.ERROR,
            message: `RabbitMQ consume setup failed (${queue}): ${describeError(err)}`,
            module: 'rabbitmq',
        });
        return null;
    }

    return ch;
};

/**
 * Consume from a queue with automatic reconnect. If the broker is unreachable
 * (e.g. it starts after the API/worker, or it restarts), this retries in the
 * background with exponential backoff and resumes consuming as soon as the
 * broker is available — no process restart needed.
 *
 * Returns a controller: `{ stop() }`.
 */
api.consumeWithRetry = function consumeWithRetry(queue, handler, options = {}) {
    const baseDelayMs = options.baseDelayMs || 1000;
    const maxDelayMs = options.maxDelayMs || 30000;
    let stopped = false;
    let retryTimer = null;
    let currentChannel = null;
    let firstFailureLogged = false;

    const scheduleRetry = (attempt) => {
        if (stopped) return;
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        retryTimer = setTimeout(() => {
            retryTimer = null;
            tryConsume(attempt + 1);
        }, delay);
    };

    const tryConsume = async (attempt) => {
        if (stopped) return;
        const ch = await api.consume(queue, handler, { silent: true });
        if (stopped) {
            if (ch) { try { ch.close(); } catch (_) { /* ignore */ } }
            return;
        }
        if (!ch) {
            if (!firstFailureLogged) {
                firstFailureLogged = true;
                logger.log({
                    level: LOG_LEVELS.WARNING,
                    message: `RabbitMQ unreachable (queue ${queue}) - will keep retrying in the background`,
                    module: 'rabbitmq',
                });
            }
            scheduleRetry(attempt);
            return;
        }

        firstFailureLogged = false;
        currentChannel = ch;
        logger.log({
            level: LOG_LEVELS.INFO,
            message: `Consuming from queue ${queue}`,
            module: 'rabbitmq',
        });
        ch.on('close', () => {
            currentChannel = null;
            scheduleRetry(0);
        });
    };

    tryConsume(0);

    return {
        stop() {
            stopped = true;
            if (retryTimer) clearTimeout(retryTimer);
            if (currentChannel) { try { currentChannel.close(); } catch (_) { /* ignore */ } }
        },
    };
};

api.close = async function close() {
    if (channel) {
        try { await channel.close(); } catch (_) { /* already closed */ }
    }
    if (connection) {
        try { await connection.close(); } catch (_) { /* already closed */ }
    }
    connection = null;
    channel = null;
};

api.isEnabled = () => RABBITMQ_ENABLED;

module.exports = api;
