// AUD-020: POST /events/:id/register never loaded the event (so it created
// dangling registrations for ids that are not events), and
// GET /events/:id/registrations returned every registrant of any event to any
// authenticated user.
//
// Policy under test:
//   register: any authenticated user may register for any existing event (no
//   society or status rule exists in the code, none is added); the registrant is
//   always req.user; a nonexistent event is 404 and a malformed id is 400.
//   list: events:edit (the organizer-level permission used by the other event
//   routes) AND ADMIN, or an office bearer whose society is the one stored on
//   the event. The society comes from the stored event only.
//
// The real route stack and permission middleware run; the permission resolver,
// audit logger and models are stubbed, so no database or server is involved.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CALLER = "64b7f8f2a1b2c3d4e5f6a001";
const OTHER_USER = "64b7f8f2a1b2c3d4e5f6a002";
const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";
const EVENT_A = "64b7f8f2a1b2c3d4e5f6c001"; // belongs to society A
const EVENT_B = "64b7f8f2a1b2c3d4e5f6c002"; // belongs to society B
const MISSING_EVENT = "64b7f8f2a1b2c3d4e5f6c0ff";

let events; // id -> { societyId }
let calls;
let resolved;
let createError;

function stubModule(relPath, exportsValue) {
  const file = require.resolve(path.join(__dirname, relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsValue };
}

function freshLoad(relPath) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  return require(file);
}

beforeEach(() => {
  events = {
    [EVENT_A]: { societyId: SOCIETY_A },
    [EVENT_B]: { societyId: SOCIETY_B },
  };
  calls = { existsQueries: [], findByIdIds: [], created: [], audits: [], finds: [] };
  createError = null;
  resolved = {
    role: "society_chair",
    scope: { type: "society", societyId: SOCIETY_A },
    permissions: { "events:edit": "limited_own_scope" },
  };

  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => resolved,
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", { logAudit: async () => {} });
  delete require.cache[require.resolve("../../src/middleware/rbac.js")];
  delete require.cache[require.resolve("../../src/middleware/auth.js")];
  const auth = require("../../src/middleware/auth.js");
  stubModule("../../src/middleware/auth.js", { ...auth, authenticate: (req, res, next) => next() });

  stubModule("../../src/models/Event.js", {
    exists: async (query) => {
      calls.existsQueries.push(query);
      return events[String(query._id)] ? { _id: query._id } : null;
    },
    findById: (id) => {
      calls.findByIdIds.push(String(id));
      const doc = events[String(id)] ? { _id: id, ...events[String(id)] } : null;
      const chain = { select: () => chain, lean: async () => doc };
      return chain;
    },
  });
  stubModule("../../src/models/EventRegistration.js", {
    create: async (doc) => {
      if (createError) throw createError;
      calls.created.push(doc);
      return { _id: "registration-1", ...doc };
    },
    find: (query) => {
      calls.finds.push(query);
      const chain = { populate: () => chain, sort: async () => [{ user: { name: "Someone" } }] };
      return chain;
    },
  });
  stubModule("../../src/models/AuditLog.js", {
    create: async (doc) => {
      calls.audits.push(doc);
      return doc;
    },
  });
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

async function callRoute(method, routePath, { user, id, body = {}, query = {} }) {
  const router = freshLoad("../../src/routes/events.js");
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods[method],
  );
  assert.ok(layer, `no ${method} ${routePath}`);
  const req = {
    user,
    params: { id },
    body,
    query,
    method: method.toUpperCase(),
    originalUrl: `/api/v1/events/${id}/${routePath.split("/")[2]}`,
    ip: "127.0.0.1",
    headers: {},
    socket: {},
  };
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

const register = (options) => callRoute("post", "/:id/register", options);
const list = (options) => callRoute("get", "/:id/registrations", options);

const userIn = (societyId, role = "OFFICE_BEARER") => ({ _id: CALLER, id: CALLER, role, societyId });
const admin = () => userIn(null, "ADMIN");
const noRegistrationWrites = () => {
  assert.deepEqual(calls.created, []);
  assert.deepEqual(calls.audits, []);
};

// ---- register -----------------------------------------------------------------

test("register: a user from any society can register for an existing event", async () => {
  for (const eventId of [EVENT_A, EVENT_B]) {
    calls.created = [];

    const { res, error } = await register({ user: userIn(SOCIETY_A), id: eventId });

    assert.equal(error, null);
    assert.equal(res.statusCode, 201, eventId);
    assert.deepEqual(Object.keys(res.body).sort(), ["data", "success"]);
    assert.equal(res.body.success, true);
    assert.equal(calls.created.length, 1);
  }
});

test("register: no society or status rule is applied; only existence is checked", async () => {
  await register({ user: userIn(null), id: EVENT_A });

  assert.deepEqual(calls.existsQueries, [{ _id: EVENT_A }]);
  assert.equal(calls.created.length, 1, "a society-less user could not register");
});

test("register: the registrant and status come from the server, never the body", async () => {
  const { res } = await register({
    user: userIn(SOCIETY_A),
    id: EVENT_A,
    body: {
      user: OTHER_USER,
      userId: OTHER_USER,
      registrant: OTHER_USER,
      event: EVENT_B,
      status: "ATTENDED",
    },
  });

  assert.equal(res.statusCode, 201);
  assert.deepEqual(calls.created, [{ event: EVENT_A, user: CALLER, status: "REGISTERED" }]);
  assert.equal(calls.audits[0].userId, CALLER);
  assert.equal(calls.audits[0].action, "EVENT_REGISTER");
});

test("register: a nonexistent event is 404 and nothing is created or audited", async () => {
  const { res } = await register({ user: userIn(SOCIETY_A), id: MISSING_EVENT });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Event not found");
  noRegistrationWrites();
});

test("register: a malformed event id is 400 and never reaches the database", async () => {
  for (const id of ["not-an-object-id", "abcdefghijkl", `${EVENT_A}0`, "undefined", "%7B%7D"]) {
    const { res, error } = await register({ user: userIn(SOCIETY_A), id });

    assert.equal(error, null, id);
    assert.equal(res.statusCode, 400, id);
    assert.equal(res.body.message, "Invalid ID format.");
  }
  assert.deepEqual(calls.existsQueries, []);
  noRegistrationWrites();
});

test("register: a duplicate registration keeps its existing 400 response", async () => {
  createError = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });

  const { res } = await register({ user: userIn(SOCIETY_A), id: EVENT_A });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "User already registered for this event");
  assert.deepEqual(calls.audits, []);
});

