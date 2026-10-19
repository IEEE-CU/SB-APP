"use strict";

/**
 * AUD-019 over HTTP: POST /societies/:societyId/importer/{slack,todoist}.
 *
 * Policy (routes/importers.js): community_hub:create AND membership of the
 * society named in the URL (administrator unrestricted) AND the society exists,
 * all before any write. Owner and society come from the authenticated user and
 * the path, never from the body.
 *
 * Every denial is proven by the database: marker documents are counted before
 * and after, and nothing may have been created.
 *
 * Fixtures: chairA/memberA belong to society A (both hold community_hub:create),
 * chairB to society B, loner has no society and no RBAC role, admin is the
 * branch-wide administrator. A disposable society-A user whose role grants
 * nothing separates the permission check from the society check.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 * Nothing leaves the harness: the importers take their data from the request
 * body and call no external service.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const {
  requireHarnessTarget,
  deleteDisposableUser,
  withDatabase,
} = require("./helpers/target");
const { createSession } = require("./helpers/session");
const { TEST_PASSWORD } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const session = createSession(target);
const { users, societies } = target.ready.fixtures;

const RUN = Date.now();
const MISSING_SOCIETY = "64b7f8f2a1b2c3d4e5f6ffff";
const NO_PERMISSION_EMAIL = `importer-no-permission-${RUN}@integration.test`;

let noPermission; // { id, token }: society A, role granting nothing
let counter = 0;
const marker = (label) => `imp-${label}-${RUN}-${++counter}`;

const importer = (userKey, societyId, kind, body) =>
  session.request(userKey, "POST", `/societies/${societyId}/importer/${kind}`, { body });

async function asToken(account, societyId, kind, body) {
  const res = await fetch(`${target.baseUrl}/api/v1/societies/${societyId}/importer/${kind}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(account ? { Authorization: `Bearer ${account.token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: parsed, text };
}

const tasksTitled = (title) =>
  withDatabase(target, (db) => db.collection("tasks").find({ title }).toArray());
const channelsNamed = (name) =>
  withDatabase(target, (db) => db.collection("channels").find({ name }).toArray());
const messagesBodied = (body) =>
  withDatabase(target, (db) => db.collection("messages").find({ body }).toArray());

/** A Todoist payload and a Slack payload that carry a unique marker. */
const todoistPayload = (title, extra = {}) => ({
  tasks: [{ content: title, priority: 4 }],
  ...extra,
});
const slackPayload = (name, extra = {}) => ({ channels: [{ name }], messages: [], ...extra });

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    const register = await target.api("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Disposable No Permission",
        email: NO_PERMISSION_EMAIL,
        password: TEST_PASSWORD,
      }),
    });
    const registered = await register.json();
    assert.equal(register.status, 201, "could not register the disposable user");
    const id = registered.data.user.id;

    await db
      .collection("users")
      .updateOne({ _id: new ObjectId(id) }, { $set: { societyId: new ObjectId(societies.A.id) } });
    const role = await db.collection("roles").findOneAndUpdate(
      { name: "it_no_hub_permission" },
      {
        $setOnInsert: {
          name: "it_no_hub_permission",
          displayName: "Integration role without permissions",
          level: "member",
          scope: "society",
          description: "Integration test role",
          isSystemRole: false,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    await db.collection("userroles").insertOne({
      user: new ObjectId(id),
      role: role._id,
      society: new ObjectId(societies.A.id),
      assignedBy: new ObjectId(users.admin.id),
      assignedAt: now,
    });

    const login = await target.api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: NO_PERMISSION_EMAIL, password: TEST_PASSWORD }),
    });
    const body = await login.json();
    assert.equal(login.status, 200);
    noPermission = { id, token: body.data.token };
  });
});

after(async () => {
  if (!noPermission) return;
  await withDatabase(target, (db, ObjectId) =>
    db.collection("userroles").deleteOne({ user: new ObjectId(noPermission.id) }),
  );
  await deleteDisposableUser(target, noPermission.id, NO_PERMISSION_EMAIL);
});

describe("anonymous and invalid credentials", () => {
  test("are 401 on both routes and write nothing", async () => {
    const title = marker("anon-task");
    const name = marker("anon-channel");

    const noToken = [
      await asToken(null, societies.A.id, "todoist", todoistPayload(title)),
      await asToken(null, societies.A.id, "slack", slackPayload(name)),
    ];
    const badToken = [
      await asToken({ token: "not-a-real-token" }, societies.A.id, "todoist", todoistPayload(title)),
      await asToken({ token: "not-a-real-token" }, societies.A.id, "slack", slackPayload(name)),
    ];

    for (const res of [...noToken, ...badToken]) assert.equal(res.status, 401);
    assert.equal((await tasksTitled(title)).length, 0);
    assert.equal((await channelsNamed(name)).length, 0);
  });
});

