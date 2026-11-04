// PUT /tasks/:id copied the whole request body onto the task
// (Object.assign(task, req.body)), so a caller could set userId (planting the
// task in another user's list), societyId (moving it to another society), _id,
// timestamps or Mongoose internals.
//
// Policy under test: tasks are personal - every read filters by userId and no
// workflow reassigns or moves a task - so only the explicit content fields
// (title, description, status, priority, dueDate, categoryName, categoryColor,
// blockedBy, completed) can be updated. Everything else in the body is ignored.
// The existing owner-only lookup is unchanged.
//
// The real Task schema is used (so assignment, casting and modified-path
// tracking are genuine); findOne and save are stubbed, so no database or server
// is involved.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");

const OWNER = "64b7f8f2a1b2c3d4e5f6a001";
const OTHER_USER = "64b7f8f2a1b2c3d4e5f6a002";
const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";
const TASK_ID = "64b7f8f2a1b2c3d4e5f6f001";

const Task = require("../../src/models/Task");
const originalFindOne = Task.findOne;

let doc;
let findOneQueries;
let saved;

function freshLoad(relPath) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  return require(file);
}

function stubAuthenticate() {
  const file = require.resolve(path.join(__dirname, "../../src/middleware/auth.js"));
  delete require.cache[file];
  const auth = require(file);
  require.cache[file] = {
    id: file,
    filename: file,
    loaded: true,
    exports: { ...auth, authenticate: (req, res, next) => next() },
  };
}

