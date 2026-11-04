# Completion MASTER-TODO (updated 2026-10-30)
- [x] Phase 0 current state - 00-current-state.md (observed)
- [x] Phase 1 Batch 1 verification - 01-batch1-verification.md (reproduced: unit 709, 8 integration files 147, frontend node 40, typecheck, announcement browser 2). D-24 still needs your explicit approval.
- [x] Phase 2 Batch 2 - 02-batch2-verification.md. D-B10 (no transaction data to Gemini) and D-B11 (legacy admin authorized) implemented in integration/batch2 and tested (unit 690, AI integration 13, frontend node 45, build with fake key clean).
- [x] Phase 3 Agent C - 03-agent-c-report.md. C1 CI scripts + workflow (tested locally only), C2 NEW-10 diagnosed partially (still OPEN, fix proposed not applied), C3 9 generated files untracked in batch2-ci, C4 npm audit done (new findings: criticals in dompurify, proxy-addr, tar).
- [ ] Phase 4 combined gate - 04-combined-regression-gate.md: INTERRUPTED by low memory after unit/eslint/typecheck (exit 0). Needs a rerun when memory allows. An orphaned integration runner (pid 23648 + harness) may still be running: stop needs your OK.
- [ ] Phase 5 git review (05) - content scan of the 32 files done (no secrets, no data files, no skipped tests); proposed commits not written yet.
- [ ] Phase 6 issue register and readiness (06) - not written; overall status would be NOT READY (combined gate unrun).

> **Correction to the line above (2026-11-01):** the Phase 4 combined gate was **not** left unrun after unit/eslint/typecheck. The wrapper was stopped; the driver finished at 14:04:37. See `14-combined-regression-gate.md` for the full corrected record. The gate is still **not passed** - 8 integration files never launched and `socket-reconnect` failed.

---

# CANONICAL TASK REGISTER (single source of truth, from 2026-11-01)

Statuses: Not started / In progress / Blocked / Awaiting approval / In review / Verified complete / Deferred / Cancelled / Superseded.
"Approval" names the decision or authorisation in `DECISION-REGISTER.md` that must land first. Nothing in this table authorises a commit, merge, push, install or deploy.

