"use strict";

/**
 * AUD-030 over HTTP: GET /opportunities never serves a stored link that is not a plain
 * http(s) URL without credentials.
 *
 * Rows scraped before links were validated are inserted directly into the isolated
 * database (javascript:, data:, file:, ftp:, credentials, junk). The API returns only the
 * safe ones, the count matches, the response shape and fallbackUrl are unchanged, and the
 * raw documents are NOT rewritten or deleted.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);

const RUN = Date.now();
const SOCIETY = "WIE";
const SAFE = [`https://example.org/aud030-${RUN}-a`, `http://example.org/aud030-${RUN}-b`];
const UNSAFE = [
  "javascript:alert(document.domain)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "file:///C:/Windows/win.ini",
  "vbscript:msgbox(1)",
  "ftp://example.org/award.zip",
  `https://admin:secret@example.org/aud030-${RUN}`,
  "not a url",
  "",
];
const titleOf = (link) => `aud030-${RUN}-${link}`;

before(async () => {
  await withDatabase(target, async (db) => {
    const now = new Date();
    const rows = [...SAFE, ...UNSAFE].map((link) => ({
      society: SOCIETY,
      title: titleOf(link),
      link,
      sourceUrl: "https://example.org/source",
      scrapedAt: now,
      createdAt: now,
      updatedAt: now,
    }));
    await db.collection("opportunities").insertMany(rows);
  });
});

after(async () => {
  await withDatabase(target, (db) => db.collection("opportunities").deleteMany({ title: new RegExp(`^aud030-${RUN}-`) }));
});

const mine = (res) => res.body.data.filter((item) => item.title.startsWith(`aud030-${RUN}-`));

describe("GET /opportunities", () => {
  test("serves only safe stored links, with a matching count", async () => {
    const res = await session.request("memberA", "GET", `/opportunities?society=${SOCIETY}`);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.success, true);
    assert.deepEqual(mine(res).map((i) => i.link).sort(), [...SAFE].sort());
    assert.equal(res.body.count, res.body.data.length);
    for (const item of res.body.data) assert.match(item.link, /^https?:\/\/[^/@]*\//i);
    assert.equal(typeof res.body.fallbackUrl, "string");
  });

  test("the unsafe rows are left untouched in the database (no rewrite)", async () => {
    await session.request("memberA", "GET", `/opportunities?society=${SOCIETY}`);

    const stored = await withDatabase(target, (db) =>
      db.collection("opportunities").find({ title: new RegExp(`^aud030-${RUN}-`) }).toArray(),
    );
    assert.deepEqual(stored.map((row) => row.link).sort(), [...SAFE, ...UNSAFE].sort());
  });

  test("anonymous callers and invalid societies are still rejected", async () => {
    assert.equal((await session.request(null, "GET", `/opportunities?society=${SOCIETY}`)).status, 401);
    assert.equal((await session.request("memberA", "GET", "/opportunities?society=NOPE")).status, 400);
    assert.equal((await session.request("memberA", "GET", "/opportunities")).status, 400);
  });
});
