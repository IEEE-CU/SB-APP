"use strict";

/**
 * NEW-06 / AUD-035 over HTTP: announcement creation and the targetAudience contract.
 *
 * The UI used to send only { title, content, priority }, so POST /announcements always
 * answered 400 "Invalid target audience". Policy under test (D-A2), enforced by the backend:
 *   - administrators may choose ALL, SOCIETY (with a societyId) or LEADERSHIP;
 *   - non-administrators may choose only SOCIETY, and only for their own society;
 *   - the creator is the authenticated caller; the stored audience is what was asked for;
 *   - a refused request stores nothing.
 *
 * Fixtures: admin, chairA (society_chair of society A), chairB (society B), memberA
 * (ieee_member: no announcement permission). Every claim is checked against the stored
 * documents. Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { TEST_PASSWORD, USERS } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const { users, societies } = target.ready.fixtures;
const A = societies.A.id;
const B = societies.B.id;

const RUN = Date.now();
const tokens = {};

async function tokenFor(key) {
  if (tokens[key]) return tokens[key];
  const res = await fetch(`${target.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: USERS[key].email, password: TEST_PASSWORD }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, `login failed for ${key}`);
  tokens[key] = body.data.token;
  return tokens[key];
}

async function post(key, body) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${await tokenFor(key)}`;
  const res = await fetch(`${target.baseUrl}/api/v1/announcements`, {
    method: "POST",
    headers,
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

const titled = (label) => `create-${RUN}-${label}`;
const withTitle = (label) => ({ title: titled(label), message: "Body text" });
const storedByTitle = (label) =>
  withDatabase(target, (db) => db.collection("announcements").find({ title: titled(label) }).toArray());

after(() =>
  withDatabase(target, (db) => db.collection("announcements").deleteMany({ title: new RegExp(`^create-${RUN}-`) })),
);

describe("administrators", () => {
  test("may create ALL, SOCIETY and LEADERSHIP announcements", async () => {
    const all = await post("admin", { ...withTitle("admin-all"), targetAudience: "ALL" });
    const society = await post("admin", { ...withTitle("admin-society"), targetAudience: "SOCIETY", societyId: B });
    const leadership = await post("admin", { ...withTitle("admin-leadership"), targetAudience: "LEADERSHIP" });

    for (const res of [all, society, leadership]) assert.equal(res.status, 201, res.text.slice(0, 300));

    const [allDoc] = await storedByTitle("admin-all");
    const [societyDoc] = await storedByTitle("admin-society");
    const [leadershipDoc] = await storedByTitle("admin-leadership");
    assert.equal(allDoc.targetAudience, "ALL");
    assert.equal(allDoc.societyId, null);
    assert.equal(societyDoc.targetAudience, "SOCIETY");
    assert.equal(String(societyDoc.societyId), B);
    assert.equal(leadershipDoc.targetAudience, "LEADERSHIP");
    assert.equal(leadershipDoc.societyId, null);
    for (const doc of [allDoc, societyDoc, leadershipDoc]) assert.equal(String(doc.createdBy), users.admin.id);
  });

  test("a societyId sent with ALL or LEADERSHIP is not stored", async () => {
    const res = await post("admin", { ...withTitle("admin-all-with-society"), targetAudience: "ALL", societyId: A });
    assert.equal(res.status, 201, res.text.slice(0, 300));
    assert.equal((await storedByTitle("admin-all-with-society"))[0].societyId, null);
  });
});

describe("the legacy payload the UI used to send", () => {
  test("{ title, content, priority } without targetAudience is still refused (400) and stores nothing", async () => {
    const res = await post("admin", { title: titled("no-audience"), content: "Body", priority: "medium" });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid target audience");
    assert.equal((await storedByTitle("no-audience")).length, 0);
  });

  test("an unknown audience and a SOCIETY announcement with no society are 400", async () => {
    const unknown = await post("admin", { ...withTitle("unknown"), targetAudience: "EVERYONE" });
    const noSociety = await post("admin", { ...withTitle("no-society"), targetAudience: "SOCIETY" });
    assert.equal(unknown.status, 400);
    assert.equal(noSociety.status, 400);
    assert.equal((await storedByTitle("unknown")).length + (await storedByTitle("no-society")).length, 0);
  });
});

describe("a non-administrator (society chair)", () => {
  test("may create a SOCIETY announcement for their own society, owned by them", async () => {
    // The UI payload: content, priority and the audience fields.
    const res = await post("chairA", {
      title: titled("chair-own"),
      content: "Body from the form",
      priority: "high",
      targetAudience: "SOCIETY",
      societyId: A,
    });

    assert.equal(res.status, 201, res.text.slice(0, 300));
    const [doc] = await storedByTitle("chair-own");
    assert.equal(doc.targetAudience, "SOCIETY");
    assert.equal(String(doc.societyId), A);
    assert.equal(String(doc.createdBy), users.chairA.id);
    assert.equal(doc.message, "Body from the form");
  });

  test("cannot create ALL (403)", async () => {
    const res = await post("chairA", { ...withTitle("chair-all"), targetAudience: "ALL" });
    assert.equal(res.status, 403);
    assert.equal((await storedByTitle("chair-all")).length, 0);
  });

  test("cannot create LEADERSHIP (403)", async () => {
    const res = await post("chairA", { ...withTitle("chair-leadership"), targetAudience: "LEADERSHIP" });
    assert.equal(res.status, 403, res.text.slice(0, 300));
    assert.equal((await storedByTitle("chair-leadership")).length, 0);
  });

  test("cannot target another society (403), and a chair of B cannot target A", async () => {
    const foreign = await post("chairA", { ...withTitle("chair-foreign"), targetAudience: "SOCIETY", societyId: B });
    const reverse = await post("chairB", { ...withTitle("chair-reverse"), targetAudience: "SOCIETY", societyId: A });
    assert.equal(foreign.status, 403);
    assert.equal(reverse.status, 403);
    assert.equal((await storedByTitle("chair-foreign")).length + (await storedByTitle("chair-reverse")).length, 0);
  });

  test("a malformed societyId (object, array) is refused and stores nothing", async () => {
    for (const [label, societyId] of [
      ["object", { $ne: null }],
      ["array", [A]],
    ]) {
      const res = await post("chairA", { ...withTitle(`chair-bad-${label}`), targetAudience: "SOCIETY", societyId });
      assert.ok(res.status === 403 || res.status === 400, `${label}: ${res.status} ${res.text.slice(0, 200)}`);
      assert.equal((await storedByTitle(`chair-bad-${label}`)).length, 0, label);
    }
  });

  test("cannot set the sender name or the owner", async () => {
    const res = await post("chairA", {
      ...withTitle("chair-owner"),
      targetAudience: "SOCIETY",
      societyId: A,
      senderName: "Dean of Engineering",
      createdBy: users.admin.id,
    });
    assert.equal(res.status, 201, res.text.slice(0, 300));
    const [doc] = await storedByTitle("chair-owner");
    assert.equal(String(doc.createdBy), users.chairA.id);
    assert.equal(doc.senderName, "Integration Chair A");
  });
});

async function patch(key, id, body) {
  const res = await fetch(`${target.baseUrl}/api/v1/announcements/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await tokenFor(key)}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}
const storedById = (id) =>
  withDatabase(target, (db, ObjectId) => db.collection("announcements").findOne({ _id: new ObjectId(String(id)) }));
const auditable = (doc) =>
  JSON.stringify({ title: doc.title, message: doc.message, targetAudience: doc.targetAudience, societyId: doc.societyId });

describe("PATCH audience (D-A2)", () => {
  async function ownSocietyPost(label) {
    const res = await post("chairA", { ...withTitle(label), targetAudience: "SOCIETY", societyId: A });
    assert.equal(res.status, 201, res.text.slice(0, 300));
    return res.body.data.id || res.body.data._id;
  }

  test("a non-administrator cannot retarget to LEADERSHIP (403) and the stored post is unchanged", async () => {
    const id = await ownSocietyPost("patch-to-leadership");
    const before = auditable(await storedById(id));
    const res = await patch("chairA", id, { targetAudience: "LEADERSHIP" });
    assert.equal(res.status, 403, res.text.slice(0, 300));
    assert.equal(auditable(await storedById(id)), before);
  });

  test("a non-administrator cannot retarget to ALL (403) and the stored post is unchanged", async () => {
    const id = await ownSocietyPost("patch-to-all");
    const before = auditable(await storedById(id));
    const res = await patch("chairA", id, { targetAudience: "ALL" });
    assert.equal(res.status, 403, res.text.slice(0, 300));
    assert.equal(auditable(await storedById(id)), before);
  });

  test("a non-administrator cannot retarget to another society (403) and the stored post is unchanged", async () => {
    const id = await ownSocietyPost("patch-to-foreign");
    const before = auditable(await storedById(id));
    const res = await patch("chairA", id, { targetAudience: "SOCIETY", societyId: B });
    assert.equal(res.status, 403, res.text.slice(0, 300));
    assert.equal(auditable(await storedById(id)), before);
  });

  test("a non-administrator may still edit text and keep their own society", async () => {
    const id = await ownSocietyPost("patch-own");
    const res = await patch("chairA", id, { title: titled("patch-own-edited"), targetAudience: "SOCIETY", societyId: A });
    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.equal((await storedById(id)).title, titled("patch-own-edited"));
  });

  test("legacy: the creator of an old LEADERSHIP post can edit its title while the audience stays LEADERSHIP, but cannot change the audience", async () => {
    const id = await withDatabase(target, async (db, ObjectId) => {
      const now = new Date();
      const inserted = await db.collection("announcements").insertOne({
        title: titled("patch-legacy"),
        message: "Created before D-A2",
        senderName: "Integration Chair A",
        targetAudience: "LEADERSHIP",
        societyId: null,
        createdBy: new ObjectId(users.chairA.id),
        date: now,
        createdAt: now,
        updatedAt: now,
      });
      return String(inserted.insertedId);
    });

    const edit = await patch("chairA", id, { title: titled("patch-legacy-edited") });
    assert.equal(edit.status, 200, edit.text.slice(0, 300));
    let doc = await storedById(id);
    assert.equal(doc.title, titled("patch-legacy-edited"));
    assert.equal(doc.targetAudience, "LEADERSHIP");

    // Re-sending the unchanged audience is not a change either.
    const same = await patch("chairA", id, { message: "Edited text", targetAudience: "LEADERSHIP" });
    assert.equal(same.status, 200, same.text.slice(0, 300));

    const before = auditable(await storedById(id));
    const toAll = await patch("chairA", id, { targetAudience: "ALL" });
    const toForeign = await patch("chairA", id, { targetAudience: "SOCIETY", societyId: B });
    assert.equal(toAll.status, 403);
    assert.equal(toForeign.status, 403);
    assert.equal(auditable(await storedById(id)), before);
  });

  test("an administrator may set ALL, SOCIETY and LEADERSHIP", async () => {
    const id = await ownSocietyPost("patch-admin");
    for (const body of [
      { targetAudience: "ALL" },
      { targetAudience: "SOCIETY", societyId: B },
      { targetAudience: "LEADERSHIP" },
    ]) {
      const res = await patch("admin", id, body);
      assert.equal(res.status, 200, `${JSON.stringify(body)}: ${res.text.slice(0, 300)}`);
      const doc = await storedById(id);
      assert.equal(doc.targetAudience, body.targetAudience);
      if (body.societyId) assert.equal(String(doc.societyId), body.societyId);
    }
  });
});

describe("authorization that is unchanged", () => {
  test("a member without announcements:create gets 403 for every audience, and no token gets 401", async () => {
    const own = await post("memberA", { ...withTitle("member"), targetAudience: "SOCIETY", societyId: A });
    const anonymous = await post(null, { ...withTitle("anonymous"), targetAudience: "SOCIETY", societyId: A });
    assert.equal(own.status, 403);
    assert.equal(anonymous.status, 401);
    assert.equal((await storedByTitle("member")).length + (await storedByTitle("anonymous")).length, 0);
  });

  test("visibility follows the audience: the chair of A sees their own SOCIETY post, the chair of B does not; LEADERSHIP is seen by both", async () => {
    const society = await post("admin", { ...withTitle("vis-society"), targetAudience: "SOCIETY", societyId: A });
    const leadership = await post("admin", { ...withTitle("vis-leadership"), targetAudience: "LEADERSHIP" });
    assert.equal(society.status, 201);
    assert.equal(leadership.status, 201);

    const list = async (key) => {
      const res = await fetch(`${target.baseUrl}/api/v1/announcements?limit=200`, {
        headers: { Authorization: `Bearer ${await tokenFor(key)}` },
      });
      return (await res.json()).data.map((a) => a.title);
    };
    const a = await list("chairA");
    const b = await list("chairB");
    assert.ok(a.includes(titled("vis-society")) && a.includes(titled("vis-leadership")));
    assert.ok(!b.includes(titled("vis-society")) && b.includes(titled("vis-leadership")));
  });
});
