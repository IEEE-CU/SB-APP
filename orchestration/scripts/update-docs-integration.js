// Coordinator: records the Batch 1 integration worktree results. Edits only files in D:\SB-APP-orchestration.
const fs = require("fs");
const ROOT = "D:/SB-APP-orchestration/";
const read = (f) => fs.readFileSync(ROOT + f, "utf8");
const write = (f, s) => fs.writeFileSync(ROOT + f, s);

// ---- DECISIONS: record approvals (2026-10-29)
let d = read("DECISIONS.md");
d = d.replace(
  "## Pending (needed before the related work can start)",
  [
    "## Approved (user, Batch 1 integration authorization, 2026-10-29)",
    "- **D-01** Chair/treasurer emails stay administrator-only. Budgets additionally require the existing `finance:view` permission. (Implemented by Agent A; coordinator-verified.)",
    "- **D-22** Preserve legacy announcement behavior: non-admin creators may edit title/content of their legacy `LEADERSHIP` announcements but cannot change the audience; non-admins cannot edit legacy `ALL` or other-society announcements. (Implemented by Agent B pass 2; coordinator-verified.)",
    "- **D-23** Restrict society-term handover PATCH writes to administrators and authorized office bearers of the relevant society, reusing existing role/permission mechanisms. **Implemented as:** `societyAccess` (admin or a user of that society) then, for non-administrators, the existing RBAC permission `settings:edit` (same rule as `PATCH /societies/:id`; the matrix grants it to `society_chair`, `society_faculty_advisor`, `sb_chair`, `sb_faculty_advisor`). Legacy `ADMIN` passes without an RBAC role. Interpretation to confirm: `settings:edit` was chosen as the existing mechanism for \"authorized office bearers\"; treasurers, vice-chairs, secretaries and webmasters do NOT hold it, so they cannot update a handover.",
    "- **D-20** Duplicate-term error-message changes deferred (no change made; the loser of a duplicate still gets the generic error-handler 400).",
    "- **D-21** Creating a term for a nonexistent society is refused: 404 \"Society not found\" (400 for a malformed id), checked before the index wait; the startup model load and `init()` readiness guard are unchanged (503 if the index cannot be built).",
    "",
    "## Pending (needed before the related work can start)",
  ].join("\n"),
);
// remove the now-decided rows from the pending table
d = d.replace(/^\| D-01 \|.*\n/m, "").replace(/^\| D-20 \|.*\n/m, "").replace(/^\| D-21 \|.*\n/m, "").replace(/^\| D-22 \|.*\n/m, "").replace(/^\| D-23 \|.*\n/m, "");
d +=
  "| D-24 | Confirm `settings:edit` as the \"authorized office bearer\" rule for term handover (treasurers cannot update a handover; alternatives: also `finance:edit` for `balanceReconciled`, or `reports:edit`) | NEW-26 | Raised while implementing D-23 |\n" +
  "| D-25 | Legacy `ALL`/foreign-society announcements by non-admins stay un-editable by them (D-22 as approved); no action unless you want a migration | AUD-022 | Informational |\n";
write("DECISIONS.md", d);

