// AUD-030: services/opportunityScraper.js against hostile or compromised pages.
//
// Reproduced weaknesses (before the fix, with these same fixtures):
//   1. scraped hrefs were stored verbatim: javascript:, data:, file:, vbscript:, ftp:,
//      and links with embedded credentials all became Opportunity.link, which the API
//      serves to every user and the frontend renders as <a href>;
//   2. axios followed redirects anywhere: a 302 from the page to an "internal service"
//      made the server request it (one hit at the internal fixture), and the scrape
//      still reported success.
//
// Properties now enforced and tested here: only http(s) links without credentials are
// kept; the first URL and every redirect hop must be a public http(s) address; the
// address a name resolves to is checked when connecting; blocked destinations receive NO
// request (counted at the fixture servers); persistence only ever sees safe links.
//
// Everything runs against servers on 127.0.0.1 that this file starts, with fake DNS. The
// production policy blocks loopback, so tests that need the fixture page to be reachable
// use a policy that allows exactly 127.0.0.1 and still blocks every other internal range.
// A positive control (a redirect to an allowed fixture IS followed) proves the fixtures
// are reachable, so a zero-hit result means "blocked", not "unreachable". The real source
// list (real society websites) is never used.
const { test, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// axios honours proxy environment variables; the fixtures must be reached directly.
const savedProxyEnv = {};
for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"]) {
  savedProxyEnv[name] = process.env[name];
  delete process.env[name];
}
after(() => {
  for (const [name, value] of Object.entries(savedProxyEnv)) {
    if (value !== undefined) process.env[name] = value;
  }
});

const { scrapeSociety, scrapeAllSocieties } = require("../../src/services/opportunityScraper");
const { createSafeFetchOptions, isBlockedAddress } = require("../../src/utils/urlSafety");
const Opportunity = require("../../src/models/Opportunity");
const sources = require("../../src/config/opportunitySources");

// Allows exactly 127.0.0.1 (the fixture page) and keeps every other internal range blocked.
const allowFixtureLoopback = (address) => address !== "127.0.0.1" && isBlockedAddress(address);
const fixtureFetch = (extra = {}) => createSafeFetchOptions({ isBlocked: allowFixtureLoopback, ...extra });

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

/** A server that counts the requests it receives and answers with `respond`. */
async function counting(respond) {
  const state = { hits: 0, urls: [] };
  const { port } = await listen((req, res) => {
    state.hits += 1;
    state.urls.push(req.url);
    respond(req, res, state);
  });
  return Object.assign(state, { port, base: `http://127.0.0.1:${port}` });
}
const html = (body) => (req, res) => {
  res.setHeader("content-type", "text/html");
  res.end(`<html><body>${body}</body></html>`);
};
const redirectTo = (location) => (req, res) => {
  res.statusCode = 302;
  res.setHeader("location", location);
  res.end();
};

const HOSTILE_PAGE = `
  <a href="https://example.test/ok-https">Student Award Scholarship (https)</a>
  <a href="http://example.test/ok-http">Student Grant Fellowship (http)</a>
  <a href="/awards/2026">Award Scholarship relative link</a>
  <a href="//example.test/protocol-relative">Award Scholarship protocol-relative</a>
  <a href="javascript:alert(document.domain)">Award Scholarship javascript link</a>
  <a href="JaVaScRiPt:alert(1)">Award Scholarship mixed-case javascript</a>
  <a href="java&#09;script:alert(1)">Award Scholarship tab-split javascript</a>
  <a href="&#x6A;avascript:alert(1)">Award Scholarship entity-encoded javascript</a>
  <a href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;">Award Scholarship data link</a>
  <a href="file:///C:/Windows/win.ini">Award Scholarship file link</a>
  <a href="vbscript:msgbox(1)">Award Scholarship vbscript link</a>
  <a href="ftp://example.test/award.zip">Award Scholarship ftp link</a>
  <a href="https://admin:secret@example.test/award">Award Scholarship credential link</a>
  <a href="mailto:grants@example.test">Award Scholarship mail link</a>
  <a href="">Award Scholarship empty link</a>
  <a href="https://example.test/${"a".repeat(3000)}">Award Scholarship oversized link</a>`;

const linksOf = (result) => result.items.map((item) => item.link);

// ---- what gets stored ----------------------------------------------------------------------

