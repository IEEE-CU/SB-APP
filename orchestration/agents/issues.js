// Task queue for the specialist agents. Usage: node issues.js <key>   (posts that one issue to Paperclip)
const fs = require("fs");
const os = require("os");
const http = require("http");

const COMPANY = "18593b48-1149-4280-aa92-2316368f4961";
const NAMES = { security: "Security Lead", reviewer: "Independent Reviewer", devops: "DevOps / CI Engineer", qa: "QA Engineer", backend: "Backend Engineer", frontend: "Frontend / UI-UX Lead", ceo: "CEO" };

const RULES = "Rules: follow your instruction file and D:\\SB-APP-orchestration\\completion\\CHARTER.md. No commits/merges/pushes/installs. Never touch digest.txt. Do not edit permission settings. If a permission is denied or a decision is missing, record it in your report and stop that item. When done (or blocked), write your report to the path below, post a short summary comment, and STOP. Do not start other tasks.";

const ISSUES = {
  security: {
    title: "Wave 1: SEC-02 follow-up, NEW-14 backup/restore design review, importer/scraper audit",
    description: `Read-only, no decision needed, no harness. Three parts, one report.\n\n1. SEC-02 follow-up: is the root-manifest 'tar' critical actually reachable? Confirm whether D:\\SB-APP\\package.json (root) is ever invoked at runtime (check its "main"/"scripts.start" and whether anything actually runs it, vs backend/frontend having their own manifests) and whether the root 'bcrypt' dependency that pulls in tar/@mapbox/node-pre-gyp is imported anywhere outside node_modules.\n2. NEW-14 backup/restore safety: read backend/src/scripts/backup.js and restore.js (and anything they call). Report: are password hashes included in plaintext exports; is restore atomic (all-or-nothing) or can it leave a half-restored state; can a legacy report block a backup. Propose a design fix for each (no code change, no real backup/restore run).\n3. Importer/scraper audit (NEW-24, AUD-030, NEW-25): read backend/src/routes/importers.js and any scraper/URL-fetching code. Check URL validation, SSRF protections (do not weaken them), input validation, duplicate-import handling, size limits, and any stored URL field (avatar/logo/image) that is never validated. Produce a test matrix (success / failure / malformed / unauthorized / edge cases) as a proposal, not code.\n\n${RULES}\n\nReport: D:\\SB-APP-orchestration\\completion\\agents\\security\\2026-11-01-wave1.md`,
  },
  reviewer: {
    title: "Wave 1: hold — nothing new to review yet",
    description: `No task this wave. Wave 1 is producing reports and read-only investigations from the other five agents; there is nothing new to review until those land. Do nothing and do not pick up other work. ${RULES}\n\nIf you are reading this, just reply that there is nothing to do yet and stop.`,
  },
  devops: {
    title: "Wave 1: NEW-19 fix proposal, F-06 investigation",
    description: `Read-only / proposal-only, no decision needed, no harness, no code edits applied.\n\n1. NEW-19: frontend/tests/e2e.spec.ts targets a live backend on localhost:5000 (unsafe legacy pattern). Read it and playwright.session.config.ts (the safe isolated pattern already used elsewhere). Write an exact PROPOSED replacement for e2e.spec.ts using the isolated harness pattern (do not apply it; describe or diff it in your report only).\n2. F-06: ten backend areas were found with no frontend services/ client module (dashboard, notes, sprints, transactions, boards, tasks, notifications, institution, rbac, audit logs — see 06-api-and-database-audit.md Flag E). For each, grep the frontend for any inline fetch/axios call to that area's routes (not through services/) to determine: consumed inline (name the file), or genuinely unused. Report per area.\n\n${RULES}\n\nReport: D:\\SB-APP-orchestration\\completion\\agents\\devops\\2026-11-01-wave1.md`,
  },
  qa: {
    title: "Wave 1: NEW-05 browser-test proposal, NEW-20 investigation",
    description: `Proposal/read-only only. Do NOT run the harness or any browser test this task.\n\n1. NEW-05: task creation already enforces society scope on the backend (see backend/test/unit/task-create-society.test.js and its integration test) but has no browser-level regression test. Write (as a new file, do not run it) a Playwright session spec proposal that exercises task creation through the UI for: own-society success, cross-society rejection, no-society rejection — following the existing style in frontend/tests/session/*.spec.ts.\n2. NEW-20 (duplicate permission requests): read the RBAC middleware and resolvePermissions to find anywhere the same permission check appears to run more than once per request (e.g. requirePermission called twice, or attachScope re-deriving what requirePermission already resolved). Report every instance found, with file:line, and whether it is just wasteful or could cause inconsistent results.\n\n${RULES}\n\nReport: D:\\SB-APP-orchestration\\completion\\agents\\qa\\2026-11-01-wave1.md`,
  },
  backend: {
    title: "Wave 1: NEW-23 and NEW-21 investigation (read-only, no code change)",
    description: `Worktree: D:\\SB-APP-worktrees\\wave2-backend. Read-only investigation only this task — do NOT edit any file, do NOT touch your existing uncommitted NEW-22 change.\n\n1. NEW-23: read the Event/EventRegistration and Project/ProjectReport models and routes for legacy data mismatches (duplicate registrations, orphaned rows referencing a deleted parent, eligibility/cancelled-event re-registration edge cases). Propose an approach (validation added, or a one-off read-only report script) — NO migration, NO data change.\n2. NEW-21: search for auditLogger / logAudit definitions and every call site. Report whether it is genuinely dormant (defined but never called) or partially wired, and which actions currently go unaudited that probably should be (e.g. denied access attempts, per AUD-023).\n\n${RULES}\n\nReport: D:\\SB-APP-orchestration\\completion\\agents\\backend\\2026-11-01-wave1.md`,
  },
  frontend: {
    title: "Wave 1: extend the frontend functional audit (second static pass)",
    description: `Read-only, no code change. Worktree: D:\\SB-APP-worktrees\\wave2-frontend (do not touch your existing uncommitted batch-1 changes).\n\nRead completion\\05-functional-audit.md (the first pass, which covered routes/guards, the permission model, 429 handling, double-submit protection, and API usage). Extend it with a SECOND pass over the pages/workflows not yet covered: events (list/detail/form), projects (list/detail/form), tasks (TasksPage, KanbanBoardView), calendar, societies (list/detail/form), admin/users. For each: loading/empty/error states present or missing, obvious dead buttons or unreachable branches, any other double-submit or 429-handling gaps like the ones already found. Append your findings to 05-functional-audit.md (do not rewrite the first pass) with a clear "## Second pass (Wave 1)" heading.\n\n${RULES}\n\nReport: append to D:\\SB-APP-orchestration\\completion\\05-functional-audit.md; also write a short D:\\SB-APP-orchestration\\completion\\agents\\frontend\\2026-11-01-wave1.md summary.`,
  },
  ceo: {
    title: "Wave 1: consolidate the CI/dependency audit doc, update the roadmap",
    description: `Document-only, read-only on the repo.\n\n1. Write D:\\SB-APP-orchestration\\completion\\13-ci-and-dependency-audit.md consolidating what already exists: DEP-01 (completion\\agents\\security\\2026-11-01-DEP-01.md), AUD-015/AUD-014 findings (completion\\03-agent-c-report.md), and the npm audit summary (completion\\raw\\c4-audit-summary.md). This is a consolidation of existing findings into the charter's named document, not new investigation.\n2. Update D:\\SB-APP-orchestration\\completion\\01-master-roadmap.md to reflect the current wave plan (D:\\SB-APP-orchestration\\completion\\17-wave-plan.md) and the true phase status in MASTER-TODO.md.\n\n${RULES}\n\nReport: the two files above, plus a short summary comment.`,
  },
};

if (require.main === module) {
  const key = process.argv[2];
  if (!ISSUES[key]) { console.error("keys:", Object.keys(ISSUES).join(", ")); process.exit(2); }
  const agents = JSON.parse(fs.readFileSync(os.homedir() + "/pc-agents.json", "utf8"));
  const list = Array.isArray(agents) ? agents : agents.agents;
  const agent = list.find((a) => a.name === NAMES[key]);
  if (!agent) { console.error("agent not found:", NAMES[key]); process.exit(3); }
  const body = JSON.stringify({ title: ISSUES[key].title, description: ISSUES[key].description, assigneeAgentId: agent.id });
  const req = http.request({ host: "127.0.0.1", port: 3100, method: "POST", path: `/api/companies/${COMPANY}/issues`, headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (res) => {
    let s = ""; res.on("data", (d) => (s += d)); res.on("end", () => { try { const j = JSON.parse(s); console.log(j.identifier || "", j.id || s.slice(0, 200), "status:", j.status); } catch { console.log(s.slice(0, 300)); } });
  });
  req.write(body); req.end();
}
module.exports = { ISSUES, NAMES };
