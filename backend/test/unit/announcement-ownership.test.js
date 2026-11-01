// AUD-022: announcement ownership was decided by comparing the mutable display
// name (announcement.senderName === req.user.name). Display names are not unique
// and any user can change their own (PATCH /users/:id), so any user who could edit
// or delete announcements could take over anyone else's by sharing their name.
//
// Behavior under test:
//   - ownership is the server-assigned createdBy id (set from req.user on create,
//     never from the body) - the display name proves nothing;
//   - an administrator may change any announcement (unchanged policy); everyone
//     else only their own; an announcement with no createdBy (created before the
//     field existed) is administrator-only, with no fallback to senderName;
//   - senderName is presentation only: administrators may set it, everyone else's
//     is their own name, and changing it never changes ownership;
//   - PATCH holds a non-administrator to the audience rules that apply on create
//     (no "ALL", own society only), on the resulting values;
//   - the RBAC permission checks (announcements:create/edit/delete) are unchanged.
//
// The real Announcement schema is used (hydrated documents); database calls and the
// permission resolver are stubbed. No database or server is involved. Database-level
// behavior is covered by announcement-ownership.integration.test.js.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const OWNER = "64b7f8f2a1b2c3d4e5f6a001";
const OTHER = "64b7f8f2a1b2c3d4e5f6a002";
const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";
const ANN = "64b7f8f2a1b2c3d4e5f6d001";

const Announcement = require("../../src/models/Announcement");
const original = {
  findById: Announcement.findById,
  create: Announcement.create,
  findByIdAndDelete: Announcement.findByIdAndDelete,
};

let doc;
let calls;
let resolved;

function stubModule(relPath, exportsValue) {
  const file = require.resolve(path.join(__dirname, relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsValue };
}
function freshLoad(relPath) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  return require(file);
}

const hydrate = (extra = {}) =>
  Announcement.hydrate({
    _id: ANN,
    title: "Original",
    message: "Original message",
    senderName: "Pat Chair",
    targetAudience: "SOCIETY",
    societyId: SOCIETY_A,
    createdBy: OWNER,
    date: new Date("2026-01-01T00:00:00Z"),
    ...extra,
  });

beforeEach(() => {
  calls = { saves: 0, deletes: [], creates: [] };
  resolved = { role: "r", scope: { type: "society", societyId: SOCIETY_A }, permissions: {} };
  doc = hydrate();
  doc.save = async function save() {
    await this.validate();
    calls.saves++;
    return this;
  };

  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => resolved,
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", { logAudit: async () => {} });
  delete require.cache[require.resolve("../../src/middleware/rbac.js")];
  const authFile = require.resolve(path.join(__dirname, "../../src/middleware/auth.js"));
  delete require.cache[authFile];
  const auth = require(authFile);
  require.cache[authFile] = {
    id: authFile,
    filename: authFile,
    loaded: true,
    exports: { ...auth, authenticate: (req, res, next) => next() },
  };

  Announcement.findById = (id) => {
    const found = String(id) === ANN && doc ? doc : null;
    const chain = { populate: () => chain, then: (a, b) => Promise.resolve(found).then(a, b) };
    return chain;
  };
  Announcement.findByIdAndDelete = async (id) => {
    calls.deletes.push(String(id));
    return doc;
  };
  Announcement.create = async (fields) => {
    calls.creates.push(fields);
    doc = Announcement.hydrate({ _id: ANN, ...fields });
    doc.save = async function save() {
      calls.saves++;
      return this;
    };
    return doc;
  };
});

