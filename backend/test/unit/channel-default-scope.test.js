// AUD-029: the default society of GET /channels (and POST /channels).
//
// Every channel and message route checks isSocietyInScope(...) against the caller's
// RBAC scope - except the branch that picks a society on the caller's behalf (no
// society named in the request). That branch used the user's own societyId, or, if
// there was none, the FIRST SOCIETY IN THE DATABASE, without any scope check. A role
// whose scope is "none" (nothing in scope) was refused by every other channel route
// yet got a society's channel list from this one.
//
// Policy under test:
//   - a society named in the request must be in scope (403 otherwise) - unchanged;
//   - a society chosen on the caller's behalf is held to the same check (403);
//   - with no society of their own, callers whose scope covers every society (the
//     global advisor, branch-wide roles) still get the first society, as before; a
//     caller whose scope does not cover it gets an empty list, never another
//     society's channels.
//
// The real router, requirePermission and attachScope run; the permission resolver and
// the database calls are stubbed. No database or server is involved. The same behavior
// against a real database, plus messages and Socket.IO rooms, is in
// channel-default-scope.integration.test.js.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001"; // the first society in the database
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";

const Channel = require("../../src/models/Channel");
const Society = require("../../src/models/Society");
const original = { find: Channel.find, create: Channel.create, society: Society.findOne };

let resolved;
let calls;

function freshLoad(relPath) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  return require(file);
}
function stubModule(relPath, exportsValue) {
  const file = require.resolve(path.join(__dirname, relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsValue };
}

const PERMS = { "community_hub:view": "limited_own_scope", "community_hub:create": "limited_own_scope" };
const asSociety = (societyId = SOCIETY_A) => ({ role: "society_chair", scope: { type: "society", societyId }, permissions: PERMS });
const asGlobal = () => ({ role: "sb_faculty_advisor", scope: { type: "global", societyId: null }, permissions: PERMS });
const asBranch = () => ({ role: "sb_chair", scope: { type: "student_branch", societyId: null }, permissions: PERMS });
const asNone = () => ({ role: "scope_none_role", scope: { type: "none", societyId: null }, permissions: PERMS });

beforeEach(() => {
  calls = { find: [], create: [], firstSociety: 0 };
  resolved = asSociety();

  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => resolved,
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", { logAudit: async () => {} });
  delete require.cache[require.resolve("../../src/middleware/rbac.js")];
  const authFile = require.resolve(path.join(__dirname, "../../src/middleware/auth.js"));
  delete require.cache[authFile];
  const auth = require(authFile);
  require.cache[authFile] = { id: authFile, filename: authFile, loaded: true, exports: { ...auth, authenticate: (req, res, next) => next() } };

  Channel.find = (filter) => {
    calls.find.push(filter);
    return { sort: async () => [{ name: "general", societyId: filter.societyId }] };
  };
  Channel.create = async (doc) => {
    calls.create.push(doc);
    return { _id: "c1", ...doc };
  };
  Society.findOne = () => {
    calls.firstSociety++;
    return { sort: async () => ({ _id: SOCIETY_A }) };
  };
});

test.after(() => {
  Channel.find = original.find;
  Channel.create = original.create;
  Society.findOne = original.society;
});

function mockRes() {
  const res = { statusCode: 200, body: null, sent: false };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    res.sent = true;
    return res;
  };
  return res;
}

async function call(method, { user, query = {}, body = {} }) {
  const router = freshLoad("../../src/routes/channels.js");
  const layer = router.stack.find((l) => l.route && l.route.path === "/" && l.route.methods[method]);
  const req = { user, query, body, params: {}, method: method.toUpperCase(), originalUrl: "/api/v1/channels", ip: "127.0.0.1", headers: {}, socket: {} };
  const res = mockRes();
  let error = null;
  for (const handlerLayer of layer.route.stack) {
    if (res.sent || error) break;
    await new Promise((resolve) => {
      Promise.resolve(handlerLayer.handle(req, res, (err) => {
        if (err) error = err;
        resolve();
      })).then(() => {
        if (res.sent) resolve();
      }, (err) => {
        error = err;
        resolve();
      });
    });
  }
  return { res, error };
}
const list = (options) => call("get", options);
const create = (options) => call("post", options);

