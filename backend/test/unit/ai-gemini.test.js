// AUD-013: GeminiService and the prompt built from server-side data. A fake fetch stands in for
// Google: no network, no real key.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { generate, GeminiNotConfiguredError, GeminiProviderError } = require("../../src/services/ai/GeminiService");
const { buildPrompt } = require("../../src/services/ai/financialSummary");

const SECRET = "TEST-SECRET-KEY-do-not-leak-0123456789";
const config = { apiKey: SECRET, model: "test-model", baseUrl: "https://provider.invalid/v1beta" };
const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test("no configured key: NotConfigured, and the provider is never called", async () => {
  let called = false;
  await assert.rejects(
    generate("p", { config: { ...config, apiKey: "" }, fetchImpl: async () => { called = true; } }),
    GeminiNotConfiguredError,
  );
  assert.equal(called, false);
});

test("the key travels in a header, never in the URL or body; the prompt is the only content sent", async () => {
  let seen;
  const text = await generate("hello", {
    config,
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return ok({ candidates: [{ content: { parts: [{ text: "part one " }, { text: "part two" }] } }] });
    },
  });

  assert.equal(text, "part one part two");
  assert.equal(seen.url, "https://provider.invalid/v1beta/models/test-model:generateContent");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers["x-goog-api-key"], SECRET);
  assert.ok(!seen.url.includes(SECRET));
  assert.ok(!seen.init.body.includes(SECRET));
  assert.deepEqual(JSON.parse(seen.init.body), { contents: [{ parts: [{ text: "hello" }] }] });
  assert.ok(seen.init.signal, "a timeout signal is set");
});

test("provider failures become a generic error that carries a status number only (no key, no provider text)", async () => {
  const failures = [
    async () => ({ ok: false, status: 500, json: async () => ({ error: { message: `bad key ${SECRET}` } }) }),
    async () => { throw new Error(`connect failed for key ${SECRET}`); },
    async () => ({ ok: true, status: 200, json: async () => { throw new Error(`parse ${SECRET}`); } }),
    async () => ok({ candidates: [] }),
    async () => ok({}),
    async () => ok({ candidates: [{ content: { parts: [{ text: "  " }] } }] }),
  ];
  for (const fetchImpl of failures) {
    await assert.rejects(generate("p", { config, fetchImpl }), (error) => {
      assert.ok(error instanceof GeminiProviderError);
      assert.ok(!error.message.includes(SECRET));
      assert.ok(!String(error.stack).includes(SECRET));
      assert.ok(error.status === undefined || typeof error.status === "number");
      return true;
    });
  }
});

test("prompts are built from server data only and contain the figures", () => {
  const societies = [
    { name: "Computer Society", shortName: "CS", budget: 1000, balance: 400 },
    { name: "Power Society", shortName: "PES", budget: 500, balance: 500 },
  ];
  const overview = buildPrompt({ societies, transactions: [] }, false);
  assert.match(overview, /Total Budget: ₹1500/);
  assert.match(overview, /Total Current Balance: ₹900/);
  assert.match(overview, /CS: Budget ₹1000, Spent ₹600/);

  const single = buildPrompt({ societies: [societies[0]] }, true);
  assert.match(single, /"Computer Society" \(CS\)/);
  assert.match(single, /Allocated Budget: ₹1000/);
  assert.match(single, /Current Balance: ₹400/);
  // D-B10: no transaction data in the prompt.
  assert.doesNotMatch(single, /EXPENSE|INCOME|transaction/i);
});

// ---- controller: success path and provider failures (fake provider, stubbed models) ------------
const geminiService = require("../../src/services/ai/GeminiService");
const Society = require("../../src/models/Society");
const Transaction = require("../../src/models/Transaction");
const aiController = require("../../src/controllers/aiController");

const SOC = "64b7f8f2a1b2c3d4e5f6b001";
const chain = (rows) => ({ sort: () => ({ limit: () => ({ lean: async () => rows }) }), lean: async () => rows });

