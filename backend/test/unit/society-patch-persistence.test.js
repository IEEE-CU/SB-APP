// AUD-026: PATCH /societies/:id assigned name/description/type/budget on the
// loaded document and replied, but never called save(), so the response looked
// successful while nothing was stored.
//
// Behavior under test:
//   - the handler validates the four editable paths (cast errors included),
//     saves without re-validating the rest of the document, and still reads only
//     name/description/type/budget from the body;
//   - budget is applied only for administrators (as on the admin-only
//     PATCH /:id/budget); another user's budget value is ignored, never persisted
//     and never echoed;
//   - authorization: the society-scope guard first (admin, or a user of this
//     society), then the existing RBAC permission settings:edit - held by
//     sb_faculty_advisor, society_faculty_advisor, society_chair and sb_chair in
//     the seed matrix and docs/rbac-matrix.json. Both run before anything is read
//     or written.
//
// The real Society schema is used (hydrated documents, so casting, validation
// and modified-path tracking are genuine); findById and save's storage are
// replaced, the permission resolver and audit logger are stubbed, and the real
// scope and permission middleware run in front of the handler. No database or
// server is involved.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";
const MISSING = "64b7f8f2a1b2c3d4e5f6b0ff";

const Society = require("../../src/models/Society");
const originalFindById = Society.findById;

let stored; // what "the database" holds, by id
let findByIdCalls;
let resolved; // what the permission resolver reports for the caller
let doc;
let saves;

function stubModule(relPath, exportsValue) {
  const file = require.resolve(path.join(__dirname, relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsValue };
}

function freshLoad(relPath) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  return require(file);
}

function hydrate(id, extra = {}) {
  return Society.hydrate({
    _id: id,
    name: "Original Name",
    description: "Original description",
    shortName: id === SOCIETY_A ? "ORA" : "ORB",
    type: "SOCIETY",
    budget: 1000,
    logoUrl: "https://example.test/logo.png",
    advisorSignatureUrl: null,
    officeBearers: [{ name: "Chair", position: "Chair", email: "chair@example.test", phone: "555" }],
    members: [{ ieeeId: "1", name: "Member", email: "m@example.test", grade: "Student" }],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...extra,
  });
}

beforeEach(() => {
  saves = [];
  findByIdCalls = [];
  // By default the caller holds settings:edit, as society_chair does in the seed matrix.
  resolved = {
    role: "society_chair",
    scope: { type: "society", societyId: SOCIETY_A },
    permissions: { "settings:edit": "limited_own_scope" },
  };
  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => resolved,
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", { logAudit: async () => {} });
  delete require.cache[require.resolve("../../src/middleware/rbac.js")];
  doc = hydrate(SOCIETY_A);
  stored = { [SOCIETY_A]: doc, [SOCIETY_B]: hydrate(SOCIETY_B) };
  for (const society of Object.values(stored)) {
    society.save = async function save(options) {
      // Mirror what a real save does before writing: validate the whole document
      // unless validation is switched off, and fail without recording a write.
      if (!options || options.validateBeforeSave !== false) await this.validate();
      saves.push({ id: String(this._id), options, modified: this.modifiedPaths(), snapshot: this.toObject() });
      return this;
    };
  }
  Society.findById = async (id) => {
    findByIdCalls.push(String(id));
    return stored[String(id)] || null;
  };
});

