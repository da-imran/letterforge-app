const mongo = require('mongodb');
require('dotenv').config();

const { MongoClient } = mongo;

const { MONGODB_DBNAME } = require('./env');

function getDbName() {
    return process.env.MONGODB_DBNAME || MONGODB_DBNAME || 'data';
}

/**
 * All helpers reject with the underlying driver error so callers can
 * distinguish real failures from empty results (never resolve an Error).
 * Full-document results are intentionally not logged to avoid log noise and
 * dumping potentially sensitive data to stdout.
 */
module.exports = {
	clientConnect: async (mongoDBUrl) => {
		const client = new MongoClient(mongoDBUrl, {
			maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 50,
			minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 5,
			serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000,
			connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 10000,
			socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 30000,
		});
		await client.connect();
		console.log('Connected to MongoDB');
		return client;
	},
	getObjectId: (str) => {
		try {
			return new mongo.ObjectId(str);
		} catch (error) {
			console.error('MongoDB Failed to get ObjectId:', error);
			return null;
		}
	},
	findOne: async (client, collectionName, parameters, projection) => {
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		return collection.findOne({ ...parameters }, { projection });
	},
	insertOne: async (client, collectionName, insertInput, index = false, indexType = false) => {
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		if (index && indexType) {
			await collection.createIndex({ [index]: indexType });
		}
		return collection.insertOne({ ...insertInput });
	},
	findOneAndUpdate: async (client, collectionName, matchParameters, updateInput, updateOptions, unsetFields = {}) => {
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		return collection.findOneAndUpdate(
			{ ...matchParameters },
			{ $set: { ...updateInput }, $unset: { ...unsetFields } },
			{ ...updateOptions, returnDocument: 'after' }
		);
	},
	findOneAndUpdateInc: async (client, collectionName, matchParameters, updateInput, updateOptions = {}) => {
		// Increment field by a specific value
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		return collection.findOneAndUpdate(
			{ ...matchParameters },
			{ $inc: { ...updateInput } },
			{ ...updateOptions, returnDocument: 'after' }
		);
	},
	updateOne: async (client, collectionName, matchParameters, updateInput, updateOptions = {}) => {
		// Generic updateOne (supports $inc/$set/upsert in `updateInput`/`updateOptions`)
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		return collection.updateOne({ ...matchParameters }, { ...updateInput }, { ...updateOptions });
	},
	findOneAndUpdateAddToSet: async (client, collectionName, matchParameters, updateInput, updateOptions) => {
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		return collection.findOneAndUpdate(
			{ ...matchParameters },
			{ $addToSet: { ...updateInput } },
			{ ...updateOptions, returnDocument: 'after' }
		);
	},
	deleteOne: async (client, collectionName, matchParameters) => {
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		return collection.deleteOne({ ...matchParameters });
	},
	deleteMany: async (client, collectionName, matchParameters = {}) => {
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		return collection.deleteMany({ ...matchParameters });
	},
	aggregate: async (client, collectionName, pipelines) => {
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		return collection.aggregate(pipelines).toArray();
	},
	find: async (client, collectionName, input, projection = {}) => {
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		const filter = { ...input };
		if (input && (input._id === null || input._id === undefined)) {
			delete filter._id;
		} else if (input && typeof input._id === 'string') {
			filter._id = new mongo.ObjectId(input._id);
		}
		return collection.find({ ...filter }).project({ ...projection }).toArray();
	},
	insertMany: async (client, collectionName, documents) => {
		const db = client.db(getDbName());
		const collection = db.collection(collectionName);
		return collection.insertMany(documents);
	},
	/**
	 * Create indexes required for the hot query paths. Idempotent — safe to
	 * call on every boot.
	 */
	ensureIndexes: async (client) => {
		const db = client.db(getDbName());
		const definitions = {
			scores: [
				{ key: { mode: 1, createdAt: -1 } },
				{ key: { userId: 1, mode: 1, createdAt: -1 } },
				{ key: { gameId: 1 }, unique: true },
			],
			games: [
				{ key: { userId: 1, isCompleted: 1 } },
				// Expired time-attack games are cleaned up automatically. Only
				// documents with a Date `expiresAt` are affected.
				{ key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
			],
			users: [
				{ key: { email: 1 }, unique: true },
				{ key: { nickname: 1 }, unique: true },
			],
			milestones: [
				{ key: { id: 1 }, unique: true },
			],
			duels: [
				{ key: { code: 1 }, unique: true },
				{ key: { challengerId: 1, createdAt: -1 } },
				{ key: { opponentId: 1, createdAt: -1 } },
			],
		};

		for (const [collectionName, indexes] of Object.entries(definitions)) {
			for (const { key, unique = false, options = {} } of indexes) {
				// Use Mongo's auto-generated naming so we can resolve conflicts
				// deterministically if an index spec changes (e.g. a plain
				// gameId index becoming unique).
				const name = Object.entries(key)
					.map(([field, dir]) => `${field}_${dir}`)
					.join('_');
				try {
					await db.collection(collectionName).createIndex(key, { unique, name, ...options });
				} catch (err) {
					if (err && (err.codeName === 'IndexOptionsConflict' || err.codeName === 'IndexKeySpecsConflict')) {
						await db.collection(collectionName).dropIndex(name);
						await db.collection(collectionName).createIndex(key, { unique, name, ...options });
					} else {
						throw err;
					}
				}
			}
		}
	},
};
