const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

test('GET /api/v1/health reports a connected database', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.db, 'connected');
});
