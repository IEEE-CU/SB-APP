// AUD-022 follow-up: GET /announcements/:id returned any announcement to any
// authenticated user, while GET /announcements filtered by audience and society.
//
// The list and the detail now use ONE visibility rule (visibilityFilter), so they
// cannot disagree: administrators see everything; office bearers see ALL,
// LEADERSHIP and SOCIETY announcements of their own society; an announcement the
// caller may not see is a 404, exactly like one that does not exist. Visibility is
// about the audience, not about who created the announcement, and the mutation
// ownership checks of AUD-022 are untouched.
//
// The real router runs with the Announcement model's database calls replaced, so no
// database or server is involved. How the filter classifies stored records
// (including incomplete legacy ones) is verified against a real database in
// announcement-visibility.integration.test.js.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const ANN = "64b7f8f2a1b2c3d4e5f6d001";

const Announcement = require("../../src/models/Announcement");
const original = {
  find: Announcement.find,
  findOne: Announcement.findOne,
  findById: Announcement.findById,
};

let calls;
let found;
let findOneError;

function freshLoad(relPath) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  return require(file);
}

beforeEach(() => {
  calls = { find: [], findOne: [], findById: [] };
  found = null;
  findOneError = null;

  const authFile = require.resolve(path.join(__dirname, "../../src/middleware/auth.js"));
  delete require.cache[authFile];
  const auth = require(authFile);
  require.cache[authFile] = {
    id: authFile,
    filename: authFile,
    loaded: true,
    exports: { ...auth, authenticate: (req, res, next) => next() },
  };

  Announcement.find = (filter) => {
    calls.find.push(filter);
    const chain = { populate: () => chain, sort: () => chain, limit: async () => [] };
    return chain;
  };
  Announcement.findOne = (filter) => {
    calls.findOne.push(filter);
    if (findOneError) throw findOneError;
    const chain = { populate: () => chain, then: (a, b) => Promise.resolve(found).then(a, b) };
    return chain;
  };
  Announcement.findById = (id) => {
    calls.findById.push(String(id));
    const chain = { populate: () => chain, then: (a, b) => Promise.resolve(null).then(a, b) };
    return chain;
  };
});

