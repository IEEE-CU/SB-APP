// AUD-012B: trusted-proxy configuration.
//
// Reproduced before the fix: the app hard-coded `trust proxy = 1`. Reached directly, a client
// chose its own address with X-Forwarded-For, so 14 failed logins - each claiming a different
// address - were never rate limited. The repository holds no deployment manifest or proxy
// configuration, so no hop count is guessed: TRUST_PROXY states the topology explicitly,
// defaults to trusting nothing, is required in production, and rejects `true`, `*` and
// anything unrecognised. These tests check the parser and, with real HTTP on loopback, what
// Express then does with X-Forwarded-For under each setting, including through the real
// rate-limit middleware.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const rateLimit = require("express-rate-limit");

const { parseTrustProxy } = require("../../src/config/trustProxy");

// ---- the parser ------------------------------------------------------------------------------------

test("unset, empty, 0, false and none all mean: trust nothing (outside production)", () => {
  for (const raw of [undefined, "", "  ", "0", "false", "FALSE", "none", " None "]) {
    assert.deepEqual(parseTrustProxy(raw), { setting: false, mode: "none" }, JSON.stringify(raw));
  }
});

test("in production it must be stated; 0 / none / false are valid statements", () => {
  assert.throws(() => parseTrustProxy(undefined, { production: true }), /TRUST_PROXY must be set explicitly in production/);
  for (const raw of ["0", "false", "none", "1", "loopback"]) {
    assert.doesNotThrow(() => parseTrustProxy(raw, { production: true }), raw);
  }
  // an empty string is an explicit (empty) statement of no proxies, like the other "none" spellings
  assert.deepEqual(parseTrustProxy("", { production: true }), { setting: false, mode: "none" });
});

test("a hop count from 1 to 10 is accepted; anything else numeric is refused", () => {
  for (let hops = 1; hops <= 10; hops += 1) assert.deepEqual(parseTrustProxy(String(hops)), { setting: hops, mode: "hops" });
  for (const raw of ["11", "100", "-1", "1.5", "1e1", "0x2"]) assert.throws(() => parseTrustProxy(raw), /TRUST_PROXY/, raw);
});

test("proxy addresses, CIDR ranges and the named subnets are accepted", () => {
  assert.deepEqual(parseTrustProxy("10.0.0.0/8, 127.0.0.1 ,LOOPBACK, ::1, fd00::/8, uniquelocal"), {
    setting: ["10.0.0.0/8", "127.0.0.1", "loopback", "::1", "fd00::/8", "uniquelocal"],
    mode: "addresses",
  });
});

test("true, *, words, malformed addresses and bad prefixes are refused", () => {
  for (const raw of ["true", "TRUE", "*", "yes", "all", "on", "1,2", "10.0.0.1/33", "::1/129", "10.0.0.1/", "10.0.0.1/8/8", "300.1.1.1", "loopback,,", ",", "10.0.0.0/8;1.1.1.1", "localhost"]) {
    assert.throws(() => parseTrustProxy(raw), /^Error: TRUST_PROXY/, raw);
  }
});

test("error messages never echo the configured value", () => {
  for (const raw of ["s3cr3t-looking-value", "10.0.0.1/99"]) {
    assert.throws(() => parseTrustProxy(raw), (error) => !error.message.includes(raw));
  }
});

// ---- what Express does with X-Forwarded-For under each setting ---------------------------------------------

const servers = [];
after(() => {
  for (const server of servers) server.close();
});

/** An app whose only route echoes req.ip, configured exactly as server.js configures it. */
function appWith(rawTrustProxy) {
  const app = express();
  app.set("trust proxy", parseTrustProxy(rawTrustProxy).setting);
  return app;
}
function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app).listen(0, "127.0.0.1", () => {
      servers.push(server);
      resolve(server.address().port);
    });
  });
}
async function ipSeenBy(rawTrustProxy, forwardedFor) {
  const app = appWith(rawTrustProxy);
  app.get("/ip", (req, res) => res.json({ ip: req.ip }));
  const port = await listen(app);
  const res = await fetch(`http://127.0.0.1:${port}/ip`, { headers: forwardedFor ? { "X-Forwarded-For": forwardedFor } : {} });
  return (await res.json()).ip;
}
const isLoopback = (ip) => ip === "127.0.0.1" || ip === "::ffff:127.0.0.1" || ip === "::1";

test("trusting nothing ignores X-Forwarded-For completely", async () => {
  for (const header of [undefined, "203.0.113.9", "1.1.1.1, 203.0.113.9", "not-an-address"]) {
    assert.equal(isLoopback(await ipSeenBy(undefined, header)), true, String(header));
    assert.equal(isLoopback(await ipSeenBy("0", header)), true, String(header));
  }
});

test("a proxy list that does not include the connecting address ignores the header too", async () => {
  assert.equal(isLoopback(await ipSeenBy("10.0.0.0/8, 192.168.0.0/16", "203.0.113.9")), true);
});

test("a trusted proxy's header is believed, and only the part it appended counts", async () => {
  assert.equal(await ipSeenBy("loopback", "203.0.113.9"), "203.0.113.9");
  assert.equal(await ipSeenBy("1", "203.0.113.9"), "203.0.113.9");
  // The client prepended its own claim; the trusted hop appended the real address.
  assert.equal(await ipSeenBy("1", "6.6.6.6, 203.0.113.9"), "203.0.113.9");
});

// ---- the rate limiter keyed on req.ip ------------------------------------------------------------------------

async function statusesFor(rawTrustProxy, attempts, headerFor) {
  const app = appWith(rawTrustProxy);
  app.use(rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: false, legacyHeaders: false }));
  app.get("/login", (req, res) => res.status(401).json({ ok: false }));
  const port = await listen(app);
  const statuses = [];
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(`http://127.0.0.1:${port}/login`, { headers: { "X-Forwarded-For": headerFor(i) } });
    statuses.push(res.status);
    await res.arrayBuffer();
  }
  return statuses;
}

test("with no trusted proxy, rotating X-Forwarded-For cannot evade the limiter", async () => {
  const statuses = await statusesFor(undefined, 14, (i) => `203.0.113.${i + 1}`);

  assert.deepEqual(statuses, [...Array(10).fill(401), ...Array(4).fill(429)]);
});

test("with an untrusted connection and a proxy list, rotating the header still cannot evade it", async () => {
  const statuses = await statusesFor("10.0.0.0/8", 14, (i) => `203.0.113.${i + 1}`);

  assert.deepEqual(statuses, [...Array(10).fill(401), ...Array(4).fill(429)]);
});

test("behind a trusted proxy each real client has its own counter (the proxy's header is believed)", async () => {
  // A trusted hop appends the real client address, so distinct clients are distinct keys.
  const statuses = await statusesFor("loopback", 14, (i) => `203.0.113.${i + 1}`);

  assert.equal(statuses.every((s) => s === 401), true);
});