test("only plain http(s) links are kept from a hostile page", async () => {
  const page = await counting(html(HOSTILE_PAGE));

  const result = await scrapeSociety({ society: "CS", url: `${page.base}/page` }, { safeFetch: fixtureFetch() });

  assert.equal(result.ok, true, result.error);
  assert.deepEqual(linksOf(result), [
    "https://example.test/ok-https",
    "http://example.test/ok-http",
    `${page.base}/awards/2026`,
    "http://example.test/protocol-relative",
  ]);
  for (const link of linksOf(result)) assert.match(link, /^https?:\/\//);
});

test("titles and the response shape of a successful scrape are unchanged", async () => {
  const page = await counting(html(HOSTILE_PAGE));

  const result = await scrapeSociety({ society: "CS", url: `${page.base}/page` }, { safeFetch: fixtureFetch() });

  assert.deepEqual(Object.keys(result).sort(), ["items", "ok", "society", "sourceUrl"]);
  assert.equal(result.society, "CS");
  assert.equal(result.items[0].title, "Student Award Scholarship (https)");
});

test("a page whose every link is unsafe yields no items", async () => {
  const page = await counting(
    html(`<a href="javascript:1">Award Scholarship one</a><a href="data:text/html,x">Award Scholarship two</a>`),
  );

  const result = await scrapeSociety({ society: "CS", url: `${page.base}/page` }, { safeFetch: fixtureFetch() });

  assert.equal(result.ok, true);
  assert.deepEqual(result.items, []);
});

// ---- the first URL --------------------------------------------------------------------------

test("the production policy refuses internal first URLs and sends NO request", async () => {
  const internal = await counting(html(`<a href="https://example.test/a">Award Scholarship listing</a>`));
  const targets = [
    `${internal.base}/`, // loopback literal
    `http://localhost:${internal.port}/`,
    `http://app.localhost:${internal.port}/`,
    `http://2130706433:${internal.port}/`, // 127.0.0.1 as a decimal integer
    `http://0x7f.0.0.1:${internal.port}/`,
    `http://017700000001:${internal.port}/`,
    `http://127.1:${internal.port}/`,
    `http://[::1]:${internal.port}/`,
    `http://[::ffff:127.0.0.1]:${internal.port}/`,
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/",
    "http://192.168.0.1/",
    "file:///etc/passwd",
    "ftp://example.test/",
    "javascript:alert(1)",
    `http://user:pass@127.0.0.1:${internal.port}/`,
  ];

  for (const url of targets) {
    const result = await scrapeSociety({ society: "CS", url });

    assert.equal(result.ok, false, url);
    assert.match(result.error, /Blocked URL/, url);
    assert.deepEqual(result.items, []);
  }
  assert.equal(internal.hits, 0, "a blocked URL still reached the internal service");
});

test("a name that resolves to an internal address is refused when connecting, and sends NO request", async () => {
  const internal = await counting(html(`<a href="https://example.test/a">Award Scholarship listing</a>`));
  const resolve = (hostname, options, callback) =>
    callback(null, [{ address: hostname === "evil.test" ? "127.0.0.1" : "169.254.169.254", family: 4 }]);

  for (const url of [`http://evil.test:${internal.port}/`, `http://metadata.test:${internal.port}/`]) {
    const result = await scrapeSociety({ society: "CS", url }, { safeFetch: createSafeFetchOptions({ resolve }) });

    assert.equal(result.ok, false, url);
    assert.match(result.error, /internal address/, url);
  }
  assert.equal(internal.hits, 0);
});

// ---- redirects --------------------------------------------------------------------------------

test("positive control: a redirect to an allowed destination is followed", async () => {
  const target = await counting(html(`<a href="https://example.test/moved">Award Scholarship moved listing</a>`));
  const page = await counting(redirectTo(`${target.base}/new-location`));

  const result = await scrapeSociety({ society: "CS", url: `${page.base}/old` }, { safeFetch: fixtureFetch() });

  assert.equal(result.ok, true, result.error);
  assert.equal(target.hits, 1);
  assert.deepEqual(linksOf(result), ["https://example.test/moved"]);
});

test("a redirect to an internal destination is blocked and the internal service receives NO request", async () => {
  const internal = await counting(html(`<a href="https://example.test/secret">Award Scholarship secret listing</a>`));
  const fakeDns = (hostname, options, callback) =>
    callback(null, [{ address: hostname === "metadata.test" ? "169.254.169.254" : "10.0.0.7", family: 4 }]);

  for (const location of [
    `http://127.0.0.2:${internal.port}/secret`, // another loopback address: not allowed by the fixture policy
    "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    `http://10.0.0.5:${internal.port}/`,
    `http://192.168.1.1:${internal.port}/`,
    `http://[::1]:${internal.port}/`,
    `http://2852039166:${internal.port}/`, // 169.254.169.254 as a decimal integer
    `http://metadata.test:${internal.port}/`, // a name that resolves to the metadata address
    `http://user:pass@127.0.0.1:${internal.port}/`,
  ]) {
    const page = await counting(redirectTo(location));

    const result = await scrapeSociety(
      { society: "CS", url: `${page.base}/start` },
      { safeFetch: fixtureFetch({ resolve: fakeDns }) },
    );

    assert.equal(result.ok, false, location);
    assert.match(result.error, /Blocked URL/, `${location}: ${result.error}`);
    assert.deepEqual(result.items, []);
  }
  assert.equal(internal.hits, 0, "a blocked redirect still reached the internal service");
});

test("a redirect to a non-web scheme yields nothing", async () => {
  for (const location of ["file:///etc/passwd", "ftp://example.test/x", "javascript:alert(1)", "data:text/html,x"]) {
    const page = await counting(redirectTo(location));

    const result = await scrapeSociety({ society: "CS", url: `${page.base}/start` }, { safeFetch: fixtureFetch() });

    assert.equal(result.ok, false, location);
    assert.deepEqual(result.items, []);
  }
});

test("redirect chains are bounded", async () => {
  const page = await counting((req, res) => redirectTo(`${page.base}/next${page.hits}`)(req, res));

  const result = await scrapeSociety({ society: "CS", url: `${page.base}/start` }, { safeFetch: fixtureFetch() });

  assert.equal(result.ok, false);
  assert.ok(page.hits <= 5, `followed ${page.hits} hops`);
});

test("an oversized response is refused", async () => {
  const page = await counting((req, res) => {
    res.setHeader("content-type", "text/html");
    res.end("x".repeat(4096));
  });

  const result = await scrapeSociety(
    { society: "CS", url: `${page.base}/big` },
    { safeFetch: fixtureFetch({ maxContentLength: 1024 }) },
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /maxContentLength|exceeded/i);
});

// ---- persistence ------------------------------------------------------------------------------

const realUpsert = Opportunity.findOneAndUpdate;
const realDeleteMany = Opportunity.deleteMany;
let persisted;
beforeEach(() => {
  persisted = { upserts: [], deletes: [] };
  Opportunity.findOneAndUpdate = async (filter, doc, options) => {
    persisted.upserts.push({ filter, doc, options });
    return doc;
  };
  Opportunity.deleteMany = async (filter) => {
    persisted.deletes.push(filter);
    return { deletedCount: 0 };
  };
});
after(() => {
  Opportunity.findOneAndUpdate = realUpsert;
  Opportunity.deleteMany = realDeleteMany;
});

/** Runs scrapeAllSocieties against local fixture sources only (never the real list). */
async function scrapeLocal(localSources, options) {
  const real = sources.slice();
  sources.splice(0, sources.length, ...localSources);
  try {
    return await scrapeAllSocieties(options);
  } finally {
    sources.splice(0, sources.length, ...real);
  }
}

test("only safe links reach the database, and the writes are validated", async () => {
  const page = await counting(html(HOSTILE_PAGE));

  const results = await scrapeLocal([{ society: "CS", label: "x", url: `${page.base}/page` }], { safeFetch: fixtureFetch() });

  assert.equal(results[0].ok, true, results[0].error);
  assert.equal(persisted.upserts.length, 4);
  for (const { doc, options } of persisted.upserts) {
    assert.match(doc.link, /^https?:\/\//);
    assert.doesNotMatch(doc.link, /^(javascript|data|file|vbscript|ftp):/i);
    assert.equal(options.runValidators, true);
  }
  assert.deepEqual(persisted.deletes[0].link.$nin, persisted.upserts.map((u) => u.doc.link));
});

test("a failed or blocked scrape persists nothing and removes nothing", async () => {
  const internal = await counting(html(`<a href="https://example.test/a">Award Scholarship listing</a>`));
  const unsafeOnly = await counting(html(`<a href="javascript:1">Award Scholarship one</a>`));

  const blocked = await scrapeLocal([{ society: "CS", label: "x", url: `${internal.base}/` }]); // production policy
  const unsafe = await scrapeLocal([{ society: "WIE", label: "y", url: `${unsafeOnly.base}/` }], { safeFetch: fixtureFetch() });

  assert.equal(blocked[0].ok, false);
  assert.equal(unsafe[0].ok, true);
  assert.deepEqual(persisted, { upserts: [], deletes: [] });
  assert.equal(internal.hits, 0);
});

// ---- the model ---------------------------------------------------------------------------------

test("the Opportunity model rejects unsafe links and source URLs", () => {
  const base = { society: "CS", title: "Student Award", link: "https://example.org/award", sourceUrl: "https://example.org/awards" };
  assert.equal(new Opportunity(base).validateSync(), undefined);

  for (const link of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://example.org/x", "https://u:p@example.org/", "not a url", "   "]) {
    const error = new Opportunity({ ...base, link }).validateSync();
    assert.ok(error && error.errors.link, `link ${link} was accepted`);
  }
  const badSource = new Opportunity({ ...base, sourceUrl: "javascript:1" }).validateSync();
  assert.ok(badSource && badSource.errors.sourceUrl);
});