beforeEach(() => {
  findOneQueries = [];
  saved = 0;
  // hydrate() builds an unmodified, persisted-looking document, as findOne returns.
  doc = Task.hydrate({
    _id: TASK_ID,
    title: "Original",
    description: "Original description",
    status: "NOT_STARTED",
    priority: "MEDIUM",
    userId: OWNER,
    societyId: SOCIETY_A,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
  doc.save = async () => {
    saved++;
    await doc.validate();
    return doc;
  };
  Task.findOne = async (query) => {
    findOneQueries.push(query);
    return query._id === TASK_ID && String(query.userId) === OWNER ? doc : null;
  };
  stubAuthenticate();
});

test.after(() => {
  Task.findOne = originalFindOne;
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

async function put(body, { id = TASK_ID, userId = OWNER } = {}) {
  const router = freshLoad("../../src/routes/tasks.js");
  const layer = router.stack.find((l) => l.route && l.route.path === "/:id" && l.route.methods.put);
  const req = { user: { _id: userId }, params: { id }, body, query: {} };
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

const unchangedOwnership = () => {
  assert.equal(String(doc.userId), OWNER, "ownership changed");
  assert.equal(String(doc.societyId), SOCIETY_A, "society changed");
  assert.equal(String(doc._id), TASK_ID, "_id changed");
};

test("the content fields can still be updated", async () => {
  const dueDate = "2027-01-15T00:00:00.000Z";
  const blocker = new mongoose.Types.ObjectId().toString();

  const { res, error } = await put({
    title: "Renamed",
    description: "New description",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate,
    categoryName: "Research",
    categoryColor: "#112233",
    blockedBy: [blocker],
    completed: true,
  });

  assert.equal(error, null);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ["data", "success"]);
  assert.equal(doc.title, "Renamed");
  assert.equal(doc.description, "New description");
  assert.equal(doc.status, "IN_PROGRESS");
  assert.equal(doc.priority, "HIGH");
  assert.equal(doc.dueDate.toISOString(), dueDate);
  assert.equal(doc.categoryName, "Research");
  assert.equal(doc.categoryColor, "#112233");
  assert.deepEqual(doc.blockedBy.map(String), [blocker]);
  assert.equal(doc.completed, true);
  assert.equal(saved, 1);
  unchangedOwnership();
});

test("the only thing the frontend sends, a status change, works and COMPLETED marks it completed", async () => {
  const { res } = await put({ status: "COMPLETED" });

  assert.equal(res.statusCode, 200);
  assert.equal(doc.status, "COMPLETED");
  assert.equal(doc.completed, true);
  assert.equal(doc.title, "Original");
});

test("ownership and society cannot be changed through the body", async () => {
  const { res, error } = await put({ userId: OTHER_USER, societyId: SOCIETY_B });

  assert.equal(error, null);
  assert.equal(res.statusCode, 200);
  unchangedOwnership();
  assert.deepEqual(doc.modifiedPaths(), [], "something was modified");
});

test("protected and internal fields in the body are ignored, while allowed ones still apply", async () => {
  const body = JSON.parse(
    JSON.stringify({
      title: "Kept",
      userId: OTHER_USER,
      societyId: SOCIETY_B,
      _id: new mongoose.Types.ObjectId().toString(),
      id: new mongoose.Types.ObjectId().toString(),
      __v: 99,
      createdAt: "2001-01-01T00:00:00.000Z",
      updatedAt: "2001-01-01T00:00:00.000Z",
      isNew: true,
      $isNew: true,
      _doc: { userId: OTHER_USER, societyId: SOCIETY_B },
      $__: { activePaths: {} },
      errors: { title: "x" },
      assignee: OTHER_USER,
      owner: OTHER_USER,
    }),
  );
  const createdAt = doc.createdAt;
  const prototypeBefore = Object.getPrototypeOf(doc);

  const { res, error } = await put(body);

  assert.equal(error, null);
  assert.equal(res.statusCode, 200);
  assert.equal(doc.title, "Kept");
  unchangedOwnership();
  assert.equal(doc.createdAt, createdAt);
  assert.equal(doc.get("__v"), undefined);
  assert.equal(doc.isNew, false);
  assert.equal(doc.get("assignee"), undefined);
  assert.equal(doc.get("owner"), undefined);
  assert.equal(Object.getPrototypeOf(doc), prototypeBefore);
  assert.deepEqual(doc.modifiedPaths(), ["title"]);
});

test("a __proto__ key cannot reach the document", async () => {
  const body = JSON.parse('{"title":"Proto","__proto__":{"userId":"x","societyId":"y"}}');
  const prototypeBefore = Object.getPrototypeOf(doc);

  const { res } = await put(body);

  assert.equal(res.statusCode, 200);
  assert.equal(Object.getPrototypeOf(doc), prototypeBefore);
  unchangedOwnership();
  assert.equal(doc.title, "Proto");
  assert.equal(({}).userId, undefined, "Object.prototype was polluted");
});

test("a body with only protected fields changes nothing and still succeeds", async () => {
  const { res } = await put({ userId: OTHER_USER, societyId: SOCIETY_B, createdAt: "2001-01-01" });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(doc.modifiedPaths(), []);
});

test("an empty or non-object body is handled safely", async () => {
  for (const body of [{}, undefined, null, [], "text", 7]) {
    const { res, error } = await put(body);

    assert.equal(error, null, JSON.stringify(body));
    assert.equal(res.statusCode, 200, JSON.stringify(body));
  }
  unchangedOwnership();
});

test("invalid values for allowed fields are still rejected by the schema", async () => {
  const { error } = await put({ status: "NOT_A_STATUS" });

  assert.ok(error && error.name === "ValidationError", "no validation error");
});

test("the owner-only lookup is unchanged: another user's task is 404 and is never loaded", async () => {
  const { res } = await put({ title: "Hijack", userId: OTHER_USER }, { userId: OTHER_USER });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Task not found");
  assert.deepEqual(findOneQueries, [{ _id: TASK_ID, userId: OTHER_USER }]);
  assert.equal(doc.title, "Original");
  assert.equal(saved, 0);
});

test("an unknown task id is 404", async () => {
  const { res } = await put({ title: "x" }, { id: "64b7f8f2a1b2c3d4e5f6f0ff" });

  assert.equal(res.statusCode, 404);
});
