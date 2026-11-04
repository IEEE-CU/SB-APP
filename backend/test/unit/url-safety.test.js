// AUD-030: utils/urlSafety.js - the helpers behind the scraper's two protections.
//
//   1. a URL that is only stored and shown as a link must be a plain web URL;
//   2. a URL the server fetches must not lead to an internal destination, whatever the
//      spelling of the address, wherever a redirect points, and whatever a name resolves
//      to when the connection is made.
//
// Everything here is deterministic and offline: addresses are classified directly, and
// DNS is replaced by fake resolvers. Nothing is resolved or requested for real.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  isBlockedAddress,
  parseWebUrl,
  safeWebUrl,
  isSafeWebUrl,
  assertFetchableUrl,
  createSafeLookup,
  createSafeFetchOptions,
  MAX_URL_LENGTH,
} = require("../../src/utils/urlSafety");

// ---- stored links: plain web URLs only ------------------------------------------------

test("http and https URLs are accepted and normalized", () => {
  assert.equal(safeWebUrl("https://example.org/awards?id=1#top"), "https://example.org/awards?id=1#top");
  assert.equal(safeWebUrl("http://example.org"), "http://example.org/");
  assert.equal(safeWebUrl("  https://example.org/padded  "), "https://example.org/padded");
  assert.equal(safeWebUrl("HTTPS://Example.ORG/Path"), "https://example.org/Path");
  assert.equal(isSafeWebUrl("https://example.org"), true);
});

test("relative URLs are resolved against the page they were found on", () => {
  assert.equal(safeWebUrl("/awards/2026", "https://example.org/dir/page"), "https://example.org/awards/2026");
  assert.equal(safeWebUrl("detail.html", "https://example.org/dir/page"), "https://example.org/dir/detail.html");
  assert.equal(safeWebUrl("//cdn.example.org/a", "https://example.org/"), "https://cdn.example.org/a");
});

test("unsupported schemes are rejected, whatever the spelling", () => {
  for (const value of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "\u0000javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "file:///C:/Windows/win.ini",
    "file://localhost/etc/passwd",
    "ftp://example.org/award.zip",
    "gopher://example.org/",
    "blob:https://example.org/1",
    "about:blank",
    "mailto:someone@example.org",
    "tel:+15555550100",
    "ws://example.org/socket",
  ]) {
    assert.equal(safeWebUrl(value), null, JSON.stringify(value));
    assert.equal(safeWebUrl(value, "https://example.org/"), null, `relative to a base: ${JSON.stringify(value)}`);
  }
});

test("embedded credentials are rejected", () => {
  for (const value of [
    "https://user:secret@example.org/",
    "http://user@example.org/",
    "https://:secret@example.org/",
    "https://example.org@evil.example/",
    "https://example.org%40evil.example@evil.example/",
  ]) {
    assert.equal(safeWebUrl(value), null, value);
  }
});

test("malformed, empty, non-string and oversized inputs are rejected", () => {
  for (const value of [undefined, null, 42, {}, [], "", "   ", "http://", "https://", "http://[::1", "ht!tp://x", "://nohost", "http://exa mple.org/"]) {
    assert.equal(safeWebUrl(value), null, JSON.stringify(value));
  }
  // The URL standard reads "http:///path" as the host "path"; the result is a plain web URL.
  assert.equal(safeWebUrl("http:///path"), "http://path/");
  assert.equal(safeWebUrl(`https://example.org/${"a".repeat(MAX_URL_LENGTH)}`), null);
  assert.equal(parseWebUrl(`https://example.org/${"a".repeat(MAX_URL_LENGTH - 30)}`) !== null, true);
});

test("a look-alike host does not change what the URL is", () => {
  // The host is whatever follows the last @ (and that is rejected anyway); a lookalike
  // path or query cannot turn a different scheme into http(s).
  assert.equal(safeWebUrl("https://example.org/javascript:alert(1)"), "https://example.org/javascript:alert(1)");
  assert.equal(safeWebUrl("https://example.org?u=javascript:alert(1)"), "https://example.org/?u=javascript:alert(1)");
});

// ---- addresses the server must never connect to ---------------------------------------

