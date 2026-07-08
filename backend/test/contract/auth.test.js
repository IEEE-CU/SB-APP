const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TEST_USERS } = require('../fixtures');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const API = `${BASE_URL}/api/v1`;

test('POST /auth/login succeeds with valid fixture credentials and returns the expected shape', async () => {
    const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_USERS.admin.email, password: TEST_USERS.admin.password }),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(typeof body.token, 'string');
    assert.equal(body.user.email, TEST_USERS.admin.email);
    assert.equal(body.user.role, TEST_USERS.admin.role);
    assert.equal(body.user.password, undefined);
});

test('POST /auth/login rejects an incorrect password', async () => {
    const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_USERS.admin.email, password: 'wrong-password' }),
    });
    const body = await res.json();

    assert.equal(res.status, 401);
    assert.equal(body.success, false);
});

test('GET /auth/me requires authentication', async () => {
    const res = await fetch(`${API}/auth/me`);
    assert.equal(res.status, 401);
});

test('GET /auth/me returns the authenticated user with a valid token', async () => {
    const loginRes = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_USERS.officeBearer.email, password: TEST_USERS.officeBearer.password }),
    });
    const { token } = await loginRes.json();

    const meRes = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const body = await meRes.json();

    assert.equal(meRes.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.user.email, TEST_USERS.officeBearer.email);
});