describe("unauthorized callers cannot write", () => {
  const denied = [
    ["a user with no society and no RBAC role", "loner", () => societies.A.id],
    ["a society A office bearer targeting society B", "chairA", () => societies.B.id],
    ["a society A member targeting society B", "memberA", () => societies.B.id],
    ["a society B office bearer targeting society A", "chairB", () => societies.A.id],
  ];

  for (const [label, userKey, societyId] of denied) {
    test(`${label}: 403 on both routes and nothing is created`, async () => {
      const title = marker("denied-task");
      const name = marker("denied-channel");

      const todoist = await importer(userKey, societyId(), "todoist", todoistPayload(title));
      const slack = await importer(userKey, societyId(), "slack", slackPayload(name));

      assert.equal(todoist.status, 403, todoist.text.slice(0, 160));
      assert.equal(slack.status, 403, slack.text.slice(0, 160));
      assert.equal((await tasksTitled(title)).length, 0, "a task was created");
      assert.equal((await channelsNamed(name)).length, 0, "a channel was created");
    });
  }

  test("a society A user without community_hub:create is 403 for their own society", async () => {
    const title = marker("noperm-task");
    const name = marker("noperm-channel");

    const todoist = await asToken(noPermission, societies.A.id, "todoist", todoistPayload(title));
    const slack = await asToken(noPermission, societies.A.id, "slack", slackPayload(name));

    assert.equal(todoist.status, 403, todoist.text.slice(0, 160));
    assert.equal(slack.status, 403, slack.text.slice(0, 160));
    assert.equal((await tasksTitled(title)).length, 0);
    assert.equal((await channelsNamed(name)).length, 0);
  });

  test("body fields cannot move the import into the caller's society or change the owner", async () => {
    const title = marker("spoof-task");
    const name = marker("spoof-channel");
    const spoof = { societyId: societies.A.id, userId: users.chairA.id, query: { societyId: societies.A.id } };

    const todoist = await importer(
      "chairA",
      societies.B.id,
      "todoist",
      todoistPayload(title, { ...spoof, tasks: [{ content: title, societyId: societies.A.id }] }),
    );
    const slack = await importer("chairA", societies.B.id, "slack", slackPayload(name, spoof));
    const queryAssisted = await session.request(
      "chairA",
      "POST",
      `/societies/${societies.B.id}/importer/todoist?societyId=${societies.A.id}`,
      { body: todoistPayload(title) },
    );

    for (const res of [todoist, slack, queryAssisted]) assert.equal(res.status, 403);
    assert.equal((await tasksTitled(title)).length, 0);
    assert.equal((await channelsNamed(name)).length, 0);
  });
});

