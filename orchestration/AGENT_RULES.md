# AGENT_RULES — SB-APP three-agent workflow

These rules bind every agent (A, B, C) and the coordinator. Where a rule and a task prompt disagree,
the stricter one wins; if still unsure, STOP and report to the coordinator.

## 1. Repository safety (absolute)
- `D:\SB-APP` is the **protected baseline checkout**. Never edit, stage, commit or run tools from it
  except the coordinator. Work only in your assigned worktree.
- **Never open, read, search, hash, list the contents of, modify, rename, move, delete, stage or
  commit `digest.txt`.** It exists only in the protected checkout. Do not run bulk commands that could
  sweep it in (no `git add .`, `git add -A`, wildcard adds, recursive greps over `D:\SB-APP`).
- No `git add`, `git commit`, `git push`, `git merge`, `git rebase`, `git reset`, `git clean`,
  `git checkout`/`switch`/`restore`, `git stash`, `git branch -D`, `git worktree add/remove`.
  Allowed git: `status`, `diff` (without --cached on other trees), `log`, `show`, `rev-parse`,
  `branch --show-current`, `ls-files`, `grep`. **Agents never commit or push.**
- No dependency, manifest or lockfile changes (`package.json`, `package-lock.json`). No installs, no
  browser downloads, no environment-variable changes (do not set or clear persistent variables).
  `node_modules` in each worktree is a junction to the protected checkout's existing install:
  read-only for you — never write inside it.
- No persistent database. No seed/restore/clearData/backup scripts. Database-backed verification uses
  ONLY the isolated MongoMemoryServer harness through the runner scripts below.
- Do not use the legacy `test/contract` suite, root `verify-rbac-matrix.js` or `e2e.spec.ts`
  (they target `localhost:5000`).
- No security-policy, architecture or product decisions. If the existing code and permission model do
  not settle a question, mark the subtask BLOCKED, write the evidence and the options, and stop.
- Never weaken a test, assertion, rate limit or security check to obtain a pass.

## 2. File ownership (no concurrent edits)
- Edit only files in your own ownership list (TASK_BOARD.md). New test files must be named inside your
  owned patterns.
- **Shared files nobody edits without coordinator approval:** `backend/test/integration/helpers/*`
  (including `fixtures.js`, `target.js`, `session.js`), `frontend/tests/session/support.ts`,
  `frontend/playwright.session.config.ts`, all manifests/lockfiles, `backend/src/server.js`,
  `backend/src/routes/index.js`, `backend/src/middleware/*`. If you need a change there, stop and
  request it. Tests that need extra fixture data create it inside the test itself.
- If you discover that your change needs a file someone else owns, pause and report; the coordinator
  reassigns ownership. Do not "just fix it".

## 3. Test execution
- Focused unit tests: `node --test <file>` from your worktree's `backend/` — no ports, run freely.
- Integration and browser tests all use the same fixed ports (harness 127.0.0.1:5057, Vite 5174), so
  they run ONLY through these runners, which take a cross-worktree lock and wait their turn:
  - `node D:/SB-APP-orchestration/scripts/run-integration.js --worktree <your worktree root, forward slashes> test/integration/<file>.test.js`
  - `node D:/SB-APP-orchestration/scripts/run-browser.js --worktree <your worktree root, forward slashes> tests/session/<name>.spec.ts --trace retain-on-failure`
  - Use exactly this form (it is the only harness command permitted). Integration paths are relative to `backend/`, browser specs to `frontend/`.
  - One browser spec per invocation (fresh harness each; the shared 300/15 min limiter is never relaxed).
  - Do not start the harness, mongod or Vite any other way. Do not kill other processes.
- Agent C never runs harness tests unless the coordinator says so.
- **Record failures before rerunning.** A failing run is evidence: keep its output (and the trace /
  `error-context.md`) and report it, even if a rerun passes. Never silently discard an intermittent
  failure. State exactly which command produced which counts.
- Distinguish in every report: code inspection vs tests actually executed vs reported-by-others.
- Static checks (`npm run typecheck`, `lint`, `build` in `frontend`; `eslint` in `backend`) are run by
  the coordinator at integration unless you are told otherwise. `build` rewrites tracked
  `frontend/tsconfig.tsbuildinfo` and creates `dist`: restore/remove after (coordinator only).

## 4. Reporting standard (final message of every agent)
1. Task ID and one-line outcome (done / blocked / partially done).
2. Changed and new files (with why), and confirmation nothing outside ownership changed.
3. Root cause (reproduced before the fix, how) and behavior before/after.
4. Exact commands run and observed results (pass/fail/skip counts); anything NOT run, with reason.
5. Red check: which new tests fail against the unfixed code (if you ran it), or say it was not run.
6. Remaining risks, policy ambiguity, decisions needed.
7. `git status --short` and `git rev-parse --short HEAD` of your worktree.
Write facts, not optimism: a claim without an observed result is labelled "not run".

## 5. Integration approval
- Agents do not merge, cherry-pick or hand over commits. The coordinator reviews every diff against the
  task scope, runs the cross-task regression sequentially, and presents the plan to the user.
- Branches and worktrees are preserved until the user approves integration and cleanup.
- Nothing is marked complete in MASTER_TODO.md because an agent says so; the coordinator needs
  independently observed evidence.
