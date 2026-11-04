"use strict";

/**
 * Task mass assignment over HTTP: PUT /tasks/:id (routes/tasks.js).
 *
 * Tasks are personal: GET, PUT and DELETE are all filtered by the caller's
 * userId, and the only other reader (the calendar) does the same. Nothing
 * reassigns or moves a task, and the frontend only ever PUTs { status }. So an
 * update may change content fields only; userId and societyId (and _id,
 * timestamps and Mongoose internals) are ignored if sent.
 *
 * Every claim is checked against the stored document in the harness's
 * disposable database, not just the response.
 *
 * Fixtures: chairA/memberA belong to society A, chairB to society B, admin is
 * the administrator. Tasks are created through the API.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, readDocument, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { users, societies } = target.ready.fixtures;

const RUN = Date.now();
const MISSING_TASK = "64b7f8f2a1b2c3d4e5f6ffff";
let counter = 0;
const title = (label) => `task-${label}-${RUN}-${++counter}`;

async function createTask(userKey, extra = {}) {
  const res = await session.request(userKey, "POST", "/tasks", {
    body: { title: title(userKey), ...extra },
  });
  assert.equal(res.status, 201, `could not create the fixture task: ${res.text.slice(0, 200)}`);
  return res.body.data.id;
}

const put = (userKey, taskId, body) => session.request(userKey, "PUT", `/tasks/${taskId}`, { body });
const stored = (taskId) => readDocument(target, "tasks", taskId);
const taskCount = () => withDatabase(target, (db) => db.collection("tasks").countDocuments({}));
const listIds = async (userKey) => {
  const res = await session.request(userKey, "GET", "/tasks");
  assert.equal(res.status, 200);
  return res.body.data.map((t) => t.id);
};

/** The fields a caller must never be able to change. */
const protectedFields = (doc) => ({
  _id: String(doc._id),
  userId: String(doc.userId),
  societyId: String(doc.societyId),
  createdAt: doc.createdAt.toISOString(),
});

describe("legitimate updates still work", () => {
  test("every content field can be updated and persists", async () => {
    const id = await createTask("chairA");
    const before = await stored(id);
    const blocker = await createTask("chairA");

    const res = await put("chairA", id, {
      title: "Renamed",
      description: "New description",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: "2027-01-15T00:00:00.000Z",
      categoryName: "Research",
      categoryColor: "#112233",
      blockedBy: [blocker],
    });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.title, "Renamed");
    const after = await stored(id);
    assert.equal(after.title, "Renamed");
    assert.equal(after.description, "New description");
    assert.equal(after.status, "IN_PROGRESS");
    assert.equal(after.priority, "HIGH");
    assert.equal(after.dueDate.toISOString(), "2027-01-15T00:00:00.000Z");
    assert.equal(after.categoryName, "Research");
    assert.equal(after.categoryColor, "#112233");
    assert.deepEqual(after.blockedBy.map(String), [blocker]);
    assert.deepEqual(protectedFields(after), protectedFields(before));
  });

  test("a status-only update (the frontend's call) works and COMPLETED marks it completed", async () => {
    const id = await createTask("chairA");

    const res = await put("chairA", id, { status: "COMPLETED" });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    const after = await stored(id);
    assert.equal(after.status, "COMPLETED");
    assert.equal(after.completed, true);
  });

  test("invalid values are still rejected and change nothing", async () => {
    const id = await createTask("chairA");
    const before = await stored(id);

    const res = await put("chairA", id, { title: "Changed", status: "NOT_A_STATUS" });

    assert.equal(res.status, 400);
    const after = await stored(id);
    assert.equal(after.title, before.title);
    assert.equal(after.status, before.status);
  });
});

