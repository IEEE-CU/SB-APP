# 01 - Master roadmap (updated 2026-11-01, Wave 1 in flight)

Charter name: `01-MASTER-ROADMAP`. Phases are the charter's §20 phases. Nothing in this roadmap authorises a commit, merge, push, deploy, install or dependency change. Status below reconciled against `MASTER-TODO.md` (canonical task register) and the execution plan in `17-wave-plan.md`.

## Where the project actually is

- Phase 0 (safe discovery): **terminal, Verified complete.** All seven charter deliverables plus `INDEX.md` are written; the Phase 0/1 report was posted to issue SBA-1 on 2026-11-01. No agent task is pending on Phase 0 and no run should re-enter it.
- Phase 1 (independent handover verification): **1 of 2 original gaps closed.** `REV-01` (independent review of the 32-file diff, code-reading only, no tests run) is **Verified complete** - see `completion/agents/reviewer/2026-11-01-REV-01.md`; open follow-ups are owner questions Q1-Q3 in `DECISION-REGISTER.md` plus two pre-existing issues the reviewer noted (a PATCH-announcement societyId-clearing bug, an unvalidated handover `:id`/`:termId` CastError path). The remaining gap is closing the combined regression gate itself (**QA-02**, Blocked on authorisation A1 and QA-01's prerequisite, which is done) - 8 integration files and the `socket-reconnect` spec still need to run in the isolated harness.
- Phase 2+ (implementation): **still blocked on owner decisions (D-24, D-B5, D-B6, D-B7, D-26, D-27)**, but no longer blocked by "32 files uncommitted" alone - those files have now been independently reviewed (REV-01) and some additional wave-1/approval-free work has landed on top of them (see below). Commit preparation (**GIT-01**) remains Awaiting approval.
- **Six specialist agents exist** (Security Lead, Backend Engineer, Frontend/UI-UX Lead, QA Engineer, DevOps/CI Engineer, Independent Reviewer), hired 2026-11-01 under authorisation A3, reporting to the CEO. Wave 1 (see `17-wave-plan.md`) is the first batch of tasks dispatched to them: five read-only, no-decision, no-test-harness tasks running in parallel, plus this CEO consolidation task.

**Single biggest risk, unchanged:** 32 files of verified, reviewed work have been sitting uncommitted across 10 worktrees since 2026-10-29/30. One cleanup incident already destroyed 6 tracked files (recovered with `git checkout`). The NEW-10 traces from the combined gate exist **only** inside `D:\SB-APP-worktrees\combined\frontend\test-results\` and are invisible to git (Agent C's `.gitignore` now ignores `test-results/`), so a `git clean` there destroys the only copy. Harvesting those traces into `completion/raw/` is read-only and should happen before anything else touches that worktree.

## Phase plan

| Phase | Objective | Gate to leave the phase | Status |
|---|---|---|---|
| 0 | Safe discovery, reconciliation, baseline | This document set exists and the owner has seen it | **DONE - terminal, Verified complete** |
| 1 | Independent handover verification | Combined gate closed (8 integration files + `socket-reconnect`); independent reviewer signs off on the 32-file diff | **1 gap** - REV-01 Verified complete; QA-02 (close the gate) Blocked on authorisation A1 |
| 2 | Security + critical functional defects (P0/P1 only, approved) | Each fix: reproduced, minimal, regression-tested, reviewer-approved | Blocked on D-24, D-26, commit authority. DEP-01 (dependency remediation plan) Verified complete as a *plan* - see `13-ci-and-dependency-audit.md` |
| 3 | Complete backend / API / database audit (`06`, `07`) | 129-endpoint inventory with auth, scope, validation, tests, callers; full role-permission matrix | **In progress** - API-01 first static pass done (129 declarations classified, NEW-15 confirmed, new P3 API-F2); AUTHZ-01 matrix derived from seed/rbac-matrix.json, confirms D-24's four roles match the existing seed (owner confirmation still open); per-endpoint negative tests not yet run |
| 4 | Complete frontend functional audit (`05`) | Every feature row in `02-feature-inventory.md` moved from WIRED to a verified status | **In progress** - FE-01 first static pass done (NEW-09 confirmed, new P3 FE-F1/FE-F2); nothing run in a browser yet; Frontend batch 1 diff (API-F2, FE-F1 partial, NEW-09) is **In review** by the lead orchestrator, uncommitted in `wave2-frontend` |
| 5 | QA + browser testing | NEW-10 root-caused by evidence; NEW-19 fixed through the isolated setup; negative tests | NEW-10 partially explained, test-only fix proposed, not applied (FIX-02, Awaiting approval on D-B6); QA-03 (test-count reconciliation) Verified complete; QA-01 (trace harvest) and OPS-01 (stray-process check) Verified complete |
| 6 | UI/UX audit + approved improvements (`08`, `09`) | Route-by-route audit in a real browser, responsive + a11y checks, small reviewable batches | **Deliberately not started** - charter §11 blocks major UI work until the security and functional gates pass |
| 7 | PWA, DevOps, production readiness (`13`) | Service-worker runtime evidence incl. proof that authenticated/financial responses are never served from a shared cache; CI green on real GitHub Actions | **PWA-01 first result in: there is no PWA in this repository** (no service worker, manifest, registration code, or PWA plugin in `frontend/`, confirmed across every git ref including the reflog); the historical "Phase 2B.1 PWA, 197 tests passed" claim has no matching code here - moot until the owner says where that code is. Separately: backend sets no `Cache-Control` header, so financial/personal JSON could be heuristically cached (open risk). AUD-016: no root `.env.example`; `backend/.env.example` and `backend/src/.env.example` disagree; `FRONTEND_URL` undocumented. CI-01 (real GitHub Actions run) still Awaiting approval on D-B5; see `13-ci-and-dependency-audit.md` §1 for the AUD-015 CI-coverage detail and §3 for the full dependency-audit detail (DEP-01, NEW-12) |
| 8 | Full regression from a clean documented environment | No known P0/P1 silently carried | Not started |
| 9 | Independent final review (`15`) | Reviewer is not an implementer of what is reviewed | REV-01 (32-file diff) Verified complete; a second full-regression-gate independent pass is still Not started per charter §20 Phase 9 |
| 10 | Final handover (`16`, `AGENT-HANDOVER`) | A new engineer can continue without any prior conversation | Not started |

## Current execution plan: Wave 1-4 (see `17-wave-plan.md` for full detail)

The backlog is split into waves so several specialist agents can run in parallel without conflicting, honoring the one hard constraint: **only one agent may run the isolated test harness (`run-integration.js` / `run-browser.js`) at a time** (fixed ports 5057/5174, limited free memory on this machine). Document-only/read-only tasks have no such limit.

- **Wave 1 (running now)** - no owner decision needed, no harness, all parallel-safe: Security Lead (SEC-02 follow-up on root `tar` reachability + NEW-14 backup/restore design review + importer/scraper SSRF audit), DevOps (NEW-19 fix proposal + F-06 investigation), QA (NEW-05 browser-test proposal + NEW-20 investigation), Backend (NEW-23 + NEW-21 investigation, read-only), Frontend (second static pass on `05-functional-audit.md` for events/projects/tasks/calendar), and this CEO consolidation task (this document + `13-ci-and-dependency-audit.md`). Reviewer stays idle until Wave 1 produces diffs worth checking.
- **Wave 2 (gated on owner decisions, no harness)**: NEW-10 test fix applied (needs D-B6), AUTHZ-01 per-endpoint negative-test proposals (needs D-24), NEW-19 fix + CI-02 + TRUST_PROXY write-up (needs D-B5 + NEW-18 facts), DEP-01 turned into an exact diff (needs D-26), FE-F2 route gating (needs Q7), calendar event persistence fix (needs Q6), generated-files-untracking commit prep (needs D-B7 + a commit decision).
- **Wave 3 (harness required, strictly one agent at a time)**: close the combined gate (8 integration files + `socket-reconnect`); re-run the NEW-10 fix repeatedly to confirm it holds; run the new AUTHZ-01 negative tests; run the NEW-05 browser test; a real GitHub Actions run of the CI workflow (sequenced last so it doesn't compete for local port/memory).
- **Wave 4 (after everything above)**: Independent Reviewer reviews every Wave 1-3 diff plus the two already-uncommitted agent changes (Backend NEW-22, Frontend batch 1) as the real Phase 9 full independent review; CEO writes `15-FINAL-ISSUE-REGISTER.md` and `16-FINAL-READINESS-REPORT.md`; Phase 6 UI/UX work stays blocked behind the security/functional gates.

## Immediate next actions, in priority order

1. ~~Harvest the NEW-10 traces~~ - **done** (QA-01 Verified complete; traces + SHA-256 match under `completion/raw/new10-combined-gate-traces/`).
2. **Close the combined gate** (QA-02) - re-run the 8 integration files and `socket-reconnect` in the isolated harness, sequentially, one harness at a time. *Needs the owner's go-ahead to run tests (authorisation A1).*
3. **Decide D-24, D-B5, D-B6, D-B7, D-26, D-27** - these six block Phase 2 and most of Wave 2.
4. **Preserve the work** - prepare (not execute) commits for the 32 verified files for owner review (authorisation A2, task GIT-01, still Awaiting approval even though REV-01 has now signed off on the diff).
5. Continue Wave 1 (running now, no decisions needed); dispatch Wave 2 items as each decision lands; Wave 3 only after Wave 2, one harness run at a time; Wave 4 last.

## Specialist agents (charter §16) - status

Six agents hired 2026-11-01 under authorisation A3 (Security Lead, Backend Engineer, Frontend/UI-UX Lead, QA Engineer, DevOps/CI Engineer, Independent Reviewer), all reporting to the CEO. Each is now mid-Wave-1 or has delivered a Wave-1-equivalent first task. File sets do not overlap; the port/harness lock serialises test execution, so **only one harness at a time** regardless of how many agents are otherwise active.

| Agent | Status this wave | Workspace | Harness needed? |
|---|---|---|---|
| **QA / Product Validation** | QA-01, QA-03, OPS-01 Verified complete; Wave 1 task (NEW-05 proposal + NEW-20 investigation) read-only, no harness; QA-02 (close the combined gate) Blocked on A1 | existing `worktrees\combined` for QA-02 only | QA-02 only |
| **DevOps / CI** | PWA-01/AUD-016 first result delivered (no PWA in repo; no Cache-Control; env-example mismatches); Wave 1 task (NEW-19 fix proposal + F-06) read-only | `worktrees\batch2-ci` | No (this wave) |
| **Security Lead** | SEC-01/SEC-02/SEC-03 In review; DEP-01 Verified complete (plan only); Wave 1 task (SEC-02 follow-up + NEW-14 design review + importer/scraper audit) read-only | new read-only `security-audit` worktree | No |
| **Independent Reviewer** | REV-01 Verified complete; idle until Wave 1 produces diffs worth checking | read-only clone | No |
| **Backend Engineer** | NEW-22 backend half Verified complete, uncommitted in `wave2-backend`; Wave 1 task (NEW-23 + NEW-21 investigation) read-only | `wave2-backend` | No |
| **Frontend / UI-UX Lead** | Batch 1 diff (API-F2, FE-F1 partial, NEW-09) In review, uncommitted in `wave2-frontend`; Wave 1 task (second static functional-audit pass) read-only | `wave2-frontend` | No |

Backend and Frontend implementation work beyond what is already uncommitted stays gated on owner decisions (D-24, D-26, D-27, Q6, Q7) - starting further implementation before those land is exactly what produced Batch 2's Agent A/B rework.

## Hard rules carried into every later phase

No commit, merge, push or deploy without explicit owner approval. No dependency install or upgrade (including the two criticals) without approval - a *plan* is allowed. No schema migration or destructive data change. `digest.txt` is never opened. Never run the legacy contract/E2E tests against `localhost:5000`. Never weaken `utils/urlSafety.js` to support more importer sources. Never re-mount `routes/storage.js` without an approved access policy. Do not introduce a third authorization system.
