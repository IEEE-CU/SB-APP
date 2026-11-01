# TASK_BOARD — Batch 1 (opened 2026-10-29)

Base: `70ff8bd` on `feature/sb-app-security-hardening`. Protected checkout: `D:\SB-APP` (not edited by agents).
Status values: PLANNED · RUNNING · BLOCKED · REPORTED (agent says done) · VERIFIED (coordinator observed) · INTEGRATED.

| Task | Title | Agent | Status | Worktree / branch | Findings |
|---|---|---|---|---|---|
| B1-T1 | Society terms: same-society reads, field-level protection | A | VERIFIED (email subtask BLOCKED) | `D:\SB-APP-worktrees\terms` / `agent/batch1-terms` | NEW-07, AUD-025 |
| B1-T2 | SocietyTerm first-write/index race: reproduce, fix only if confirmed | A | VERIFIED | same as B1-T1 | NEW-11 |
| B1-T3 | Announcement creation contract + audience policy | B | VERIFIED | `D:\SB-APP-worktrees\announcements` / `agent/batch1-announcements` | NEW-06, AUD-022 |
| B1-T4 | Independent NEW-11 investigation + Batch 1 coverage/isolation review (read-only) | C | VERIFIED (report) | `D:\SB-APP-worktrees\qa` / `agent/batch1-qa` | NEW-11 (verification) |

