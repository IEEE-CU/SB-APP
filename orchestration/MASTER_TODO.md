# MASTER_TODO — SB-APP findings register (source: AUD-035, 2026-10-29)

Source: the AUD-035 report (reconciliation of Phase 0 / Phase 0.5 audit reports against code and
re-run tests). Evidence labels: **[ran]** executed in AUD-035; **[code]** read in current code;
**[hist]** earlier session report only. Nothing here is marked complete without evidence.
Baseline commit for this register: `70ff8bd` (on `feature/sb-app-security-hardening`, parent `e38c777`).

**ID collisions** (original Phase 0/0.5 numbering was reused later; suffixes keep them apart):
AUD-008a = login enumeration/500 (original); AUD-008b = message contract (later reuse).
AUD-009a = upload validation (original); AUD-009b = reaction routing / Community access (later reuse).
Original AUD-029 (Note.isPublic, task mass assignment, channel fallback) became: AUD-029 = channel
default-society, AUD-032 = note visibility, NEW-04 = task mass assignment. Original AUD-032 (root RBAC
script writing to a configured DB) is folded into AUD-002. AUD-004 merged into AUD-024. AUD-007B/007D
are sub-batches of AUD-007. `NEW-xx` = fixed/found without an original ID.

**Counts (64 rows, no double counting):** Verified complete 25 · Partially resolved 9 · Not reproduced 2 ·
Open defect 13 · Open decision 9 · Not verified/blocked 4 · Superseded 2.
Priorities: P0 none. P1: NEW-07/AUD-025, AUD-015, NEW-12, NEW-11. P2/P3/Dec as listed.

Owner "—" = unassigned. Batch 1 (current): Agent A = terms, Agent B = announcements, Agent C = QA.

## Batch 1 progress (2026-10-29) - fixed in agent worktrees, coordinator-verified, NOT yet integrated
Status columns below keep the AUD-035 baseline until integration is approved and merged.
- NEW-07 / AUD-025 (terms): fix verified in `agent/batch1-terms`; remaining: emails decision D-01.
- NEW-11: race confirmed and fixed in `agent/batch1-terms`.
- NEW-06 / AUD-022 (create contract): fix verified in `agent/batch1-announcements`; remaining: D-22 (legacy edge).
- UPDATE (integration worktree, uncommitted): D-23 and D-21 implemented and gated; NEW-26 (handover authorization) is FIXED in `integration/batch1` (pending D-24 confirmation of the `settings:edit` rule); D-21 closes the nonexistent-society hole. Combined gate: unit 709, integration 635, browser 27 (one flaky spec, NEW-10), frontend OK. Statuses below remain at the AUD-035 baseline until you approve integration.
- NEW-10 evidence added: `socket-reconnect.spec.ts` test 2 failed on its first attempt in two separate chain runs (AUD-035 baseline on 70ff8bd; Batch 1 gate), passes standalone (3/3). Not caused by Batch 1.
- NEW-26 (new, found in Batch 1): `PATCH /societies/:id/terms/:termId/handover` guarded only by society membership [code]. Open defect, Medium, decision D-23, P2. Not part of the AUD-035 count of 64.

