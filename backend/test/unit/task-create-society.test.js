// POST /tasks society policy (approved by the product owner):
//
//   - a society named in the body must be well formed (400) and exist (404);
//   - an administrator may create a task under ANY existing society;
//   - a non-admin may create a task only under their OWN stored society; naming
//     a different existing society is 403;
//   - a caller with no society cannot create a task (403), and an administrator
//     with no society who names none gets 400: no default society is invented
//     and the schema (Task.societyId is required) is unchanged;
//   - with no society in the body, a caller who has one uses it;
//   - userId always comes from the authenticated caller, never the body.
//
// Order of checks: title, id format (400), existence (404), then scope (403).
//
// The real Task schema validates what the create stub receives; Society.exists
// is stubbed. No database or server is involved.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CALLER = "64b7f8f2a1b2c3d4e5f6a001";
const OTHER_USER = "64b7f8f2a1b2c3d4e5f6a002";
const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";
const MISSING_SOCIETY = "64b7f8f2a1b2c3d4e5f6b0ff";

const Task = require("../../src/models/Task");
const originalCreate = Task.create;

let societies;
let existsQueries;
let created;

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
  societies = new Set([SOCIETY_A, SOCIETY_B]);
  existsQueries = [];
  created = [];

  Task.create = async (doc) => {
    const instance = new Task(doc);
    const failure = instance.validateSync();
    if (failure) throw failure;
    created.push(instance.toObject());
    return instance;
  };
  stubModule("../../src/models/Society.js", {
    exists: async (query) => {
      existsQueries.push(query);
      return societies.has(String(query._id).toLowerCase()) ? { _id: query._id } : null;
    },
  });
  stubModule("../../src/models/Task.js", Task);

  const authFile = require.resolve(path.join(__dirname, "../../src/middleware/auth.js"));
  delete require.cache[authFile];
  const auth = require(authFile);
  require.cache[authFile] = {
    id: authFile,
    filename: authFile,
    loaded: true,
    exports: { ...auth, authenticate: (req, res, next) => next() },
  };
});