## File ownership (exclusive; edits outside the list need coordinator approval)
**Agent A** (`terms`)
- `backend/src/routes/societies.js` (the whole file is A's during Batch 1)
- `backend/src/models/SocietyTerm.js`
- `backend/src/models/index.js` — only if the NEW-11 fix requires model initialisation there
- new: `backend/test/unit/society-terms*.test.js`, `backend/test/integration/society-terms*.integration.test.js`
- existing `backend/test/integration/society-*.integration.test.js` — only if an assertion directly encodes the
  old `/terms` behavior; report any such edit explicitly
- Frontend: none (read-only). `frontend/src/services/societies.ts` is NOT owned; request if the contract changes.

**Agent B** (`announcements`)
- `backend/src/routes/announcements.js`
- `frontend/src/pages/announcements/AnnouncementFormPage.tsx`, `AnnouncementListPage.tsx`, `AnnouncementDetailPage.tsx`
- `frontend/src/services/announcements.ts`
- `frontend/src/types/models.ts` — the `Announcement` interface only
- new: `backend/test/unit/announcement-create*.test.js`, `backend/test/integration/announcement-create*.integration.test.js`,
  `frontend/tests/session/announcement-create.spec.ts`
- existing `announcement-ownership` / `announcement-visibility` tests — only if directly required; report any edit
- `backend/src/models/Announcement.js` is NOT owned (no schema change expected); request if needed.

**Agent C** (`qa`): no files. Read-only. Report goes to `reports/` via the coordinator.

**Never edited by agents in Batch 1:** helpers (`backend/test/integration/helpers/*`), `frontend/tests/session/support.ts`,
Playwright config, manifests/lockfiles, `server.js`, `routes/index.js`, `middleware/*`, conversation files,
anything in `D:\SB-APP`.

## Dependencies and sequencing
- B1-T1 and B1-T3 are independent (disjoint files). B1-T2 follows T1's investigation (same file).
- B1-T4 is independent and read-only; its race analysis is cross-checked against B1-T2.
- Harness-using tests (integration, browser) go through `scripts/run-integration.js` / `run-browser.js`, which serialise on one lock.
- Integration gate (coordinator) only after T1–T4 are REPORTED.

## Test requirements
- A: unit tests for the terms visibility rules; integration tests for own-society / other-society / society-less /
  member vs leadership / admin, asserting absence of emails and budgets where not authorised, in the raw response text;
  a deterministic first-write race test only if the race is confirmed. Red check against unfixed code.
- B: integration tests for each caller×audience cell (admin ALL/SOCIETY/LEADERSHIP; non-admin SOCIETY-own allowed, ALL/LEADERSHIP/other
  society denied; missing/invalid audience 400), DB-state assertions; a browser test for authorised creation. Red check.
- C: no test execution unless instructed; proposes the deterministic regression test and the ordered validation sequence.

## Blockers
- None recorded at creation. Possible: sensitive-field authorization for emails/budgets (see DECISIONS.md D-01) — Agent A must mark
  that subtask BLOCKED rather than guess.

## Completion evidence
- B1-T4 (2026-10-29): Agent C report saved as `reports/2026-10-29_agentC_raw.txt` (code inspection only, no tests run; qa worktree status verified clean by the coordinator). Findings to carry into integration: NEW-11 is a probable race by inspection but unreproduced (SocietyTerm required lazily in societies.js at 3 handlers; no init() call); the loser of a duplicate gets the generic 400 "society already exists."; no existence check on POST /terms (dangling terms); D-A2 CONFLICTS with current tests: announcement-ownership integration (lines ~236-249, ~400-402) and unit tests currently allow an office bearer LEADERSHIP, and PATCH must enforce the same audience rule. Agent B may legitimately change those expectations (deliberate policy change, not a weakened assertion); the coordinator must review each such edit.
- B1-T1/T2 (Agent A, report `reports/2026-10-29_agentA_raw.txt`): coordinator-verified 2026-10-29 on the terms worktree. Unit society-terms/access/pii/patch-persistence 121/121 (society-terms alone 17). Integration society-terms 16/16, society-pii 12/12, society-authorization 14/14, society-patch 28/28.
  Independent red check (coordinator copied the new test onto baseline 70ff8bd in the qa worktree, then removed it): 10 of 16 FAIL on baseline, including the NEW-11 race (8 simultaneous creations produced duplicates, no unique index) => NEW-11 CONFIRMED and fixed.
  Production change only in backend/src/routes/societies.js (plus new tests); models untouched. Open: chair/treasurer emails are admin-only pending D-01; budgets are gated by the existing finance:view.
- B1-T3 (Agent B first pass + follow-up B2, reports `...agentB_raw.txt`, `...agentB2_raw.txt`): coordinator-verified on the announcements worktree. Unit announcement-* 32/32. Integration announcement-create 18/18, announcement-ownership 21/21, announcement-visibility 26/26. Browser announcement-create 2/2. Frontend typecheck clean, lint 0 errors (10 warnings = baseline count), build OK, frontend node 40/40. Backend eslint clean.
  Independent red check (create test on baseline): 2 of 18 FAIL (non-admin LEADERSHIP create; PATCH retarget to LEADERSHIP), exactly the D-A2 behaviors. The original UI-sends-no-targetAudience defect is covered only by the browser spec, which was NOT run against the old frontend.
  Existing-test expectation changes (all D-A2 policy-driven; none deleted or skipped): announcement-ownership unit (3 tests switched LEADERSHIP -> own SOCIETY; 1 retarget test now asserts 403); announcement-ownership integration (create LEADERSHIP -> 403; retarget -> 403). Reviewed by the coordinator.
- Cross-task: A and B changed disjoint file sets (0 overlapping paths). Combined-tree regression NOT yet run (agents did not commit; integration is gated on user approval).

## Batch 1 integration worktree (2026-10-29)
Worktree `D:\SB-APP-worktrees\batch1-integration`, branch `integration/batch1`, based on 70ff8bd, NOTHING committed (13 uncommitted entries).
Built by copying the 11 verified files from the terms (3) and announcements (8) worktrees (byte-identical, hashes in `reports/2026-10-29_integration-baseline-manifest.txt`), then coordinator changes for D-23/D-21 (below).
Agent worktrees unchanged since the manifest (0 hash differences); qa clean; protected checkout unchanged.

| Item | Owner | Status | Evidence |
|---|---|---|---|
| D-23 handover authorization | coordinator (integration worktree) | VERIFIED | red check: member case fails on baseline; unit + integration pass |
| D-21 nonexistent society | coordinator | VERIFIED | red check: nonexistent-society case fails on baseline; unit + integration pass |
| Combined regression gate | coordinator | RUN - see CHANGELOG / reports/gate | one flaky browser spec (NEW-10), one test fixed (see below) |

Coordinator-changed or coordinator-added files in the integration worktree:
- `backend/src/routes/societies.js` (D-23 guard + D-21 existence check on top of Agent A's change)
- `backend/test/unit/society-access.test.js` (handover route now carries the permission check: shape 3 layers)
- `backend/test/unit/society-terms.test.js` (Agent A's file + Society.exists stub, 3-layer handover shape, 9 new unit tests)
- `backend/test/integration/society-terms-authorization.integration.test.js` (new, 11 tests)
- `backend/test/integration/society-terms.integration.test.js` (Agent A's file; setup grants settings:edit to society_chair, member test asserts 403, +1 test for a settings:edit holder without finance:view)

## Batch 2 (2026-10-29)
Preflight done; no agents started; blocked on decisions - see BATCH2_TASK_BOARD.md.

## Batch 2 (2026-10-29)
integration/batch2 candidate ready for review (15 uncommitted entries). See BATCH2_TASK_BOARD.md.
