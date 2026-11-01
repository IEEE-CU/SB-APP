// Lead orchestrator patch, batch2-integration worktree only: D-B10 (no transaction data to Gemini)
// and D-B11 (legacy administrator authorization) plus their tests.
const fs = require("fs");
const SCRATCH = "C:/Users/ARRINP~1/AppData/Local/Temp/claude/D--SB-APP/bb7310cd-3ed4-4635-830b-71ec3776e1b5/scratchpad/";
const root = "D:/SB-APP-worktrees/batch2-integration/";

const toCrlf = (s) => s.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
function patch(rel, edits) {
  let s = fs.readFileSync(root + rel, "utf8");
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  for (const [a, b] of edits) {
    if (s.split(a).length !== 2) throw new Error(rel + ": anchor not unique/found: " + a.slice(0, 70));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(root + rel, crlf ? toCrlf(s) : s);
}

fs.writeFileSync(root + "backend/src/services/ai/financialSummary.js", toCrlf(fs.readFileSync(SCRATCH + "financialSummary.js", "utf8")));
fs.writeFileSync(root + "backend/src/routes/ai.js", toCrlf(fs.readFileSync(SCRATCH + "ai-route.js", "utf8")));

// ---- unit tests ----------------------------------------------------------------------------
patch("backend/test/unit/ai-gemini.test.js", [
  [
    `  const single = buildPrompt(
    { societies: [societies[0]], transactions: [{ type: "EXPENSE", amount: 600, category: "Events", description: "Workshop" }] },
    true,
  );
  assert.match(single, /"Computer Society" \\(CS\\)/);
  assert.match(single, /EXPENSE: ₹600 \\(Events - Workshop\\)/);`,
    `  const single = buildPrompt({ societies: [societies[0]] }, true);
  assert.match(single, /"Computer Society" \\(CS\\)/);
  assert.match(single, /Allocated Budget: ₹1000/);
  assert.match(single, /Current Balance: ₹400/);
  // D-B10: no transaction data in the prompt.
  assert.doesNotMatch(single, /EXPENSE|INCOME|transaction/i);`,
  ],
  [
    `  Transaction.find = () => chain([]);
  return`,
    `  // D-B10: transactions are only ever summed (aggregate); a record-level read is a failure.
  Transaction.find = () => { throw new Error("transaction records must not be read for the AI audit"); };
  return`,
  ],
]);

fs.appendFileSync(
  root + "backend/test/unit/ai-gemini.test.js",
  toCrlf(`
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
      assert.doesNotMatch(init.body, /EXPENSE|INCOME|description|category|transaction|Workshop|Events/i);
      assert.ok(!init.body.includes(SECRET), "the key is a header, not part of the body");
    }
  }));
`),
);

// ---- integration tests -----------------------------------------------------------------------
patch("backend/test/integration/ai-financial-insights.integration.test.js", [
  [
    `const insights = (key, body) =>`,
    `const insightsAs = (token, body) =>
  session.request(null, "POST", "/ai/financial-insights", { body, headers: { Authorization: \`Bearer \${token}\` } });
const insights = (key, body) =>`,
  ],
  [
    `describe("AUD-013: who may ask", () => {`,
    `// D-B11: the established administrator mechanism (legacy User.role ADMIN) works without any RBAC
// role; an RBAC administrator works through finance:view; an unrecognized role gets nothing.
async function account(label, mutate) {
  const email = \`ai-\${label}-\${Date.now()}@integration.test\`;
  const created = await target.registerAccount({ name: label, email, password: "Integration-Test-Pw-2026!" });
  const body = await created.json();
  assert.equal(created.status, 201, JSON.stringify(body).slice(0, 160));
  await withDatabase(target, (db, ObjectId) => mutate(db, ObjectId, new ObjectId(body.data.user.id)));
  return body.data.token;
}

describe("D-B11: administrators and unrecognized roles", () => {
  let legacyAdmin;
  let rbacAdmin;
  let strangeRole;

  before(async () => {
    legacyAdmin = await account("legacy-admin", (db, _O, id) => db.collection("users").updateOne({ _id: id }, { $set: { role: "ADMIN" } }));
    rbacAdmin = await account("rbac-admin", async (db, ObjectId, id) => {
      const role = await db.collection("roles").findOne({ name: "sb_faculty_advisor" });
      await db.collection("users").updateOne({ _id: id }, { $set: { role: "OFFICE_BEARER" } });
      await db.collection("userroles").insertOne({ user: id, role: role._id, society: null, assignedBy: new ObjectId(), assignedAt: new Date() });
    });
    strangeRole = await account("strange-role", (db, _O, id) => db.collection("users").updateOne({ _id: id }, { $set: { role: "SUPERUSER" } }));
  });

  test("a legacy administrator with no RBAC role is authorized and sees every society", async () => {
    assert.equal((await insightsAs(legacyAdmin, {})).status, NOT_AVAILABLE);
    assert.equal((await insightsAs(legacyAdmin, { societyId: A.id })).status, NOT_AVAILABLE);
    assert.equal((await insightsAs(legacyAdmin, { societyId: B.id })).status, NOT_AVAILABLE);
    assert.equal((await insightsAs(legacyAdmin, { societyId: NOBODY })).status, 404);
    assert.equal((await insightsAs(legacyAdmin, { prompt: "x" })).status, 400);
  });

  test("an RBAC administrator (sb_faculty_advisor, not a legacy ADMIN) is authorized through finance:view", async () => {
    assert.equal((await insightsAs(rbacAdmin, {})).status, NOT_AVAILABLE);
    assert.equal((await insightsAs(rbacAdmin, { societyId: B.id })).status, NOT_AVAILABLE);
  });

  test("an invalid legacy role with no RBAC role is refused, and a plain member still is", async () => {
    assert.equal((await insightsAs(strangeRole, {})).status, 403);
    assert.equal((await insights("memberA", {})).status, 403);
  });

  test("a garbage bearer token is 401", async () => {
    assert.equal((await insightsAs("not-a-token", {})).status, 401);
  });
});

describe("AUD-013: who may ask", () => {`,
  ],
]);
console.log("batch2 completion patch applied");
