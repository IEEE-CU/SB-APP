// AUD-032: the notes API ignored Note.isPublic - every note of a society was returned by
// the list and by id to anyone with community_hub:view, private ones included, and any
// caller with community_hub:edit/delete could change or delete anyone's private note.
//
// Policy (see routes/notes.js): public notes (isPublic true, or the field absent) are read
// by every caller who passes the permission and society-scope checks; private notes
// (false, null or any non-boolean value) only by their server-assigned author and by
// administrators; a hidden note is a 404 like a missing one. isPublic never widens
// mutations, and only the author or an administrator may change a note's visibility.
//
// The real router runs with the Note model's database calls replaced and the RBAC
// middleware replaced by pass-throughs (permission checks are covered by the integration
// test), so no database or server is involved.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SOC_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOC_B = "64b7f8f2a1b2c3d4e5f6b002";
const NOTE = "64b7f8f2a1b2c3d4e5f6d001";
const AUTHOR = "64b7f8f2a1b2c3d4e5f6a001";
const OTHER = "64b7f8f2a1b2c3d4e5f6a002";
const ADMIN = "64b7f8f2a1b2c3d4e5f6a003";

const Note = require("../../src/models/Note");
const original = { find: Note.find, findOne: Note.findOne, create: Note.create, findByIdAndDelete: Note.findByIdAndDelete };

let calls;
let found;

function freshLoad(relPath) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  return require(file);
}

function stubModule(relPath, patch) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  const real = require(file);
  require.cache[file] = { id: file, filename: file, loaded: true, exports: { ...real, ...patch } };
}

beforeEach(() => {
  calls = { find: [], findOne: [], create: [], deleted: [] };
  found = null;

  stubModule("../../src/middleware/auth.js", { authenticate: (req, res, next) => next() });
  stubModule("../../src/middleware/rbac.js", {
    requirePermission: () => (req, res, next) => next(),
    // The test's own scope: a society id, or null for global.
    attachScope: () => (req, res, next) => {
      req.scopeFilter = req.testScope ? { societyId: req.testScope } : {};
      next();
    },
  });

  Note.find = (filter) => {
    calls.find.push(filter);
    const chain = { populate: () => chain, sort: async () => [] };
    return chain;
  };
  Note.findOne = (filter) => {
    calls.findOne.push(filter);
    const chain = { populate: () => chain, then: (a, b) => Promise.resolve(found).then(a, b) };
    return chain;
  };
  Note.create = async (doc) => {
    calls.create.push(doc);
    return { _id: NOTE, ...doc };
  };
  Note.findByIdAndDelete = async (id) => {
    calls.deleted.push(String(id));
  };
});