## Numbered findings (39)
| ID | Sev | Status | Evidence | Owner | Deps | Next action | Pri |
|---|---|---|---|---|---|---|---|
| AUD-001 | Critical | Partially resolved | Router unmounted `routes/index.js:58` [code]; storage-unmounted 16 tests [ran] | — | Decision | Decide permanent storage design or delete | Dec |
| AUD-002 | Critical | Verified complete | script-import-safety, db-safety, backup-consistency unit tests [ran] | — | — | None | — |
| AUD-003 | High | Open decision | Two role systems coexist [code][hist] | — | Decision | Decide single source of truth | Dec |
| AUD-004 | Medium | Superseded | Revised into AUD-024 [hist] | — | — | None | — |
| AUD-005 | High | Partially resolved | finance-workflow tests [ran]; no UI calls /transactions; chairs can approve; legacy pending w/o creator | — | Decision, UI | Decide approval rules; UI later | P2/Dec |
| AUD-006 | High | Verified complete | server/ gone, legacy-server-retired 5 tests [ran][code] | — | — | None | — |
| AUD-007 | Medium | Partially resolved | password-revocation 18, session-revocation 9 [ran] | — | Decision w/ AUD-012 | Decide multi-instance/refresh/storage | Dec |
| AUD-007B | Medium | Verified complete | password-session 5/5 [ran]; see NEW-10 | — | NEW-10 | None | — |
| AUD-007D | Medium | Verified complete | socket-reconnect 4/4 on rerun [ran]; failed once first pass, see NEW-10 | — | NEW-10 | None | — |
| AUD-008a | Medium | Verified complete | login-hardening 8 int + 6 unit [ran] | — | — | None | — |
| AUD-008b | Medium | Verified complete | message-contract node tests + browser specs [ran] | — | — | See NEW-22 | — |
| AUD-009a | Medium | Superseded (conditional) | Moot while storage unmounted [code] | — | AUD-001 | Revisit if storage remounted | — |
| AUD-009b | Medium | Verified complete | reactions, community-access int; browser spec 8/8 [ran] | — | — | None | — |
| AUD-010 | Medium | Verified complete | jwt-secret-config 9 tests [ran] | — | — | None | — |
| AUD-011 | Medium | Partially resolved | installs/lint/typecheck/build pass [ran]; unused root deps bcrypt/express@5/multer/@azure [code] | — | — | Prune root deps | P3 |
| AUD-012 | Medium | Partially resolved | Cluster refused at start [code][hist] | — | Decision | Decide multi-host support | Dec |
| AUD-012B | Medium | Verified complete | trusted-proxy, rate-limit-order [ran] | — | NEW-18 | None | — |
| AUD-013 | Medium | Open defect | `VITE_GEMINI_API_KEY` read client-side `geminiService.ts:22`, used by AiAuditPage [code] | — | — | Proxy AI via backend | P2 |
| AUD-014 | Low | Open defect | 9 generated files tracked (.vite 2, test-results 6, tsbuildinfo 1) [code] | — | — | Untrack and ignore | P3 |
| AUD-015 | Low | Open defect | CI runs lint/typecheck/unit + contract; no integration or browser suite [code] | — | runner script | Add suites to CI | P1 |
| AUD-016 | Low | Open defect | Both .env.example files exist [code] | — | — | Merge | P3 |
| AUD-017 | Info | Open decision | ai/email/pdf unmounted; storage commented [code] | — | Decision | Confirm intent | P3 |
| AUD-018 | Critical | Verified complete | society-authorization int, society-access unit [ran] | — | — | None | — |
| AUD-019 | High | Verified complete | importers authorization + Slack tests [ran]; residuals NEW-24 | — | — | None | — |
| AUD-020 | Medium | Verified complete | event-registrations, event-registration-index [ran]; legacy dup→503 (NEW-23) | — | — | None | — |
| AUD-021 | High | Verified complete | project-report-scope/reads [ran]; legacy mismatch (NEW-23) | — | — | None | — |
| AUD-022 | Medium | Partially resolved | announcement-ownership/visibility [ran]; UI create broken (NEW-06); legacy admin-only (NEW-23) | **Agent B** (NEW-06 part) | NEW-06 | Fix creation contract | P2 |
| AUD-023 | Medium | Verified complete | access-check, audit-write-counts [ran] | — | — | None | — |
| AUD-024 | High | Verified complete | socket integration files [ran]; per-process | — | Decision | None | — |
| AUD-025 | Medium | Partially resolved | society-pii [ran] covers 4 endpoints; /terms open (NEW-07) | **Agent A** (NEW-07 part) | NEW-07 | Scope terms reads | P1 |
| AUD-026 | Medium | Verified complete | society-patch [ran] | — | — | None | — |
| AUD-027 | Medium | Verified complete | role-management [ran]; policy in NEW-15 | — | — | None | — |
| AUD-028 | Medium | Partially resolved | isGrantingLevel fails closed [code][unit ran]; limited_own_scope/approval still full grant | — | Decision | Define level semantics | Dec |
| AUD-029 | Low | Verified complete | channel-default-scope [ran]; global default is first society | — | Decision (low) | Decide global default | Dec |
| AUD-030 | Low | Verified complete | opportunities-links, url-safety, proxy-policy [ran]; NEW-25 | — | — | None | — |
| AUD-031 | Low | Not reproduced | audit-write-counts 10 tests [ran] | — | — | None | — |
| AUD-032 | Low | Verified complete | note-visibility [ran]; leadership private-note read = policy | — | Decision | None | Dec |
| AUD-033 | — | Verified complete | dm-recipients 18 int + 3 browser [ran]; commit 70ff8bd | — | — | None | — |
| AUD-034 | — | Not reproduced | rate-limit-budget 5 + limiter tests [ran]; commit 70ff8bd | — | NEW-18 | None | — |