function run(handler, { body = {}, scopeFilter = {} } = {}) {
  const res = { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const req = { body, scopeFilter, user: { _id: "u1" } };
  let nextCalled = false;
  return handler(req, res, (e) => { nextCalled = e || true; }).then(() => ({ res, nextCalled }));
}

function withStubs(fn) {
  const saved = { generate: geminiService.generate, find: Society.find, exists: Society.exists, agg: Transaction.aggregate, tfind: Transaction.find, err: console.error };
  Society.find = () => chain([{ _id: SOC, name: "Computer Society", shortName: "CS", budget: 1000 }]);
  Society.exists = async () => ({ _id: SOC });
  Transaction.aggregate = async () => [{ _id: { society: SOC, type: "EXPENSE" }, total: 600 }];
  // D-B10: transactions are only ever summed (aggregate); a record-level read is a failure.
  Transaction.find = () => { throw new Error("transaction records must not be read for the AI audit"); };
  return Promise.resolve(fn()).finally(() => {
    geminiService.generate = saved.generate; Society.find = saved.find; Society.exists = saved.exists;
    Transaction.aggregate = saved.agg; Transaction.find = saved.tfind; console.error = saved.err;
  });
}

test("controller: success returns only the generated text; the prompt is built from server data", () =>
  withStubs(async () => {
    let prompt;
    geminiService.generate = async (p) => { prompt = p; return "All good."; };
    const { res } = await run(aiController.financialInsights, { body: {} });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, data: { insights: "All good." } });
    assert.match(prompt, /Total Budget: ₹1000/);
    assert.match(prompt, /Total Current Balance: ₹400/);
  }));

test("controller: provider failure is a 502 with a generic message; the log line carries a status number only", () =>
  withStubs(async () => {
    const logged = [];
    console.error = (...args) => logged.push(args.join(" "));
    geminiService.generate = async () => { throw new GeminiProviderError(500); };
    const { res } = await run(aiController.financialInsights, { body: {} });
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.success, false);
    assert.doesNotMatch(JSON.stringify(res.body), /key|secret|google/i);
    assert.deepEqual(logged, ["Gemini request failed (status 500)"]);
  }));

test("controller: missing configuration is a 503; an unexpected error goes to next() and is not sent to the client", () =>
  withStubs(async () => {
    geminiService.generate = async () => { throw new GeminiNotConfiguredError(); };
    assert.equal((await run(aiController.financialInsights, { body: {} })).res.statusCode, 503);

    geminiService.generate = async () => { throw new Error("boom " + SECRET); };
    const { res, nextCalled } = await run(aiController.financialInsights, { body: {} });
    assert.ok(nextCalled instanceof Error);
    assert.equal(res.body, undefined);
  }));

test("controller: a society outside the caller's scope is 403 before any existence check", () =>
  withStubs(async () => {
    let existsCalled = false;
    Society.exists = async () => { existsCalled = true; return null; };
    const { res } = await run(aiController.validateRequest, { body: { societyId: SOC }, scopeFilter: { _id: "64b7f8f2a1b2c3d4e5f6b002" } });
    assert.equal(res.statusCode, 403);
    assert.equal(existsCalled, false);
  }));

// ---- D-B10: the outbound request carries society-level figures only --------------------------
test("D-B10: the request sent to the provider has no transaction data, for the overview and for one society", () =>
  withStubs(async () => {
    const config = require("../../src/config/gemini");
    const saved = { key: config.apiKey, fetch: globalThis.fetch };
    config.apiKey = SECRET;
    const sent = [];
    globalThis.fetch = async (url, init) => {
      sent.push({ url, init });
      return ok({ candidates: [{ content: { parts: [{ text: "fine" }] } }] });
    };
    // Even if transaction rows existed with identifiable text, nothing can reach the prompt:
    // the code only calls aggregate (sums) and Transaction.find throws if it is ever called.
    Transaction.aggregate = async () => [
      { _id: { society: SOC, type: "EXPENSE" }, total: 600 },
      { _id: { society: SOC, type: "INCOME" }, total: 50 },
    ];
    try {
      for (const body of [{}, { societyId: SOC }]) {
        const { res } = await run(aiController.financialInsights, { body });
        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      }
    } finally {
      config.apiKey = saved.key;
      globalThis.fetch = saved.fetch;
    }

    assert.equal(sent.length, 2);
    for (const { init } of sent) {
      const payload = JSON.parse(init.body);
      assert.deepEqual(Object.keys(payload), ["contents"]);
      const text = payload.contents[0].parts[0].text;
      assert.match(text, /Computer Society|CS:/);
      assert.doesNotMatch(init.body, /EXPENSE|INCOME|description|category|transaction|Workshop/i);
      assert.ok(!init.body.includes(SECRET), "the key is a header, not part of the body");
    }
  }));
