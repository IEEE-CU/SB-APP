# CHANGELOG

## 2026-10-29 — Orchestration setup
- Committed the authorised existing work on `feature/sb-app-security-hardening`: `70ff8bd`
  "fix: complete DM recipient discovery and rate-limit coverage" (6 files, +548/−13; parent `e38c777`).
  Closes in the register: AUD-033 (verified complete), AUD-034 test coverage. `digest.txt` untouched and still untracked.
- Tests behind that commit were run earlier the same day (AUD-035 baseline, observed): backend unit 681/681; backend
  integration 38 files 589/589; frontend node 40/40; typecheck/lint(0 errors)/build OK; browser 25 (one
  intermittent `socket-reconnect` failure recorded in NEW-10, rerun 4/4). Not re-run at commit time (files unchanged).
- Created `D:\SB-APP-orchestration` (plan, register of 64 findings, rules, task board, decisions, scripts, reports).
- Batch 1 opened: NEW-07/AUD-025, NEW-11, NEW-06/AUD-022 (see TASK_BOARD.md).

(Entries for completed batches are added by the coordinator after independent verification.)

## 2026-10-29 - Batch 1 implemented in worktrees (NOT integrated; nothing committed on the agent branches)
Branches: agent/batch1-terms (A), agent/batch1-announcements (B), agent/batch1-qa (C, read-only); all at 70ff8bd with uncommitted work.
- NEW-07 / AUD-025 (terms): fixed in worktree and verified. Same-society/admin reads only; budgets need finance:view; emails admin-only (D-01 open).
- NEW-11: race CONFIRMED (coordinator red check: eight simultaneous creations produced duplicates) and fixed (model loaded at start-up, init() awaited before the write, 503 if the index cannot be built).
- NEW-06 / AUD-022 (announcements): UI/service/backend contract aligned; D-A2 enforced on POST and PATCH; 4 existing tests' expectations changed by policy.
- Executed by the coordinator: terms tree unit 121/121, integration 70/70 (16 new); announcements tree unit 32/32, integration 65/65 (18 new), browser 2/2 (new), typecheck/lint/build/frontend node OK. Harness cleanup clean every run.
- New finding: NEW-26 (terms handover PATCH allows any society member to write).
- Not yet run: combined A+B tree regression, full suites, red check of the browser spec on the old frontend.
- No agent committed or pushed; no persistent database; digest.txt untouched.

## 2026-10-29 - Batch 1 integration worktree built and regression-gated (NOT committed, NOT merged)
Worktree `D:\SB-APP-worktrees\batch1-integration` (branch integration/batch1 at 70ff8bd, 13 uncommitted entries).
Changes added by the coordinator: D-23 (handover PATCH needs society scope + existing `settings:edit`, admins pass) and D-21 (404 for a nonexistent society, 400 malformed, before the index wait). D-20 deferred.
Independently executed (coordinator), final tree:
- Backend unit, all 47 files: 709/709. Backend eslint: 0 errors (11 warnings, baseline). Backend syntax typecheck: 217 files OK.
- Backend integration, all 41 files: 635/635 pass in the final tree. First gate run: 40 files green, `society-terms.integration.test.js` 15/16 (1 FAIL, see below); corrected file rerun 17/17.
- Frontend: typecheck clean; lint 0 errors / 10 warnings (baseline count); build OK; Node tests 40/40.
- Browser (6 specs, 27 tests): announcement-create 2/2, community-and-channel 5/5, dm-recipients 3/3, password-session 5/5, reactions-and-community-access 8/8 on first attempt; socket-reconnect FAILED on its first attempt (1 passed, 1 failed, 2 not run) and passed 4/4 on a disclosed standalone rerun.
- Red checks (new tests copied onto baseline code in the qa worktree, then removed): D-23/D-21 file 2 of 11 fail (member can change handover; nonexistent society accepted) - the other 9 are controls; announcement browser spec fails on the baseline frontend (original missing-audience defect).
Failure record (kept, not hidden):
1. `society-terms.integration.test.js` handover test failed in the combined run: a TEST/FIXTURE consequence of D-23 (the file's chair had finance:view but not settings:edit). Production behavior was correct. Fixed by granting settings:edit in that file's setup, asserting 403 for the member, and adding a settings:edit-without-finance:view test so handover response shaping is still covered. Output: reports/gate/integ2.raw.
2. `socket-reconnect.spec.ts` test 2 ("reconnect after a password change...") failed at the `dropConnection` helper (websocket did not close when offline within 20 s). Same test, same step as the AUD-035 baseline failure on 70ff8bd (no Batch 1 code) => independent of Batch 1 (NEW-10). Observed pattern, NOT a verified cause: both failures happened when the spec ran last in a chain of browser specs; all standalone runs (3) passed. Evidence: reports/gate/artifacts-socket-reconnect (trace + error-context), rerun in reports/gate/browser-socket-reconnect-RERUN1.raw.
Provenance: agent-reported figures (reports/*_agent*_raw.txt) were independently re-run by the coordinator on the agent worktrees before integration (see earlier entry); the figures above are coordinator-run on the integration tree.
Distinct totals now (final tree): unit 709, integration 635, frontend Node 40, browser 27 = 1,411 (AUD-035 baseline 1,335: +28 unit, +46 integration, +2 browser).
Not run: contract suite and e2e.spec.ts (target localhost:5000, excluded by instruction), npm audit, the full browser suite repeated.
Safety: no commit/push/merge; agent branches and worktrees untouched; digest.txt untouched; only the isolated harness used; no mongod/listener/lock left.
Cleanup incident: while restoring the qa worktree after a red check I deleted its 6 TRACKED frontend/test-results files by an over-broad Remove-Item; restored with git checkout of exactly those paths; qa verified clean at 70ff8bd.

## 2026-10-29 - Batch 2 preflight
Read-only preflight and planning only; see BATCH2_CHANGELOG.md. No code, branch or worktree changes.

## 2026-10-29 - Batch 2 candidate integration/batch2 gated (uncommitted); NEW-08 and AUD-013 fixed there. See BATCH2_CHANGELOG.md.
