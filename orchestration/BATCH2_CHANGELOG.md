# Batch 2 changelog
## 2026-10-29 - Phase 0 preflight and plan only
Read-only inspection (git status/log, file reads, grep). No code changed anywhere, no worktree or branch created, no test or build run, no agent started. Documents written in D:\SB-APP-orchestration: BATCH2_PLAN/TODO/DECISIONS/TASK_BOARD/CHANGELOG, reports/batch2/2026-10-29_preflight.md. Stopped at policy boundaries (D-B1..D-B9).

## 2026-10-29 - NEW-08 and AUD-013 implemented; Batch 2 candidate gated (NOT committed/merged)
Candidate: D:SB-APP-worktreesatch2-integration, integration/batch2 at 70ff8bd, 15 entries, no Batch 1 code. Copies from the two worktrees are byte-identical (reports/batch2/integration-copy-manifest.txt).
Gate (coordinator-run, final tree, raw output in reports/batch2/gate/):
- backend unit 689/689 (exit 0); backend eslint exit 0; integration 39 files 598/598 (exit 0 both halves); frontend typecheck, lint (0 errors, 10 warnings = baseline), build exit 0; frontend Node tests 45/45.
- browser: ai-audit 3/3, community-and-channel 5/5, dm-recipients 3/3, password-session 5/5 first attempt. reactions-and-community-access FAILED on first attempt (test 6 hit the 90 s timeout; the report shows 1.9 h of wall-clock for it, consistent with the computer suspending during the run - not proven); standalone rerun 8/8. socket-reconnect FAILED on first attempt (1 passed, 1 failed, 2 not run, "the websocket did not close when offline"); standalone rerun 1 failed again; two further standalone reruns 4/4 each; baseline in qa 4/4.
- Distinct tests: 689 + 598 + 45 + 28 browser = 1,360 (AUD-035 baseline 1,335; +8 unit, +9 integration, +5 frontend node, +3 browser = +25). Reruns not counted as additional tests.
Failures during development (kept): (1) first integration run of ai-financial-insights: 6/9 failed - the shared fixtures grant nobody finance:view; test setup now creates it as finance-workflow.integration.test.js does. (2) second run: 2/9 failed - the AI limiter was counting 400/403 requests; validation/scope checks moved before the limiter so only requests that would call Gemini use quota. (3) browser spec first run: exact-request-count assertion failed because the dev server's React StrictMode mounts the page twice; assertion relaxed to "every request carries no data".
Red checks: channels contract test fails 2/3 on baseline; baseline bundle contains a fake VITE_GEMINI_API_KEY, fixed bundle does not. The ai-audit browser spec and the integration tests were not red-checked on baseline.
Housekeeping incident: this shell's ln -s created full node_modules COPIES (not links) in the new worktrees and qa/frontend; I verified they were plain directories, deleted only those copies, and used junctions; D:SB-APP node_modules intact. qa verified clean.
Not run: contract suite/e2e (localhost:5000), npm audit, CI changes, any real Gemini call.
Safety: protected checkout 70ff8bd with only digest.txt (never opened); no commit/push/merge/stage; no mongod/listener/lock left.
