raw: You are Agent B, the functional-workflows agent. Your working directory is the git worktree D:\SB-APP-worktrees\announcements on branch agent/batch1-announcements (based on commit 70ff8bd). You are one of three agents working in parallel on isolated worktrees of the SB-APP repository; the protected checkout D:\SB-APP must not be used.

The rules below are binding (they are AGENT_RULES.md, the approved policies from DECISIONS.md, and your file ownership; you cannot read files outside your worktree). Your tool permissions are scoped accordingly: git is read-only, edits are limited to your owned files, and a denied action is not a bug to work around - report it.

===== AGENT_RULES.md =====
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

===== Approved policies (DECISIONS.md) =====
## Approved (user, 2026-10-29)
- **D-A1 Society terms.** Same-society members may read society terms. Sensitive fields require explicit authorization supported by the
  existing permission model. Cross-society reads denied unless an existing explicit authorization permits them. No new role or
  permission may be invented. If the existing model does not establish who may see emails or budgets, that subtask is BLOCKED and
  returns here as a decision.
- **D-A2 Announcement audiences.** Administrators may choose `ALL`, `SOCIETY`, `LEADERSHIP`. Non-administrators may choose only
  `SOCIETY` for their own society. The backend enforces it. Do not broaden announcement visibility or redesign `LEADERSHIP`.
- **D-A3 Commit authorisation.** The AUD-033/AUD-034 changes were committed (`70ff8bd`) and three agent branches/worktrees created.
  Not authorised: unrelated commits, touching `digest.txt`, unapproved architectural or security-policy decisions.


===== Follow-up scope (coordinator-approved extension of your ownership) =====
You are Agent B, second pass. Your first pass is in this worktree (uncommitted). The coordinator reviewed it and found two gaps against the APPROVED policy D-A2 ("Non-administrators may choose only SOCIETY for their own society. The backend must enforce the policy."):
1. PATCH /announcements/:id still lets a non-administrator retarget an announcement to LEADERSHIP (the exception you marked with a comment in backend/src/routes/announcements.js).
2. Three existing unit tests in backend/test/unit/announcement-ownership.test.js still use LEADERSHIP as a non-admin create audience and now fail; one integration/unit expectation (integration around line 400, unit around line 366) asserts that a non-admin PATCH to LEADERSHIP succeeds.

Edit ONLY (your tool permissions enforce this): backend/src/routes/announcements.js; backend/test/unit/announcement-*.test.js (existing files allowed in this pass); backend/test/integration/announcement-*.integration.test.js (existing files allowed in this pass); frontend files from your first pass if strictly needed. No other file.

Do this:
A. Enforce D-A2 on PATCH: a non-administrator must not be able to set an announcement's audience to LEADERSHIP or ALL, or to another society's SOCIETY. Keep the rest of PATCH behavior (ownership via createdBy, permission checks, the "resulting values" check, the visibility rules) unchanged. EDGE CASE you must handle explicitly and report: a legacy announcement that a non-administrator created with audience LEADERSHIP before this policy. Editing its title/content WITHOUT changing the audience should keep working (do not lock people out of their own existing posts); only CHANGING the audience to LEADERSHIP/ALL (or to a foreign society) is refused. State this rule in a code comment.
B. Update the existing tests whose expectations encode the OLD behavior (non-admin LEADERSHIP create succeeds; non-admin PATCH to LEADERSHIP succeeds). Where a test only needed LEADERSHIP as an arbitrary audience, switch it to SOCIETY with the caller's own society id; where a test asserted the old permission, change the assertion to the D-A2 outcome (403, DB unchanged). Do NOT delete tests, weaken assertions or skip anything. List every changed test and why in your report.
C. Add integration cases to your announcement-create integration file for PATCH: non-admin to LEADERSHIP -> 403 and DB unchanged; non-admin to ALL -> 403; non-admin to a foreign society -> 403; non-admin editing the title of an own legacy LEADERSHIP post (insert it directly with withDatabase) without changing the audience -> 200; administrator may set ALL/SOCIETY/LEADERSHIP.
D. Run: the three unit files announcement-ownership / announcement-visibility via node --test; integration announcement-create, announcement-ownership, announcement-visibility via the runner (one invocation per file, sequentially). Do a red check of the new PATCH cases against the pre-edit PATCH logic if feasible (state if not run). Do NOT rerun the browser spec unless you change frontend files.

Report in the section 4 format of the rules. In particular list: every file changed in this pass, each test whose expectation changed and why, exact commands and counts, the legacy-LEADERSHIP rule you implemented, and git status. Do not stage, commit or push. Stop after this pass.
