# 00 - Current state (lead orchestrator, 2026-10-30) - read-only inspection

All facts below were observed with git commands in this session (not copied from earlier reports).

## Worktree inventory
| Path | Branch | HEAD | Commits ahead of 70ff8bd | Staged | Dirty entries |
|---|---|---|---|---|---|
| D:\SB-APP (protected) | feature/sb-app-security-hardening | 70ff8bd | 0 | 0 | only `?? digest.txt` (never opened) |
| worktrees\terms | agent/batch1-terms | 70ff8bd | 0 | 0 | 3 (societies.js; society-terms integration + unit tests) |
| worktrees\announcements | agent/batch1-announcements | 70ff8bd | 0 | 0 | 8 |
| worktrees\qa | agent/batch1-qa | 70ff8bd | 0 | 0 | 0 (clean) |
| worktrees\batch1-integration | integration/batch1 | 70ff8bd | 0 | 0 | 13 |
| worktrees\batch2-channel | agent/batch2-channel-contract | 70ff8bd | 0 | 0 | 2 |
| worktrees\batch2-gemini | agent/batch2-gemini-security | 70ff8bd | 0 | 0 | 14 incl. untracked `frontend/test-results/session/` (a leftover from my own browser-spec run; ignored-by-nothing, not part of the change) |
| worktrees\batch2-integration | integration/batch2 | 70ff8bd | 0 | 0 | 15 |
`main` is 8c522a8 (unrelated). No Agent C worktree/branch exists yet (names agent/batch2-regression-ci and the like are free). No commits exist since 70ff8bd on any branch. All worktrees share the expected base.

## Dirty-file inventory
- Batch 1 candidate (integration/batch1, 13): M announcements.js, societies.js, announcement-ownership integration+unit tests, society-access unit test, AnnouncementFormPage.tsx, services/announcements.ts, types/models.ts; new announcement-create integration test, society-terms-authorization integration test, society-terms integration test, society-terms unit test, announcement-create.spec.ts.
- Batch 2 candidate (integration/batch2, 15): M config/gemini.js, aiController.js, rateLimiter.js, routes/ai.js, routes/index.js, GeminiService.js, AiAuditPage.tsx, services/channels.ts, services/geminiService.ts; new financialSummary.js, ai-financial-insights integration test, ai-gemini unit test, ai-audit.spec.ts, channels-contract node test, no-client-gemini-key node test.
- No overlap between the two candidates' file lists. No deleted tracked files. Nothing staged anywhere.

## Leftovers
No mongod process, no listener on 5057/5174, harness lock directory empty.

## Existing evidence (previously reported / coordinator-run in earlier sessions; NOT re-run yet in this phase)
- Batch 1 gate (reports/gate/): unit 709, integration 635, frontend Node 40, browser 27, typecheck/lint(0 errors)/build OK; socket-reconnect first attempt failed, standalone rerun 4/4.
- Batch 2 gate (reports/batch2/gate/): unit 689, integration 598, frontend Node 45, browser 28; reactions spec first attempt timed out (rerun 8/8); socket-reconnect failed in chain and once standalone, then 4/4 twice; baseline in qa 4/4.
- These are two different candidates on the same base; their totals must not be added. A combined gate must produce its own numbers (Phase 4).

## Completed work (do not redo)
Batch 1 code and tests (D-01, D-22, D-23, D-20, D-21 implemented). Batch 2: NEW-08, AUD-013 implemented. Agent C has done only a read-only investigation (reports/batch2/2026-10-29_preflight.md) - no worktree.

## Outstanding
Phase 1 verification of Batch 1 incl. D-24; Phase 2 verification of Batch 2 plus D-B10/D-B11 changes; Agent C tasks C1-C4; combined gate; git review; final register.

## Decisions status (as of this prompt)
- D-24: the prompt states the proposed policy (settings:edit holders: society chair, society faculty advisor, SB chair, SB faculty advisor; treasurer/vice chair/secretary/webmaster excluded). It matches what integration/batch1 implements. DECISIONS.md still lists it as pending, so I record it as "proposed, matches implementation, awaiting explicit approval" and do NOT claim it as approved.
- D-B10: the prompt requires that NO transaction data goes to Gemini. Treated as the decision. Current batch2 code violates it (single-society prompts include up to 20 transactions) - to be fixed in Phase 2.
- D-B11: the prompt requires legacy ADMIN to be authorized through the existing admin mechanism. Current batch2 code requires finance:view only - to be fixed in Phase 2.
- D-B5/D-B7/D-B8 (CI, artifact untracking, npm audit): this prompt asks for them explicitly (C1, C3, C4); treated as authorized, in an isolated worktree, uncommitted.

## Discrepancies from the historical baseline
None material. Minor: the untracked test-results folder in batch2-gemini (mine).

## Blockers
None for continuing. The only open approval is D-24 (and any commit/merge).

---

# PHASE 0 RE-ESTABLISHED (CEO / orchestrator, 2026-11-01)

This section is authoritative where it differs from the text above, which was written on 2026-10-30 and predates the `batch2-ci` and `combined` worktrees. Charter name for this file: `00-CURRENT-STATE` (see `INDEX.md`).

## 1. Git / worktree baseline - re-verified with read-only git

Verified this session with `git status`, `git log`, `git rev-parse` and `git worktree list` run in each working directory. **All 10 worktrees are at `70ff8bd`; no commits exist on any branch since `70ff8bd`; nothing is staged anywhere except the 9 intentional generated-file deletions.** Every dirty-file count matches what `00` (above), `03-agent-c-report.md` and `04-combined-regression-gate.md` recorded - no drift, no overwritten work, no lost changes.

