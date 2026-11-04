// AUD-031: logAudit persists exactly one AuditLog document per call, never retries a
// failed write (a retry could duplicate a row that actually landed), and keeps the
// actor, outcome and metadata it was given. The AuditLog model's save is replaced, so no
// database is involved.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const AuditLog = require("../../src/models/AuditLog");
const { logAudit } = require("../../src/services/auditLogger");

const realSave = AuditLog.prototype.save;
const realLog = console.log;
const realError = console.error;
let saved;
let failWith;

beforeEach(() => {
  saved = [];
  failWith = null;
  console.log = () => {};
  console.error = () => {};
  AuditLog.prototype.save = async function save() {
    saved.push(this.toObject());
    if (failWith) throw failWith;
    return this;
  };
});
test.after(() => {
  AuditLog.prototype.save = realSave;
  console.log = realLog;
  console.error = realError;
});

const USER = "64b7f8f2a1b2c3d4e5f6a001";
const entry = (extra = {}) => ({
  user: USER,
  action: "access_check",
  module: "events",
  route: "/api/v1/events",
  method: "GET",
  result: "allowed",
  reason: "r",
  ipAddress: "127.0.0.1",
  metadata: { targetUserId: "t1" },
  ...extra,
});

test("one call writes exactly one document with the actor, outcome and metadata given", async () => {
  await logAudit(entry());

  assert.equal(saved.length, 1);
  assert.equal(String(saved[0].userId), USER);
  assert.equal(saved[0].action, "access_check");
  assert.equal(saved[0].details.result, "allowed");
  assert.deepEqual(saved[0].details.metadata, { targetUserId: "t1" });
});

test("distinct events are all written: no de-duplication by content", async () => {
  await logAudit(entry());
  await logAudit(entry());
  await logAudit(entry({ action: "role_created", result: "denied" }));

  assert.equal(saved.length, 3);
});

test("a failed write is swallowed, attempted once, and never retried", async () => {
  failWith = new Error("db down");

  const result = await logAudit(entry());

  assert.equal(result, undefined);
  assert.equal(saved.length, 1);
});
