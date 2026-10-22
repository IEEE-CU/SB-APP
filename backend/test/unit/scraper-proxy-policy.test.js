// AUD-030 (proxy): the scraper's SSRF protection checks the address a connection is made
// to. Through an HTTP(S) proxy the PROXY resolves the host name, so that check never sees
// the real destination (reproduced with a local fake proxy: a hostname was handed to the
// proxy and the scrape succeeded). Policy now: when any proxy variable the HTTP client
// reads (http_proxy, https_proxy, all_proxy, in either letter case) is set, the fetch is
// refused BEFORE any request is made; NO_PROXY never relaxes this; axios is told not to
// use a proxy at all as defense in depth.
//
// The end-to-end cases run the real scraper in a CHILD PROCESS with its own environment
// (this process and the machine environment are never modified) against a counting local
// "proxy" and a counting local server. Nothing leaves 127.0.0.1.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const { configuredProxyVariables, assertNoProxy, createSafeFetchOptions, isBlockedAddress } = require("../../src/utils/urlSafety");
const { scrapeSociety } = require("../../src/services/opportunityScraper");

const servers = [];
function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      servers.push(server);
      resolve({ server, port: server.address().port });
    });
  });
}
after(() => {
  for (const server of servers) server.close();
});
async function counting(body = "<a href='https://example.test/x'>Award Scholarship listing</a>") {
  const state = { hits: 0, urls: [] };
  const { port } = await listen((req, res) => {
    state.hits += 1;
    state.urls.push(req.url);
    res.setHeader("content-type", "text/html");
    res.end(`<html><body>${body}</body></html>`);
  });
  return Object.assign(state, { port, base: `http://127.0.0.1:${port}` });
}

// ---- which variables count --------------------------------------------------------------

test("no proxy configured: nothing is reported and nothing is refused", () => {
  assert.deepEqual(configuredProxyVariables({}), []);
  assert.doesNotThrow(() => assertNoProxy({}));
  assert.doesNotThrow(() => assertNoProxy({ PATH: "x", NODE_ENV: "production" }));
});

test("every proxy variable the client reads is detected, in both letter cases", () => {
  for (const name of ["HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy"]) {
    assert.deepEqual(configuredProxyVariables({ [name]: "http://proxy.internal:3128" }), [name], name);
    assert.throws(() => assertNoProxy({ [name]: "http://proxy.internal:3128" }), /Blocked URL: an outbound proxy is configured/, name);
  }
});

test("NO_PROXY never relaxes the policy and is not itself a proxy", () => {
  assert.doesNotThrow(() => assertNoProxy({ NO_PROXY: "*", no_proxy: "example.test" }));
  for (const noProxy of ["*", "example.test", "localhost,127.0.0.1", ""]) {
    assert.throws(() => assertNoProxy({ HTTPS_PROXY: "http://proxy:3128", NO_PROXY: noProxy, no_proxy: noProxy }), /outbound proxy/, noProxy);
  }
});

test("empty or blank values are not a configured proxy", () => {
  assert.doesNotThrow(() => assertNoProxy({ HTTP_PROXY: "", https_proxy: "   ", ALL_PROXY: "" }));
});

test("the error names the variables but never leaks their values (they can hold credentials)", () => {
  assert.throws(
    () => assertNoProxy({ HTTPS_PROXY: "http://user:s3cret@proxy.internal:3128" }),
    (error) => /HTTPS_PROXY/.test(error.message) && !/s3cret|user:|proxy\.internal/.test(error.message),
  );
});

// ---- the fetch options ------------------------------------------------------------------

test("assertUrl refuses first, before any URL check, when a proxy is configured", () => {
  const safe = createSafeFetchOptions({ env: { ALL_PROXY: "http://proxy:3128" } });

  assert.throws(() => safe.assertUrl("https://example.org/"), /outbound proxy/);
  assert.throws(() => safe.assertUrl("javascript:1"), /outbound proxy/);
});

test("the environment is read on every call, not once at creation", () => {
  const env = {};
  const safe = createSafeFetchOptions({ env, isBlocked: () => false });

  assert.doesNotThrow(() => safe.assertUrl("https://example.org/"));
  env.https_proxy = "http://proxy:3128";
  assert.throws(() => safe.assertUrl("https://example.org/"), /outbound proxy/);
  assert.throws(() => safe.axiosOptions.beforeRedirect({ href: "https://example.org/next" }), /outbound proxy/);
});

test("axios is told not to use a proxy, and the existing limits and checks are kept", () => {
  const { axiosOptions } = createSafeFetchOptions({ env: {} });

  assert.equal(axiosOptions.proxy, false);
  assert.equal(axiosOptions.maxRedirects, 3);
  assert.equal(axiosOptions.maxContentLength, 5 * 1024 * 1024);
  assert.throws(() => axiosOptions.beforeRedirect({ href: "http://169.254.169.254/latest/meta-data/" }), /Blocked URL/);
  assert.doesNotThrow(() => axiosOptions.beforeRedirect({ href: "https://example.org/ok" }));
});

