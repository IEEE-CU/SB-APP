// One-off coordinator script: records the verified Batch 1 results in the coordination documents.
// Reads and rewrites only files inside D:\SB-APP-orchestration.
const fs = require("fs");
const ROOT = "D:/SB-APP-orchestration/";
const read = (f) => fs.readFileSync(ROOT + f, "utf8");
const write = (f, s) => fs.writeFileSync(ROOT + f, s);

// ---- TASK_BOARD
let t = read("TASK_BOARD.md");
t = t.replace(/^(\| B1-T1 .*?\| A \| )(?:PLANNED|RUNNING)( \|)/m, "$1VERIFIED (email subtask BLOCKED)$2");
t = t.replace(/^(\| B1-T2 .*?\| A \| )(?:PLANNED|RUNNING)( \|)/m, "$1VERIFIED$2");
t = t.replace(/^(\| B1-T3 .*?\| B \| )(?:PLANNED|RUNNING)( \|)/m, "$1VERIFIED$2");
t = t.replace(/^(\| B1-T4 .*?\| C \| )(?:REPORTED|RUNNING|PLANNED)( \|)/m, "$1VERIFIED (report)$2");
t = t.replace(
  "- Pending: B1-T1/T2 (Agent A), B1-T3 (Agent B).",
  [
    "- B1-T1/T2 (Agent A, report `reports/2026-10-29_agentA_raw.txt`): coordinator-verified 2026-10-29 on the terms worktree. Unit society-terms/access/pii/patch-persistence 121/121 (society-terms alone 17). Integration society-terms 16/16, society-pii 12/12, society-authorization 14/14, society-patch 28/28.",
    "  Independent red check (coordinator copied the new test onto baseline 70ff8bd in the qa worktree, then removed it): 10 of 16 FAIL on baseline, including the NEW-11 race (8 simultaneous creations produced duplicates, no unique index) => NEW-11 CONFIRMED and fixed.",
    "  Production change only in backend/src/routes/societies.js (plus new tests); models untouched. Open: chair/treasurer emails are admin-only pending D-01; budgets are gated by the existing finance:view.",
    "- B1-T3 (Agent B first pass + follow-up B2, reports `...agentB_raw.txt`, `...agentB2_raw.txt`): coordinator-verified on the announcements worktree. Unit announcement-* 32/32. Integration announcement-create 18/18, announcement-ownership 21/21, announcement-visibility 26/26. Browser announcement-create 2/2. Frontend typecheck clean, lint 0 errors (10 warnings = baseline count), build OK, frontend node 40/40. Backend eslint clean.",
    "  Independent red check (create test on baseline): 2 of 18 FAIL (non-admin LEADERSHIP create; PATCH retarget to LEADERSHIP), exactly the D-A2 behaviors. The original UI-sends-no-targetAudience defect is covered only by the browser spec, which was NOT run against the old frontend.",
    "  Existing-test expectation changes (all D-A2 policy-driven; none deleted or skipped): announcement-ownership unit (3 tests switched LEADERSHIP -> own SOCIETY; 1 retarget test now asserts 403); announcement-ownership integration (create LEADERSHIP -> 403; retarget -> 403). Reviewed by the coordinator.",
    "- Cross-task: A and B changed disjoint file sets (0 overlapping paths). Combined-tree regression NOT yet run (agents did not commit; integration is gated on user approval).",
  ].join("\n"),
);
write("TASK_BOARD.md", t);

// ---- DECISIONS
let d = read("DECISIONS.md");
d = d.replace(
  /^\| D-01 \|.*$/m,
  "| D-01 | Who besides administrators may see chair/treasurer **emails** in society terms (budgets are already gated by the existing `finance:view`) | NEW-07 | Agent A evidence: no existing permission governs another user's account email (user data is readable only via admin-only `GET /users`); office-bearer emails on the society record are already visible to all authenticated users (AUD-025). Options: (a) keep admin-only (current, safest); (b) same-society callers also see them, matching the already-visible office-bearer emails; (c) gate on an existing permission such as `members:view` (a new use of that permission). Current implementation = (a). |",
);
d +=
  "| D-22 | Legacy announcements a non-admin created as `LEADERSHIP`: they may still edit title/content (audience unchanged). Legacy `ALL` / foreign-society posts by non-admins still cannot be edited. Keep, or treat alike? | AUD-022 | Raised by Agent B pass 2; implemented rule = only unchanged-audience LEADERSHIP edits are allowed |\n" +
  "| D-23 | `PATCH /societies/:id/terms/:termId/handover` is documented as admin or office bearer but guarded only by society membership (every non-admin account is a legacy OFFICE_BEARER). Restrict writes? | NEW-26 | Raised by Agent A; write-authorization, outside Batch 1 scope |\n";
write("DECISIONS.md", d);

// ---- CHANGELOG
let c = read("CHANGELOG.md");
c += [
  "",
  "## 2026-10-29 - Batch 1 implemented in worktrees (NOT integrated; nothing committed on the agent branches)",
  "Branches: agent/batch1-terms (A), agent/batch1-announcements (B), agent/batch1-qa (C, read-only); all at 70ff8bd with uncommitted work.",
  "- NEW-07 / AUD-025 (terms): fixed in worktree and verified. Same-society/admin reads only; budgets need finance:view; emails admin-only (D-01 open).",
  "- NEW-11: race CONFIRMED (coordinator red check: eight simultaneous creations produced duplicates) and fixed (model loaded at start-up, init() awaited before the write, 503 if the index cannot be built).",
  "- NEW-06 / AUD-022 (announcements): UI/service/backend contract aligned; D-A2 enforced on POST and PATCH; 4 existing tests' expectations changed by policy.",
  "- Executed by the coordinator: terms tree unit 121/121, integration 70/70 (16 new); announcements tree unit 32/32, integration 65/65 (18 new), browser 2/2 (new), typecheck/lint/build/frontend node OK. Harness cleanup clean every run.",
  "- New finding: NEW-26 (terms handover PATCH allows any society member to write).",
  "- Not yet run: combined A+B tree regression, full suites, red check of the browser spec on the old frontend.",
  "- No agent committed or pushed; no persistent database; digest.txt untouched.",
  "",
].join("\n");
write("CHANGELOG.md", c);

// ---- MASTER_TODO
let m = read("MASTER_TODO.md");
m = m.replace(
  "## Numbered findings (39)",
  [
    "## Batch 1 progress (2026-10-29) - fixed in agent worktrees, coordinator-verified, NOT yet integrated",
    "Status columns below keep the AUD-035 baseline until integration is approved and merged.",
    "- NEW-07 / AUD-025 (terms): fix verified in `agent/batch1-terms`; remaining: emails decision D-01.",
    "- NEW-11: race confirmed and fixed in `agent/batch1-terms`.",
    "- NEW-06 / AUD-022 (create contract): fix verified in `agent/batch1-announcements`; remaining: D-22 (legacy edge).",
    "- NEW-26 (new, found in Batch 1): `PATCH /societies/:id/terms/:termId/handover` guarded only by society membership [code]. Open defect, Medium, decision D-23, P2. Not part of the AUD-035 count of 64.",
    "",
    "## Numbered findings (39)",
  ].join("\n"),
);
write("MASTER_TODO.md", m);
console.log("docs updated");
