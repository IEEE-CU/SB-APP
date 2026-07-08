#!/usr/bin/env node
// Boots the backend against a real in-memory MongoDB instance and seeds
// fixture users (ADMIN + OFFICE_BEARER) so contract tests and the RBAC
// matrix script can log in and exercise real, role-gated endpoints without
// needing a MongoDB service container in CI.
const { MongoMemoryServer } = require('mongodb-memory-server');
const { TEST_USERS } = require('../test/fixtures');

async function main() {
    const mongod = await MongoMemoryServer.create();

    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    process.env.PORT = process.env.PORT || 5000;

    // server.js starts listening as a side effect of being required.
    require('../src/server.js');

    const User = require('../src/models/User');

    await User.create([
        { email: TEST_USERS.admin.email, password: TEST_USERS.admin.password, role: TEST_USERS.admin.role, name: 'Test Admin' },
        { email: TEST_USERS.officeBearer.email, password: TEST_USERS.officeBearer.password, role: TEST_USERS.officeBearer.role, name: 'Test Office Bearer' },
    ]);

    console.log(`Seeded test fixture users (${TEST_USERS.admin.email}, ${TEST_USERS.officeBearer.email}).`);
}

main().catch((err) => {
    console.error('Failed to start test server:', err);
    process.exit(1);
});
