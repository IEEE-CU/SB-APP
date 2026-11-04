// Edits board-data.json in place (hand-maintained lists for the live board). Idempotent per run: pass edits below.
const fs = require("fs");
const f = "D:/SB-APP-orchestration/completion/dashboard/board-data.json";
const B = JSON.parse(fs.readFileSync(f, "utf8"));
const col = (title) => B.cols.find((c) => c.title.startsWith(title));
const dropItem = (c, needle) => { const i = c.items.findIndex((x) => x[0].includes(needle)); if (i >= 0) c.items.splice(i, 1); };
const addItem = (c, item, before) => {
  if (c.items.some((x) => x[0] === item[0])) return;
  const i = before ? c.items.findIndex((x) => x[0].includes(before)) : -1;
  if (i >= 0) c.items.splice(i, 0, item); else c.items.push(item);
};

const done = col("Done"), wait = col("Waiting"), todo = col("Not started");

// ---- Done
addItem(done, ["Six specialist agents created, approved and fenced in", "Security, Backend, Frontend/UI-UX, QA, DevOps, Reviewer. Each can edit only its own folder; none can commit, push, merge or install. Sonnet model to keep cost down.", "ok"], "Phase 0:");
addItem(done, ["Spending cap set: $200 a month", "Split across agents with hard stops and an 80% warning.", "ok"], "Phase 0:");
addItem(done, ["Three local commits on integration/combined", "Batch 1, Batch 2 and the CI work, explicit file lists only. Not pushed, not merged.", "ok"], "Phase 0:");
addItem(done, ["Dependency fix plan (DEP-01), by the Security Lead", "proxy-addr fixed by a lockfile refresh (Express already allows it); the root tar critical comes only from an unused root bcrypt. Plan only, nothing installed. I spot-checked 3 claims.", "unv"], "Phase 0:");

// ---- Waiting on you
for (const n of ["Set a spending cap", "Authorization A2", "Authorization A3"]) dropItem(wait, n);
addItem(wait, ["Approve the dependency batches from DEP-01", "Lockfile refresh for in-range fixes (incl. proxy-addr 2.0.8) and removing the unused root bcrypt. Zod 4 and react-router 7 are major upgrades; plan says defer.", ""]);
addItem(wait, ["Give me the hosting facts for TRUST_PROXY (NEW-18)", "How is the app reached: directly, or behind how many proxies / which proxy addresses? Decides how serious proxy-addr is.", ""]);

addItem(done, ["Independent review of the 3 commits (REV-01)", "Reviewer agent, code reading only: no test weakened; commit 1 and 2 approved with changes; the CI commit held back until D-B5 and D-B7 are answered. Report in completion/agents/reviewer.", "ok"], "Phase 0:");
addItem(wait, ["Q1: should a legacy admin see term budgets?", "Today only finance:view unlocks budgets, so a legacy admin (no RBAC role) sees none, unlike the AI audit where they are allowed.", ""]);
addItem(wait, ["Q2: may budget and balance totals go to Google?", "The AI prompt sends society name, budget and balance (no transactions). Your D-B10 rule says no transaction data; are these totals acceptable?", ""]);
addItem(wait, ["Q3: which Gemini model, and who sets the key?", "Server default is gemini-1.5-pro; the old page used gemini-3-flash-preview. Without GEMINI_MODEL and GEMINI_API_KEY set on the server the AI audit answers 503.", ""]);

addItem(done, ["PWA and environment report (DevOps agent)", "Finding: the repository contains no PWA at all (no service worker, manifest or icons; every git ref searched). Also: no root .env.example, two example files that disagree, FRONTEND_URL undocumented.", "ok"], "Phase 0:");
addItem(wait, ["Q4: where is the PWA work from your history?", "It said 197 PWA tests passed, but no PWA code exists in this repo. Another repo, never saved, or should one be built?", ""]);
addItem(wait, ["Q5: add Cache-Control: no-store to API responses?", "The backend sends none today, so financial and personal data could be cached by a browser. Small recommended hardening; changes behaviour for every client.", ""]);
{ const p7 = B.phases.find((p) => p[0] === "7"); if (p7) p7[4] = "CI written, not run on GitHub; no PWA exists in the repo (Q4)"; }

{ const pw = todo.items.find((x) => x[0].startsWith("PWA runtime check")); if (pw) { pw[0] = "PWA runtime check (PWA-01): on hold"; pw[1] = "Nothing to check: no PWA exists in the repo. Waiting for your answer to Q4."; } }

