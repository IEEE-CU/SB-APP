// Slack importer repair. The handler created Message({ channelId, senderId,
// content }) but the Message schema requires body, plainText, authorId and
// societyId, so the first message failed validation AFTER the channel had been
// created. The whole payload is now validated against the real Channel and
// Message schemas before the first write, and messages are mapped to the schema.
//
// The real Channel and Message models are used (so validateSync is genuine);
// only their database statics are replaced, and the permission resolver, audit
// logger, Society lookup and authentication are stubbed. No database, network
// or server is involved. Authorization itself is covered by
// importers-authorization.test.js.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");

const CALLER = "64b7f8f2a1b2c3d4e5f6a001";
const OTHER_USER = "64b7f8f2a1b2c3d4e5f6a002";
const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";

const Channel = require("../../src/models/Channel");
const Message = require("../../src/models/Message");
const originalStatics = {
  channelFindOne: Channel.findOne,
  channelCreate: Channel.create,
  messageCreate: Message.create,
};

let writes;
let existingChannels; // name -> { _id }
let findOneQueries;

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
  writes = { channels: [], messages: [] };
  existingChannels = {};
  findOneQueries = [];

  Channel.findOne = async (query) => {
    findOneQueries.push(query);
    return existingChannels[query.name] || null;
  };
  Channel.create = async (doc) => {
    // Mirror the real behavior: the schema is enforced on create.
    const instance = new Channel(doc);
    const failure = instance.validateSync();
    if (failure) throw failure;
    const created = { _id: new mongoose.Types.ObjectId(), name: instance.name, societyId: instance.societyId };
    writes.channels.push(created);
    return created;
  };
  Message.create = async (doc) => {
    const instance = new Message(doc);
    const failure = instance.validateSync();
    if (failure) throw failure;
    writes.messages.push(instance.toObject());
    return instance;
  };

  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => ({
      role: "society_chair",
      scope: { type: "society", societyId: SOCIETY_A },
      permissions: { "community_hub:create": "limited_own_scope" },
    }),
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", { logAudit: async () => {} });
  delete require.cache[require.resolve("../../src/middleware/rbac.js")];
  delete require.cache[require.resolve("../../src/middleware/auth.js")];
  const auth = require("../../src/middleware/auth.js");
  stubModule("../../src/middleware/auth.js", { ...auth, authenticate: (req, res, next) => next() });
  stubModule("../../src/models/Society.js", {
    exists: async (query) =>
      [SOCIETY_A, SOCIETY_B].includes(String(query._id)) ? { _id: query._id } : null,
  });
  // The router must see the patched real models, not a stale copy.
  stubModule("../../src/models/Channel.js", Channel);
  stubModule("../../src/models/Message.js", Message);
  stubModule("../../src/models/Task.js", { create: async () => ({}) });
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

async function importSlack(body, { societyId = SOCIETY_A, user } = {}) {
  const router = freshLoad("../../src/routes/importers.js");
  const layer = router.stack.find((l) => l.route && l.route.path === "/slack");
  const req = {
    user: user || { _id: CALLER, id: CALLER, role: "OFFICE_BEARER", societyId: SOCIETY_A },
    params: { societyId },
    body,
    query: {},
    method: "POST",
    originalUrl: `/api/v1/societies/${societyId}/importer/slack`,
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

const noWrites = () => assert.deepEqual(writes, { channels: [], messages: [] });

async function assertRejected(body, fragment) {
  const { res, error } = await importSlack(body);

  assert.equal(error, null, "the handler threw instead of answering");
  assert.equal(res.statusCode, 400, JSON.stringify(body)?.slice(0, 80));
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, "Validation Error");
  assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
  if (fragment) {
    assert.ok(
      res.body.errors.some((e) => fragment.test(e)),
      `no error matched ${fragment}: ${JSON.stringify(res.body.errors)}`,
    );
  }
  noWrites();
}

// ---- valid import -------------------------------------------------------------

test("a valid import creates the channel and messages mapped to the Message schema", async () => {
  const { res, error } = await importSlack({
    channels: [{ name: "general" }],
    messages: [
      { channel: "general", text: "first" },
      { channel: "general", content: "second via content" },
    ],
  });

  assert.equal(error, null);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: "Slack import completed",
    importedChannels: 1,
    importedMessages: 2,
  });
  assert.equal(writes.channels.length, 1);
  assert.equal(writes.channels[0].name, "general");
  assert.equal(String(writes.channels[0].societyId), SOCIETY_A);
  assert.equal(writes.messages.length, 2);
  assert.deepEqual(writes.messages.map((m) => m.body), ["first", "second via content"]);
  for (const message of writes.messages) {
    assert.equal(message.plainText, message.body);
    assert.equal(String(message.authorId), CALLER);
    assert.equal(String(message.societyId), SOCIETY_A);
    assert.equal(String(message.channelId), String(writes.channels[0]._id));
  }
});

test("payload fields cannot set the author, society or channel of an imported message", async () => {
  const { res } = await importSlack({
    authorId: OTHER_USER,
    societyId: SOCIETY_B,
    channels: [{ name: "general", societyId: SOCIETY_B }],
    messages: [
      {
        channel: "general",
        text: "hello",
        authorId: OTHER_USER,
        senderId: OTHER_USER,
        societyId: SOCIETY_B,
        channelId: new mongoose.Types.ObjectId().toString(),
      },
    ],
  });

  assert.equal(res.statusCode, 200);
  const [message] = writes.messages;
  assert.equal(String(message.authorId), CALLER);
  assert.equal(String(message.societyId), SOCIETY_A);
  assert.equal(String(message.channelId), String(writes.channels[0]._id));
  assert.equal(String(writes.channels[0].societyId), SOCIETY_A);
});