test.after(() => {
  Announcement.find = original.find;
  Announcement.findOne = original.findOne;
  Announcement.findById = original.findById;
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

async function get(routePath, { user, params = {}, query = {} }) {
  const router = freshLoad("../../src/routes/announcements.js");
  const layer = router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods.get);
  assert.ok(layer, `no GET ${routePath}`);
  const req = { user, params, query, body: {}, method: "GET", originalUrl: "/api/v1/announcements", ip: "127.0.0.1", headers: {}, socket: {} };
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
const list = (user) => get("/", { user });
const detail = (user, id = ANN) => get("/:id", { user, params: { id } });

// officeBearer() belongs to society A; officeBearer(x) uses x as given, including null/undefined.
const officeBearer = (...args) => ({ _id: "u1", role: "OFFICE_BEARER", societyId: args.length ? args[0] : SOCIETY_A });
const admin = () => ({ _id: "u2", role: "ADMIN", societyId: null });

// ---- one rule for both endpoints --------------------------------------------------

test("the detail applies exactly the filter the list applies, for every kind of caller", async () => {
  for (const user of [admin(), officeBearer(), officeBearer({ _id: SOCIETY_A, name: "A" }), officeBearer(null), { _id: "u3", role: "STRANGER" }]) {
    calls = { find: [], findOne: [], findById: [] };

    await list(user);
    await detail(user);

    assert.equal(calls.find.length, 1);
    assert.equal(calls.findOne.length, 1);
    const [byId, visibility] = calls.findOne[0].$and;
    assert.deepEqual(visibility, calls.find[0], `the detail and the list disagree for ${JSON.stringify(user.role)}`);
    assert.deepEqual(byId, { _id: ANN });
  }
});

test("administrators are unrestricted", async () => {
  await list(admin());

  assert.deepEqual(calls.find[0], {});
});

test("an office bearer's filter covers ALL, LEADERSHIP and their own society, and nothing else", async () => {
  await list(officeBearer());

  assert.deepEqual(calls.find[0], {
    $or: [
      { targetAudience: "ALL" },
      { targetAudience: "LEADERSHIP" },
      { targetAudience: "SOCIETY", societyId: SOCIETY_A },
    ],
  });
});

test("a user without a society gets ALL and LEADERSHIP only: no SOCIETY clause, and no societyId in the filter", async () => {
  for (const societyId of [null, undefined, ""]) {
    calls = { find: [], findOne: [], findById: [] };

    await list(officeBearer(societyId));

    assert.deepEqual(calls.find[0], {
      $or: [{ targetAudience: "ALL" }, { targetAudience: "LEADERSHIP" }],
    });
    assert.ok(!JSON.stringify(calls.find[0]).includes("societyId"), JSON.stringify(societyId));
    assert.ok(!JSON.stringify(calls.find[0]).includes("SOCIETY"), JSON.stringify(societyId));
  }
});

test("a user with a society still has the SOCIETY clause for exactly their society", async () => {
  await list(officeBearer());

  assert.deepEqual(calls.find[0].$or[2], { targetAudience: "SOCIETY", societyId: SOCIETY_A });
  assert.equal(calls.find[0].$or.length, 3);
});

test("the detail uses the same society-less filter, and a hidden announcement is the usual 404", async () => {
  const { res } = await detail(officeBearer(null));

  assert.deepEqual(calls.findOne[0].$and[1], {
    $or: [{ targetAudience: "ALL" }, { targetAudience: "LEADERSHIP" }],
  });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { success: false, message: "Announcement not found" });
});

test("a populated society reference on the caller is understood", async () => {
  await list(officeBearer({ _id: SOCIETY_A, name: "A" }));

  assert.equal(calls.find[0].$or[2].societyId, SOCIETY_A);
});

test("an unrecognized role matches nothing, in the list and in the detail", async () => {
  const stranger = { _id: "u3", role: "STRANGER", societyId: SOCIETY_A };

  await list(stranger);
  const { res } = await detail(stranger);

  assert.deepEqual(calls.find[0], { _id: { $in: [] } });
  assert.equal(res.statusCode, 404);
});

// ---- the detail response ------------------------------------------------------------

test("a visible announcement is returned with the unchanged response shape", async () => {
  found = { id: ANN, title: "t" };

  const { res } = await detail(officeBearer());

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, data: found });
});

test("an announcement the caller may not see is the same 404 as one that does not exist", async () => {
  const hidden = await detail(officeBearer()); // the filter excluded it, so the query found nothing
  found = null;
  const missing = await detail(officeBearer(), "64b7f8f2a1b2c3d4e5f6d0ff");

  assert.equal(hidden.res.statusCode, 404);
  assert.deepEqual(hidden.res.body, { success: false, message: "Announcement not found" });
  assert.deepEqual(missing.res.body, hidden.res.body);
});

test("a malformed id keeps flowing to the error handler (a 400 there), not to the client as data", async () => {
  findOneError = Object.assign(new Error("Cast to ObjectId failed"), { name: "CastError" });

  const { res, error } = await detail(officeBearer(), "not-an-object-id");

  assert.equal(res.sent, false);
  assert.equal(error.name, "CastError");
});

test("the mutation routes still look the announcement up by id and check ownership (AUD-022 untouched)", async () => {
  const router = freshLoad("../../src/routes/announcements.js");
  const source = require("node:fs").readFileSync(path.join(__dirname, "../../src/routes/announcements.js"), "utf8");

  assert.ok(router.stack.some((l) => l.route && l.route.methods.patch));
  assert.ok(router.stack.some((l) => l.route && l.route.methods.delete));
  assert.match(source, /isOwner\(req\.user, announcement\)/);
  assert.doesNotMatch(source, /senderName\s*!==\s*req\.user\.name/);
});
