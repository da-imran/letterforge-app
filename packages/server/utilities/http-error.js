/**
 * HttpError — an error carrying an HTTP status code.
 * Thrown by services/routes for expected client-facing failures so the
 * error middleware can respond with JSON instead of a generic 500.
 */
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'HttpError';
    }
}

module.exports = { HttpError };