| Path | Branch | HEAD | Dirty entries |
|---|---|---|---|
| `D:\SB-APP` (protected) | feature/sb-app-security-hardening | 70ff8bd | only `?? digest.txt` - never opened, searched or hashed |
| `worktrees\terms` | agent/batch1-terms | 70ff8bd | 3 |
| `worktrees\announcements` | agent/batch1-announcements | 70ff8bd | 8 |
| `worktrees\qa` | agent/batch1-qa | 70ff8bd | 0 (clean) |
| `worktrees\batch1-integration` | integration/batch1 | 70ff8bd | 13 |
| `worktrees\batch2-channel` | agent/batch2-channel-contract | 70ff8bd | 2 |
| `worktrees\batch2-gemini` | agent/batch2-gemini-security | 70ff8bd | 14 (incl. a leftover untracked `frontend/test-results/session/`) |
| `worktrees\batch2-integration` | integration/batch2 | 70ff8bd | 15 |
| `worktrees\batch2-ci` | agent/batch2-regression-ci | 70ff8bd | Agent C's C1 CI scripts/workflow + the 9 C3 generated-file untrackings, as recorded in `03-agent-c-report.md` |
| `worktrees\combined` | integration/combined | 70ff8bd | 41 (32 copied files + 9 staged index deletions) |

`main` is `8c522a8` (unrelated). **Total work at risk: 32 distinct uncommitted files.**

**One thing git cannot see:** `worktrees\combined\frontend\test-results\` exists on disk and holds the only copy of the combined gate's NEW-10 traces. It is invisible to `git status` because Agent C's `.gitignore` change ignores `test-results/`. A `git clean` in that worktree would destroy the only evidence of the live NEW-10 failure. Harvest it (read-only copy into `completion\raw\`) before anything else touches that worktree.

## 2. Repository maps (new this session)

- `03-architecture-map.md` - middleware order with line numbers, 23 mounted routers + 1 unmounted, **129 endpoint declarations / 125 reachable**, 30 models, both authorization systems, sockets, and every dormant/unreachable/dead code path.
- `02-feature-inventory.md` - 33 feature chains (page -> client -> mount -> router -> models) with six new Phase-0 findings (F-01..F-06).
- `14-combined-regression-gate.md` - the corrected gate record **and** the counted test baseline.

## 3. Test baseline - counted from the test files

Counted, not copied from reports. The counting method reproduces observed run totals **exactly** for all four frontend suites in both trees, which is why the backend figures are trustworthy too.

- Protected baseline `70ff8bd`: **1,243 declaration sites** across 57 files (unit 608/45 files, integration 560/38, contract 5/2 *excluded - localhost:5000, NEW-19*, frontend Node 40/6, browser 25/5, stale `e2e.spec.ts` 5/1 *not run*).
- `integration/combined`: **1,339 gate-runnable declaration sites** across 104 files (unit 645/47, integration 619/42, frontend Node 45/8, browser 30/7).
- Backend unit expands at runtime: 645 sites -> **718 executed tests**. More executed tests than sites is only possible through re-entered sites (loops / table-driven helpers). Full expansion is ~1,412 executed tests.
- The previously circulated "~1,441 unique tests" came from adding reported executions and is **superseded**.

## 4. New findings from the repository (not in any earlier register)

- **F-02 / NEW-17 confirmed at code level**: `/register` is publicly routed (`frontend/src/routes.tsx:46`, outside `ProtectedRoute`) while registration is admin-only server-side. Needs decision D-27.
- **F-01**: `frontend/src/services/googleDriveService.ts` is dead code - a complete Google Drive OAuth upload flow with no caller. Needs decision D-28 (feature removal).
- **F-03**: `projectReports.js` is mounted twice (`/project-reports` and `/reports`), doubling the reachable surface. D-29.
- **F-04**: 9 API calls bypass the `services/` layer (`TasksPage.tsx` 4, `KanbanBoardView.tsx` 3, `SocietySwitcher.tsx` 1, `authStore.ts` 1).
- **F-05**: `frontend/package.json` `"test:unit"` is a stub (`echo "No tests yet"`); the real frontend Node tests are wired to no npm script. Folds into AUD-015 / D-B5.
- **F-06**: ten mounted backend areas have no frontend client module.
- Baseline confirmation of AUD-017: `routes/ai.js`, `routes/email.js`, `routes/pdf.js` are not imported **and declare zero routes**, so the baseline has no server-side AI endpoint at all - which is exactly why AUD-013 (browser-side Gemini key) existed. `integration/batch2` adds the server-side route; do not re-implement it.

## 5. Permission denials in this session (recorded, not worked around)

`git -C <path>` is denied (the allow rules only match commands starting with `git status`/`git log`/...); the same read-only commands were run with the working directory instead. Also denied: `find`, shell loops containing variables, `sed`/`awk` inside pipelines, `mv`, `rm`. Nothing was circumvented; file maps were built with the Glob/Grep tools instead. `digest.txt` was never opened, read, searched, hashed, moved or staged.

## 6. Status

Phase 0 complete. Phase 1 has two gaps (8 unlaunched integration files + `socket-reconnect`) and needs an independent reviewer who is not an implementer. **No P0.** Open P1: the two critical dependency findings (`dompurify`, `proxy-addr` - the latter coupled to NEW-18 / AUD-012B / AUD-034), NEW-12, AUD-015 (implemented, unapproved), NEW-11 and NEW-07/AUD-025 (fixed, uncommitted). Blocking decisions: D-24, D-B5, D-B6, D-B7, D-26 (+ new D-27). Top risk: 32 verified files still uncommitted.