describe("malformed and nonexistent societies", () => {
  test("an administrator gets 400 for a malformed id and 404 for an unknown society, with no writes", async () => {
    const title = marker("badid-task");
    const name = marker("badid-channel");

    for (const kind of ["todoist", "slack"]) {
      const payload = kind === "todoist" ? todoistPayload(title) : slackPayload(name);
      for (const societyId of ["not-an-object-id", "abcdefghijkl", `${societies.A.id}0`]) {
        const res = await importer("admin", societyId, kind, payload);
        assert.equal(res.status, 400, `${kind} ${societyId}`);
        assert.equal(res.body.message, "Invalid ID format.");
      }
      const missing = await importer("admin", MISSING_SOCIETY, kind, payload);
      assert.equal(missing.status, 404, kind);
    }
    // An empty import must not be able to "succeed" against a society that does not exist.
    const empty = await importer("admin", MISSING_SOCIETY, "todoist", { tasks: [] });
    assert.equal(empty.status, 404);

    assert.equal((await tasksTitled(title)).length, 0);
    assert.equal((await channelsNamed(name)).length, 0);
  });

  test("a non-admin cannot tell a nonexistent society from another society", async () => {
    const title = marker("oracle-task");

    const missing = await importer("chairA", MISSING_SOCIETY, "todoist", todoistPayload(title));
    const other = await importer("chairA", societies.B.id, "todoist", todoistPayload(title));
    const malformed = await importer("chairA", "not-an-object-id", "todoist", todoistPayload(title));

    assert.equal(missing.status, 403);
    assert.deepEqual(missing.body, other.body);
    assert.equal(malformed.status, 403);
    assert.equal((await tasksTitled(title)).length, 0);
  });

  test("the server stays healthy after the rejected requests", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});

describe("authorized callers import into their own society (positive controls)", () => {
  test("Todoist: an office bearer creates tasks owned by themselves, scoped by the path", async () => {
    const title = marker("ok-task");

    const res = await importer("chairA", societies.A.id, "todoist", {
      // None of these may change the owner or the society.
      societyId: societies.B.id,
      userId: users.admin.id,
      tasks: [
        { content: title, priority: 4, societyId: societies.B.id, userId: users.admin.id },
        { content: title, is_completed: true, priority: 3 },
      ],
    });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.success, true);
    assert.equal(res.body.importedTasks, 2);
    const tasks = await tasksTitled(title);
    assert.equal(tasks.length, 2);
    for (const task of tasks) {
      assert.equal(String(task.societyId), societies.A.id);
      assert.equal(String(task.userId), users.chairA.id);
    }
    assert.deepEqual(tasks.map((t) => t.priority).sort(), ["HIGH", "MEDIUM"]);
    assert.deepEqual(tasks.map((t) => t.status).sort(), ["COMPLETED", "NOT_STARTED"]);
  });

  test("Todoist: a member holding community_hub:create can import into their own society", async () => {
    const title = marker("member-task");

    const res = await importer("memberA", societies.A.id, "todoist", todoistPayload(title));

    assert.equal(res.status, 200, res.text.slice(0, 200));
    const [task] = await tasksTitled(title);
    assert.equal(String(task.userId), users.memberA.id);
    assert.equal(String(task.societyId), societies.A.id);
  });

  test("Slack: an office bearer creates channels in their own society", async () => {
    const name = marker("ok-channel");

    const res = await importer("chairA", societies.A.id, "slack", {
      societyId: societies.B.id,
      channels: [{ name, societyId: societies.B.id }],
      messages: [],
    });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.importedChannels, 1);
    assert.equal(res.body.importedMessages, 0);
    const channels = await channelsNamed(name);
    assert.equal(channels.length, 1);
    assert.equal(String(channels[0].societyId), societies.A.id);
  });

  test("an administrator can import into any existing society (established ADMIN policy)", async () => {
    const title = marker("admin-task");
    const name = marker("admin-channel");

    const todoist = await importer("admin", societies.B.id, "todoist", todoistPayload(title));
    const slack = await importer("admin", societies.B.id, "slack", slackPayload(name));

    assert.equal(todoist.status, 200, todoist.text.slice(0, 200));
    assert.equal(slack.status, 200, slack.text.slice(0, 200));
    const [task] = await tasksTitled(title);
    assert.equal(String(task.societyId), societies.B.id);
    assert.equal(String(task.userId), users.admin.id);
    assert.equal((await channelsNamed(name))[0].societyId.toString(), societies.B.id);
  });
});

