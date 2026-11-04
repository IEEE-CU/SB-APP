# 01 - Batch 1 verification (2026-10-30)
Candidate: D:\SB-APP-worktrees\batch1-integration, integration/batch1, base 70ff8bd, 13 uncommitted entries, nothing staged. Not committed, not merged.

## Inspected (read by the lead orchestrator)
Full diff of backend/src/routes/societies.js and announcements.js; every removed line of the three modified test files; docs/rbac-matrix.json (settings grants).

## Society terms (5.1) - code read + tests
- GET /:id/terms: 400 malformed id; 403 unless administrator or user of that society (canSeeSocietyPii, fail closed). Budgets (allocatedBudget/openingBalance/closingBalance) only with the existing finance:view held for that society; chair/treasurer e-mails only for legacy ADMIN. Input documents are not mutated.
- POST /:id/terms (admin-only route): 400 malformed id, 404 nonexistent society, both BEFORE `SocietyTerm.init()`; init rejection -> 503 and nothing written; model is required at module load (index build starts with the app).
- PATCH handover: society guard, then admin-or-`settings:edit`; term looked up inside the URL's society (no cross-society term ids); response shaped like GET.
- Tests: integration society-terms (17), society-terms-authorization (11) incl. concurrent first-time creation / index readiness; unit society-terms (26).

## Announcements (5.2) - code read + tests
- Non-admin: only own SOCIETY audience on create (ALL/LEADERSHIP/foreign society -> 403). PATCH enforces the same on the resulting audience; only exception (D-22) = a legacy LEADERSHIP post staying LEADERSHIP may have title/content edited. Admin may use ALL/SOCIETY/LEADERSHIP. Frontend form, service and types carry targetAudience/societyId matching the backend; browser spec covers the original missing-audience UI defect.

## D-24 (5.3)
rbac-matrix.json grants `settings` to sb_faculty_advisor (full) and society_faculty_advisor, society_chair, sb_chair (limited_own_scope); it is `none` for vice chair, secretary, treasurer, webmaster, member (and sb_vice_chair/secretary/treasurer/webmaster, ieee_member). The implemented handover rule (admin or settings:edit) therefore equals the policy proposed in the 2026-10-30 prompt, and no new role/permission was created. DECISIONS.md still lists D-24 as pending, so this is recorded as PROPOSED + MATCHES IMPLEMENTATION; **explicit approval requested** - I have not marked it approved.

## Test weakening check
Removed lines: 4 in announcement-ownership integration, 5 in announcement-ownership unit, 3 in society-access unit. All removed assertions are the old expectations that a non-admin can create/retarget a LEADERSHIP announcement (contradicts approved D-A2/D-22) or the old "PATCH /:id is the only route with a permission check" pin (now also the handover route, D-23). Each is replaced by new assertions for the approved rule. No test was skipped, deleted wholesale, or had a timeout/retry added.

## Independently reproduced results (this session, lead orchestrator, on the actual candidate)
| Command (cwd) | Result |
|---|---|
| `node --test test/unit/*.test.js` (backend) | exit 0; 709 tests, 709 pass, 0 fail, 0 skipped |
| run-integration.js on 8 files: announcement-create, announcement-ownership, announcement-visibility, society-authorization, society-patch, society-pii, society-terms-authorization, society-terms (fresh isolated harness each) | exit 0; 147 tests, 147 pass, 0 fail, 0 skipped; every harness stopped cleanly |
| `node --test tests/unit/*.node-test.mjs` (frontend) | exit 0; 40/40 |
| `npm run typecheck` (frontend) | exit 0 |
| run-browser.js announcement-create.spec.ts | exit 0; 2 passed |
Raw output: completion/raw/b1-*.raw.

## Baseline (red) checks
Previously coordinator-run in the earlier integration session (new D-23/D-21 tests 2 of 11 fail on baseline; announcement-create integration 2/18 fail; society-terms integration 10/16 fail; announcement browser spec fails on baseline frontend). NOT re-run in this phase.

## Remaining risks
D-24 unapproved; legacy duplicate (society, academicYear) rows would make creation return 503; legacy ALL/foreign-society announcements by non-admins stay non-editable by them (D-22 as approved); full-suite and lint/build for this candidate alone were not re-run here (they run in the combined gate, Phase 4).
Status: READY FOR REVIEW (pending D-24 approval for the handover rule). Not ready for commit/merge until you authorize.
