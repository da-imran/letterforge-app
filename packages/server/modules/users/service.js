const mongo = require('../../utilities/mongodb');
const { ObjectId } = require('mongodb');

class UserService {
    constructor(client) {
        this.client = client;
        this.collection = 'users';
    }

    /**
     * Create a new user
     * @param {Object} params
     * @param {string} params.email - User's email (required)
     * @param {string} params.nickname - User's nickname (optional, can be set later)
     * @returns {Object} Created user
     */
    async createUser({ email, nickname }) {
        if (email && typeof email !== 'string') {
            throw new Error('Email must be a string');
        }

        const user = {
            email: email ? email.trim().toLowerCase() : null,
            nickname: nickname ? nickname.trim().toLowerCase() : null,
            milestones: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await mongo.insertOne(this.client, this.collection, user);

        return {
            ...user,
            _id: result.insertedId,
        };
    }

    /**
     * Get user by ID
     * @param {string} userId
     * @returns {Object|null}
     */
    async getUserById(userId) {
        const user = await mongo.findOne(
            this.client,
            this.collection,
            { _id: mongo.getObjectId(userId) }
        );
        return user;
    }

    /**
     * Get user by nickname
     * @param {string} nickname
     * @returns {Object|null}
     */
    async getUserByNickname(nickname) {
        if (!nickname) return null;

        const user = await mongo.findOne(
            this.client,
            this.collection,
            { nickname: nickname.trim().toLowerCase() }
        );
        return user;
    }

    /**
     * Get user by email
     * @param {string} email
     * @returns {Object|null}
     */
    async getUserByEmail(email) {
        if (!email) return null;

        const user = await mongo.findOne(
            this.client,
            this.collection,
            { email: email.trim().toLowerCase() }
        );
        return user;
    }

    /**
     * Update user
     * @param {string} userId
     * @param {Object} updates
     * @returns {Object|null}
     */
    async updateUser(userId, updates) {
        const updateObj = {
            ...updates,
            updatedAt: new Date(),
        };

        if (updates.nickname) {
            updateObj.nickname = updates.nickname.trim().toLowerCase();
        }

        const result = await mongo.findOneAndUpdate(
            this.client,
            this.collection,
            { _id: mongo.getObjectId(userId) },
            updateObj
        );

        if (result) {
            return result;
        }

        return this.getUserById(userId);
    }

    /**
     * Delete user
     * @param {string} userId
     * @returns {boolean}
     */
    async deleteUser(userId) {
        const result = await mongo.deleteOne(
            this.client,
            this.collection,
            { _id: mongo.getObjectId(userId) }
        );
        return result.deletedCount > 0;
    }
}

module.exports = UserService;