## Findings without an original ID (25)
| ID | Sev (assessed) | Status | Evidence | Owner | Deps | Next action | Pri |
|---|---|---|---|---|---|---|---|
| NEW-01 Calendar unified leak | High | Verified complete | calendar-conversations-authz [ran] | — | — | None | — |
| NEW-02 POST /conversations validation | Medium | Verified complete | same file + AUD-033 [ran] | — | — | None | — |
| NEW-03 Public registration closed | High | Verified complete | registration-policy [ran] | — | NEW-17 | None | — |
| NEW-04 Task update mass assignment | Medium | Verified complete | task-ownership [ran] | — | — | None | — |
| NEW-05 Task create society scope | Low | Partially resolved | backend tested; Tasks page only node-helper tested | — | — | Browser test | P2 |
| NEW-06 Announcement create contract | Medium | Open defect | UI sends {title,content,priority}; backend requires targetAudience → 400 [code, not run] | **Agent B** | policy approved (see DECISIONS) | Align form/service/backend | P2 |
| NEW-07 Society terms exposure | Medium–High | Open defect | societies.js:710 no scope check; populates chair/treasurer name+email; budgets in model [code] | **Agent A** | policy approved; sensitive fields may BLOCK | Scope reads + field protection | P1 |
| NEW-08 Channel members calls | Medium | Open defect | FE calls POST/DELETE /channels/:id/members; no server route [code] | — | Decision | Implement or remove calls | P2 |
| NEW-09 Frontend 429 handling | Low | Open defect | none in frontend/src [code] | — | — | Friendly message | P3 |
| NEW-10 Intermittent browser failures | — | Not verified | password-session earlier (uncaptured); socket-reconnect failed once in AUD-035, 4/4 on rerun | — | traces | Diagnose | P2 |
| NEW-11 Lazy model index races | Medium | Not verified | SocietyTerm required lazily societies.js:712; unique (society,academicYear) index; no race reproduced [code] | **Agent A** + **Agent C** (independent) | evidence | Reproduce deterministically, fix only if confirmed | P1 |
| NEW-12 Dependency audit never run | Unknown | Not verified | needs network + approval | — | approval | Approve and run | P1 |
| NEW-13 Seed accounts | Unknown | Not verified | literal-password seeds exist; guarded by dbSafety; deployed seeding unknown | — | — | Confirm | P2 |
| NEW-14 Backup/restore | Medium | Open decision | plaintext hashes; non-atomic restore; legacy reports collection [hist] | — | Decision | Decide | Dec |
| NEW-15 Matrix authority | Medium | Open decision | society advisors edit any role's perms; matrix readable by all [hist] | — | Decision | Decide | Dec |
| NEW-16 Org-wide reads | Low–Medium | Open decision | events/projects/dashboards open to all signed-in users | — | Decision | Decide | Dec |
| NEW-17 Onboarding | Medium | Open decision | register makes society-less roleless accounts; no assignment API; token returned | — | Decision | Decide | Dec |
| NEW-18 Rate-limit deployment | Medium | Open decision | per-address key, in-memory; TRUST_PROXY needs topology | — | Decision | Decide | Dec |
| NEW-19 Stale e2e.spec.ts / tsconfig.app.json | Low | Open defect | targets :5000 + public registration; unused config [code] | — | — | Remove/fix | P3 |
| NEW-20 Duplicate permission requests | Low | Open defect | login() + ProtectedRoute both fetchPermissions [code]; dev StrictMode doubles | — | — | Dedupe | P3 |
| NEW-21 Dormant auditLogger | Low | Open decision | defined in middleware/rbac.js, no callers [code] | — | Decision | Remove? | P3 |
| NEW-22 Sidebar lastMessage.content | Low | Open defect | backend never sends lastMessage; Message type has body [code] | — | — | Fix with contract | P3 |
| NEW-23 Legacy data | Medium | Open decision | dup registrations, null isPublic, mismatched reports, creator-less pending tx, missing perms [hist] | — | Decision | Migration plan | Dec |
| NEW-24 Importer residuals | Low | Open defect | Todoist no validation; no transaction; dup imports [hist] | — | — | Harden | P3 |
| NEW-25 Stored URL fields | Low | Open defect | avatarUrl/logoUrl/imageUrl unvalidated [hist] | — | — | Validate | P3 |

Status key: Verified complete · Partially resolved · Not reproduced · Open defect · Open decision ·
Not verified/blocked · Superseded.

- Batch 2 (2026-10-29): preflight done; NEW-08, AUD-013, AUD-015, NEW-10, NEW-19, AUD-014 tracked in BATCH2_TODO.md. Statuses above unchanged (nothing fixed).

- Batch 2 (2026-10-29): NEW-08 and AUD-013 FIXED in integration/batch2 (uncommitted, gated). NEW-10 still open with new evidence (can fail standalone). AUD-015/NEW-19/AUD-014 await decisions. See BATCH2_TODO.md.