| ID | Task | Pri | Status | Agent | Depends on | Finding | Worktree | Evidence required |
|---|---|---|---|---|---|---|---|---|
| **PH0-01** | Phase 0 discovery, reconciliation, repository maps, counted test baseline | P1 | **Verified complete** | CEO | - | charter §20 | read-only | `00-current-state.md` §PHASE 0 RE-ESTABLISHED, `01`, `02`, `03`, `14`, `DECISION-REGISTER`, `INDEX` |
| **QA-01** | Harvest the NEW-10 traces out of `worktrees\combined\frontend\test-results\` into `completion\raw\` | P1 | **Verified complete** | QA | A3 | NEW-10 | combined (read-only copy) | trace files present under `completion\raw\` |
| **QA-02** | Re-run the 8 unlaunched integration files + the `socket-reconnect` spec to close the combined gate | P1 | **Blocked** | QA | A1, QA-01 | gate gap | combined, isolated harness, sequential | per-file raw output, exit codes, test counts |
| **QA-03** | Pin which backend unit files generate tests at runtime (645 sites -> 718 executed) | P3 | Not started | QA | A3 | baseline integrity | read-only | per-file result lines diffed against per-file declaration sites |
| **REV-01** | Independent review of the 32-file diff and every red check; reviewer must not be an implementer | P1 | Not started | Reviewer | A3 | charter §16 | read-only clone | written approval or rejection per file set |
| **GIT-01** | **Prepare** (not execute) commits for the 32 verified files | P1 | **Awaiting approval** | CEO | A2, REV-01 | top risk | per worktree | proposed commit messages + explicit file lists (never `git add .`) |
| **SEC-01** | Does the app use DOMPurify `IN_PLACE` / an afterSanitize hook? Exploitability of the `dompurify` critical | P1 | **In review** | Security | A3 | NEW-12 | read-only | call sites quoted, attack scenario tested or ruled out |
| **SEC-02** | Exploitability of the `proxy-addr` critical under the **actual** `trust proxy` configuration | P1 | **In review** | Security | A3 | NEW-12 + NEW-18 + AUD-012B + AUD-034 (one cluster) | read-only | config value, spoofing scenario, rate-limit keying impact |
| **SEC-03** | Confirm `googleDriveService.ts` holds no client secret before any removal decision | P2 | **In review** | Security | A3 | F-01 | read-only | file reviewed, secret status stated (never quote a real secret) |
| **DEP-01** | Dependency remediation **plan** for `dompurify` + `proxy-addr` (and the high/direct: axios, compression, multer, zod, react-router-dom) | P1 | **Blocked** | Security + DevOps | D-26 | NEW-12 | read-only | severity, direct/transitive, exploitability here, non-breaking vs breaking, no installs |
| **FIX-01** | Sign off Batch 1 once the handover authority is confirmed | P1 | **Awaiting approval** | CEO + Reviewer | D-24 | D-24 | batch1-integration | confirmation recorded in `DECISION-REGISTER` |
| **FIX-02** | Apply the proposed NEW-10 **test-side** fix, then re-run the spec | P1 | **Awaiting approval** | QA | D-B6 | NEW-10 | combined or a fresh worktree | spec green on first attempt, twice, no weakened assertion |
| **FIX-03** | Keep the 9 generated files untracked | P2 | **Awaiting approval** | DevOps | D-B7 | D-B7 | batch2-ci / combined | staged deletions reviewed |
| **FIX-04** | Resolve the public `/register` route | P2 | **Blocked** | Frontend | D-27 | NEW-17 / F-02 | new worktree | route change + regression test |
| **CI-01** | One real GitHub Actions run of the C1 workflow | P1 | **Awaiting approval** | DevOps | D-B5 | AUD-015 / AUD-014 | batch2-ci | Actions run URL and job results |
| **CI-02** | Wire the frontend Node tests to an npm script (`test:unit` is a stub) | P2 | **Blocked** | DevOps | D-B5 | F-05 | batch2-ci | script runs 45/45 locally and in CI |
| **OPS-01** | Confirm no stray harness/runner (pid 23648) and nothing listening on :5057 / :5174 | P2 | **Verified complete** | DevOps | A3 | 04 §interrupted run | n/a | port + process check output |
| **PWA-01** | PWA runtime verification: registration, install, update, offline fallback, cache invalidation, **and that authenticated / personal / financial responses can never be served from a shared or service-worker cache** | P1 | Not started | DevOps + Security | A3 | charter §4-8 (Phase 2B.1) | read-only + browser | per-item evidence incl. financial `Cache-Control` headers |
| **API-01** | Full endpoint audit of all 129 declarations -> `06-API-AND-DATABASE-AUDIT` | P2 | **In progress** (first static pass done) | Backend + Security | Phase 1 closed | charter §13 | read-only | per-endpoint auth, scope, validation, tests, callers |
| **AUTHZ-01** | Full role-permission matrix -> `07-ROLE-AUTHORIZATION-MATRIX`, using only roles that actually exist | P1 | **In progress** (matrix derived from seed.js: 07-role-authorization-matrix.md; per-endpoint negative tests still to do) | Security | D-24 | charter §10 | read-only + tests | matrix + negative tests per role |
| **FE-01** | Frontend functional audit -> `05-FUNCTIONAL-AUDIT`; move every row of `02-feature-inventory.md` off WIRED | P2 | **In progress** (first static pass done) | Frontend + QA | Phase 2 | charter §9 | read-only + browser | per-feature workflow evidence |
| **UIUX-01** | UI/UX audit + improvements -> `08`, `09` | P3 | **Blocked** | Frontend | security + functional gates (charter §11) | charter §11 | new worktree | route-by-route audit, responsive + a11y, small batches |
| **DOC-01** | Remaining charter documents: `04`, `05`, `06`, `07`, `08`, `09`, `13`, `15`, `16`, `CHANGELOG`, `AGENT-HANDOVER` | P2 | Not started | CEO | upstream phases | charter §19 | completion\ | files written and indexed |

## Register reconciliation status (AUD-035 + NEW-01..NEW-26)

65 rows total. Full reconciliation with evidence is in the Phase 0 report on issue SBA-1 and in `D:\SB-APP-orchestration\MASTER_TODO.md` (the AUD-035 register, provenance preserved). Summary of the changes against the AUD-035 baseline:

- **Implemented and verified, but uncommitted**: NEW-07/AUD-025, NEW-11 (duplicate-creation race *confirmed* by a red check on the baseline: 8 simultaneous creations produced duplicates), NEW-06/AUD-022, NEW-26/D-23, D-21, NEW-08, AUD-013 (plus the D-B10 / D-B11 corrections).
- **NEW-12 is no longer "not verified"**: the audit ran (10 root / 9 backend / 13 frontend findings; criticals `dompurify` and `proxy-addr`; high/direct `axios`, `compression`, `multer`, `zod`, `react-router-dom`).
- **AUD-015 / AUD-014**: implemented in `batch2-ci`, exercised **locally only** - never on GitHub Actions.
- **NEW-10**: 4+ recorded occurrences; partially explained, not proven. The "only fails last in a chain" hypothesis is dead (it has failed standalone). Test-side fix proposed, not applied.
- **Unchanged / still open**: AUD-001 + AUD-009a (storage, D-02), AUD-003 (dual authorization, D-03), NEW-19, NEW-22, NEW-05, and the nine open-decision rows.
- **No P0.** New P1 entries: the two dependency criticals.
- **New in Phase 0**: F-01..F-06 (see `02-feature-inventory.md`), with decisions D-27, D-28, D-29.

## SBA-1 disposition (recorded 2026-11-01)

**Phase 0 (SBA-1) is terminal: Verified complete.** All seven charter deliverables plus `INDEX.md` are written under `completion\`; the Phase 0/1 report was posted to the issue on 2026-11-01. Nothing in Phase 0 remains in progress, and **no agent task is pending on Phase 0.**

**Everything downstream is a typed wait on the owner, not an agent task.** No run should re-enter Phase 0. The gate is:

| Waiting on | Items | Unblocks |
|---|---|---|
| Owner decision | D-24, D-B5, D-B6, D-B7, D-26, D-27 | FIX-01, CI-01, CI-02, FIX-02, FIX-03, FIX-04, DEP-01, AUTHZ-01 |
| Owner authorisation | A1 (close the gate), A2 (prepare commits), A3 (create the specialists) | QA-01, QA-02, REV-01, GIT-01, SEC-01..03, OPS-01, PWA-01 |

The only task that needs **no** approval is **QA-01** (harvest the NEW-10 traces out of `worktrees\combined\frontend\test-results\` into `completion\raw\` - a read-only copy). It is the one item that is lost if that worktree is cleaned, so it should run first whenever an agent is next woken on this project.

**Known workspace defect blocking board hygiene:** the CEO agent cannot record a disposition through the Paperclip API - `mcp__Paperclip_projects__list_projects` and `mcp__Paperclip_projects__create_task` are not granted to it, and the Paperclip HTTP environment is not readable from a run (`printenv`, `env` denied). That is why completed runs on this issue keep being reported as undispositioned parks even when the work finished. It needs one operator action (enable those two tools for the CEO agent, or close SBA-1 from the board); it cannot be fixed from inside a run, and per the owner's standing rule `.claude\settings.json` was not edited.

### The exact fix (for the owner / operator - I am not permitted to apply it)

Confirmed by reading `D:\SB-APP-orchestration\.claude\settings.json` on 2026-11-01: its `permissions.allow` list contains **no MCP tool entries at all** (only `Read`, `Glob`, `Grep`, the read-only `git` forms, `ls`, `Edit`/`Write`). That is the whole cause - the Paperclip MCP tools are not denied, they are simply never allowed, so each call raises a prompt that no unattended run can answer. Two lines in `permissions.allow` fix it:

```jsonc
// D:\SB-APP-orchestration\.claude\settings.json -> "permissions" -> "allow": add
"mcp__Paperclip_projects__list_projects",
"mcp__Paperclip_projects__create_task"
```

Either that, or enable those two tools for the CEO agent on its Paperclip agent page. Both are operator actions; nothing inside a run can grant them.

Two related observations from the same file, neither blocking:
- `Read(/**)`, `Edit(/completion/**)` and `Write(/completion/**)` are root-anchored and cannot match `D:\...` paths. They are not what made this session work - the **trusted-workspace** grant did. If that trust is ever withdrawn, these three patterns must become `Read(D:/SB-APP/**)`, `Read(D:/SB-APP-worktrees/**)`, `Read(D:/SB-APP-orchestration/**)`, `Edit(D:/SB-APP-orchestration/completion/**)`, `Write(D:/SB-APP-orchestration/completion/**)`, and `Bash(git -C:*)` must be added or `git -C <path>` stays denied.
- `deny` still covers `Read`, `Edit` and `Bash(*digest.txt*)` for `digest.txt` but no longer has a `Write(**/digest.txt)` entry. The realistic paths remain blocked, so the practical risk is low, but charter §2.3 treats `digest.txt` as strictly off-limits for modification and that explicit guard is gone. Restoring the line costs nothing.

**Important:** none of the above is a Phase 0 gap. Phase 0 is complete and needs no further run. If the board can only express this as an open item, the correct state is **manual review / awaiting owner**, not "in progress".


## Update 2026-11-01 (approval-free items worked by the lead orchestrator)
- **QA-01 Verified complete**: NEW-10 trace + error context copied to `raw/new10-combined-gate-traces/`, SHA-256 matched against the originals.
- **OPS-01 Verified complete**: nothing on :5057/:5174, pid 23648 gone, harness lock empty, no mongod, no sb-app-integration temp artifacts. Free memory was only 59 MB of 7.9 GB at the time (Paperclip Postgres + an unrelated project test run): do not run test suites until that clears.
- **SEC-01 / SEC-02 / SEC-03 In review**: see `04-security-audit.md`. Code-reading only; the independent reviewer (REV-01) has not looked. DOMPurify critical not reachable with the current call sites; proxy-addr depends on the TRUST_PROXY topology (undecided); googleDriveService holds no secret.
- **AUTHZ-01 In progress**: role/permission matrix written from the seed and rbac-matrix.json (`07-role-authorization-matrix.md`). It shows the seed grants settings:edit to exactly the four roles in the owner D-24 proposal, so D-24 describes the existing seed; still awaiting the owner confirmation. Per-endpoint checks and negative tests remain.
- **API-01 In progress**: first static pass written (`06-api-and-database-audit.md`): 129 declarations classified; 12 unguarded-chain mutating endpoints reviewed (all have inline checks); NEW-15 confirmed from code with a new detail (arbitrary role examined when a user has several); new P3 finding API-F2 (dead getConversation wrapper). 27 GET endpoints and the database half remain.
- **FE-01 In progress**: first static pass written (`05-functional-audit.md`): NEW-09 (no 429 handling) confirmed; new P3 findings FE-F1 (3 submit buttons without in-flight protection: Calendar Save Event, Kanban Create Card, chat send) and FE-F2 (create/edit form routes not gated in the UI). UI vs backend permission vocabulary checked: consistent. Nothing was run in a browser.
- **A3 (create specialist agents) DONE 2026-11-01 on the owner instruction**: six agents hired in Paperclip as pending_approval (Security Lead, Backend Engineer, Frontend/UI-UX Lead, QA Engineer, DevOps/CI Engineer, Independent Reviewer), all reporting to the CEO, model claude-sonnet-5-5, heartbeat off, skip-permissions off, 30 turns / 25 min per run, own instruction files and per-agent --settings in D:\SB-APP-orchestrationgents\. Nothing assigned yet. Waiting on: owner approval of each hire in the Paperclip UI, a spending cap, and (for Backend/Frontend) worktrees that do not exist yet (wave2-backend, wave2-frontend) because they must branch from a commit of the 32 verified files, which is not authorised yet.

- **REV-01 Verified complete (by the Independent Reviewer, code reading only, no tests run)**: see completion/agents/reviewer/2026-11-01-REV-01.md. Open follow-ups: owner questions Q1-Q3 in DECISION-REGISTER.md; pre-existing issues noted by the reviewer: PATCH announcement with societyId and no targetAudience clears societyId for admins; handover :id/:termId not format-validated (CastError path). **DEP-01 Verified complete (Security Lead, plan only)**: completion/agents/security/2026-11-01-DEP-01.md.

- **PWA-01 / AUD-016 first result (DevOps agent SBA-4, independently re-checked by the lead orchestrator):** the repository contains NO PWA: no service worker, web manifest, registration code, PWA plugin or icons in frontend/, and a search of every git ref, all commit messages and the reflog finds none. The historical claim "Phase 2B.1 PWA, 197 tests passed, SW /api/ precedence fixed" therefore has no matching code in this repo. PWA runtime verification is moot until the owner says where that code is. Separately, the backend sets no Cache-Control header, so financial and personal JSON could be heuristically cached by a browser or an intermediary. AUD-016: there is no root .env.example; backend/.env.example and backend/src/.env.example disagree; FRONTEND_URL is read by the server but not documented in backend/.env.example. Report: completion/agents/devops/2026-11-01-PWA-01-AUD-016.md.

- **QA-03 Verified complete (QA agent SBA-5; arithmetic independently re-checked by the lead orchestrator):** the backend unit gap reconciles exactly. 645 line-start test() declarations across 48 files + 73 extra executions from three files that declare tests inside loops over data tables (society-access 11 rows: +50; finance-workflow 9 rows: +16; importers-authorization 2 rows: +7) = 718 executed. No missing, skipped or duplicated tests found. The agent could not map every raw output line to a file (it says so). Report: completion/agents/qa/2026-11-01-QA-03.md.

- **NEW-22 backend half: VERIFIED COMPLETE (Backend agent SBA-6; independently re-verified by the lead orchestrator)**: GET /conversations now returns lastMessage via one Message.aggregate; filter and authorization unchanged; uncommitted in D:\SB-APP-worktrees\wave2-backend (agent/wave2-backend). I independently re-ran: eslint on the 4 changed/new files (clean, 0 problems), the new integration test conversation-last-message.integration.test.js (8/8 pass), and the pre-existing calendar-conversations-authz.integration.test.js on the same tree to confirm no regression (22/22 pass). Unit tests also re-run earlier (8/8). Follow-up decision: a {conversationId, createdAt} index for scale (not urgent). Report: completion/agents/backend/2026-11-01-NEW-22.md.

- **Frontend batch 1: IN REVIEW (Frontend agent SBA-7; diffs read and tests independently re-run by the lead orchestrator)**: API-F2 done (unused getConversation removed, contract test added); FE-F1 done for Kanban Create Card and chat send (in-flight guard + disabled/loading state); FE-F1 Calendar Save Event explicitly skipped because that handler never calls the API (events are not persisted at all - pre-existing, flagged as its own question); FE-F2 not done, needs an owner decision per form route (module+action); NEW-09 done, one readable 429 message via a new pure helper (frontend/src/lib/rateLimit.ts), no auto-retry, 401 handling untouched. Independently re-ran `node --test tests/unit/*.node-test.mjs`: 53/53 pass. Diffs match the report exactly. eslint/tsc not re-run by me (agent reports both clean). Uncommitted in D:\SB-APP-worktrees\wave2-frontend (agent/wave2-frontend). Report: completion/agents/frontend/2026-11-01-frontend-batch1.md.
