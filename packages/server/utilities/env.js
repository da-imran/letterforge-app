require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'letterforge-dev-secret-change-me';
if (!process.env.JWT_SECRET) {
    console.warn('[env] JWT_SECRET is not set - using an insecure development fallback. Set JWT_SECRET in production.');
}

module.exports = {
    HOSTNAME: process.env.HOSTNAME || 'localhost',
    ROUTE_PREPEND: process.env.ROUTE_PREPEND || 'letter-forge',
    API_VERSION: process.env.API_VERSION || '1.0.0',
    APP_VERSION: process.env.APP_VERSION || '1.0.0',
    SERVICE_NAME: process.env.SERVICE_NAME || 'letter-forge',
    VERSION: process.env.VERSION || 'v1',
    PORT: Number(process.env.PORT || 8888),
    MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/', // Default MongoDB localhost URI
    MONGODB_DBNAME: process.env.MONGODB_DBNAME || 'data',
    NODE_ENV: process.env.NODE_ENV || 'development', // local - env when running npm run dev / npm start
    JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};