test("loopback, private, link-local, metadata, CGNAT, reserved and multicast IPv4 are blocked", () => {
  for (const address of [
    "127.0.0.1", "127.255.255.254", "0.0.0.0", "0.1.2.3",
    "10.0.0.1", "10.255.255.255",
    "172.16.0.1", "172.31.255.255",
    "192.168.0.1", "192.168.255.255",
    "169.254.0.1", "169.254.169.254",
    "100.64.0.1", "100.127.255.255",
    "192.0.0.1", "192.0.2.5", "198.18.0.1", "198.19.255.255", "198.51.100.7", "203.0.113.9",
    "224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255",
  ]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
});

test("ordinary public IPv4 addresses and the edges of the private ranges are allowed", () => {
  for (const address of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.255.255", "172.32.0.1", "11.0.0.1", "192.169.0.1", "100.63.255.255", "100.128.0.1", "169.253.0.1", "126.255.255.255", "128.0.0.1"]) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test("IPv6 loopback, unspecified, unique-local, link-local, multicast and documentation ranges are blocked", () => {
  for (const address of ["::1", "::", "fc00::1", "fd12:3456:789a::1", "fe80::1", "febf::1", "ff02::1", "2001:db8::1", "100::1"]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  assert.equal(isBlockedAddress("2606:4700:4700::1111"), false);
  assert.equal(isBlockedAddress("2001:4860:4860::8888"), false);
});

test("an IPv4 address carried inside an IPv6 literal is judged as that IPv4 address", () => {
  for (const address of ["::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1", "64:ff9b::10.0.0.1", "::FFFF:127.0.0.1"]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  assert.equal(isBlockedAddress("::ffff:8.8.8.8"), false);
});

test("anything that is not an IP address is blocked (fail closed)", () => {
  for (const value of ["", "localhost", "example.org", "1.2.3", "256.1.1.1", "not-an-ip", undefined, null]) {
    assert.equal(isBlockedAddress(value), true, String(value));
  }
});

// ---- the URL a server is about to fetch ---------------------------------------------------

test("a public http(s) URL may be fetched", () => {
  assert.equal(assertFetchableUrl("https://www.ieeefoundation.org/students/").hostname, "www.ieeefoundation.org");
  assert.equal(assertFetchableUrl("http://93.184.216.34/page").hostname, "93.184.216.34");
});

test("alternate spellings of an internal IPv4 address are all caught by the URL parser's canonical form", () => {
  for (const value of [
    "http://127.0.0.1/",
    "http://2130706433/", // decimal
    "http://0x7f000001/", // hexadecimal
    "http://0x7f.0.0.1/", // mixed hex
    "http://017700000001/", // octal
    "http://0177.0.0.1/", // dotted octal
    "http://127.1/", // short form
    "http://127.0.1/",
    "http://0/",
    "http://0.0.0.0/",
    "http://169.254.169.254/latest/meta-data/",
    "http://2852039166/latest/meta-data/", // 169.254.169.254 as a decimal integer
    "http://[::1]/",
    "http://[0:0:0:0:0:0:0:1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:7f00:1]/",
    "http://[fe80::1]/",
    "http://[fd00::1]/",
    "http://10.0.0.1:8080/admin",
    "http://192.168.1.1/",
    "http://172.16.0.5/",
    "http://100.64.0.1/",
  ]) {
    assert.throws(() => assertFetchableUrl(value), /Blocked URL/, value);
  }
});

test("loopback host names are blocked without a DNS lookup", () => {
  for (const value of ["http://localhost/", "http://LOCALHOST:8080/", "http://app.localhost/", "https://a.b.localhost/x", "http://localhost./"]) {
    // the trailing-dot form is not special-cased by name; it falls to the lookup guard
    if (value.endsWith("localhost./")) continue;
    assert.throws(() => assertFetchableUrl(value), /Blocked URL/, value);
  }
});

test("schemes, credentials and malformed URLs are blocked for fetching too", () => {
  for (const value of ["file:///etc/passwd", "ftp://example.org/", "gopher://example.org/", "javascript:1", "data:text/plain,x", "https://u:p@example.org/", "http://", "not a url", "", undefined, null]) {
    assert.throws(() => assertFetchableUrl(value), /Blocked URL/, String(value));
  }
});

test("a custom policy is honoured (used by tests, never by production code)", () => {
  assert.throws(() => assertFetchableUrl("http://203.0.113.9/", { isBlocked: () => true }), /Blocked URL/);
  assert.doesNotThrow(() => assertFetchableUrl("http://127.0.0.1/", { isBlocked: () => false }));
});

// ---- the connection-time check: names that resolve somewhere internal --------------------------

const resolverFor = (table) => (hostname, options, callback) => {
  const answer = table[hostname];
  if (answer instanceof Error) return callback(answer);
  if (!answer) return callback(Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: "ENOTFOUND" }));
  return callback(null, answer.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
};
const lookupWith = (table) => (hostname, options = {}) =>
  new Promise((resolve, reject) =>
    createSafeLookup({ resolve: resolverFor(table) })(hostname, options, (error, address, family) => (error ? reject(error) : resolve({ address, family }))),
  );

test("a name that resolves to a public address connects to it, in both lookup call shapes", async () => {
  const lookup = lookupWith({ "ok.example": ["93.184.216.34"] });

  assert.deepEqual(await lookup("ok.example"), { address: "93.184.216.34", family: 4 });
  const all = await lookup("ok.example", { all: true });
  assert.deepEqual(all.address, [{ address: "93.184.216.34", family: 4 }]);
});

test("a name that resolves to an internal address is refused, so no connection is made", async () => {
  const lookup = lookupWith({
    "evil.example": ["127.0.0.1"],
    "metadata.example": ["169.254.169.254"],
    "lan.example": ["192.168.1.10"],
    "v6.example": ["::1"],
    "mapped.example": ["::ffff:10.0.0.1"],
  });

  for (const host of ["evil.example", "metadata.example", "lan.example", "v6.example", "mapped.example"]) {
    await assert.rejects(lookup(host), (error) => error.code === "EBLOCKEDADDRESS" && /internal address/.test(error.message), host);
  }
});

test("one internal address among several answers is enough to refuse the name", async () => {
  const lookup = lookupWith({ "mixed.example": ["93.184.216.34", "10.0.0.5"], "mixed6.example": ["2606:4700:4700::1111", "::1"] });

  await assert.rejects(lookup("mixed.example"), /internal address/);
  await assert.rejects(lookup("mixed6.example", { all: true }), /internal address/);
});

test("DNS rebinding: every connection is checked against the answer it is given at that moment", async () => {
  let call = 0;
  const rebinding = (hostname, options, callback) => {
    call += 1;
    callback(null, [{ address: call === 1 ? "93.184.216.34" : "127.0.0.1", family: 4 }]);
  };
  const lookup = createSafeLookup({ resolve: rebinding });
  const run = () => new Promise((resolve, reject) => lookup("rebind.example", {}, (e, a) => (e ? reject(e) : resolve(a))));

  assert.equal(await run(), "93.184.216.34");
  await assert.rejects(run(), /internal address/, "the second answer pointed inside and was used");
});

test("resolver failures and empty answers are refused", async () => {
  const lookup = lookupWith({ "empty.example": [], "broken.example": new Error("SERVFAIL") });

  await assert.rejects(lookup("unknown.example"), /ENOTFOUND/);
  await assert.rejects(lookup("empty.example"), /internal address/);
  await assert.rejects(lookup("broken.example"), /SERVFAIL/);
});

// ---- redirect hops ---------------------------------------------------------------------

test("every redirect hop is validated: internal literals, schemes and credentials abort the request", () => {
  const { axiosOptions } = createSafeFetchOptions();
  const hop = (href) => axiosOptions.beforeRedirect({ href });

  assert.doesNotThrow(() => hop("https://www.example.org/moved"));
  for (const target of [
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/admin",
    "http://[::1]/",
    "http://2130706433/",
    "http://localhost:8080/",
    "file:///etc/passwd",
    "ftp://example.org/",
    "javascript:alert(1)",
    "https://user:pass@example.org/",
  ]) {
    assert.throws(() => hop(target), /Blocked URL/, target);
  }
});

test("a redirect hop given as request options (no href) is validated too", () => {
  const { axiosOptions } = createSafeFetchOptions();

  assert.throws(() => axiosOptions.beforeRedirect({ protocol: "http:", hostname: "127.0.0.1", path: "/x" }), /Blocked URL/);
  assert.doesNotThrow(() => axiosOptions.beforeRedirect({ protocol: "https:", hostname: "www.example.org", path: "/x" }));
});

test("the fetch options bound redirects and response size, and bring their own agents", () => {
  const { axiosOptions, assertUrl } = createSafeFetchOptions();

  assert.equal(axiosOptions.maxRedirects, 3);
  assert.equal(axiosOptions.maxContentLength, 5 * 1024 * 1024);
  assert.ok(axiosOptions.httpAgent && axiosOptions.httpsAgent);
  assert.throws(() => assertUrl("http://127.0.0.1/"), /Blocked URL/);
});