// ---- TASK_BOARD
let t = read("TASK_BOARD.md");
t += `
## Batch 1 integration worktree (2026-10-29)
Worktree \`D:\\SB-APP-worktrees\\batch1-integration\`, branch \`integration/batch1\`, based on 70ff8bd, NOTHING committed (13 uncommitted entries).
Built by copying the 11 verified files from the terms (3) and announcements (8) worktrees (byte-identical, hashes in \`reports/2026-10-29_integration-baseline-manifest.txt\`), then coordinator changes for D-23/D-21 (below).
Agent worktrees unchanged since the manifest (0 hash differences); qa clean; protected checkout unchanged.

| Item | Owner | Status | Evidence |
|---|---|---|---|
| D-23 handover authorization | coordinator (integration worktree) | VERIFIED | red check: member case fails on baseline; unit + integration pass |
| D-21 nonexistent society | coordinator | VERIFIED | red check: nonexistent-society case fails on baseline; unit + integration pass |
| Combined regression gate | coordinator | RUN - see CHANGELOG / reports/gate | one flaky browser spec (NEW-10), one test fixed (see below) |

Coordinator-changed or coordinator-added files in the integration worktree:
- \`backend/src/routes/societies.js\` (D-23 guard + D-21 existence check on top of Agent A's change)
- \`backend/test/unit/society-access.test.js\` (handover route now carries the permission check: shape 3 layers)
- \`backend/test/unit/society-terms.test.js\` (Agent A's file + Society.exists stub, 3-layer handover shape, 9 new unit tests)
- \`backend/test/integration/society-terms-authorization.integration.test.js\` (new, 11 tests)
- \`backend/test/integration/society-terms.integration.test.js\` (Agent A's file; setup grants settings:edit to society_chair, member test asserts 403, +1 test for a settings:edit holder without finance:view)
`;
write("TASK_BOARD.md", t);

// ---- CHANGELOG
let c = read("CHANGELOG.md");
c += `
## 2026-10-29 - Batch 1 integration worktree built and regression-gated (NOT committed, NOT merged)
Worktree \`D:\\SB-APP-worktrees\\batch1-integration\` (branch integration/batch1 at 70ff8bd, 13 uncommitted entries).
Changes added by the coordinator: D-23 (handover PATCH needs society scope + existing \`settings:edit\`, admins pass) and D-21 (404 for a nonexistent society, 400 malformed, before the index wait). D-20 deferred.
Independently executed (coordinator), final tree:
- Backend unit, all 47 files: 709/709. Backend eslint: 0 errors (11 warnings, baseline). Backend syntax typecheck: 217 files OK.
- Backend integration, all 41 files: 635/635 pass in the final tree. First gate run: 40 files green, \`society-terms.integration.test.js\` 15/16 (1 FAIL, see below); corrected file rerun 17/17.
- Frontend: typecheck clean; lint 0 errors / 10 warnings (baseline count); build OK; Node tests 40/40.
- Browser (6 specs, 27 tests): announcement-create 2/2, community-and-channel 5/5, dm-recipients 3/3, password-session 5/5, reactions-and-community-access 8/8 on first attempt; socket-reconnect FAILED on its first attempt (1 passed, 1 failed, 2 not run) and passed 4/4 on a disclosed standalone rerun.
- Red checks (new tests copied onto baseline code in the qa worktree, then removed): D-23/D-21 file 2 of 11 fail (member can change handover; nonexistent society accepted) - the other 9 are controls; announcement browser spec fails on the baseline frontend (original missing-audience defect).
Failure record (kept, not hidden):
1. \`society-terms.integration.test.js\` handover test failed in the combined run: a TEST/FIXTURE consequence of D-23 (the file's chair had finance:view but not settings:edit). Production behavior was correct. Fixed by granting settings:edit in that file's setup, asserting 403 for the member, and adding a settings:edit-without-finance:view test so handover response shaping is still covered. Output: reports/gate/integ2.raw.
2. \`socket-reconnect.spec.ts\` test 2 ("reconnect after a password change...") failed at the \`dropConnection\` helper (websocket did not close when offline within 20 s). Same test, same step as the AUD-035 baseline failure on 70ff8bd (no Batch 1 code) => independent of Batch 1 (NEW-10). Observed pattern, NOT a verified cause: both failures happened when the spec ran last in a chain of browser specs; all standalone runs (3) passed. Evidence: reports/gate/artifacts-socket-reconnect (trace + error-context), rerun in reports/gate/browser-socket-reconnect-RERUN1.raw.
Provenance: agent-reported figures (reports/*_agent*_raw.txt) were independently re-run by the coordinator on the agent worktrees before integration (see earlier entry); the figures above are coordinator-run on the integration tree.
Distinct totals now (final tree): unit 709, integration 635, frontend Node 40, browser 27 = 1,411 (AUD-035 baseline 1,335: +28 unit, +46 integration, +2 browser).
Not run: contract suite and e2e.spec.ts (target localhost:5000, excluded by instruction), npm audit, the full browser suite repeated.
Safety: no commit/push/merge; agent branches and worktrees untouched; digest.txt untouched; only the isolated harness used; no mongod/listener/lock left.
Cleanup incident: while restoring the qa worktree after a red check I deleted its 6 TRACKED frontend/test-results files by an over-broad Remove-Item; restored with git checkout of exactly those paths; qa verified clean at 70ff8bd.
`;
write("CHANGELOG.md", c);