test.after(() => {
  Note.find = original.find;
  Note.findOne = original.findOne;
  Note.create = original.create;
  Note.findByIdAndDelete = original.findByIdAndDelete;
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

async function call(method, routePath, { user, params = {}, query = {}, body = {}, scope = SOC_A }) {
  const router = freshLoad("../../src/routes/notes.js");
  const layer = router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods[method]);
  assert.ok(layer, `no ${method} ${routePath}`);
  const req = { user, params: { societyId: SOC_A, ...params }, query, body, testScope: scope, method: method.toUpperCase() };
  const res = mockRes();
  let error = null;
  for (const handlerLayer of layer.route.stack) {
    if (res.sent || error) break;
    await new Promise((resolve) => {
      Promise.resolve(handlerLayer.handle(req, res, (err) => {
        if (err) error = err;
        resolve();
      })).then(() => resolve(), (err) => {
        error = err;
        resolve();
      });
    });
  }
  return { res, error };
}

const author = { _id: AUTHOR, role: "OFFICE_BEARER" };
const other = { _id: OTHER, role: "OFFICE_BEARER" };
const admin = { _id: ADMIN, role: "ADMIN" };
const noteDoc = (extra = {}) => {
  const doc = {
    _id: NOTE,
    societyId: SOC_A,
    authorId: AUTHOR,
    title: "t",
    isPublic: false,
    saved: 0,
    async save() {
      this.saved += 1;
    },
    ...extra,
  };
  return doc;
};
const listFilter = (user) => call("get", "/", { user }).then(() => calls.find.at(-1));
const detailFilter = (user) => call("get", "/:noteId", { user, params: { noteId: NOTE } }).then(() => calls.findOne.at(-1));

// ---- one rule for the list and the detail ------------------------------------------

test("non-admin callers: public (true or absent) or their own authorship", async () => {
  const filter = await listFilter(other);

  assert.deepEqual(filter.$and[0], { societyId: SOC_A });
  assert.deepEqual(filter.$and[1], {
    $or: [{ isPublic: true }, { isPublic: { $exists: false } }, { authorId: OTHER }],
  });
});

test("the list and the detail apply the identical visibility clause, for every kind of caller", async () => {
  for (const user of [author, other, admin, { _id: "x", role: "STRANGER" }]) {
    const list = await listFilter(user);
    const detail = await detailFilter(user);

    assert.deepEqual(detail.$and[1], list.$and[1], `list and detail disagree for ${user.role}`);
    assert.deepEqual(detail.$and[0], { _id: NOTE, societyId: SOC_A });
  }
});

test("administrators are unrestricted; a null or non-boolean isPublic is never matched for others", async () => {
  assert.deepEqual((await listFilter(admin)).$and[1], {});
  const clause = (await listFilter(other)).$and[1];
  assert.equal(JSON.stringify(clause).includes("null"), false);
  assert.equal(clause.$or.length, 3);
});

test("the channel filter is added to, not instead of, the visibility filter", async () => {
  await call("get", "/", { user: other, query: { channelId: "c1" } });

  const filter = calls.find.at(-1);
  assert.equal(filter.$and.length, 3);
  assert.deepEqual(filter.$and[2], { channelId: "c1" });
});

test("list: society scope is still enforced before any query", async () => {
  const { res } = await call("get", "/", { user: other, scope: SOC_B });

  assert.equal(res.statusCode, 403);
  assert.equal(calls.find.length, 0);
});

// ---- detail ----------------------------------------------------------------------------

test("a hidden private note is a 404 exactly like a missing one", async () => {
  found = null; // the visibility filter matched nothing
  const hidden = await call("get", "/:noteId", { user: other, params: { noteId: NOTE } });
  const missing = await call("get", "/:noteId", { user: other, params: { noteId: "64b7f8f2a1b2c3d4e5f6dfff" } });

  assert.equal(hidden.res.statusCode, 404);
  assert.deepEqual(hidden.res.body, missing.res.body);
});

test("a visible note is returned in the unchanged envelope; other societies are still 403", async () => {
  found = noteDoc({ isPublic: true });
  const ok = await call("get", "/:noteId", { user: other, params: { noteId: NOTE } });
  const foreign = await call("get", "/:noteId", { user: other, params: { noteId: NOTE }, scope: SOC_B });

  assert.equal(ok.res.statusCode, 200);
  assert.deepEqual(Object.keys(ok.res.body), ["success", "data"]);
  assert.equal(foreign.res.statusCode, 403);
});

// ---- mutations -------------------------------------------------------------------------

test("update and delete look the note up through the same visibility filter; hidden means 404 and no change", async () => {
  found = null;

  const put = await call("put", "/:noteId", { user: other, params: { noteId: NOTE }, body: { title: "x", isPublic: true } });
  const del = await call("delete", "/:noteId", { user: other, params: { noteId: NOTE } });

  assert.equal(put.res.statusCode, 404);
  assert.equal(del.res.statusCode, 404);
  assert.deepEqual(calls.findOne[0].$and[1], calls.findOne[1].$and[1]);
  assert.deepEqual(calls.findOne[0].$and[1], (await listFilter(other)).$and[1]);
  assert.deepEqual(calls.deleted, []);
});

test("the author can update and delete their private note", async () => {
  found = noteDoc();
  const put = await call("put", "/:noteId", { user: author, params: { noteId: NOTE }, body: { title: "new", isPublic: true } });
  const del = await call("delete", "/:noteId", { user: author, params: { noteId: NOTE } });

  assert.equal(put.res.statusCode, 200);
  assert.equal(found.title, "new");
  assert.equal(found.isPublic, true);
  assert.equal(found.saved, 1);
  assert.equal(del.res.statusCode, 200);
  assert.deepEqual(calls.deleted, [NOTE]);
});

test("a non-author cannot change the visibility of a visible (public) note", async () => {
  found = noteDoc({ isPublic: true });

  const hide = await call("put", "/:noteId", { user: other, params: { noteId: NOTE }, body: { isPublic: false } });

  assert.equal(hide.res.statusCode, 403);
  assert.equal(found.isPublic, true);
  assert.equal(found.saved, 0);
});

test("a non-author may still edit the text of a public note (existing permission rules), keeping visibility", async () => {
  found = noteDoc({ isPublic: true });

  const edit = await call("put", "/:noteId", { user: other, params: { noteId: NOTE }, body: { title: "edited", isPublic: true } });

  assert.equal(edit.res.statusCode, 200);
  assert.equal(found.title, "edited");
  assert.equal(found.saved, 1);
});

test("an administrator may change visibility", async () => {
  found = noteDoc({ isPublic: false });

  const res = await call("put", "/:noteId", { user: admin, params: { noteId: NOTE }, body: { isPublic: true }, scope: null });

  assert.equal(res.res.statusCode, 200);
  assert.equal(found.isPublic, true);
});

test("update cannot forge ownership or move the note", async () => {
  found = noteDoc({ isPublic: true });

  await call("put", "/:noteId", {
    user: other,
    params: { noteId: NOTE },
    body: { title: "x", authorId: OTHER, societyId: SOC_B, channelId: "c9" },
  });

  assert.equal(found.authorId, AUTHOR);
  assert.equal(found.societyId, SOC_A);
  assert.equal(found.channelId, undefined);
});

test("update and create reject a non-boolean isPublic with 400 and write nothing", async () => {
  found = noteDoc({ isPublic: false });

  for (const bad of [null, "true", 1, {}, []]) {
    const put = await call("put", "/:noteId", { user: author, params: { noteId: NOTE }, body: { isPublic: bad } });
    const post = await call("post", "/", { user: author, body: { title: "t", isPublic: bad } });

    assert.equal(put.res.statusCode, 400, JSON.stringify(bad));
    assert.equal(post.res.statusCode, 400, JSON.stringify(bad));
  }
  assert.equal(found.saved, 0);
  assert.equal(calls.create.length, 0);
});

// ---- create ----------------------------------------------------------------------------

test("create assigns authorship from the session, never from the body, and defaults to public", async () => {
  const { res } = await call("post", "/", { user: other, body: { title: "t", authorId: AUTHOR } });

  assert.equal(res.statusCode, 201);
  assert.equal(calls.create[0].authorId, OTHER);
  assert.equal(calls.create[0].isPublic, true);
  assert.equal(calls.create[0].societyId, SOC_A);
});

test("create outside the caller's society is still refused", async () => {
  const { res } = await call("post", "/", { user: other, scope: SOC_B });

  assert.equal(res.statusCode, 403);
  assert.equal(calls.create.length, 0);
});
