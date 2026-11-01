# 14 - Combined regression gate + counted test baseline (Phase 0, 2026-11-01)

Charter name: `14-COMBINED-REGRESSION-GATE`. This supersedes `04-combined-regression-gate.md`, which is kept (not renamed, not deleted) and already carries the owner-side CORRECTION of 2026-11-01. Where the two differ, **this file is authoritative**.

Candidate: `D:\SB-APP-worktrees\combined`, branch `integration/combined`, base `70ff8bd`, 41 uncommitted entries (32 copied files byte-identical to their sources per `raw/combined-copy-manifest.txt`, plus 9 staged index deletions of generated files). Contents: Batch 1 (13 files) + Batch 2 (15) + Agent C (4). No file in more than one set. **Nothing committed.**

## 1. The gate did finish

`04`'s original text said the gate was "unrun beyond unit/eslint/typecheck". That was wrong, and the owner has confirmed the correction. Only the shell wrapper was stopped; the driver kept running to **14:04:37** (`raw/combined/progress.txt` ends with FIN, and the ten raw files in `raw/combined/` are timestamped 13:54-14:04, i.e. after `04` was written at 13:53).

| Step | Exit | Result (read from `raw/combined/*.raw` this session) |
|---|---|---|
| backend unit | 0 | `tests 718 / pass 718 / fail 0 / skipped 0 / suites 0` |
| backend eslint | 0 | clean |
| backend syntax typecheck | 0 | 221 files |
| backend integration | **1** | **34 of 42 files ran: 557 pass, 0 fail.** 8 files never started |
| frontend typecheck | 0 | clean |
| frontend lint | 0 | 0 errors, 10 warnings (= baseline) |
| frontend Node tests | 0 | 45 / 45 |
| frontend build (fake Gemini key) | 0 | built |
| bundle secret check | - | fake key in **0** dist files; `generativelanguage` in **0** |
| browser (7 specs) | **1** | 27 / 30 passed, 1 failed, 2 not run |

## 2. The two non-zero exits

**(a) Integration exit 1 is environmental, not a test failure.** Eight files recorded `tests exit=3221225794` (`0xC0000142`, STATUS_DLL_INIT_FAILED - a process that could not initialise) with `harness exit=0` and the ready file removed: the harness was healthy, the test process could not launch. Consistent with the host memory exhaustion. Verified in `raw/combined/backend-integration.raw:1225-1257`. These are **"not run"**, and must never be reported as defects:

1. `socket-auth.integration.test.js`
2. `socket-reconnect.integration.test.js`
3. `socket-rooms.integration.test.js`
4. `socket-typing-presence.integration.test.js`
5. `storage-unmounted.integration.test.js`
6. `task-create.integration.test.js`
7. `task-ownership.integration.test.js`
8. `trusted-proxy.integration.test.js`

Note which ones these are: socket lifecycle, the AUD-001 storage guard, task ownership, and trusted proxy. Those are exactly the areas with open findings (NEW-10, AUD-001, NEW-01/04/05, NEW-18) - so the missing 8 files are the *least* acceptable ones to leave unrun.

**(b) Browser exit 1 is NEW-10**, identical to every previous occurrence: `support.ts:217` in `dropConnection`, "the websocket did not close when offline", 20 s poll timeout. Every other spec passed on the **first attempt**, including `reactions-and-community-access` 8/8, which had timed out during the Batch 2 gate.

**Incidental but useful:** the bundle check passing on the combined tree is the strongest evidence so far that AUD-013 is fixed - no key and no provider hostname in the production bundle.

## 3. Verdict

**Substantially green, with exactly two gaps: 8 integration files to re-run, and `socket-reconnect`.** This is **not a passed gate** and authorises nothing (charter §21: a passing build is not completion). Estimated cost to close: ~6-8 min for the integration files plus one browser spec, isolated harness, sequential.

## 4. Counted test baseline (from the actual test files, not from reports)

Method: count declaration sites matching `(^|[^.\w])(test|it)\(` per file, per directory. **The method is validated**: it reproduces the observed totals *exactly* for all four frontend suites across both trees (40 and 45 Node tests; 25 and 30 browser tests). Historical totals are never added across trees.

### Protected baseline `D:\SB-APP` (`70ff8bd`)

| Suite | Files | Declaration sites | Observed in a run |
|---|---|---|---|
| `backend/test/unit` | 45 | 608 | 681 reported by AUD-035 (not re-run here) |
| `backend/test/integration` | 38 | 560 | 589 reported by AUD-035 |
| `backend/test/contract` | 2 | 5 | **excluded from all gates** - targets `localhost:5000` (NEW-19) |
| `frontend/tests/unit/*.node-test.mjs` | 6 | **40** | 40 ✔ exact match |
| `frontend/tests/session/*.spec.ts` | 5 | **25** | 25 ✔ exact match |
| `frontend/tests/e2e.spec.ts` | 1 | 5 | **not run** - stale legacy spec (NEW-19) |
| **Total** | **57** | **1,243** | |

### Candidate `integration/combined`

| Suite | Files | Declaration sites | Observed in the gate |
|---|---|---|---|
| `backend/test/unit` | 47 | 645 | **718 executed** (all passed) |
| `backend/test/integration` | 42 | 619 | 557 passed in the 34 files that ran |
| `frontend/tests/unit` | 8 | **45** | 45 ✔ exact match |
| `frontend/tests/session` | 7 | **30** | 30 ✔ exact match |
| `frontend/tests/e2e.spec.ts` | 1 | 5 | not run (stale) |
| `backend/test/contract` | 2 | 5 | not run (legacy) |
| **Gate-runnable total** | **104** | **1,339** | |

### The one delta I can explain only mechanically

Backend unit: **645 declaration sites produced 718 executed tests** (the reporter printed 718 individual result lines; `suites 0`). More executed tests than declaration sites is only possible if sites are re-entered at runtime - loops or table-driven helpers around a `test(`/`t.test(` call (`t.test(` appears once in the baseline unit suite). The same ratio appears against the AUD-035 baseline figures (608 sites -> 681 executed; 560 -> 589).

So: **1,339 declaration sites, ~1,412 executed tests at full expansion.** Both numbers are honest; neither is a count of "unique behaviours". Pinning which files generate tests dynamically is a cheap QA follow-up (diff per-file result lines against per-file sites) and is recorded in `MASTER-TODO.md` as QA-03. The earlier "~1,441 unique tests" estimate was derived by adding reported executions and is **superseded** by the counted figures here.

Observed in that single combined run: **1,347 tests passed** (718 + 557 + 45 + 27), **1 failed** (NEW-10), 2 browser tests and the ~91 tests in the 8 unlaunched integration files **not run**.