// ---- end to end, in-process (injected environment) ---------------------------------------

const allowFixtureLoopback = (address) => address !== "127.0.0.1" && isBlockedAddress(address);

test("a rejected proxy configuration makes ZERO outbound requests", async () => {
  const target = await counting();
  const proxy = await counting();
  const safeFetch = createSafeFetchOptions({
    env: { HTTP_PROXY: proxy.base, NO_PROXY: "*" },
    isBlocked: allowFixtureLoopback,
  });

  const result = await scrapeSociety({ society: "CS", url: `${target.base}/page` }, { safeFetch });

  assert.equal(result.ok, false);
  assert.match(result.error, /outbound proxy/);
  assert.deepEqual(result.items, []);
  assert.equal(target.hits, 0);
  assert.equal(proxy.hits, 0);
});

test("with no proxy, a legitimate http page is still scraped (positive control)", async () => {
  const target = await counting();
  const safeFetch = createSafeFetchOptions({ env: {}, isBlocked: allowFixtureLoopback });

  const result = await scrapeSociety({ society: "CS", url: `${target.base}/page` }, { safeFetch });

  assert.equal(result.ok, true, result.error);
  assert.equal(target.hits, 1);
  assert.deepEqual(result.items.map((i) => i.link), ["https://example.test/x"]);
});

test("the initial destination and redirect hops stay protected when no proxy is configured", async () => {
  const internal = await counting();
  const page = await listen((req, res) => {
    res.statusCode = 302;
    res.setHeader("location", `http://169.254.169.254:${internal.port}/latest/meta-data/`);
    res.end();
  });
  const safeFetch = createSafeFetchOptions({ env: {}, isBlocked: allowFixtureLoopback });

  const redirected = await scrapeSociety({ society: "CS", url: `http://127.0.0.1:${page.port}/` }, { safeFetch });
  const direct = await scrapeSociety({ society: "CS", url: "http://10.0.0.1/" }, { safeFetch });

  assert.equal(redirected.ok, false);
  assert.match(redirected.error, /Blocked URL/);
  assert.equal(direct.ok, false);
  assert.match(direct.error, /Blocked URL/);
  assert.equal(internal.hits, 0);
});

// ---- end to end, real child process with a real environment -------------------------------

const SERVICE = path.join(__dirname, "../../src/services/opportunityScraper.js").replace(/\\/g, "/");
const CHILD = `
  const { scrapeSociety } = require(${JSON.stringify(SERVICE)});
  scrapeSociety({ society: "CS", url: process.argv[1] }).then((r) => {
    process.stdout.write(JSON.stringify({ ok: r.ok, error: r.error || null, items: r.items.length }));
    process.exit(0);
  });
`;

/** Runs the production scraper (default policy) in a clean child environment. */
function scrapeInChild(url, extraEnv) {
  const env = {};
  for (const keep of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP"]) {
    if (process.env[keep] !== undefined) env[keep] = process.env[keep];
  }
  const run = spawnSync(process.execPath, ["-e", CHILD, url], { env: { ...env, ...extraEnv }, encoding: "utf8", timeout: 30000 });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

test("child process: every proxy variable, in each case, refuses the fetch and the proxy sees NOTHING", async () => {
  const proxy = await counting();
  const cases = [
    { HTTP_PROXY: proxy.base },
    { http_proxy: proxy.base },
    { HTTPS_PROXY: proxy.base },
    { https_proxy: proxy.base },
    { ALL_PROXY: proxy.base },
    { all_proxy: proxy.base },
    { HTTP_PROXY: proxy.base, NO_PROXY: "*" },
    { HTTPS_PROXY: proxy.base, no_proxy: "example.test" },
  ];

  for (const extraEnv of cases) {
    for (const url of ["http://example.test/awards", "https://example.test/awards"]) {
      const result = scrapeInChild(url, extraEnv);

      assert.equal(result.ok, false, JSON.stringify(extraEnv));
      assert.match(result.error, /outbound proxy/, JSON.stringify(extraEnv));
      assert.equal(result.items, 0);
    }
  }
  assert.equal(proxy.hits, 0, "a request reached the proxy");
});

test("child process: with a clean environment the default policy still validates the URL (no proxy message)", () => {
  const result = scrapeInChild("http://10.0.0.1/", {});

  assert.equal(result.ok, false);
  assert.match(result.error, /Blocked URL: internal address/);
  assert.doesNotMatch(result.error, /proxy/);
});
