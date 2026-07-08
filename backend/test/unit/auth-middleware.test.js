const { test } = require('node:test');
const assert = require('node:assert/strict');
const { authorize, societyAccess } = require('../../src/middleware/auth');

function mockRes() {
    const res = {};
    res.statusCode = null;
    res.body = null;
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (body) => {
        res.body = body;
        return res;
    };
    return res;
}

test('authorize rejects unauthenticated requests with 401', () => {
    const req = {};
    const res = mockRes();
    let nextCalled = false;

    authorize('ADMIN')(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
});

test('authorize rejects roles outside the allow-list with 403', () => {
    const req = { user: { role: 'OFFICE_BEARER' } };
    const res = mockRes();
    let nextCalled = false;

    authorize('ADMIN')(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
});

test('authorize calls next for an allowed role', () => {
    const req = { user: { role: 'ADMIN' } };
    const res = mockRes();
    let nextCalled = false;

    authorize('ADMIN', 'OFFICE_BEARER')(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
});

test('societyAccess rejects unauthenticated requests with 401', () => {
    const req = { params: {}, body: {}, query: {} };
    const res = mockRes();
    let nextCalled = false;

    societyAccess(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
});

test('societyAccess always allows ADMIN through', () => {
    const req = { user: { role: 'ADMIN' }, params: { societyId: 'someone-elses-society' }, body: {}, query: {} };
    const res = mockRes();
    let nextCalled = false;

    societyAccess(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
});

test('societyAccess defaults body.societyId to the user\'s own society when unspecified', () => {
    const req = { user: { role: 'OFFICE_BEARER', societyId: 'society-1' }, params: {}, body: {}, query: {} };
    const res = mockRes();
    let nextCalled = false;

    societyAccess(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.body.societyId, 'society-1');
});

test('societyAccess blocks a non-admin reaching into another society', () => {
    const req = { user: { role: 'OFFICE_BEARER', societyId: 'society-1' }, params: { societyId: 'society-2' }, body: {}, query: {} };
    const res = mockRes();
    let nextCalled = false;

    societyAccess(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
});

test('societyAccess allows a non-admin accessing their own society explicitly', () => {
    const req = { user: { role: 'OFFICE_BEARER', societyId: 'society-1' }, params: { societyId: 'society-1' }, body: {}, query: {} };
    const res = mockRes();
    let nextCalled = false;

    societyAccess(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
});