// ---- MASTER_TODO
let m = read("MASTER_TODO.md");
m = m.replace(
  "- NEW-26 (new, found in Batch 1):",
  [
    "- UPDATE (integration worktree, uncommitted): D-23 and D-21 implemented and gated; NEW-26 (handover authorization) is FIXED in `integration/batch1` (pending D-24 confirmation of the `settings:edit` rule); D-21 closes the nonexistent-society hole. Combined gate: unit 709, integration 635, browser 27 (one flaky spec, NEW-10), frontend OK. Statuses below remain at the AUD-035 baseline until you approve integration.",
    "- NEW-10 evidence added: `socket-reconnect.spec.ts` test 2 failed on its first attempt in two separate chain runs (AUD-035 baseline on 70ff8bd; Batch 1 gate), passes standalone (3/3). Not caused by Batch 1.",
    "- NEW-26 (new, found in Batch 1):",
  ].join("\n"),
);
write("MASTER_TODO.md", m);

// ---- standalone gate report
write(
  "reports/2026-10-29_batch1-integration-report.md",
  `# Batch 1 integration report (coordinator, 2026-10-29)

Worktree: D:\\SB-APP-worktrees\\batch1-integration, branch integration/batch1, base 70ff8bd, uncommitted.

## Changed files (13)
Modified: backend/src/routes/announcements.js; backend/src/routes/societies.js; backend/test/integration/announcement-ownership.integration.test.js; backend/test/unit/announcement-ownership.test.js; backend/test/unit/society-access.test.js; frontend/src/pages/announcements/AnnouncementFormPage.tsx; frontend/src/services/announcements.ts; frontend/src/types/models.ts.
New: backend/test/integration/announcement-create.integration.test.js; backend/test/integration/society-terms-authorization.integration.test.js; backend/test/integration/society-terms.integration.test.js; backend/test/unit/society-terms.test.js; frontend/tests/session/announcement-create.spec.ts.
Provenance: announcements.js, AnnouncementFormPage.tsx, announcements.ts, models.ts, announcement-create* and the announcement ownership tests = Agent B (byte-identical copies); societies.js base + society-terms tests = Agent A, plus coordinator additions (D-23, D-21, test updates) listed in TASK_BOARD.md.

## Gate (coordinator-run, raw output in reports/gate/)
unit 709/709; backend eslint 0 errors; integration 41 files: 40 green first time, society-terms 15/16 then 17/17 after fixing the test fixture for D-23; frontend typecheck/lint/build/Node 40/40 OK; browser 27 tests: 23 first-attempt green + socket-reconnect first attempt FAILED (flaky NEW-10), standalone rerun 4/4.

## Contracts
No UI code calls the term endpoints (only unused wrappers in frontend/src/services/societies.ts), so the new 403/404/field-redaction behavior cannot break a page. The announcement form is the only caller of announcement create/update and matches the backend contract (targetAudience, societyId for SOCIETY).

## Open risks
- D-24: settings:edit holders only (chair, society faculty advisor, sb chair, sb faculty advisor) can update a handover; treasurers cannot.
- NEW-10 flaky browser spec unresolved.
- Legacy data: duplicate (society, academicYear) rows would make term creation return 503; legacy announcements by non-admins as ALL/foreign cannot be edited by them (D-22).
- Not exercised: contract suite/e2e (localhost:5000), npm audit.
`,
);
console.log("docs updated");