// User.societyId: a bare id, null/undefined for none
const user = (societyId = null) => ({ _id: "u1", role: "OFFICE_BEARER", societyId });

// ---- list ---------------------------------------------------------------------------

test("list: a society-scoped caller gets their own society and no first-society lookup", async () => {
  resolved = asSociety(SOCIETY_B);

  const { res } = await list({ user: user(SOCIETY_B) });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.find, [{ societyId: SOCIETY_B }]);
  assert.equal(calls.firstSociety, 0);
});

test("list: a society named in the request must be in scope (unchanged)", async () => {
  resolved = asSociety(SOCIETY_B);

  const foreign = await list({ user: user(SOCIETY_B), query: { societyId: SOCIETY_A } });
  const own = await list({ user: user(SOCIETY_B), query: { societyId: SOCIETY_B } });

  assert.equal(foreign.res.statusCode, 403);
  assert.equal(own.res.statusCode, 200);
  assert.deepEqual(calls.find, [{ societyId: SOCIETY_B }]);
});

test("list: a scope-none caller with a society of their own is refused, not given that society's channels (the AUD-029 bypass)", async () => {
  resolved = asNone();

  const { res } = await list({ user: user(SOCIETY_B) });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(calls.find, []);
});

test("list: a scope-none caller with no society gets an empty list, never the first society's channels (the AUD-029 fallback)", async () => {
  resolved = asNone();

  const { res } = await list({ user: user(null) });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, count: 0, data: [] });
  assert.deepEqual(calls.find, [], "another society's channels were read");
});

test("list: a society-scoped caller with an unresolved society is refused by RBAC before any default is chosen", async () => {
  resolved = asSociety(null);

  const { res } = await list({ user: user(null) });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(calls.find, []);
  assert.equal(calls.firstSociety, 0);
});

test("list: callers whose scope covers every society keep the first-society default (behavior kept, pending your decision)", async () => {
  for (const make of [asGlobal, asBranch]) {
    calls = { find: [], create: [], firstSociety: 0 };
    resolved = make();

    const { res } = await list({ user: user(null) });

    assert.equal(res.statusCode, 200, resolved.role);
    assert.deepEqual(calls.find, [{ societyId: SOCIETY_A }], resolved.role);
    assert.equal(calls.firstSociety, 1);
  }
});

test("list: a global caller can still name any society", async () => {
  resolved = asGlobal();

  await list({ user: user(null), query: { societyId: SOCIETY_B } });

  assert.deepEqual(calls.find, [{ societyId: SOCIETY_B }]);
});

test("list: with no societies at all the list is empty (unchanged)", async () => {
  resolved = asGlobal();
  Society.findOne = () => ({ sort: async () => null });

  const { res } = await list({ user: user(null) });

  assert.deepEqual(res.body, { success: true, count: 0, data: [] });
  assert.deepEqual(calls.find, []);
});

// ---- create -------------------------------------------------------------------------

const newChannel = (extra = {}) => ({ name: "announcements", ...extra });

test("create: a society-scoped caller creates in their own society by default", async () => {
  resolved = asSociety(SOCIETY_B);

  const { res } = await create({ user: user(SOCIETY_B), body: newChannel() });

  assert.equal(res.statusCode, 201);
  assert.equal(String(calls.create[0].societyId), SOCIETY_B);
});

test("create: a scope-none caller cannot create in their own User.societyId by omitting the society", async () => {
  resolved = asNone();

  const { res } = await create({ user: user(SOCIETY_B), body: newChannel() });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(calls.create, []);
});

test("create: a named society must be in scope, and a global caller with no society must name one (both unchanged)", async () => {
  resolved = asSociety(SOCIETY_B);
  const foreign = await create({ user: user(SOCIETY_B), body: newChannel({ societyId: SOCIETY_A }) });
  resolved = asGlobal();
  const unnamed = await create({ user: user(null), body: newChannel() });
  const named = await create({ user: user(null), body: newChannel({ societyId: SOCIETY_A }) });

  assert.equal(foreign.res.statusCode, 403);
  assert.equal(unnamed.res.statusCode, 400);
  assert.equal(unnamed.res.body.message, "Society ID is required");
  assert.equal(named.res.statusCode, 201);
  assert.equal(calls.create.length, 1);
});