test.after(() => {
  Society.findById = originalFindById;
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

async function patch(body, { user, id = SOCIETY_A }) {
  const router = freshLoad("../../src/routes/societies.js");
  const layer = router.stack.find((l) => l.route && l.route.path === "/:id" && l.route.methods.patch);
  const req = {
    user,
    params: { id },
    body,
    query: {},
    method: "PATCH",
    originalUrl: `/api/v1/societies/${id}`,
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

// chair() belongs to society A; chair(x) uses x as given, including null/undefined.
const chair = (...args) => ({ _id: "u1", role: "OFFICE_BEARER", societyId: args.length ? args[0] : SOCIETY_A });
const admin = () => ({ _id: "u2", role: "ADMIN", societyId: null });

// ---- persistence ---------------------------------------------------------------

test("a permitted update is saved, not just assigned", async () => {
  const { res, error } = await patch(
    { name: "New Name", description: "New description", type: "AFFINITY_GROUP" },
    { user: chair() },
  );

  assert.equal(error, null);
  assert.equal(res.statusCode, 200);
  assert.equal(saves.length, 1, "the update was never saved");
  assert.deepEqual(saves[0].modified.sort(), ["description", "name", "type"]);
  assert.equal(saves[0].snapshot.name, "New Name");
  assert.equal(saves[0].snapshot.description, "New description");
  assert.equal(saves[0].snapshot.type, "AFFINITY_GROUP");
});

test("the response envelope and shape are unchanged", async () => {
  const { res } = await patch({ name: "Renamed" }, { user: chair() });

  assert.deepEqual(Object.keys(res.body).sort(), ["data", "success"]);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.name, "Renamed");
  assert.equal(res.body.data.id !== undefined, true);
});

test("fields that are not sent are left alone, and an empty body saves nothing new", async () => {
  await patch({}, { user: chair() });

  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0].modified, []);
  assert.equal(doc.name, "Original Name");
});

test("the editable paths are validated explicitly and the rest of the document is not re-validated", async () => {
  await patch({ name: "Renamed" }, { user: chair() });

  assert.equal(saves[0].options.validateBeforeSave, false);
});

test("a legacy invalid roster entry does not block an unrelated rename", async () => {
  const legacy = Society.hydrate({
    _id: SOCIETY_A,
    name: "Legacy",
    shortName: "LEG",
    members: [{ name: "No email or grade" }],
  });
  legacy.save = stored[SOCIETY_A].save;
  stored[SOCIETY_A] = legacy;

  const { res, error } = await patch({ name: "Renamed legacy" }, { user: chair() });

  assert.equal(error, null);
  assert.equal(res.statusCode, 200);
  assert.equal(saves.length, 1);
});

// ---- protected fields ----------------------------------------------------------

test("only name, description, type and (for administrators) budget can be changed", async () => {
  const before = doc.toObject();
  const body = JSON.parse(
    JSON.stringify({
      name: "Kept",
      _id: MISSING,
      id: MISSING,
      shortName: "HACK",
      logoUrl: "https://evil.test/x.png",
      advisorSignatureUrl: "https://evil.test/s.png",
      officeBearers: [{ name: "Evil", position: "Chair", email: "e@evil.test" }],
      members: [],
      createdAt: "2001-01-01T00:00:00.000Z",
      updatedAt: "2001-01-01T00:00:00.000Z",
      __v: 9,
      isNew: true,
      _doc: { name: "Hijacked" },
      balance: 123456,
    }),
  );

  const { res } = await patch(body, { user: chair() });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(saves[0].modified, ["name"]);
  const after = doc.toObject();
  for (const field of ["_id", "shortName", "logoUrl", "advisorSignatureUrl", "createdAt", "updatedAt", "budget"]) {
    assert.deepEqual(after[field], before[field], field);
  }
  assert.deepEqual(after.officeBearers.map((o) => o.name), ["Chair"]);
  assert.deepEqual(after.members.map((m) => m.name), ["Member"]);
  assert.equal(after.name, "Kept");
});

// ---- budget policy -------------------------------------------------------------

test("an administrator's budget change is saved (they already hold PATCH /:id/budget)", async () => {
  const { res } = await patch({ name: "Renamed", budget: 2500 }, { user: admin() });

  assert.equal(res.statusCode, 200);
  assert.equal(saves[0].snapshot.budget, 2500);
  assert.deepEqual(saves[0].modified.sort(), ["budget", "name"]);
});

test("a non-admin's budget value is ignored: not saved and not echoed", async () => {
  const { res } = await patch({ name: "Renamed", budget: 999999 }, { user: chair() });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(saves[0].modified, ["name"]);
  assert.equal(saves[0].snapshot.budget, 1000);
  assert.equal(res.body.data.budget, 1000);
});

test("a body that claims to be an administrator does not unlock the budget", async () => {
  await patch({ budget: 5, role: "ADMIN", isAdmin: true, user: { role: "ADMIN" } }, { user: chair() });

  assert.equal(doc.budget, 1000);
});

// ---- rejected updates ----------------------------------------------------------

test("an invalid value is rejected with the schema's validation error and nothing is saved", async () => {
  for (const body of [
    { name: "Valid name", type: "NOT_A_TYPE" },
    { name: "" },
    { name: { $ne: "" } },
    { name: ["a"] },
    { description: { a: 1 } },
  ]) {
    saves = [];

    const { res, error } = await patch(body, { user: chair() });

    assert.equal(res.sent, false, JSON.stringify(body));
    assert.ok(error && error.name === "ValidationError", `${JSON.stringify(body)}: expected a validation error`);
    assert.deepEqual(saves, [], JSON.stringify(body));
  }
});

test("a negative administrator budget is rejected and nothing is saved", async () => {
  const { error } = await patch({ name: "Valid name", budget: -1 }, { user: admin() });

  assert.ok(error && error.name === "ValidationError");
  assert.deepEqual(saves, []);
});

test("a nonexistent society is 404 and nothing is saved", async () => {
  const { res } = await patch({ name: "x" }, { user: admin(), id: MISSING });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Society not found");
  assert.deepEqual(saves, []);
});

// ---- the scope guard still runs first ------------------------------------------

test("another society's id is 403 and nothing is read or saved", async () => {
  const { res } = await patch({ name: "Hijack" }, { user: chair(), id: SOCIETY_B });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(saves, []);
  assert.equal(stored[SOCIETY_B].name, "Original Name");
});

test("a caller with no society is 403", async () => {
  for (const societyId of [null, undefined, ""]) {
    const { res } = await patch({ name: "x" }, { user: chair(societyId) });

    assert.equal(res.statusCode, 403, JSON.stringify(societyId));
  }
  assert.deepEqual(saves, []);
});

test("an administrator may update any existing society", async () => {
  const { res } = await patch({ name: "By admin" }, { user: admin(), id: SOCIETY_B });

  assert.equal(res.statusCode, 200);
  assert.equal(saves[0].id, SOCIETY_B);
});

// ---- RBAC: settings:edit on top of the society scope ----------------------------

const grant = (permissions, extra = {}) => {
  resolved = { ...resolved, permissions, ...extra };
};

test("the route runs the scope guard, then settings:edit, then the handler", () => {
  const router = freshLoad("../../src/routes/societies.js");
  const layer = router.stack.find((l) => l.route && l.route.path === "/:id" && l.route.methods.patch);

  assert.equal(layer.route.stack.length, 3);
});

test("a same-society caller without settings:edit is 403 PERMISSION_DENIED and nothing is read or saved", async () => {
  for (const permissions of [
    {},
    { "settings:edit": "none" },
    { "settings:view": "full" },
    { "events:edit": "full" },
    { "settings:edit": "banana" },
  ]) {
    grant(permissions);
    saves = [];

    const { res, error } = await patch({ name: "Hijack", type: "COUNCIL", budget: 1 }, { user: chair() });

    assert.equal(error, null, JSON.stringify(permissions));
    assert.equal(res.statusCode, 403, JSON.stringify(permissions));
    assert.equal(res.body.error.code, "PERMISSION_DENIED");
    assert.deepEqual(saves, []);
  }
  assert.deepEqual(findByIdCalls, [], "the society was read before authorization");
  assert.equal(doc.name, "Original Name");
  assert.equal(doc.budget, 1000);
});

test("a foreign-society caller is denied by the scope guard even with settings:edit", async () => {
  grant({ "settings:edit": "full" });

  const { res } = await patch({ name: "Hijack" }, { user: chair(), id: SOCIETY_B });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Access restricted to your own society only.");
  assert.deepEqual(findByIdCalls, []);
  assert.deepEqual(saves, []);
  assert.equal(stored[SOCIETY_B].name, "Original Name");
});

test("a non-admin with no society is denied even with settings:edit", async () => {
  grant({ "settings:edit": "full" });

  for (const societyId of [null, undefined, ""]) {
    const { res } = await patch({ name: "x" }, { user: chair(societyId) });

    assert.equal(res.statusCode, 403, JSON.stringify(societyId));
  }
  assert.deepEqual(findByIdCalls, []);
  assert.deepEqual(saves, []);
});

test("an administrator keeps cross-society access, subject to the RBAC model", async () => {
  grant({ "settings:edit": "full" }, { role: "sb_faculty_advisor", scope: { type: "global", societyId: null } });
  const allowed = await patch({ name: "By admin" }, { user: admin(), id: SOCIETY_B });
  assert.equal(allowed.res.statusCode, 200);
  assert.equal(saves[0].id, SOCIETY_B);

  // An administrator whose RBAC role lacks the permission is denied like anyone else.
  grant({});
  saves = [];
  const denied = await patch({ name: "By admin" }, { user: admin(), id: SOCIETY_B });
  assert.equal(denied.res.statusCode, 403);
  assert.deepEqual(saves, []);
});

test("an authorized non-admin's metadata is saved while a budget value in the same request is not", async () => {
  const { res } = await patch(
    { name: "Renamed with budget", type: "COUNCIL", budget: 999999 },
    { user: chair() },
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(saves[0].modified.sort(), ["name", "type"]);
  assert.equal(saves[0].snapshot.budget, 1000);
  assert.equal(res.body.data.budget, 1000);
});

test("a denied request cannot partially change metadata or budget", async () => {
  grant({});

  await patch({ name: "Partial", description: "Partial", type: "COUNCIL", budget: 5 }, { user: chair() });

  assert.deepEqual(saves, []);
  assert.equal(doc.name, "Original Name");
  assert.equal(doc.description, "Original description");
  assert.equal(doc.type, "SOCIETY");
  assert.equal(doc.budget, 1000);
});

test("the permission is checked before the payload: invalid input from an unauthorized caller is 403, not 400", async () => {
  grant({});

  const { res, error } = await patch({ type: "NOT_A_TYPE", name: "" }, { user: chair() });

  assert.equal(error, null);
  assert.equal(res.statusCode, 403);
});

test("the dedicated budget route is still administrator-only", () => {
  const router = freshLoad("../../src/routes/societies.js");
  const layer = router.stack.find((l) => l.route && l.route.path === "/:id/budget" && l.route.methods.patch);

  assert.ok(layer, "no PATCH /:id/budget route");
  assert.equal(layer.route.stack.length, 2); // adminOnly, handler
  const adminOnlyGuard = layer.route.stack[0].handle;
  let nextCalled = false;
  let status = null;
  const res = {
    status: (code) => {
      status = code;
      return res;
    },
    json: () => res,
  };
  adminOnlyGuard({ user: chair() }, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(status, 403);
});
