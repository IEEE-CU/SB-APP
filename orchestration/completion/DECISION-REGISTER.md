# DECISION-REGISTER (consolidated, 2026-11-01)

Charter name: `DECISION-REGISTER`. Consolidates `D:\SB-APP-orchestration\DECISIONS.md`, `BATCH2_DECISIONS.md` and the `completion\00-04` reports. **Recommendations are not policy** (charter §18). Where a decision's wording lives in a source file, this register points at it rather than paraphrasing it, so nothing is silently rewritten.

Status values: **DECIDED** (owner), **OWNER REQUIREMENT** (stated by the owner as a requirement), **DEFERRED**, **PROPOSED - AWAITING OWNER**, **NOT CONFIRMED** (implemented against a proposal the owner never confirmed).

## Settled - do not re-ask

| ID | Subject | Status | Implementation | Source |
|---|---|---|---|---|
| D-01 | E-mails are admin-only | DECIDED | Batch 1 (uncommitted) | `DECISIONS.md` |
| D-02 | `routes/storage.js` stays unmounted until an approved access policy exists (AUD-001 / AUD-009a) | DECIDED | In baseline: mount commented out at `routes/index.js:54-58`, guarded by `test/unit/storage-unmounted.test.js` | `DECISIONS.md`, code comment |
| D-03 | Legacy `User.role` and RBAC coexist; no third system (AUD-003) | DECIDED | Both present in baseline | `DECISIONS.md` |
| D-20 | Duplicate-term message wording | DEFERRED | n/a | `DECISIONS.md` |
| D-21 | Nonexistent society -> 404 | DECIDED | Batch 1 (uncommitted) | `DECISIONS.md` |
| D-22 | Legacy announcement editing | DECIDED | Batch 1 (uncommitted) | `DECISIONS.md` |
| D-23 | Handover `PATCH` authorization | DECIDED | Batch 1 (uncommitted); NEW-26 | `DECISIONS.md` |
| D-A1..D-A3 | Batch 1 agent decisions | DECIDED | Batch 1 | `DECISIONS.md` - wording not restated here |
| D-B1..D-B4, D-B9 | Batch 2 decisions | DECIDED by owner | Batch 2 | `BATCH2_DECISIONS.md` - wording not restated here |
| D-B8 | Run an npm audit (no auto-fix, no upgrade) | DECIDED, DONE | Agent C C4, `raw/c4-audit-*` | `03-agent-c-report.md` |
| D-B10 | **No financial transaction data may be sent to Google / Gemini** | OWNER REQUIREMENT | Implemented in `integration/batch2` and tested | charter §18, `02-batch2-verification.md` |
| D-B11 | Legacy `ADMIN` is authorized through the existing admin mechanism | OWNER REQUIREMENT | Implemented in `integration/batch2` and tested | charter §18, `02-batch2-verification.md` |

## Open - the owner must decide