test.after(() => {
  Task.create = originalCreate;
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

async function post(body, user) {
  const router = freshLoad("../../src/routes/tasks.js");
  const layer = router.stack.find((l) => l.route && l.route.path === "/" && l.route.methods.post);
  const req = { user, body, query: {}, params: {} };
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

// chair(): belongs to society A; chair(x) uses x as given, including null/undefined.
const chair = (...args) => ({
  _id: CALLER,
  role: "OFFICE_BEARER",
  societyId: args.length ? args[0] : SOCIETY_A,
});
const societyLess = () => chair(null);
const admin = (societyId = null) => ({ _id: CALLER, role: "ADMIN", societyId });

const noTaskCreated = () => assert.deepEqual(created, []);

// ---- non-admin with a society ---------------------------------------------------

test("non-admin: defaults to their own society (bare id or populated document)", async () => {
  for (const societyId of [SOCIETY_A, { _id: SOCIETY_A, name: "A" }]) {
    created = [];

    const { res, error } = await post({ title: "Default society" }, chair(societyId));

    assert.equal(error, null);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(Object.keys(res.body).sort(), ["data", "success"]);
    assert.equal(String(created[0].societyId), SOCIETY_A);
    assert.equal(String(created[0].userId), CALLER);
  }
});

test("non-admin: may name their own existing society", async () => {
  const { res } = await post({ title: "Own", societyId: SOCIETY_A }, chair());

  assert.equal(res.statusCode, 201);
  assert.equal(String(created[0].societyId), SOCIETY_A);
});

test("non-admin: the same id in a different letter case is still their own society", async () => {
  const { res } = await post({ title: "Case", societyId: SOCIETY_A.toUpperCase() }, chair());

  assert.equal(res.statusCode, 201);
  assert.equal(String(created[0].societyId), SOCIETY_A);
});

test("non-admin: naming a different existing society is 403 and nothing is created", async () => {
  const { res, error } = await post({ title: "Foreign", societyId: SOCIETY_B }, chair());

  assert.equal(error, null);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Access restricted to your own society");
  noTaskCreated();
});

test("non-admin: a different society cannot be reached through the body's identity claims", async () => {
  const { res } = await post(
    { title: "Claims", societyId: SOCIETY_B, role: "ADMIN", isAdmin: true, user: { role: "ADMIN" }, userId: OTHER_USER },
    chair(),
  );

  assert.equal(res.statusCode, 403);
  noTaskCreated();
});

test("non-admin: an empty societyId falls back to their own society", async () => {
  const { res } = await post({ title: "Fallback", societyId: "" }, chair());

  assert.equal(res.statusCode, 201);
  assert.equal(String(created[0].societyId), SOCIETY_A);
  assert.deepEqual(existsQueries, []);
});

// ---- callers without a society --------------------------------------------------

test("a caller with no society is 403 whether or not they name an existing society", async () => {
  for (const user of [societyLess(), chair(undefined), chair(""), chair({ _id: null })]) {
    for (const body of [{ title: "x" }, { title: "x", societyId: SOCIETY_A }, { title: "x", societyId: SOCIETY_B }]) {
      const { res, error } = await post(body, user);

      assert.equal(error, null);
      assert.equal(res.statusCode, 403, `${JSON.stringify(user.societyId)} ${JSON.stringify(body)}`);
      assert.equal(res.body.message, "You must belong to a society to create tasks");
    }
  }
  noTaskCreated();
});

test("a caller with no society and none named is rejected before any lookup, with no default society", async () => {
  await post({ title: "No default" }, societyLess());

  assert.deepEqual(existsQueries, []);
  noTaskCreated();
});

// ---- administrators -------------------------------------------------------------

test("admin: may create under any existing society", async () => {
  for (const societyId of [SOCIETY_A, SOCIETY_B]) {
    const { res } = await post({ title: "Admin", societyId }, admin());

    assert.equal(res.statusCode, 201, societyId);
  }
  assert.deepEqual(created.map((t) => String(t.societyId)), [SOCIETY_A, SOCIETY_B]);
  assert.ok(created.every((t) => String(t.userId) === CALLER));
});

test("admin: with no society selected (none in the body, none of their own) is 400 and nothing is created", async () => {
  const { res } = await post({ title: "No selection" }, admin());

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Society ID is required");
  assert.deepEqual(existsQueries, []);
  noTaskCreated();
});

test("admin: an administrator who has a society of their own and names none uses it", async () => {
  const { res } = await post({ title: "Own default" }, admin(SOCIETY_A));

  assert.equal(res.statusCode, 201);
  assert.equal(String(created[0].societyId), SOCIETY_A);
});

// ---- malformed and nonexistent ids (every caller) -------------------------------

test("a nonexistent society is 404 for every kind of caller, and nothing is created", async () => {
  for (const user of [chair(), societyLess(), admin()]) {
    const { res, error } = await post({ title: "Dangling", societyId: MISSING_SOCIETY }, user);

    assert.equal(error, null);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "Society not found.");
  }
  noTaskCreated();
});

test("malformed society ids are 400 for every kind of caller, never reach the database, and create nothing", async () => {
  const malformed = [
    "not-an-object-id",
    "abcdefghijkl", // 12 characters
    `${SOCIETY_A}0`,
    ` ${SOCIETY_A}`,
    [SOCIETY_A],
    [SOCIETY_A, SOCIETY_B],
    { $ne: null },
    { _id: SOCIETY_A },
    12345,
    true,
  ];
  for (const user of [chair(), societyLess(), admin()]) {
    for (const societyId of malformed) {
      const { res, error } = await post({ title: "Malformed", societyId }, user);

      assert.equal(error, null, JSON.stringify(societyId));
      assert.equal(res.statusCode, 400, JSON.stringify(societyId));
      assert.equal(res.body.message, "Invalid ID format.");
    }
  }
  assert.deepEqual(existsQueries, []);
  noTaskCreated();
});

// ---- ownership and unchanged behavior -------------------------------------------

test("the owner is always the authenticated caller, whatever the body says", async () => {
  const { res } = await post(
    { title: "Owner", userId: OTHER_USER, owner: OTHER_USER, societyId: SOCIETY_A },
    chair(),
  );

  assert.equal(res.statusCode, 201);
  assert.equal(String(created[0].userId), CALLER);
});

test("the title is still required, and is checked before any society lookup", async () => {
  const { res } = await post({ societyId: SOCIETY_B }, chair());

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Task title is required");
  assert.deepEqual(existsQueries, []);
});

test("other fields keep their defaults and pass-through", async () => {
  const { res } = await post({ title: "Fields", description: "d", priority: "HIGH", categoryName: "Research" }, chair());

  assert.equal(res.statusCode, 201);
  assert.equal(created[0].description, "d");
  assert.equal(created[0].priority, "HIGH");
  assert.equal(created[0].categoryName, "Research");
  assert.equal(created[0].status, "NOT_STARTED");
  assert.equal(created[0].categoryColor, "#3b82f6");
});

test("schema validation errors still flow to the error handler", async () => {
  const { error } = await post({ title: "Bad status", status: "NOT_A_STATUS" }, chair());

  assert.ok(error && error.name === "ValidationError");
  noTaskCreated();
});