test("messages go to an existing channel instead of creating a duplicate", async () => {
  const existing = { _id: new mongoose.Types.ObjectId() };
  existingChannels.general = existing;

  const { res } = await importSlack({
    channels: [{ name: "general" }],
    messages: [{ channel: "general", text: "hi" }],
  });

  assert.equal(res.body.importedChannels, 0);
  assert.equal(res.body.importedMessages, 1);
  assert.equal(writes.channels.length, 0);
  assert.equal(String(writes.messages[0].channelId), String(existing._id));
});

test("a channel name is looked up and created in the schema's lowercase form", async () => {
  existingChannels.general = { _id: new mongoose.Types.ObjectId() };

  const { res } = await importSlack({ channels: [{ name: "General" }], messages: [] });

  assert.equal(res.statusCode, 200);
  assert.equal(findOneQueries[0].name, "general");
  assert.equal(res.body.importedChannels, 0, "an existing channel was not matched");
});

test("a channel without a name keeps the existing default name", async () => {
  const { res } = await importSlack({ channels: [{}], messages: [] });

  assert.equal(res.statusCode, 200);
  assert.equal(writes.channels[0].name, "imported-slack-channel");
});

test("messages for a channel that is not listed are ignored, as before", async () => {
  const { res } = await importSlack({
    channels: [{ name: "general" }],
    messages: [
      { channel: "general", text: "kept" },
      { channel: "elsewhere", text: "ignored" },
    ],
  });

  assert.equal(res.body.importedMessages, 1);
  assert.deepEqual(writes.messages.map((m) => m.body), ["kept"]);
});

test("an empty import succeeds without writes", async () => {
  for (const body of [{}, { channels: [], messages: [] }]) {
    const { res } = await importSlack(body);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.importedChannels, 0);
    assert.equal(res.body.importedMessages, 0);
  }
  noWrites();
});

// ---- invalid payloads create nothing -------------------------------------------

test("the original defect: a valid channel with an invalid message creates neither", async () => {
  await assertRejected(
    { channels: [{ name: "general" }], messages: [{ channel: "general", text: "" }] },
    /messages\[0\]/,
  );
});

test("an invalid message after valid ones creates nothing (no partial import)", async () => {
  await assertRejected(
    {
      channels: [{ name: "general" }],
      messages: [
        { channel: "general", text: "fine" },
        { channel: "general", text: "also fine" },
        { channel: "general", text: "   " },
      ],
    },
    /messages\[2\]/,
  );
});

test("an invalid second channel prevents the first channel from being created", async () => {
  await assertRejected(
    { channels: [{ name: "general" }, { name: "Not Kebab Case!" }], messages: [] },
    /channels\[1\]/,
  );
});

test("invalid message shapes are rejected", async () => {
  const bad = [
    { channel: "general" }, // no text
    { channel: "general", text: 42 },
    { channel: "general", text: { $ne: "" } },
    { channel: "general", text: ["a"] },
    { channel: "general", text: null, content: null },
    { text: "no channel" },
    { channel: 7, text: "numeric channel" },
    { channel: "", text: "empty channel" },
    "a string",
    null,
    7,
    ["array"],
  ];
  for (const message of bad) {
    await assertRejected({ channels: [{ name: "general" }], messages: [message] });
  }
});

test("invalid channel shapes and names are rejected", async () => {
  const bad = [
    { name: "Has Spaces" },
    { name: "#general" },
    { name: "under_score" },
    { name: 7 },
    { name: { $ne: "" } },
    { name: ["general"] },
    "general",
    null,
    ["general"],
  ];
  for (const channel of bad) {
    await assertRejected({ channels: [channel], messages: [] });
  }
});

test("a malformed payload is rejected safely", async () => {
  await assertRejected(null, /JSON object/);
  await assertRejected("text", /JSON object/);
  await assertRejected(["not", "an", "object"], /JSON object/);
  await assertRejected({ channels: "general" }, /channels must be an array/);
  await assertRejected({ channels: {} }, /channels must be an array/);
  await assertRejected({ messages: "hi" }, /messages must be an array/);
  await assertRejected({ channels: null }, /channels must be an array/);
  await assertRejected({ messages: null }, /messages must be an array/);
});

test("all problems are reported together, capped at 20", async () => {
  const many = Array.from({ length: 50 }, () => ({ channel: "general", text: "" }));

  const { res } = await importSlack({ channels: [{ name: "general" }], messages: many });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.errors.length, 20);
  noWrites();
});

test("validation failures use the established format and do not leak internals", async () => {
  const { res } = await importSlack({ channels: [{ name: "BAD NAME" }] });

  assert.deepEqual(Object.keys(res.body).sort(), ["errors", "message", "success"]);
  assert.ok(res.body.errors.every((e) => typeof e === "string"));
});

test("the guards still run before any validation or write", async () => {
  const { res } = await importSlack(
    { channels: [{ name: "general" }], messages: [] },
    { societyId: SOCIETY_B }, // the caller belongs to society A
  );

  assert.equal(res.statusCode, 403);
  noWrites();
});