describe("ownership and society cannot be changed by mass assignment", () => {
  test("userId and societyId in the body are ignored; the task stays with its owner and society", async () => {
    const id = await createTask("chairA");
    const before = await stored(id);

    const res = await put("chairA", id, {
      title: "Content change is still applied",
      userId: users.chairB.id,
      societyId: societies.B.id,
    });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(String(res.body.data.userId), users.chairA.id);
    assert.equal(String(res.body.data.societyId), societies.A.id);
    const after = await stored(id);
    assert.equal(after.title, "Content change is still applied");
    assert.deepEqual(protectedFields(after), protectedFields(before));
    assert.equal(String(after.userId), users.chairA.id);
    assert.equal(String(after.societyId), societies.A.id);
  });

  test("the task is not planted in another user's list", async () => {
    const id = await createTask("chairA");

    await put("chairA", id, { userId: users.chairB.id, societyId: societies.B.id });

    assert.ok((await listIds("chairA")).includes(id), "the owner lost the task");
    assert.ok(!(await listIds("chairB")).includes(id), "the task appeared in another user's list");
    const otherSociety = await session.request("chairB", "GET", `/tasks?societyId=${societies.B.id}`);
    assert.ok(!otherSociety.body.data.some((t) => t.id === id));
  });

  test("a payload with only protected fields changes nothing and succeeds", async () => {
    const id = await createTask("chairA");
    const before = await stored(id);

    const res = await put("chairA", id, {
      userId: users.admin.id,
      societyId: societies.B.id,
      createdAt: "2001-01-01T00:00:00.000Z",
    });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    const after = await stored(id);
    assert.deepEqual(protectedFields(after), protectedFields(before));
    assert.equal(after.title, before.title);
  });

  test("_id, id, timestamps, version and Mongoose internals in the body are ignored", async () => {
    const id = await createTask("chairA");
    const before = await stored(id);

    const raw = JSON.stringify({
      title: "Internals ignored",
      _id: MISSING_TASK,
      id: MISSING_TASK,
      __v: 99,
      createdAt: "2001-01-01T00:00:00.000Z",
      updatedAt: "2001-01-01T00:00:00.000Z",
      isNew: true,
      _doc: { userId: users.chairB.id, societyId: societies.B.id },
      errors: { title: "x" },
      assignee: users.chairB.id,
      owner: users.chairB.id,
    }).replace(/^\{/, '{"__proto__":{"userId":"' + users.chairB.id + '"},"$set":{"userId":"' + users.chairB.id + '"},');
    const res = await session.request("chairA", "PUT", `/tasks/${id}`, {
      raw,
      headers: { "Content-Type": "application/json" },
    });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    const after = await stored(id);
    assert.equal(after.title, "Internals ignored");
    assert.deepEqual(protectedFields(after), protectedFields(before));
    assert.equal(after.__v, before.__v);
    assert.equal(after.assignee, undefined);
    assert.equal(after.owner, undefined);
    assert.equal(await stored(MISSING_TASK), null, "_id from the body created a document");
    assert.ok(!(await listIds("chairB")).includes(id));
  });

  test("other users' tasks and the shared object prototype are untouched", async () => {
    const mine = await createTask("chairA");
    const theirs = await createTask("chairB");
    const theirsBefore = await stored(theirs);

    await put("chairA", mine, { userId: users.chairB.id, blockedBy: [theirs] });

    assert.deepEqual(protectedFields(await stored(theirs)), protectedFields(theirsBefore));
    const health = await target.api("/health");
    assert.equal(health.status, 200);
  });
});

describe("existing authorization still prevents unauthorized edits", () => {
  test("another user cannot update, or take over, someone else's task", async () => {
    const id = await createTask("chairA");
    const before = await stored(id);

    const plain = await put("chairB", id, { title: "Hijacked" });
    const takeover = await put("chairB", id, {
      title: "Hijacked",
      userId: users.chairB.id,
      societyId: societies.B.id,
    });

    assert.equal(plain.status, 404);
    assert.equal(takeover.status, 404);
    assert.equal(takeover.body.message, "Task not found");
    const after = await stored(id);
    assert.equal(after.title, before.title);
    assert.deepEqual(protectedFields(after), protectedFields(before));
    assert.ok(!(await listIds("chairB")).includes(id));
  });

  test("an administrator has no special access to a personal task", async () => {
    const id = await createTask("chairA");
    const before = await stored(id);

    const res = await put("admin", id, { title: "Admin edit", userId: users.admin.id });

    assert.equal(res.status, 404);
    assert.deepEqual(protectedFields(await stored(id)), protectedFields(before));
    assert.equal((await stored(id)).title, before.title);
  });

  test("a nonexistent task is 404, a malformed id is 400, and nothing is created", async () => {
    const before = await taskCount();

    const missing = await put("chairA", MISSING_TASK, { title: "x", userId: users.chairA.id });
    const malformed = await put("chairA", "not-an-object-id", { title: "x" });

    assert.equal(missing.status, 404);
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.message, "Invalid ID format.");
    assert.equal(await taskCount(), before);
  });

  test("anonymous and invalid-token requests are 401 and change nothing", async () => {
    const id = await createTask("chairA");
    const before = await stored(id);

    const anonymous = await session.request(null, "PUT", `/tasks/${id}`, { body: { title: "x" } });
    const badToken = await session.request(null, "PUT", `/tasks/${id}`, {
      body: { title: "x" },
      headers: { Authorization: "Bearer not-a-real-token" },
    });

    assert.equal(anonymous.status, 401);
    assert.equal(badToken.status, 401);
    assert.equal((await stored(id)).title, before.title);
  });

  test("delete is still owner-only", async () => {
    const id = await createTask("chairA");

    const other = await session.request("chairB", "DELETE", `/tasks/${id}`);
    const stillThere = await stored(id);
    const owner = await session.request("chairA", "DELETE", `/tasks/${id}`);

    assert.equal(other.status, 404);
    assert.ok(stillThere, "another user deleted the task");
    assert.equal(owner.status, 200);
    assert.equal(await stored(id), null);
  });
});

describe("creation keeps its ownership rule", () => {
  test("a userId in the create body is ignored; the task belongs to the caller", async () => {
    const res = await session.request("chairA", "POST", "/tasks", {
      body: { title: title("create-owner"), userId: users.chairB.id },
    });

    assert.equal(res.status, 201, res.text.slice(0, 200));
    const doc = await stored(res.body.data.id);
    assert.equal(String(doc.userId), users.chairA.id);
    assert.ok(!(await listIds("chairB")).includes(res.body.data.id));
  });
});