addItem(done, ["Unit-test count gap explained (QA-03, QA agent)", "645 declared + 73 from three loop-driven files = 718 executed, exactly. I re-checked the table sizes and totals. No missing or skipped tests.", "ok"], "Phase 0:");

addItem(done, ["Backend: conversation sidebar fix, fully verified (NEW-22)", "I independently re-ran eslint (clean), the new test (8/8) and the pre-existing calendar-conversations-authz suite on the same tree (22/22, no regression). Uncommitted in wave2-backend.", "ok"], "Phase 0:");
addItem(done, ["Frontend: 4 small fixes reviewed (API-F2, FE-F1, NEW-09)", "I read every diff and re-ran the tests myself (53/53). Dead wrapper removed, 2 of 3 buttons now guarded against double-clicks (the 3rd never called the API at all - see Q6), and 429s now show one readable message. FE-F2 needs your answer (Q7).", "ok"], "Phase 0:");
addItem(wait, ["Q6: calendar events aren't saved to the backend at all", "Found while reviewing the frontend fixes: Save Event only updates local state. Intentional, or should it call the API?", ""]);
addItem(wait, ["Q7: which permission should gate each create/edit form page?", "societies/events/projects/reports/announcements new+edit routes have no permission check in the UI today (backend still enforces it).", ""]);
addItem(wait, ["Decide: commit the Backend and Frontend agent changes?", "Both fully reviewed and tested by me now (not just reported). Uncommitted in wave2-backend / wave2-frontend.", ""]);

// ---- Not started
dropItem(todo, "Dependency fix plan (DEP-01)");
const rev = todo.items.find((x) => x[0].startsWith("Independent review of the 32 files"));
if (rev) { rev[0] = "Independent review of the 3 commits (REV-01)"; rev[1] = "Given to the Reviewer agent as SBA-3: see the live panel."; }

dropItem(todo, "Independent review of the 3 commits");

// ---- stats
B.stats = [
  { cls: "done", n: done.items.length, t: `things finished: ${done.items.filter((x) => x[2] === "ok").length} verified, ${done.items.filter((x) => x[2] === "unv").length} written or code-read but not fully checked` },
  { cls: "wait", n: wait.items.length, t: "waiting on your decision or approval" },
  { cls: "todo", n: todo.items.length, t: "not started yet" },
  { cls: "bad", n: 3, t: "critical dependency packages, none upgraded (dompurify, proxy-addr, tar)" },
];

B.nextSteps = [
  "<b>Answer the open decisions</b> in the Waiting column: D-24, D-B5, D-B6, D-B7, D-26 to D-29, the dependency batches from DEP-01, and the hosting facts for the proxy setting.",
  "<b>Watch the agent queue</b> in the live panel above. Done so far: Security plan and the Reviewer. Next in the queue: DevOps (PWA and environment documents), QA (explain the test-count gap), Backend (conversation last-message preview), Frontend (429 handling and small fixes).",
  "<b>Review the coding agents' uncommitted changes</b> in their two worktrees before anything is committed.",
  "<b>Rerun the 8 unlaunched integration files and the flaky spec</b> once memory is free (close other programs first).",
  "<b>Prove the CI on GitHub</b> with one real run, then check the PWA in a browser.",
  "<b>Decide NEW-15:</b> should society faculty advisors be able to change any role's permissions across the whole app?",
];

const p2 = B.phases.find((p) => p[0] === "2"); if (p2) p2[4] = "Batch fixes done; dependency plan written, not applied";
const p1 = B.phases.find((p) => p[0] === "1"); if (p1) p1[4] = "Batch 1 and 2 re-run by me; independent review of the 3 commits is with the Reviewer agent";

B.risks = [
  ["High", "Nothing is pushed anywhere", "The 3 commits and every agent change exist only on this PC. A disk problem would lose them."],
  ["High", "3 critical dependency packages", "dompurify looks unreachable in current code; proxy-addr depends on your proxy setup; tar comes only from an unused root package. None upgraded."],
  ["Medium", "Agent spending", "$200 monthly cap with hard stops. The CEO used about $37 before the cap. Each finished task also triggers two cheap recovery runs (about $0.35)."],
  ["Medium", "NEW-10 flaky browser test", "Would make a CI browser job fail at random until fixed."],
  ["Medium", "CI never run on GitHub", "The workflow changes are only tested on this PC."],
  ["Medium", "Agent guardrails are best-effort", "No filesystem sandbox on Windows; relies on Claude permission rules. Tested: reads and edits are limited and git commit is refused."],
];

fs.writeFileSync(f, JSON.stringify(B, null, 1));
console.log("board updated:", B.stats.map((s) => s.n).join("/"));