// ---- registrations list ---------------------------------------------------------

test("list: an office bearer of the event's society gets the registrants (envelope unchanged)", async () => {
  const { res } = await list({ user: userIn(SOCIETY_A), id: EVENT_A });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ["count", "data", "success"]);
  assert.equal(res.body.count, 1);
  assert.deepEqual(calls.finds, [{ event: EVENT_A }]);
});

test("list: a populated society reference on the caller is understood", async () => {
  const { res } = await list({ user: userIn({ _id: SOCIETY_A, name: "A" }), id: EVENT_A });

  assert.equal(res.statusCode, 200);
});

test("list: an administrator can list any event, with or without a society", async () => {
  for (const eventId of [EVENT_A, EVENT_B]) {
    const { res } = await list({ user: admin(), id: eventId });

    assert.equal(res.statusCode, 200, eventId);
  }
});

test("list: an office bearer of another society is 403 and no registrants are read", async () => {
  const { res } = await list({ user: userIn(SOCIETY_A), id: EVENT_B });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Access restricted to your own society");
  assert.equal(res.body.data, undefined);
  assert.deepEqual(calls.finds, []);
});

test("list: a user without a society never matches, whatever the fallback", async () => {
  for (const societyId of [null, undefined, "", { _id: null }]) {
    const { res } = await list({ user: userIn(societyId), id: EVENT_A });

    assert.equal(res.statusCode, 403, JSON.stringify(societyId));
  }
  assert.deepEqual(calls.finds, []);
});

test("list: a society named by the client cannot widen access", async () => {
  const { res } = await list({
    user: userIn(SOCIETY_A),
    id: EVENT_B,
    query: { societyId: SOCIETY_B },
    body: { societyId: SOCIETY_B },
  });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(calls.finds, []);
});

test("list: without events:edit the caller is 403 before any event lookup", async () => {
  for (const permissions of [{}, { "events:edit": "none" }, { "events:view": "full" }]) {
    resolved = { ...resolved, permissions };

    const { res } = await list({ user: userIn(SOCIETY_A), id: EVENT_A });

    assert.equal(res.statusCode, 403, JSON.stringify(permissions));
  }
  assert.deepEqual(calls.findByIdIds, []);
  assert.deepEqual(calls.finds, []);
});

test("list: a nonexistent event is 404 and a malformed id is 400", async () => {
  const missing = await list({ user: userIn(SOCIETY_A), id: MISSING_EVENT });
  const malformed = [];
  for (const id of ["not-an-object-id", "abcdefghijkl", `${EVENT_A}0`]) {
    malformed.push((await list({ user: userIn(SOCIETY_A), id })).res.statusCode);
  }

  assert.equal(missing.res.statusCode, 404);
  assert.deepEqual(malformed, [400, 400, 400]);
  assert.deepEqual(calls.finds, []);
});

test("both routes keep their handler count (permission guard added to the list only)", () => {
  const router = freshLoad("../../src/routes/events.js");
  const stackOf = (method, routePath) =>
    router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods[method]).route
      .stack.length;

  assert.equal(stackOf("post", "/:id/register"), 1);
  assert.equal(stackOf("get", "/:id/registrations"), 2);
});