describe("Slack import: valid payloads (schema mapping)", () => {
  test("creates the channel and messages with the correct author, society, body and channel", async () => {
    const name = marker("slack-ok");
    const first = marker("slack-msg-one");
    const second = marker("slack-msg-two");

    const res = await importer("chairA", societies.A.id, "slack", {
      // None of these may change who authors the messages or where they go.
      societyId: societies.B.id,
      authorId: users.admin.id,
      channels: [{ name, societyId: societies.B.id }],
      messages: [
        { channel: name, text: first, authorId: users.admin.id, societyId: societies.B.id },
        { channel: name, content: second, senderId: users.admin.id },
      ],
    });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.deepEqual(res.body, {
      success: true,
      message: "Slack import completed",
      importedChannels: 1,
      importedMessages: 2,
    });
    const channels = await channelsNamed(name);
    assert.equal(channels.length, 1);
    assert.equal(String(channels[0].societyId), societies.A.id);
    assert.equal(channels[0].type, "chat");
    for (const [body, label] of [[first, "text"], [second, "content"]]) {
      const stored = await messagesBodied(body);
      assert.equal(stored.length, 1, label);
      assert.equal(stored[0].plainText, body, label);
      assert.equal(String(stored[0].authorId), users.chairA.id, label);
      assert.equal(String(stored[0].societyId), societies.A.id, label);
      assert.equal(String(stored[0].channelId), String(channels[0]._id), label);
      assert.equal(stored[0].parentMessageId, null, label);
    }
  });

  test("an administrator's import is attributed to the administrator in the path society", async () => {
    const name = marker("slack-admin");
    const text = marker("slack-admin-msg");

    const res = await importer("admin", societies.B.id, "slack", {
      channels: [{ name }],
      messages: [{ channel: name, text }],
    });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    const [stored] = await messagesBodied(text);
    assert.equal(String(stored.authorId), users.admin.id);
    assert.equal(String(stored.societyId), societies.B.id);
  });

  test("a later import reuses the existing channel instead of creating or failing on a duplicate", async () => {
    const name = marker("slack-reuse");
    const earlier = marker("slack-earlier");
    const later = marker("slack-later");
    await importer("chairA", societies.A.id, "slack", {
      channels: [{ name }],
      messages: [{ channel: name, text: earlier }],
    });

    const res = await importer("chairA", societies.A.id, "slack", {
      channels: [{ name }],
      messages: [{ channel: name, text: later }],
    });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.equal(res.body.importedChannels, 0);
    assert.equal(res.body.importedMessages, 1);
    const channels = await channelsNamed(name);
    assert.equal(channels.length, 1);
    const [stored] = await messagesBodied(later);
    assert.equal(String(stored.channelId), String(channels[0]._id));
  });

  test("a mixed-case channel name is stored lowercase and re-importing it is not a duplicate error", async () => {
    const lower = marker("slack-case");
    const mixed = lower.replace("slack-case", "Slack-CASE");

    const first = await importer("chairA", societies.A.id, "slack", { channels: [{ name: mixed }] });
    const again = await importer("chairA", societies.A.id, "slack", { channels: [{ name: mixed }] });

    assert.equal(first.status, 200, first.text.slice(0, 300));
    assert.equal(first.body.importedChannels, 1);
    assert.equal(again.status, 200, again.text.slice(0, 300));
    assert.equal(again.body.importedChannels, 0);
    assert.equal((await channelsNamed(lower)).length, 1);
  });
});

describe("Slack import: invalid payloads create nothing", () => {
  const rejected = (res) => {
    assert.equal(res.status, 400, res.text.slice(0, 300));
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "Validation Error");
    assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
  };

  test("the original defect: an invalid message leaves no channel and no messages behind", async () => {
    const name = marker("slack-invalid-msg");
    const valid = marker("slack-valid-before");

    const res = await importer("chairA", societies.A.id, "slack", {
      channels: [{ name }],
      messages: [
        { channel: name, text: valid },
        { channel: name, text: "" },
      ],
    });

    rejected(res);
    assert.match(res.body.errors.join(" "), /messages\[1\]/);
    assert.equal((await channelsNamed(name)).length, 0, "a channel was left behind");
    assert.equal((await messagesBodied(valid)).length, 0, "a message was left behind");
  });

  test("an invalid second channel prevents the first from being created", async () => {
    const good = marker("slack-good-channel");

    const res = await importer("chairA", societies.A.id, "slack", {
      channels: [{ name: good }, { name: "Not Kebab Case!" }],
    });

    rejected(res);
    assert.match(res.body.errors.join(" "), /channels\[1\]/);
    assert.equal((await channelsNamed(good)).length, 0);
  });

  test("malformed fields and shapes are 400 and write nothing", async () => {
    const name = marker("slack-malformed");
    const text = marker("slack-malformed-msg");
    const payloads = [
      { channels: [{ name }], messages: [{ channel: name }] }, // no text
      { channels: [{ name }], messages: [{ channel: name, text: 42 }] },
      { channels: [{ name }], messages: [{ channel: name, text: { $ne: "" } }] },
      { channels: [{ name }], messages: [{ text }] }, // no channel
      { channels: [{ name }], messages: ["a string"] },
      { channels: [{ name }], messages: "not an array" },
      { channels: "not an array", messages: [{ channel: name, text }] },
      { channels: [{ name: 7 }] },
      { channels: [null] },
      { channels: [{ name }], messages: null },
    ];
    for (const payload of payloads) {
      const res = await importer("chairA", societies.A.id, "slack", payload);

      rejected(res);
    }
    const asArray = await importer("chairA", societies.A.id, "slack", [{ name }]);
    rejected(asArray);

    assert.equal((await channelsNamed(name)).length, 0);
    assert.equal((await messagesBodied(text)).length, 0);
  });

  test("an invalid payload from an unauthorized caller is still refused by the guards first", async () => {
    const name = marker("slack-guard-first");

    const res = await importer("chairA", societies.B.id, "slack", {
      channels: [{ name }],
      messages: [{ channel: name, text: "" }],
    });

    assert.equal(res.status, 403);
    assert.equal((await channelsNamed(name)).length, 0);
  });

  test("the server stays healthy after the rejected payloads", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});
