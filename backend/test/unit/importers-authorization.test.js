// AUD-019: the Slack and Todoist importers were protected by authentication
// only. Any authenticated user could create channels or tasks in ANY society
// (and a malformed or nonexistent society id reached the database).
//
// Policy under test: community_hub:create (RBAC) AND membership of the society
// named in the URL (ADMIN unrestricted, as elsewhere) AND the society must
// exist, all checked before the first write. Identity and society come from
// the authenticated user and the path, never from the body.
//
// The real route stack and the real permission/scope middleware are run; the
// permission resolver, audit logger and models are stubbed, so no database,
// network or server is involved. Authentication itself is replaced by
// attaching req.user, because token handling is covered elsewhere.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CHAIR_A = "64b7f8f2a1b2c3d4e5f6a001";
const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";
const MISSING_SOCIETY = "64b7f8f2a1b2c3d4e5f6b0ff";
const OTHER_USER = "64b7f8f2a1b2c3d4e5f6a002";

// The Slack handler validates with the real Channel/Message schemas, so these
// are the real models with only their database statics replaced.
const Channel = require("../../src/models/Channel");
const Message = require("../../src/models/Message");
const originalStatics = {
  channelFindOne: Channel.findOne,
  channelCreate: Channel.create,
  messageCreate: Message.create,
};

let writes;
let resolved;
let societies;

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
  writes = { channels: [], messages: [], tasks: [] };
  societies = new Set([SOCIETY_A, SOCIETY_B]);
  resolved = {
    role: "society_chair",
    scope: { type: "society", societyId: SOCIETY_A },
    permissions: { "community_hub:create": "limited_own_scope" },
  };

  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => resolved,
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", { logAudit: async () => {} });

  delete require.cache[require.resolve("../../src/middleware/rbac.js")];

  // Real scope middleware; authentication replaced by req.user.
  delete require.cache[require.resolve("../../src/middleware/auth.js")];
  const auth = require("../../src/middleware/auth.js");
  stubModule("../../src/middleware/auth.js", { ...auth, authenticate: (req, res, next) => next() });

  stubModule("../../src/models/Society.js", {
    exists: async (query) => (societies.has(String(query._id)) ? { _id: query._id } : null),
  });
  Channel.findOne = async () => null;
  Channel.create = async (doc) => {
    writes.channels.push(doc);
    return { _id: `channel-${writes.channels.length}`, ...doc };
  };
  Message.create = async (doc) => {
    writes.messages.push(doc);
    return doc;
  };
  stubModule("../../src/models/Channel.js", Channel);
  stubModule("../../src/models/Message.js", Message);
  stubModule("../../src/models/Task.js", {
    create: async (doc) => {
      writes.tasks.push(doc);
      return doc;
    },
  });
});

