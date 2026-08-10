const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const mongo = require('../../utilities/mongodb');
const { HttpError } = require('../../utilities/http-error');
const { toPublicUser } = require('../../utilities/sanitize-user');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../utilities/env');

const scryptAsync = promisify(crypto.scrypt);

const SCRYPT_KEYLEN = 64;

/**
 * Hash a password using scrypt (async — never blocks the event loop).
 * Stored format: `<salt>:<hash>`.
 */
async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await scryptAsync(password, salt, SCRYPT_KEYLEN);
    return `${salt}:${hash.toString('hex')}`;
}

/**
 * Verify a password against a stored `<salt>:<hash>` value.
 */
async function verifyPassword(password, stored) {
    if (typeof stored !== 'string' || !stored.includes(':')) {
        return false;
    }
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const candidate = await scryptAsync(password, salt, SCRYPT_KEYLEN);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), candidate);
}

/**
 * Sign a JWT for a user document.
 */
function signToken(user) {
    return jwt.sign(
        { sub: user._id.toString(), email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

class AuthService {
    constructor(client) {
        this.client = client;
        this.collection = 'users';
    }

    /**
     * Register a new account and return a session token.
     * @returns {{ token: string, user: Object }}
     */
    async register({ email, nickname, password }) {
        if (!email || !password) {
            throw new HttpError(400, 'Email and password are required');
        }
        if (password.length < 8) {
            throw new HttpError(400, 'Password must be at least 8 characters');
        }
        const normalizedEmail = email.trim().toLowerCase();

        const existing = await mongo.findOne(this.client, this.collection, { email: normalizedEmail });
        if (existing) {
            throw new HttpError(409, 'Email already exists');
        }

        const user = {
            email: normalizedEmail,
            nickname: nickname ? nickname.trim().toLowerCase() : null,
            passwordHash: await hashPassword(password),
            milestones: [],
            xp: 0,
            powerUps: { hint: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await mongo.insertOne(this.client, this.collection, user);
        const created = { ...user, _id: result.insertedId };
        return { token: signToken(created), user: toPublicUser(created) };
    }

    /**
     * Authenticate an existing account.
     * @returns {{ token: string, user: Object }}
     */
    async login({ email, password }) {
        if (!email || !password) {
            throw new HttpError(400, 'Email and password are required');
        }

        const user = await mongo.findOne(this.client, this.collection, {
            email: email.trim().toLowerCase(),
        });

        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            throw new HttpError(401, 'Invalid email or password');
        }

        return { token: signToken(user), user: toPublicUser(user) };
    }

    /**
     * Load a user by id (used by the `me` endpoint / auth middleware).
     */
    async getUserById(userId) {
        const user = await mongo.findOne(
            this.client,
            this.collection,
            { _id: mongo.getObjectId(userId) }
        );
        if (!user) {
            throw new HttpError(404, 'User not found');
        }
        return toPublicUser(user);
    }
}

module.exports = AuthService;
module.exports.hashPassword = hashPassword;
module.exports.verifyPassword = verifyPassword;
module.exports.signToken = signToken;