test.after(() => {
  Announcement.findById = original.findById;
  Announcement.create = original.create;
  Announcement.findByIdAndDelete = original.findByIdAndDelete;
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

async function call(method, routePath, { user, params = {}, body = {} }) {
  const router = freshLoad("../../src/routes/announcements.js");
  const layer = router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods[method]);
  assert.ok(layer, `no ${method} ${routePath}`);
  const req = {
    user,
    params,
    body,
    query: {},
    method: method.toUpperCase(),
    originalUrl: `/api/v1/announcements${routePath}`,
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
const post = (options) => call("post", "/", options);
const patch = (options) => call("patch", "/:id", { params: { id: ANN }, ...options });
const del = (options) => call("delete", "/:id", { params: { id: ANN }, ...options });

const grant = (...keys) => {
  resolved = { ...resolved, permissions: Object.fromEntries(keys.map((k) => [k, "limited_own_scope"])) };
};
const owner = (extra = {}) => ({ _id: OWNER, role: "OFFICE_BEARER", name: "Pat Chair", societyId: SOCIETY_A, ...extra });
const stranger = (extra = {}) => ({ _id: OTHER, role: "OFFICE_BEARER", name: "Someone Else", societyId: SOCIETY_A, ...extra });
const admin = () => ({ _id: OTHER, role: "ADMIN", name: "Admin", societyId: null });

// ---- the RBAC checks are unchanged ---------------------------------------------------

test("create, edit and delete still need their announcements permission", async () => {
  for (const [fn, key] of [
    [() => post({ user: owner(), body: { title: "t", message: "m", targetAudience: "SOCIETY", societyId: SOCIETY_A } }), "announcements:create"],
    [() => patch({ user: owner(), body: { title: "x" } }), "announcements:edit"],
    [() => del({ user: owner() }), "announcements:delete"],
  ]) {
    grant();
    const denied = await fn();
    assert.equal(denied.res.statusCode, 403, key);
    assert.equal(denied.res.body.error.code, "PERMISSION_DENIED");

    grant(key);
    const allowed = await fn();
    assert.notEqual(allowed.res.statusCode, 403, key);
  }
  assert.equal(calls.saves + calls.deletes.length, 2);
});

// ---- creation ------------------------------------------------------------------------

test("create: createdBy is the authenticated caller and a body createdBy is ignored", async () => {
  grant("announcements:create");

  const { res } = await post({
    user: owner(),
    body: { title: "t", message: "m", targetAudience: "SOCIETY", societyId: SOCIETY_A, createdBy: OTHER, ownerId: OTHER, userId: OTHER },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(String(calls.creates[0].createdBy), OWNER);
  assert.equal(calls.creates[0].ownerId, undefined);
});

test("create: a non-administrator cannot choose the sender name; an administrator can", async () => {
  grant("announcements:create");

  await post({ user: owner(), body: { title: "t", message: "m", targetAudience: "SOCIETY", societyId: SOCIETY_A, senderName: "Dean of Engineering" } });
  await post({ user: admin(), body: { title: "t", message: "m", targetAudience: "ALL", senderName: "Dean of Engineering" } });
  await post({ user: admin(), body: { title: "t", message: "m", targetAudience: "ALL" } });

  assert.equal(calls.creates[0].senderName, "Pat Chair");
  assert.equal(calls.creates[1].senderName, "Dean of Engineering");
  assert.equal(calls.creates[2].senderName, "Admin");
  assert.ok(calls.creates.every((c) => c.createdBy));
});

test("create: the audience rules are unchanged (no ALL, own society only for a non-administrator)", async () => {
  grant("announcements:create");

  const all = await post({ user: owner(), body: { title: "t", message: "m", targetAudience: "ALL" } });
  const foreign = await post({ user: owner(), body: { title: "t", message: "m", targetAudience: "SOCIETY", societyId: SOCIETY_B } });
  const own = await post({ user: owner(), body: { title: "t", message: "m", targetAudience: "SOCIETY", societyId: SOCIETY_A } });

  assert.equal(all.res.statusCode, 403);
  assert.equal(foreign.res.statusCode, 403);
  assert.equal(own.res.statusCode, 201);
  assert.equal(calls.creates.length, 1);
});

// ---- delete ---------------------------------------------------------------------------

test("delete: the creator can delete; the response is unchanged", async () => {
  grant("announcements:delete");

  const { res } = await del({ user: owner() });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, message: "Announcement deleted" });
  assert.deepEqual(calls.deletes, [ANN]);
});

test("delete: another user with the creator's exact display name is refused", async () => {
  grant("announcements:delete");

  for (const impostor of [
    stranger({ name: "Pat Chair" }),
    stranger({ name: "Pat Chair", societyId: SOCIETY_B }),
    stranger({ name: "  Pat Chair  " }),
  ]) {
    const { res } = await del({ user: impostor });

    assert.equal(res.statusCode, 403, JSON.stringify(impostor.name));
    assert.equal(res.body.message, "You can only delete your own announcements");
  }
  assert.deepEqual(calls.deletes, []);
});

test("delete: a legacy announcement with no creator is administrator-only, even when the names match", async () => {
  grant("announcements:delete");
  doc = hydrate({ createdBy: undefined });

  const sameName = await del({ user: owner() });
  const admin_ = await del({ user: admin() });

  assert.equal(sameName.res.statusCode, 403);
  assert.match(sameName.res.body.message, /no recorded owner/);
  assert.equal(admin_.res.statusCode, 200);
  assert.deepEqual(calls.deletes, [ANN]);
});

test("delete: an administrator may delete any announcement (unchanged policy)", async () => {
  grant("announcements:delete");

  const { res } = await del({ user: admin() });

  assert.equal(res.statusCode, 200);
});

test("delete: unknown id is 404", async () => {
  grant("announcements:delete");
  doc = null;

  const { res } = await del({ user: owner() });

  assert.equal(res.statusCode, 404);
});

// ---- update ---------------------------------------------------------------------------

test("update: the creator can update their announcement", async () => {
  grant("announcements:edit");

  const { res } = await patch({ user: owner(), body: { title: "Edited", message: "New text" } });

  assert.equal(res.statusCode, 200);
  assert.equal(doc.title, "Edited");
  assert.equal(calls.saves, 1);
});

test("update: matching the creator's display name does not give ownership", async () => {
  grant("announcements:edit");

  const { res } = await patch({ user: stranger({ name: "Pat Chair" }), body: { title: "Hijacked" } });

  assert.equal(res.statusCode, 403);
  assert.equal(doc.title, "Original");
  assert.equal(calls.saves, 0);
});

test("update: changing senderName neither transfers ownership nor lets a non-administrator rename the sender", async () => {
  grant("announcements:edit");

  await patch({ user: owner(), body: { senderName: "Someone Else", createdBy: OTHER, ownerId: OTHER } });

  assert.equal(doc.senderName, "Pat Chair");
  assert.equal(String(doc.createdBy), OWNER);
  // Even if a sender name had been set to match, the other user is still not the owner.
  doc.senderName = "Someone Else";
  const takeover = await patch({ user: stranger(), body: { title: "Hijacked" } });
  assert.equal(takeover.res.statusCode, 403);
});

test("update: an administrator may change the display name, which still changes no ownership", async () => {
  grant("announcements:edit");

  const { res } = await patch({ user: admin(), body: { senderName: "Dean of Engineering", createdBy: OTHER } });

  assert.equal(res.statusCode, 200);
  assert.equal(doc.senderName, "Dean of Engineering");
  assert.equal(String(doc.createdBy), OWNER, "createdBy changed");
});

test("update: a legacy announcement with no creator is administrator-only", async () => {
  grant("announcements:edit");
  doc = hydrate({ createdBy: undefined });

  const sameName = await patch({ user: owner(), body: { title: "Hijacked" } });
  const admin_ = await patch({ user: admin(), body: { title: "Fixed by admin" } });

  assert.equal(sameName.res.statusCode, 403);
  assert.equal(admin_.res.statusCode, 200);
  assert.equal(doc.title, "Fixed by admin");
});

test("update: a creator cannot retarget their announcement to everyone or to another society", async () => {
  grant("announcements:edit");

  const toAll = await patch({ user: owner(), body: { targetAudience: "ALL" } });
  assert.equal(toAll.res.statusCode, 403);
  doc = hydrate();
  const toOtherSociety = await patch({ user: owner(), body: { targetAudience: "SOCIETY", societyId: SOCIETY_B } });
  assert.equal(toOtherSociety.res.statusCode, 403);
  doc = hydrate();
  const societyOnly = await patch({ user: owner(), body: { societyId: SOCIETY_B } });
  assert.equal(societyOnly.res.statusCode, 403, "a society change without an audience must not slip through");

  assert.equal(calls.saves, 0);
});

test("update: D-A2 - a creator cannot retarget to LEADERSHIP; own society still works and administrators may use ALL or LEADERSHIP", async () => {
  grant("announcements:edit");

  const leadership = await patch({ user: owner(), body: { targetAudience: "LEADERSHIP" } });
  assert.equal(leadership.res.statusCode, 403);
  assert.equal(calls.saves, 0, "a refused retarget must not be saved");

  doc = hydrate();
  const adminLeadership = await patch({ user: admin(), body: { targetAudience: "LEADERSHIP" } });
  assert.equal(adminLeadership.res.statusCode, 200);
  assert.equal(doc.targetAudience, "LEADERSHIP");

  doc = hydrate();
  const own = await patch({ user: owner(), body: { targetAudience: "SOCIETY", societyId: SOCIETY_A } });
  assert.equal(own.res.statusCode, 200);

  doc = hydrate();
  const everyone = await patch({ user: admin(), body: { targetAudience: "ALL" } });
  assert.equal(everyone.res.statusCode, 200);
  assert.equal(doc.targetAudience, "ALL");
});

test("update: a creator's legacy LEADERSHIP post stays editable while its audience is unchanged; changing the audience is refused", async () => {
  grant("announcements:edit");
  doc = hydrate({ targetAudience: "LEADERSHIP", societyId: null });

  const retitle = await patch({ user: owner(), body: { title: "Edited legacy" } });
  assert.equal(retitle.res.statusCode, 200);
  assert.equal(doc.title, "Edited legacy");
  assert.equal(doc.targetAudience, "LEADERSHIP");

  const toAll = await patch({ user: owner(), body: { targetAudience: "ALL" } });
  assert.equal(toAll.res.statusCode, 403);
  doc = hydrate({ targetAudience: "LEADERSHIP", societyId: null });
  const toForeign = await patch({ user: owner(), body: { targetAudience: "SOCIETY", societyId: SOCIETY_B } });
  assert.equal(toForeign.res.statusCode, 403);
});

test("create: D-A2 - a non-administrator cannot create a LEADERSHIP announcement", async () => {
  grant("announcements:create");

  const { res } = await post({ user: owner(), body: { title: "t", message: "m", targetAudience: "LEADERSHIP" } });

  assert.equal(res.statusCode, 403);
  assert.equal(calls.creates.length, 0);
});

test("update: invalid input keeps the established errors", async () => {
  grant("announcements:edit");

  const badAudience = await patch({ user: owner(), body: { targetAudience: "EVERYONE" } });

  assert.equal(badAudience.res.statusCode, 400);
  assert.equal(badAudience.res.body.message, "Invalid target audience");
  assert.equal(calls.saves, 0);
});

test("update: a user with no society cannot retarget to a society announcement", async () => {
  grant("announcements:edit");

  const { res } = await patch({ user: owner({ societyId: null }), body: { title: "x" } });

  // The record is SOCIETY-targeted at society A and the caller has no society.
  assert.equal(res.statusCode, 403);
  assert.equal(calls.saves, 0);
});