test.after(() => {
  Channel.findOne = originalStatics.channelFindOne;
  Channel.create = originalStatics.channelCreate;
  Message.create = originalStatics.messageCreate;
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

/** Runs a route's handler stack in order, like Express, until a response is sent. */
async function callRoute(routePath, { user, societyId, body = {} }) {
  const router = freshLoad("../../src/routes/importers.js");
  const layer = router.stack.find((l) => l.route && l.route.path === routePath);
  assert.ok(layer, `no route ${routePath}`);
  const req = {
    user,
    params: { societyId },
    body,
    query: {},
    method: "POST",
    originalUrl: `/api/v1/societies/${societyId}/importer${routePath}`,
    ip: "127.0.0.1",
    headers: {},
    socket: {},
  };
  const res = mockRes();
  let error = null;
  for (const handlerLayer of layer.route.stack) {
    if (res.sent || error) break;
    await new Promise((resolve) => {
      const next = (err) => {
        if (err) error = err;
        resolve();
      };
      Promise.resolve(handlerLayer.handle(req, res, next)).then(() => {
        if (res.sent) resolve();
      }, (err) => {
        error = err;
        resolve();
      });
    });
  }
  if (error) throw error;
  return res;
}

const chairA = () => ({ _id: CHAIR_A, id: CHAIR_A, role: "OFFICE_BEARER", societyId: SOCIETY_A });
const admin = () => ({ _id: OTHER_USER, id: OTHER_USER, role: "ADMIN", societyId: null });
const noWrites = () => assert.deepEqual(writes, { channels: [], messages: [], tasks: [] });

const TODOIST_BODY = { tasks: [{ content: "Imported", priority: 4 }] };
const SLACK_BODY = { channels: [{ name: "imported" }], messages: [] };
const ROUTES = [
  ["/todoist", TODOIST_BODY],
  ["/slack", SLACK_BODY],
];

for (const [route, body] of ROUTES) {
  test(`${route}: a caller without community_hub:create is 403 and nothing is written`, async () => {
    for (const permissions of [{}, { "community_hub:create": "none" }, { "community_hub:create": "banana" }]) {
      resolved = { ...resolved, permissions };

      const res = await callRoute(route, { user: chairA(), societyId: SOCIETY_A, body });

      assert.equal(res.statusCode, 403, JSON.stringify(permissions));
      noWrites();
    }
  });

  test(`${route}: another society's id is 403 and nothing is written`, async () => {
    const res = await callRoute(route, { user: chairA(), societyId: SOCIETY_B, body });

    assert.equal(res.statusCode, 403);
    noWrites();
  });

  test(`${route}: a body that names the caller's society cannot override the path society`, async () => {
    const res = await callRoute(route, {
      user: chairA(),
      societyId: SOCIETY_B,
      body: { ...body, societyId: SOCIETY_A, query: { societyId: SOCIETY_A } },
    });

    assert.equal(res.statusCode, 403);
    noWrites();
  });

  test(`${route}: a user with no society is 403`, async () => {
    const res = await callRoute(route, {
      user: { ...chairA(), societyId: null },
      societyId: SOCIETY_A,
      body,
    });

    assert.equal(res.statusCode, 403);
    noWrites();
  });

  test(`${route}: an administrator with a malformed id is 400, never a write`, async () => {
    for (const societyId of ["not-an-object-id", "abcdefghijkl", `${SOCIETY_A}0`, "%7B%24ne%7D"]) {
      const res = await callRoute(route, { user: admin(), societyId, body });

      assert.equal(res.statusCode, 400, societyId);
      assert.equal(res.body.message, "Invalid ID format.");
    }
    noWrites();
  });

  test(`${route}: an administrator with a nonexistent society is 404, never a write`, async () => {
    const res = await callRoute(route, { user: admin(), societyId: MISSING_SOCIETY, body });

    assert.equal(res.statusCode, 404);
    noWrites();
  });

  test(`${route}: a non-admin learns nothing about whether another society exists`, async () => {
    const forMissing = await callRoute(route, { user: chairA(), societyId: MISSING_SOCIETY, body });
    const forExisting = await callRoute(route, { user: chairA(), societyId: SOCIETY_B, body });

    assert.equal(forMissing.statusCode, 403);
    assert.deepEqual(forMissing.body, forExisting.body);
    noWrites();
  });
}

test("/todoist: an authorized caller imports into their own society as themselves", async () => {
  const res = await callRoute("/todoist", {
    user: chairA(),
    societyId: SOCIETY_A,
    body: {
      // None of these may change who owns the task or where it goes.
      societyId: SOCIETY_B,
      userId: OTHER_USER,
      tasks: [
        { content: "One", priority: 4, societyId: SOCIETY_B, userId: OTHER_USER },
        { title: "Two", is_completed: true, societyId: SOCIETY_B },
      ],
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.importedTasks, 2);
  assert.equal(writes.tasks.length, 2);
  for (const task of writes.tasks) {
    assert.equal(task.societyId, SOCIETY_A);
    assert.equal(task.userId, CHAIR_A);
  }
  assert.deepEqual(writes.tasks.map((t) => t.priority), ["HIGH", "LOW"]);
});

test("/slack: an authorized caller creates channels in their own society", async () => {
  const res = await callRoute("/slack", {
    user: chairA(),
    societyId: SOCIETY_A,
    body: { societyId: SOCIETY_B, channels: [{ name: "general", societyId: SOCIETY_B }], messages: [] },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.importedChannels, 1);
  assert.equal(writes.channels.length, 1);
  assert.equal(writes.channels[0].societyId, SOCIETY_A);
  assert.equal(writes.channels[0].name, "general");
});

test("an administrator may import into any existing society (established ADMIN policy)", async () => {
  const todoist = await callRoute("/todoist", { user: admin(), societyId: SOCIETY_B, body: TODOIST_BODY });
  const slack = await callRoute("/slack", { user: admin(), societyId: SOCIETY_B, body: SLACK_BODY });

  assert.equal(todoist.statusCode, 200);
  assert.equal(slack.statusCode, 200);
  assert.equal(writes.tasks[0].societyId, SOCIETY_B);
  assert.equal(writes.tasks[0].userId, OTHER_USER);
  assert.equal(writes.channels[0].societyId, SOCIETY_B);
});

test("both routes run the guards before the handler", () => {
  const router = freshLoad("../../src/routes/importers.js");
  for (const routePath of ["/slack", "/todoist"]) {
    const layer = router.stack.find((l) => l.route && l.route.path === routePath);
    // authenticate, requirePermission, societyAccessByParam, requireExistingSociety, handler
    assert.equal(layer.route.stack.length, 5, routePath);
  }
});
