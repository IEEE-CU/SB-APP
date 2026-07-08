// Shared test-user fixtures used by the test-server bootstrap, contract
// tests, and the RBAC matrix script, so all three agree on one set of
// credentials instead of duplicating literals.
const TEST_USERS = {
    admin: { email: 'admin@test.local', password: 'Test1234!', role: 'ADMIN' },
    officeBearer: { email: 'officebearer@test.local', password: 'Test1234!', role: 'OFFICE_BEARER' },
};

module.exports = { TEST_USERS };