| ID | Question | Why it blocks | Recommendation |
|---|---|---|---|
| **D-24** | Confirm the term-handover / settings-edit authority: `settings:edit` held by society chair, society faculty advisor, SB chair, SB faculty advisor; **treasurer, vice chair, secretary, webmaster excluded**. | Already implemented in `integration/batch1` against an unconfirmed proposal. Until confirmed, Batch 1 cannot be signed off and the authorization matrix (Phase 3) has no authority for this row. | Confirm as implemented, or name the correct holders. |
| **D-B5** | Approve the CI additions in `agent/batch2-regression-ci`, and say whether the new jobs become **required** for merge. | AUD-015/AUD-014. CI has only ever been exercised locally - never on GitHub Actions. Also folds in F-05 (the frontend `test:unit` stub). | Approve, make the jobs required, and allow one real Actions run. |
| **D-B6** | Approve applying the proposed **test-side** NEW-10 fix (wait for the replacement socket's `channel:join`). No production change, no weakened assertion, no retry bump. | NEW-10 is the only failing test in the combined gate, 4+ recorded occurrences. | Approve applying it, then re-run the spec to confirm. |
| **D-B7** | Approve untracking the 9 generated files (already staged as deletions in `batch2-ci` / `combined`). | Part of the 41 uncommitted entries; blocks a clean commit set. | Approve. |
| **D-26** (new) | Authorise a **remediation plan** (not installs) for the two critical dependency findings: `dompurify` (frontend, direct, production - DOM XSS via the `IN_PLACE` afterSanitize hook) and `proxy-addr` (backend, production - IP spoofing via an IPv4-mapped IPv6 trust subnet). | Charter §2.5 forbids upgrades without approval. `proxy-addr` couples directly to `trust proxy` (NEW-18, AUD-012B, AUD-034 rate-limit keying) - treat those four as one P1 cluster. | Approve plan-only: exploitability assessment + non-breaking vs breaking remediation, no installs. |
| **D-27** (new) | `/register` is publicly routed (`frontend/src/routes.tsx:46`) while server-side registration is admin-only (NEW-17). Remove the route, hide it behind admin, or implement real self-registration? | Product policy - cannot be inferred. Currently a dead end for any visitor. | Remove the public route (smallest change, preserves the admin flow), unless self-registration is wanted. |
| **D-28** (new) | `frontend/src/services/googleDriveService.ts` is dead code (complete Google Drive OAuth upload flow, no caller). Delete or keep? | Deleting is a feature removal -> charter §16.2 requires approval. | Delete, after the Security Lead confirms it holds no client secret. |
| **D-29** (new, P3) | `projectReports.js` is mounted at both `/project-reports` and `/reports`. Keep both for compatibility, or deprecate one? | Doubles the reachable surface and any authorization mistake in it. Not blocking. | Decide during Phase 3; no action now. |

## Authorisations requested (not decisions, but needed to proceed)

| ID | Request | Scope limit |
|---|---|---|
| **A1** | Re-run the 8 unlaunched integration files and the `socket-reconnect` browser spec to close the combined gate. | Isolated MongoMemoryServer harness, sequential, one harness at a time. No production code change. |
| **A2** | **Prepare** (not execute) commits for the 32 verified files, for owner review. | Nothing committed, merged or pushed without an explicit go-ahead. Explicit file lists only - never `git add .`. |
| **A3** | Create the six specialist agents per `01-master-roadmap.md`, starting only QA, DevOps, Security and Reviewer. | Backend and Frontend stay idle until P1 remediation is approved. |

## Explicitly NOT approved (recorded so no agent mistakes it for consent)

Batch 1, Batch 2, Agent C and combined review commits; any merge or push; any dependency install or upgrade; any deployment; any trusted-proxy hop-count or topology choice; re-mounting the storage router; activating the dormant AI/email/PDF routers in the baseline; any schema migration.


## Recorded 2026-11-01 (lead orchestrator, after REV-01)
- **Commit authorisation (answers the REV-01 process finding):** on 2026-11-01 the owner answered the question "May I commit the 32 verified files on the local branch integration/combined (three explicit-file commits ... no push, no merge)?" with "Yes, commit locally". Resulting commits on integration/combined: 4da021b (Batch 1), 384ce8a (Batch 2), 3488c60 (CI work). Local only; push and merge remain unapproved. The owner also set a $200/month Paperclip cap and asked for all six specialist agents to be queued in order.
- **CI and untracking:** the owner's completion prompt (section 7, tasks C1 and C3) asked for the CI additions and for exact generated files to be untracked, which is why 3488c60 exists. What remains OPEN is D-B5 part two (should the new jobs be REQUIRED for merge?) and an Actions run; the REV-01 reviewer rejected 3488c60 "as a commit for now" because the register did not show that instruction.
- **New owner questions from REV-01 (not decided):** (Q1) a legacy ADMIN with no RBAC role sees no budget fields in GET /societies/:id/terms because only `finance:view` unlocks them (D-01 literal reading) while D-B11 treats legacy admin as authorised on the AI route: should legacy admins also see budgets? (Q2) D-B10: are society-level budget and balance figures (derived from approved transactions) acceptable to send to Google, or must even those stay out? (Q3) the server default model is gemini-1.5-pro (config/gemini.js) while the old frontend used gemini-3-flash-preview; deployment must set GEMINI_MODEL and GEMINI_API_KEY, otherwise the AI audit answers 503: which model do you want?
- **REV-01 verdicts:** 4da021b approve with changes (D-24 and Q1 need the owner); 384ce8a approve with changes (Q2, Q3); 3488c60 reject as a commit until D-B5/D-B7 are answered (code itself judged sound). No test was weakened (all removed assertions listed in the report). Report: completion/agents/reviewer/2026-11-01-REV-01.md.

- **Q4 (new):** where is the Phase 2B.1 PWA work (service worker, tests)? It is not in this repository (all refs, commits and the reflog were searched). Was it in another repo or never saved, or should a PWA be built?
- **Q5 (new):** add `Cache-Control: no-store` to API responses (at least financial and personal routes)? Today the backend sends none. Small backend change, recommended hardening, needs the owner because it changes behaviour for every client.

- **Q6 (new):** calendar events are not persisted at all today (Save Event only updates local state and closes the modal) - is that intentional/known, or should it call the backend? Found while reviewing FE-F1.
- **Q7 (new):** for FE-F2 (gating the 5 create/edit form routes in the UI), which permission module+action should each require: /societies/new+edit, /events/new+edit, /projects/new+edit, /reports/new+edit, /announcements/new+edit? And should a denied user still go to /dashboard?
