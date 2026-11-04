// Live progress board for SB-APP. Loopback only (127.0.0.1:8099), read-only, no secrets.
// GET /           -> index.html
// GET /data.json  -> board-data.json (hand-maintained lists) + live data from Paperclip (127.0.0.1:3100) and read-only git
// Exits by itself after MAX_HOURS.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = 8099;
const MAX_HOURS = 8;
const COMPANY = "18593b48-1149-4280-aa92-2316368f4961";
const DIR = __dirname;
const COMPLETION = path.join(DIR, "..");
const WORKTREES = [
  ["D:/SB-APP", "protected checkout"],
  ["D:/SB-APP-worktrees/combined", "combined (3 commits)"],
  ["D:/SB-APP-worktrees/wave2-backend", "backend agent"],
  ["D:/SB-APP-worktrees/wave2-frontend", "frontend agent"],
  ["D:/SB-APP-worktrees/batch2-ci", "CI agent (DevOps)"],
  ["D:/SB-APP-worktrees/batch1-integration", "batch 1 (old)"],
  ["D:/SB-APP-worktrees/batch2-integration", "batch 2 (old)"],
];

function getJson(p) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: 3100, path: p, timeout: 4000 }, (res) => {
      let s = "";
      res.on("data", (d) => (s += d));
      res.on("end", () => { try { resolve(JSON.parse(s)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}
function git(args) {
  return new Promise((resolve) => execFile("git", args, { timeout: 8000, windowsHide: true }, (err, out) => resolve(err ? null : out.trim())));
}

let cache = { at: 0, data: null };
async function live() {
  if (Date.now() - cache.at < 8000 && cache.data) return cache.data;
  const [agentsRaw, issuesRaw, health] = await Promise.all([
    getJson(`/api/companies/${COMPANY}/agents`),
    getJson(`/api/companies/${COMPANY}/issues`),
    getJson("/api/health"),
  ]);
  const agents = Array.isArray(agentsRaw) ? agentsRaw : (agentsRaw && agentsRaw.agents) || [];
  const issues = Array.isArray(issuesRaw) ? issuesRaw : (issuesRaw && (issuesRaw.issues || issuesRaw.items)) || [];

  // runs and cost per agent
  const runsPerAgent = await Promise.all(
    agents.map((a) => getJson(`/api/companies/${COMPANY}/heartbeat-runs?agentId=${a.id}&limit=30`)),
  );
  const agentRows = agents.map((a, i) => {
    const runs = Array.isArray(runsPerAgent[i]) ? runsPerAgent[i] : [];
    const cost = runs.reduce((t, r) => t + ((r.resultJson && r.resultJson.total_cost_usd) || 0), 0);
    const last = runs[0];
    return {
      name: a.name, role: a.role, status: a.status, budget: (a.budgetMonthlyCents || 0) / 100,
      spent: Math.round(cost * 100) / 100, runs: runs.length,
      lastRun: last ? { status: last.status, at: last.finishedAt || last.startedAt } : null,
    };
  });
  const issueRows = issues
    .map((x) => ({ id: x.identifier || x.id, title: x.title, status: x.status, assignee: (agents.find((a) => a.id === x.assigneeAgentId) || {}).name || "-", updated: x.updatedAt }))
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));

  const trees = await Promise.all(WORKTREES.map(async ([p, label]) => {
    const [head, status, branch] = await Promise.all([
      git(["-C", p, "rev-parse", "--short", "HEAD"]),
      git(["-C", p, "status", "--short"]),
      git(["-C", p, "branch", "--show-current"]),
    ]);
    return { label, branch: branch || "?", head: head || "?", dirty: status === null ? null : status.split("\n").filter((l) => l.trim() && !l.includes("digest.txt")).length };
  }));

  let docs = [];
  try {
    docs = fs.readdirSync(COMPLETION).filter((f) => f.endsWith(".md")).map((f) => ({ f, t: fs.statSync(path.join(COMPLETION, f)).mtimeMs }));
    const agentDir = path.join(COMPLETION, "agents");
    if (fs.existsSync(agentDir)) for (const d of fs.readdirSync(agentDir)) {
      const dd = path.join(agentDir, d);
      if (fs.statSync(dd).isDirectory()) for (const f of fs.readdirSync(dd)) docs.push({ f: `agents/${d}/${f}`, t: fs.statSync(path.join(dd, f)).mtimeMs });
    }
    docs.sort((a, b) => b.t - a.t);
    docs = docs.slice(0, 8).map((d) => ({ f: d.f, at: new Date(d.t).toISOString() }));
  } catch { /* ignore */ }

  const totalSpent = Math.round(agentRows.reduce((t, a) => t + a.spent, 0) * 100) / 100;
  cache = { at: Date.now(), data: { at: new Date().toISOString(), paperclipUp: Boolean(health), agents: agentRows, issues: issueRows, trees, docs, totalSpent, companyBudget: 200 } };
  return cache.data;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== "GET") { res.writeHead(405); return res.end(); }
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return fs.createReadStream(path.join(DIR, "index.html")).pipe(res);
    }
    if (req.url.startsWith("/data.json")) {
      const board = JSON.parse(fs.readFileSync(path.join(DIR, "board-data.json"), "utf8"));
      const body = JSON.stringify({ board, live: await live() });
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(body);
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("error");
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Live board: http://127.0.0.1:${PORT} (stops itself after ${MAX_HOURS} h)`));
setTimeout(() => process.exit(0), MAX_HOURS * 3600 * 1000);
