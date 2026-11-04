"use strict";

/**
 * POST /tasks over HTTP: society policy and ownership (routes/tasks.js).
 *
 * Approved policy:
 *   - a society named in the body must be well formed (400) and exist (404);
 *   - an administrator may create a task under ANY existing society;
 *   - a non-admin may create a task only under their OWN society (403 otherwise);
 *   - a caller with no society cannot create a task (403); an administrator with
 *     no society who names none gets 400. No default society is assigned and the
 *     schema (Task.societyId required) is unchanged;
 *   - userId always comes from the authenticated caller.
 * Check order: id format (400), existence (404), scope (403).
 *
 * Every rejection is proven by the database (task count and marker titles).
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
const MISSING_SOCIETY = "64b7f8f2a1b2c3d4e5f6ffff";
let counter = 0;
const title = (label) => `create-${label}-${RUN}-${++counter}`;

const create = (userKey, body) => session.request(userKey, "POST", "/tasks", { body });
const taskCount = () => withDatabase(target, (db) => db.collection("tasks").countDocuments({}));
const tasksTitled = (t) =>
  withDatabase(target, (db) => db.collection("tasks").find({ title: t }).toArray());
const listIds = async (userKey) => {
  const res = await session.request(userKey, "GET", "/tasks");
  assert.equal(res.status, 200);
  return res.body.data.map((t) => t.id);
};

describe("a user with a society", () => {
  test("creates a task under their own society by default", async () => {
    const t = title("default");

    const res = await create("chairA", { title: t });

    assert.equal(res.status, 201, res.text.slice(0, 200));
    assert.equal(res.body.success, true);
    assert.deepEqual(Object.keys(res.body).sort(), ["data", "success"]);
    const doc = await readDocument(target, "tasks", res.body.data.id);
    assert.equal(String(doc.userId), users.chairA.id);
    assert.equal(String(doc.societyId), societies.A.id);
    assert.equal(doc.title, t);
    assert.equal(doc.status, "NOT_STARTED");
    assert.equal(doc.priority, "MEDIUM");
    assert.equal(doc.categoryName, "General");
  });

  test("creates a task when naming their own existing society", async () => {
    const t = title("own");

    const res = await create("chairA", { title: t, societyId: societies.A.id, priority: "HIGH" });

    assert.equal(res.status, 201, res.text.slice(0, 200));
    const [doc] = await tasksTitled(t);
    assert.equal(String(doc.societyId), societies.A.id);
    assert.equal(doc.priority, "HIGH");
  });

  test("naming a different existing society is 403 and creates nothing", async () => {
    const t = title("foreign");
    const before = await taskCount();

    const chairAOnB = await create("chairA", { title: t, societyId: societies.B.id });
    const chairBOnA = await create("chairB", { title: t, societyId: societies.A.id });
    const memberAOnB = await create("memberA", { title: t, societyId: societies.B.id });
    const upperCased = await create("chairA", { title: t, societyId: societies.B.id.toUpperCase() });

    for (const res of [chairAOnB, chairBOnA, memberAOnB, upperCased]) {
      assert.equal(res.status, 403, res.text.slice(0, 200));
      assert.equal(res.body.message, "Access restricted to your own society");
    }
    assert.equal(await taskCount(), before);
    assert.equal((await tasksTitled(t)).length, 0);
  });

  test("identity claims in the body cannot unlock another society", async () => {
    const t = title("claims");
    const before = await taskCount();

    const res = await create("chairA", {
      title: t,
      societyId: societies.B.id,
      role: "ADMIN",
      isAdmin: true,
      userId: users.admin.id,
      user: { role: "ADMIN", societyId: societies.B.id },
    });

    assert.equal(res.status, 403, res.text.slice(0, 200));
    assert.equal(await taskCount(), before);
  });

  test("naming their own society in a different letter case still works", async () => {
    const t = title("case");

    const res = await create("chairA", { title: t, societyId: societies.A.id.toUpperCase() });

    assert.equal(res.status, 201, res.text.slice(0, 200));
    assert.equal(String((await tasksTitled(t))[0].societyId), societies.A.id);
  });

  test("a userId in the body never changes the owner", async () => {
    const t = title("owner");

    const res = await create("chairA", { title: t, userId: users.chairB.id, owner: users.chairB.id });

    assert.equal(res.status, 201, res.text.slice(0, 200));
    const [doc] = await tasksTitled(t);
    assert.equal(String(doc.userId), users.chairA.id);
    assert.ok((await listIds("chairA")).includes(res.body.data.id));
    assert.ok(!(await listIds("chairB")).includes(res.body.data.id), "the task landed in another user's list");
  });

  test("an empty societyId falls back to their own society, as before", async () => {
    const t = title("empty");

    const res = await create("chairA", { title: t, societyId: "" });

    assert.equal(res.status, 201, res.text.slice(0, 200));
    assert.equal(String((await tasksTitled(t))[0].societyId), societies.A.id);
  });
});

describe("an invalid society creates nothing", () => {
  test("a nonexistent society is 404 for a user with a society and for one without", async () => {
    const t = title("dangling");
    const before = await taskCount();

    const withSociety = await create("chairA", { title: t, societyId: MISSING_SOCIETY });
    const withoutSociety = await create("loner", { title: t, societyId: MISSING_SOCIETY });
    const admin = await create("admin", { title: t, societyId: MISSING_SOCIETY });

    for (const res of [withSociety, withoutSociety, admin]) {
      assert.equal(res.status, 404, res.text.slice(0, 200));
      assert.equal(res.body.message, "Society not found.");
    }
    assert.equal((await tasksTitled(t)).length, 0);
    assert.equal(await taskCount(), before);
  });

  test("malformed society ids are 400", async () => {
    const t = title("malformed");
    const before = await taskCount();

    for (const societyId of [
      "not-an-object-id",
      "abcdefghijkl",
      `${societies.A.id}0`,
      [societies.A.id],
      { $ne: null },
      { _id: societies.A.id },
      12345,
      true,
    ]) {
      const res = await create("chairA", { title: t, societyId });

      assert.equal(res.status, 400, JSON.stringify(societyId));
    }
    assert.equal(await taskCount(), before);
    assert.equal((await tasksTitled(t)).length, 0);
  });

  test("a missing title and an invalid enum value are still 400", async () => {
    const t = title("invalid");
    const before = await taskCount();

    const noTitle = await create("chairA", { societyId: societies.A.id });
    const badStatus = await create("chairA", { title: t, status: "NOT_A_STATUS" });

    assert.equal(noTitle.status, 400);
    assert.equal(noTitle.body.message, "Task title is required");
    assert.equal(badStatus.status, 400);
    assert.equal(await taskCount(), before);
  });

  test("anonymous and invalid-token requests are 401", async () => {
    const t = title("anon");
    const before = await taskCount();

    const anonymous = await session.request(null, "POST", "/tasks", {
      body: { title: t, societyId: societies.A.id },
    });
    const badToken = await session.request(null, "POST", "/tasks", {
      body: { title: t, societyId: societies.A.id },
      headers: { Authorization: "Bearer not-a-real-token" },
    });

    assert.equal(anonymous.status, 401);
    assert.equal(badToken.status, 401);
    assert.equal(await taskCount(), before);
  });

  test("the server stays healthy after the rejected requests", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});

describe("callers without a society", () => {
  test("cannot create a task, whether or not they name an existing society", async () => {
    const t = title("societyless");
    const before = await taskCount();

    const none = await create("loner", { title: t });
    const naming = await create("loner", { title: t, societyId: societies.A.id });
    const namingOther = await create("loner", { title: t, societyId: societies.B.id });

    for (const res of [none, naming, namingOther]) {
      assert.equal(res.status, 403, res.text.slice(0, 200));
      assert.equal(res.body.message, "You must belong to a society to create tasks");
    }
    assert.equal(await taskCount(), before);
    assert.equal((await tasksTitled(t)).length, 0);
  });

  test("no default society is assigned to them", async () => {
    const t = title("no-default");

    await create("loner", { title: t });

    assert.equal((await tasksTitled(t)).length, 0);
  });
});

describe("administrators", () => {
  test("can create a task under any existing society, owned by themselves", async () => {
    for (const key of ["A", "B"]) {
      const t = title(`admin-${key}`);

      const res = await create("admin", { title: t, societyId: societies[key].id });

      assert.equal(res.status, 201, res.text.slice(0, 200));
      const [doc] = await tasksTitled(t);
      assert.equal(String(doc.userId), users.admin.id);
      assert.equal(String(doc.societyId), societies[key].id);
    }
  });

  test("with no society selected are denied (400) and nothing is created", async () => {
    const t = title("admin-none");
    const before = await taskCount();

    const none = await create("admin", { title: t });
    const empty = await create("admin", { title: t, societyId: "" });

    assert.equal(none.status, 400, none.text.slice(0, 200));
    assert.equal(none.body.message, "Society ID is required");
    assert.equal(empty.status, 400);
    assert.equal(await taskCount(), before);
    assert.equal((await tasksTitled(t)).length, 0);
  });

  test("still cannot name a malformed or nonexistent society", async () => {
    const t = title("admin-invalid");
    const before = await taskCount();

    const malformed = await create("admin", { title: t, societyId: "not-an-object-id" });
    const missing = await create("admin", { title: t, societyId: MISSING_SOCIETY });

    assert.equal(malformed.status, 400);
    assert.equal(missing.status, 404);
    assert.equal(await taskCount(), before);
  });
});
