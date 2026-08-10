const { expect } = require('chai');

const AuthService = require('../modules/auth/service');
const mongodb = require('../utilities/mongodb');

const {
    MONGO_URI,
} = require('../utilities/env');

describe('Auth (async scrypt password hashing)', () => {
    let mongoClient;
    let authService;

    before(async () => {
        mongoClient = await mongodb.clientConnect(MONGO_URI);
        authService = new AuthService(mongoClient);
    });

    after(async () => {
        await mongodb.deleteMany(mongoClient, 'users');
        await mongoClient.close();
    });

    it('[AUTH / AU01] - register hashes the password and returns a token', async () => {
        const result = await authService.register({
            email: 'scrypt@test.dev',
            password: 'password123',
            nickname: 'scryptuser',
        });

        expect(result.token).to.be.ok;
        expect(result.user).to.not.have.property('passwordHash');
        expect(result.user.xp).to.equal(0);

        const stored = await mongodb.findOne(mongoClient, 'users', { email: 'scrypt@test.dev' });
        expect(stored.passwordHash).to.match(/^[a-f0-9]+:[a-f0-9]+$/);
    });

    it('[AUTH / AU02] - login round-trips with the correct password', async () => {
        const login = await authService.login({
            email: 'scrypt@test.dev',
            password: 'password123',
        });

        expect(login.token).to.be.ok;
        expect(login.user.email).to.equal('scrypt@test.dev');
    });

    it('[AUTH / AU03] - login rejects a wrong password with 401', async () => {
        const err = await authService
            .login({ email: 'scrypt@test.dev', password: 'wrongpass123' })
            .catch(e => e);

        expect(err.status).to.equal(401);
    });
});
