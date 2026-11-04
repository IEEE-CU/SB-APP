// AUD-025: society read endpoints returned every society's member roster
// (IEEE id, name, email, contact number, grade) and every office bearer's phone
// number to any authenticated user.
//
// Approved policy:
//  - member rosters/PII: the target society's own users (User.societyId) and ADMIN only
//  - office bearers' name, position and email: all authenticated users
//  - office bearers' phone: the target society's own users and ADMIN only
//
// The real GET handlers are driven with the Society/Transaction models stubbed:
// no server, database or network.
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const Society = require("../../src/models/Society");
const Transaction = require("../../src/models/Transaction");
const router = require("../../src/routes/societies");

const OWN = "64b7f8f2a1b2c3d4e5f60001";
const OTHER = "64b7f8f2a1b2c3d4e5f60002";

const makeSociety = (id, label) => ({
  _id: id,
  name: `${label} Society`,
  shortName: label,
  description: `About ${label}`,
  type: "SOCIETY",
  budget: 100,
  logoUrl: null,
  officeBearers: [
    {
      _id: `${id}-ob1`,
      name: `${label} Chair`,
      position: "Chair",
      email: `chair@${label}.example`,
      phone: `PHONE-${label}-1`,
      termYear: 2026,
    },
    {
      _id: `${id}-ob2`,
      name: `${label} Secretary`,
      position: "Secretary",
      email: `sec@${label}.example`,
      phone: `PHONE-${label}-2`,
      termYear: 2026,
    },
  ],
  members: [
    {
      _id: `${id}-m1`,
      ieeeId: `IEEEID-${label}-1`,
      name: `${label} Member One`,
      email: `m1@${label}.example`,
      contactNumber: `CONTACT-${label}-1`,
      grade: "Student",
    },
  ],
});

let docs;
let realFind;
let realFindById;
let realCount;
let realAggregate;

const chain = (value) => {
  const c = {
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    lean: () => c,
    sort: () => c,
    skip: () => c,
    limit: () => c,
    select: () => c,
  };
  return c;
};

beforeEach(() => {
  docs = { [OWN]: makeSociety(OWN, "OWN"), [OTHER]: makeSociety(OTHER, "OTHER") };
  realFind = Society.find;
  realFindById = Society.findById;
  realCount = Society.countDocuments;
  realAggregate = Transaction.aggregate;

  // Fresh copies per query, as a real query would produce.
  Society.find = () => chain(Object.values(docs).map((d) => structuredClone(d)));
  Society.findById = (id) =>
    chain(docs[id] ? structuredClone(docs[id]) : null);
  Society.countDocuments = async () => Object.keys(docs).length;
  Transaction.aggregate = async () => [];
});

afterEach(() => {
  Society.find = realFind;
  Society.findById = realFindById;
  Society.countDocuments = realCount;
  Transaction.aggregate = realAggregate;
});

function handler(routePath) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods.get,
  );
  assert.ok(layer, `GET ${routePath} not found`);
  return layer.route.stack.at(-1).handle;
}

async function get(routePath, { user, params = {}, query = {} }) {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextError = null;
  await handler(routePath)({ user, params, query, body: {} }, res, (e) => {
    nextError = e || null;
  });
  assert.equal(nextError, null);
  return res;
}

const obOf = (societyId) => ({ role: "OFFICE_BEARER", societyId });
const ADMIN = { role: "ADMIN", societyId: null };

const hasMemberPii = (value) => {
  const text = JSON.stringify(value);
  return ["IEEEID-", "CONTACT-", "m1@"].some((needle) => text.includes(needle));
};
const hasPhones = (value) => JSON.stringify(value).includes("PHONE-");

// ---- cross-society callers ---------------------------------------------------

