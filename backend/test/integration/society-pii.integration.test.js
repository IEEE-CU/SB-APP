"use strict";

/**
 * AUD-025 over real HTTP: member rosters and office-bearer phone numbers are
 * visible only to the target society's own users (User.societyId) and
 * administrators. Office-bearer names, positions and e-mails stay visible to
 * every authenticated user.
 *
 * Absence is asserted on the raw response text, not just on parsed fields.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const { request } = createSession(target);
const { A, B } = target.ready.fixtures.societies;

// Values created by helpers/fixtures.js for each society label.
const piiOf = (label) => ({
  memberTokens: [
    `IT-${label}-0001`,
    `IT-${label}-0002`,
    `member1@${label.toLowerCase()}.integration.test`,
    `member2@${label.toLowerCase()}.integration.test`,
    `+1-555-0300-${label}`,
    `+1-555-0400-${label}`,
  ],
  phoneTokens: [`+1-555-0100-${label}`, `+1-555-0200-${label}`],
  bearers: [
    {
      name: `${label} Chair`,
      position: "Chair",
      email: `chair@${label.toLowerCase()}.integration.test`,
    },
    {
      name: `${label} Secretary`,
      position: "Secretary",
      email: `secretary@${label.toLowerCase()}.integration.test`,
    },
  ],
});
const PII = { ITA: piiOf("ITA"), ITB: piiOf("ITB") };
const DENIED_MESSAGE = "Access restricted to your own society";

const textHasNone = (text, tokens, what) => {
  for (const token of tokens) {
    assert.equal(text.includes(token), false, `${what} leaked "${token}"`);
  }
};
const textHasAll = (text, tokens, what) => {
  for (const token of tokens) {
    assert.equal(text.includes(token), true, `${what} is missing "${token}"`);
  }
};
const bearerSummary = (list) =>
  list.map((b) => ({ name: b.name, position: b.position, email: b.email }));

describe("AUD-025: office bearer of A inspecting society B", () => {
  test("the list omits B's roster and phones but keeps its public bearer data", async () => {
    const res = await request("chairA", "GET", "/societies");
    assert.equal(res.status, 200);
    const entryB = res.body.data.find((s) => s.id === B.id || s._id === B.id);
    assert.ok(entryB, "society B missing from the list");

    assert.equal("members" in entryB, false, "members key present for B");
    assert.deepEqual(bearerSummary(entryB.officeBearers), PII.ITB.bearers);
    assert.equal(
      entryB.officeBearers.every((b) => !("phone" in b)),
      true,
      "a phone field is present",
    );
    textHasNone(JSON.stringify(entryB), [...PII.ITB.memberTokens, ...PII.ITB.phoneTokens], "B's list entry");
  });

  test("the detail omits B's roster and phones", async () => {
    const res = await request("chairA", "GET", `/societies/${B.id}`);

    assert.equal(res.status, 200);
    assert.equal("members" in res.body.data, false);
    assert.deepEqual(bearerSummary(res.body.data.officeBearers), PII.ITB.bearers);
    textHasNone(res.text, [...PII.ITB.memberTokens, ...PII.ITB.phoneTokens], "B's detail");
    // Non-sensitive fields are still there.
    assert.equal(res.body.data.name, "Integration Society B");
    assert.equal(res.body.data.shortName, "ITB");
    assert.equal(typeof res.body.data.budget, "number");
    assert.equal(typeof res.body.data.balance, "number");
  });

  test("GET /:id/members is denied with 403 and returns no PII", async () => {
    const res = await request("chairA", "GET", `/societies/${B.id}/members`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, DENIED_MESSAGE);
    textHasNone(res.text, PII.ITB.memberTokens, "B's members response");
  });

  test("GET /:id/office-bearers keeps names, positions and e-mails but omits phones", async () => {
    const res = await request("chairA", "GET", `/societies/${B.id}/office-bearers`);

    assert.equal(res.status, 200);
    assert.deepEqual(bearerSummary(res.body.data), PII.ITB.bearers);
    textHasNone(res.text, PII.ITB.phoneTokens, "B's office-bearers response");
  });

  test("the combined list response never contains any of B's restricted values", async () => {
    const res = await request("chairA", "GET", "/societies");

    textHasNone(res.text, [...PII.ITB.memberTokens, ...PII.ITB.phoneTokens], "the societies list");
  });
});

describe("AUD-025: a caller inspecting their own society", () => {
  test("the list entry keeps the roster and phones", async () => {
    const res = await request("chairA", "GET", "/societies");
    const entryA = res.body.data.find((s) => s.id === A.id || s._id === A.id);

    assert.equal(entryA.members.length, 2);
    assert.deepEqual(
      entryA.members.map((m) => m.ieeeId).sort(),
      ["IT-ITA-0001", "IT-ITA-0002"],
    );
    assert.equal(entryA.members[0].email.endsWith("@ita.integration.test"), true);
    assert.ok(entryA.members[0].contactNumber.startsWith("+1-555-03"));
    assert.deepEqual(
      entryA.officeBearers.map((b) => b.phone).sort(),
      PII.ITA.phoneTokens,
    );
  });

  test("detail, members and office-bearers endpoints return full data", async () => {
    const detail = await request("chairA", "GET", `/societies/${A.id}`);
    const members = await request("chairA", "GET", `/societies/${A.id}/members`);
    const bearers = await request("chairA", "GET", `/societies/${A.id}/office-bearers`);

    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.members.length, 2);
    textHasAll(detail.text, [...PII.ITA.memberTokens, ...PII.ITA.phoneTokens], "A's detail");

    assert.equal(members.status, 200);
    assert.equal(members.body.data.length, 2);
    assert.deepEqual(
      Object.keys(members.body.data[0]).filter((k) => !k.startsWith("_") && k !== "id").sort(),
      ["contactNumber", "email", "grade", "ieeeId", "name"],
    );

    assert.equal(bearers.status, 200);
    textHasAll(bearers.text, PII.ITA.phoneTokens, "A's office-bearers response");
  });

  test("the symmetric case holds: office bearer of B sees B's roster and not A's", async () => {
    const own = await request("chairB", "GET", `/societies/${B.id}/members`);
    const other = await request("chairB", "GET", `/societies/${A.id}/members`);

    assert.equal(own.status, 200);
    assert.equal(own.body.data.length, 2);
    assert.equal(other.status, 403);
    textHasNone(other.text, PII.ITA.memberTokens, "A's members response for B's chair");
  });

  test("a non-officer user with a society (member A) sees A's roster but not B's", async () => {
    const own = await request("memberA", "GET", `/societies/${A.id}/members`);
    const other = await request("memberA", "GET", `/societies/${B.id}/members`);

    assert.equal(own.status, 200);
    assert.equal(other.status, 403);
  });
});

describe("AUD-025: administrator", () => {
  test("keeps cross-society access to rosters and phones", async () => {
    const members = await request("admin", "GET", `/societies/${B.id}/members`);
    const bearers = await request("admin", "GET", `/societies/${B.id}/office-bearers`);
    const detail = await request("admin", "GET", `/societies/${B.id}`);
    const list = await request("admin", "GET", "/societies");

    assert.equal(members.status, 200);
    assert.equal(members.body.data.length, 2);
    textHasAll(bearers.text, PII.ITB.phoneTokens, "admin office-bearers");
    assert.equal(detail.body.data.members.length, 2);
    for (const entry of list.body.data) {
      assert.equal(Array.isArray(entry.members), true, `members missing for ${entry.shortName}`);
      assert.equal(entry.officeBearers.every((b) => "phone" in b), true);
    }
  });
});

describe("AUD-025: fail closed without a valid society scope", () => {
  test("a user with no society cannot read any roster or phone", async () => {
    const members = await request("loner", "GET", `/societies/${A.id}/members`);
    const detail = await request("loner", "GET", `/societies/${A.id}`);
    const list = await request("loner", "GET", "/societies");
    const bearers = await request("loner", "GET", `/societies/${A.id}/office-bearers`);

    assert.equal(members.status, 403);
    assert.equal("members" in detail.body.data, false);
    assert.equal(bearers.status, 200);
    for (const response of [detail, list, bearers]) {
      textHasNone(
        response.text,
        [
          ...PII.ITA.memberTokens,
          ...PII.ITA.phoneTokens,
          ...PII.ITB.memberTokens,
          ...PII.ITB.phoneTokens,
        ],
        "a society-less caller's response",
      );
    }
    assert.deepEqual(bearerSummary(bearers.body.data), PII.ITA.bearers);
  });

  test("an unauthenticated caller is rejected with 401 on every endpoint", async () => {
    for (const route of [
      "/societies",
      `/societies/${A.id}`,
      `/societies/${A.id}/members`,
      `/societies/${A.id}/office-bearers`,
    ]) {
      const res = await request(null, "GET", route);
      assert.equal(res.status, 401, `${route} returned ${res.status}`);
    }
  });
});
