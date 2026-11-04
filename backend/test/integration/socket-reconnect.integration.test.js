"use strict";

/**
 * AUD-007D, server side: what a RECONNECTED socket does and does not get back.
 *
 * The client now re-sends its room joins after every reconnect (frontend socketRejoin.ts); this
 * file pins the server contract that makes that safe:
 *   - a reconnected socket is a brand-new socket: it is in no room until it joins again, and a
 *     message sent meanwhile is not replayed to it;
 *   - every join is authorized again, from the current permissions and scope - a grant that
 *     succeeded on the previous connection is not remembered (another society's channel, a
 *     conversation of other users, and a channel whose permission was revoked while offline are
 *     all refused);
 *   - a revoked session (password reset) cannot reconnect at all.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget } = require("./helpers/target");
const { createSession } = require("./helpers/session");
const { createSocketTracker } = require("./helpers/socket-client");

const target = requireHarnessTarget();
const session = createSession(target);
const tracker = createSocketTracker();
const { channels, conversation } = target.ready.fixtures;

after(() => tracker.closeAll());

const RUN = Date.now();
let counter = 0;
const unique = (label) => `${label} #${++counter} ${RUN}`;

async function connectWith(token) {
  return tracker.connect(target.baseUrl, { token });
}
async function connected(token) {
  const result = await connectWith(token);
  assert.equal(result.ok, true, `could not connect: ${result.error}`);
  return result.client;
}
const join = (client, event, payload) => client.emitWithAck(event, payload);
async function post(userKey, text) {
  const res = await session.request(userKey, "POST", `/channels/${channels.A.id}/messages`, { body: { body: text } });
  assert.equal(res.status, 201, res.text.slice(0, 160));
}
const received = async (client, text, mark, timeout = 1500) => {
  try {
    await client.waitFor("message:new", (m) => m && m.body === text, timeout, mark);
    return true;
  } catch {
    return false;
  }
};
const setPermission = async (accessLevel) =>
  session.request("admin", "POST", "/role-permissions", {
    body: { role: "ieee_member", permission: "community_hub:view", accessLevel },
  });

describe("a reconnected socket starts with no rooms", () => {
  test("no delivery until it joins again, then delivery resumes; the message sent meanwhile is not replayed", async () => {
    const token = await session.tokenFor("memberA");
    const first = await connected(token);
    assert.deepEqual(await join(first, "channel:join", channels.A.id), { success: true });
    const before = unique("before the drop");
    let mark = first.mark();
    await post("chairA", before);
    assert.equal(await received(first, before, mark, 3000), true, "positive control: the joined socket receives messages");
    await first.close();

    const second = await connected(token); // the reconnect: same user, same token, new socket
    const whileUnjoined = unique("sent before rejoining");
    mark = second.mark();
    await post("chairA", whileUnjoined);
    assert.equal(await received(second, whileUnjoined, mark), false, "a reconnected socket received a room message it had not joined");

    assert.deepEqual(await join(second, "channel:join", channels.A.id), { success: true });
    const after = unique("after rejoining");
    mark = second.mark();
    await post("chairA", after);
    assert.equal(await received(second, after, mark, 3000), true);
    assert.equal(await received(second, whileUnjoined, 0, 200), false, "the earlier message was replayed");
    await second.close();
  });
});

describe("every join is authorized again after a reconnect", () => {
  test("another society's channel and other users' conversation are refused, however the user was connected before", async () => {
    const token = await session.tokenFor("memberA");
    const first = await connected(token);
    assert.deepEqual(await join(first, "channel:join", channels.A.id), { success: true });
    await first.close();

    const second = await connected(token);
    assert.deepEqual(await join(second, "channel:join", channels.B.id), { success: false });
    assert.deepEqual(await join(second, "channel:join", { channelId: channels.B.id }), { success: false });
    assert.deepEqual(await join(second, "room:join", { channelId: channels.B.id }), { success: false });
    const stranger = await connected(await session.tokenFor("chairB"));
    assert.deepEqual(await join(stranger, "conversation:join", conversation.id), { success: false });
    assert.deepEqual(await join(second, "conversation:join", conversation.id), { success: true }, "a participant may rejoin their own conversation");
    await Promise.all([second.close(), stranger.close()]);
  });

  test("a permission revoked while the user was offline is honoured; restoring it allows the join again", async () => {
    const token = await session.tokenFor("memberA");
    const first = await connected(token);
    assert.deepEqual(await join(first, "channel:join", channels.A.id), { success: true });
    await first.close();

    assert.equal((await setPermission("none")).status, 200);
    const second = await connected(token);
    assert.deepEqual(await join(second, "channel:join", channels.A.id), { success: false }, "an earlier grant was remembered");

    assert.equal((await setPermission("limited_own_scope")).status, 200);
    assert.deepEqual(await join(second, "channel:join", channels.A.id), { success: true });
    await second.close();
  });
});

describe("a revoked session cannot reconnect", () => {
  test("after an administrator reset the old token is refused at the handshake and gets no room", async () => {
    const email = `reconnect-${RUN}@integration.test`;
    const created = await target.registerAccount({ name: "Reconnect Revoked", email, password: "reconnect-original-password-12" });
    const body = await created.json();
    const oldToken = body.data.token;
    const live = await connected(oldToken);

    const reset = await session.request("admin", "POST", `/users/${body.data.user.id}/reset-password`, { body: { newPassword: "reconnect-second-password-345" } });
    assert.equal(reset.status, 200, reset.text.slice(0, 160));
    await live.waitForClose(4000);

    const refused = await connectWith(oldToken);
    assert.equal(refused.ok, false);
    assert.match(String(refused.error), /Authentication error/);
    const login = await target.api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "reconnect-second-password-345" }),
    });
    const fresh = await login.json();
    const again = await connected(fresh.data.token);
    assert.deepEqual(await join(again, "channel:join", channels.A.id), { success: false }, "the account has no channel permission; a new login does not change that");
    await again.close();
  });
});