test("AUD-025: list omits members and phones for other societies, keeps public bearer fields", async () => {
  const res = await get("/", { user: obOf(OWN) });
  const other = res.body.data.find((s) => s._id === OTHER);

  assert.equal("members" in other, false, "members present for another society");
  assert.equal(hasMemberPii(other), false);
  assert.equal(hasPhones(other), false);
  assert.deepEqual(
    other.officeBearers.map((o) => [o.name, o.position, o.email]),
    [
      ["OTHER Chair", "Chair", "chair@OTHER.example"],
      ["OTHER Secretary", "Secretary", "sec@OTHER.example"],
    ],
  );
  assert.equal(other.officeBearers.every((o) => !("phone" in o)), true);
});

test("AUD-025: detail omits members and phones for a cross-society caller", async () => {
  const res = await get("/:id", { user: obOf(OWN), params: { id: OTHER } });

  assert.equal(res.statusCode, 200);
  assert.equal("members" in res.body.data, false);
  assert.equal(hasMemberPii(res.body), false);
  assert.equal(hasPhones(res.body), false);
  assert.equal(res.body.data.officeBearers.length, 2);
  assert.equal(res.body.data.officeBearers[0].email, "chair@OTHER.example");
});

test("AUD-025: the members endpoint is denied (403) for a cross-society caller and returns no PII", async () => {
  const res = await get("/:id/members", {
    user: obOf(OWN),
    params: { id: OTHER },
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, "Access restricted to your own society");
  assert.equal(hasMemberPii(res.body), false);
});

test("AUD-025: the office-bearers endpoint hides phones from a cross-society caller", async () => {
  const res = await get("/:id/office-bearers", {
    user: obOf(OWN),
    params: { id: OTHER },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(hasPhones(res.body), false);
  assert.deepEqual(
    res.body.data.map((o) => [o.name, o.position, o.email]),
    [
      ["OTHER Chair", "Chair", "chair@OTHER.example"],
      ["OTHER Secretary", "Secretary", "sec@OTHER.example"],
    ],
  );
});

// ---- own society and administrators --------------------------------------------

test("own-society caller keeps roster and phones in list (own entry) while others stay redacted", async () => {
  const res = await get("/", { user: obOf(OWN) });
  const own = res.body.data.find((s) => s._id === OWN);

  assert.equal(own.members.length, 1);
  assert.equal(own.members[0].email, "m1@OWN.example");
  assert.equal(own.members[0].contactNumber, "CONTACT-OWN-1");
  assert.equal(own.members[0].ieeeId, "IEEEID-OWN-1");
  assert.equal(own.officeBearers[0].phone, "PHONE-OWN-1");
});

test("own-society caller keeps full detail, members and office-bearer phones", async () => {
  const detail = await get("/:id", { user: obOf(OWN), params: { id: OWN } });
  const members = await get("/:id/members", { user: obOf(OWN), params: { id: OWN } });
  const bearers = await get("/:id/office-bearers", {
    user: obOf(OWN),
    params: { id: OWN },
  });

  assert.equal(detail.body.data.members.length, 1);
  assert.equal(detail.body.data.officeBearers[0].phone, "PHONE-OWN-1");
  assert.equal(members.statusCode, 200);
  assert.equal(members.body.data[0].email, "m1@OWN.example");
  assert.equal(bearers.body.data[0].phone, "PHONE-OWN-1");
});

test("ADMIN keeps everything everywhere", async () => {
  const list = await get("/", { user: ADMIN });
  const detail = await get("/:id", { user: ADMIN, params: { id: OTHER } });
  const members = await get("/:id/members", { user: ADMIN, params: { id: OTHER } });
  const bearers = await get("/:id/office-bearers", {
    user: ADMIN,
    params: { id: OTHER },
  });

  for (const s of list.body.data) {
    assert.equal(s.members.length, 1);
    assert.equal(s.officeBearers[0].phone.startsWith("PHONE-"), true);
  }
  assert.equal(detail.body.data.members.length, 1);
  assert.equal(members.statusCode, 200);
  assert.equal(members.body.data[0].ieeeId, "IEEEID-OTHER-1");
  assert.equal(bearers.body.data[0].phone, "PHONE-OTHER-1");
});

test("a populated societyId on the user is compared by its _id", async () => {
  const user = { role: "OFFICE_BEARER", societyId: { _id: OWN, name: "Own" } };

  const own = await get("/:id/members", { user, params: { id: OWN } });
  const other = await get("/:id/members", { user, params: { id: OTHER } });

  assert.equal(own.statusCode, 200);
  assert.equal(other.statusCode, 403);
});

// ---- fail closed -------------------------------------------------------------

test("a caller with no society scope is treated as outside every society", async () => {
  for (const societyId of [null, undefined, "", {}]) {
    const user = { role: "OFFICE_BEARER", societyId };

    const members = await get("/:id/members", { user, params: { id: OWN } });
    const detail = await get("/:id", { user, params: { id: OWN } });
    const list = await get("/", { user });

    assert.equal(members.statusCode, 403, JSON.stringify(societyId));
    assert.equal("members" in detail.body.data, false);
    assert.equal(hasPhones(detail.body), false);
    assert.equal(hasMemberPii(list.body), false);
    assert.equal(hasPhones(list.body), false);
  }
});

test("an unrecognized role gets no special access outside its society", async () => {
  const user = { role: "SOMETHING_ELSE", societyId: OWN };

  const members = await get("/:id/members", { user, params: { id: OTHER } });
  const detail = await get("/:id", { user, params: { id: OTHER } });

  assert.equal(members.statusCode, 403);
  assert.equal("members" in detail.body.data, false);
});

test("a society record with no identifier is redacted for non-admins", async () => {
  docs = { x: { ...makeSociety(undefined, "NOID"), _id: undefined } };

  const res = await get("/", { user: obOf(OWN) });

  assert.equal(hasMemberPii(res.body), false);
  assert.equal(hasPhones(res.body), false);
});

// ---- unchanged behavior -------------------------------------------------------------

test("non-sensitive fields, balance, ids and pagination metadata are unchanged", async () => {
  const res = await get("/", { user: obOf(OWN) });
  const other = res.body.data.find((s) => s._id === OTHER);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.count, 2);
  assert.deepEqual(res.body.meta, {
    page: 1,
    limit: 100,
    totalItems: 2,
    totalPages: 1,
  });
  assert.equal(other.id, OTHER);
  assert.equal(other.name, "OTHER Society");
  assert.equal(other.shortName, "OTHER");
  assert.equal(other.description, "About OTHER");
  assert.equal(other.type, "SOCIETY");
  assert.equal(other.budget, 100);
  assert.equal(other.balance, 100);
  assert.equal(other.officeBearers[0].termYear, 2026);
  assert.equal(other.officeBearers[0]._id, `${OTHER}-ob1`);
});

test("an unknown society still returns 404 with the existing message", async () => {
  const res = await get("/:id", { user: obOf(OWN), params: { id: "nope" } });
  const members = await get("/:id/members", {
    user: obOf(OWN),
    params: { id: "nope" },
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Society not found");
  assert.equal(members.statusCode, 404);
});

test("redaction does not mutate the stored/queried documents", async () => {
  await get("/", { user: obOf(OWN) });
  await get("/:id", { user: obOf(OWN), params: { id: OTHER } });

  assert.equal(docs[OTHER].members.length, 1);
  assert.equal(docs[OTHER].officeBearers[0].phone, "PHONE-OTHER-1");
});

test("mongoose-style office bearer sub-documents are redacted too", async () => {
  const original = docs[OTHER].officeBearers;
  docs[OTHER] = {
    ...docs[OTHER],
    officeBearers: original.map((o) => ({
      toObject: () => ({ ...o }),
      ...o,
    })),
  };
  Society.findById = (id) => chain(docs[id]);

  const res = await get("/:id/office-bearers", {
    user: obOf(OWN),
    params: { id: OTHER },
  });

  assert.equal(hasPhones(res.body), false);
  assert.equal(res.body.data[0].email, "chair@OTHER.example");
});
