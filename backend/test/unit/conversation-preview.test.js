const { test } = require("node:test");
const assert = require("node:assert/strict");
const Message = require("../../src/models/Message");
const {
  toPlainPreview,
  toLastMessage,
  withLastMessages,
  PREVIEW_MAX_LENGTH,
} = require("../../src/utils/conversationPreview");

const oid = (n) => String(n).padStart(24, "0");

test("toPlainPreview prefers plainText and returns it as text", () => {
  assert.equal(toPlainPreview({ body: "<p>hi</p>", plainText: "hi" }), "hi");
});

test("toPlainPreview never returns markup, even when plainText itself holds HTML", () => {
  const out = toPlainPreview({ body: "x", plainText: '<p>Hello <b>world</b><img src=x onerror=alert(1)><script>alert(2)</script></p>' });
  assert.equal(/<|>/.test(out), false, out);
  assert.ok(out.startsWith("Hello world"), out);
});

test("toPlainPreview cannot be tricked into reassembling a tag from nested fragments", () => {
  const out = toPlainPreview({ body: "<<b>script>alert(1)<</b>/script>", plainText: "" });
  assert.equal(/<script/i.test(out), false, out);
});

test("toPlainPreview falls back to body, keeps &lt; encoded, collapses whitespace and truncates", () => {
  assert.equal(toPlainPreview({ body: "<div>a &amp; b\n\n  c</div>", plainText: "  " }), "a & b c");
  assert.equal(toPlainPreview({ body: "1 &lt;script&gt;", plainText: "" }), "1 &lt;script&gt;");
  const long = toPlainPreview({ body: "x".repeat(500), plainText: "x".repeat(500) });
  assert.equal(long.length, PREVIEW_MAX_LENGTH);
  assert.equal(toPlainPreview({}), "");
});

test("toLastMessage has the shape of the frontend Message and names the author from the conversation", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const conversation = { userOneId: { _id: oid(1), name: "One" }, userTwoId: { _id: oid(2), name: "Two" } };
  const out = toLastMessage(
    { _id: oid(9), conversationId: oid(5), authorId: oid(2), body: "<b>yo</b>", plainText: "yo", createdAt, updatedAt: createdAt },
    conversation,
  );
  assert.deepEqual(out, {
    id: oid(9), conversationId: oid(5), sender: { id: oid(2), name: "Two" }, content: "yo", reactions: [], createdAt, updatedAt: createdAt,
  });
});

function withAggregate(rows, run) {
  const original = Message.aggregate;
  const calls = [];
  Message.aggregate = (pipeline) => { calls.push(pipeline); return Promise.resolve(rows); };
  return Promise.resolve(run(calls)).finally(() => { Message.aggregate = original; });
}

const conv = (id, extra = {}) => ({
  _id: oid(id),
  toJSON() { return { id: oid(id), ...extra }; },
  userOneId: { _id: oid(100), name: "A" },
  userTwoId: { _id: oid(200), name: "B" },
});

test("withLastMessages issues ONE aggregate for any number of conversations, scoped to the given ids", async () => {
  const list = [conv(1), conv(2), conv(3)];
  await withAggregate([], async (calls) => {
    await withLastMessages(list);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][0].$match.conversationId.$in.map(String), [oid(1), oid(2), oid(3)]);
    assert.equal(calls[0][0].$match.parentMessageId, null);
  });
});

test("withLastMessages attaches lastMessage only where one exists and keeps the other fields", async () => {
  const when = new Date("2026-02-02T00:00:00Z");
  const rows = [{ _id: oid(1), message: { _id: oid(50), conversationId: oid(1), authorId: oid(100), body: "<i>hey</i>", plainText: "hey", createdAt: when, updatedAt: when } }];
  await withAggregate(rows, async () => {
    const out = await withLastMessages([conv(1, { societyId: "S" }), conv(2, { societyId: "S" })]);
    assert.equal(out[0].societyId, "S");
    assert.equal(out[0].lastMessage.content, "hey");
    assert.equal(out[0].lastMessage.sender.name, "A");
    assert.equal("lastMessage" in out[1], false);
    assert.equal(out[1].societyId, "S");
  });
});

test("withLastMessages does not query at all for an empty list", async () => {
  await withAggregate([], async (calls) => {
    assert.deepEqual(await withLastMessages([]), []);
    assert.equal(calls.length, 0);
  });
});
