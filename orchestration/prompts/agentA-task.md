===== Your file ownership (TASK_BOARD.md) =====
Edit ONLY:
- backend/src/routes/societies.js
- backend/src/models/SocietyTerm.js
- backend/src/models/index.js (only if the NEW-11 fix needs it)
- new backend/test/unit/society-terms*.test.js
- backend/test/integration/society-*.integration.test.js (create new files named society-terms*.integration.test.js; edit an existing society-* file only if an assertion directly encodes the old /terms behavior, and then report it)
Frontend: read-only. Your tool permissions enforce this list.

Harness commands (the only permitted form, run from the worktree root):
  node D:/SB-APP-orchestration/scripts/run-integration.js --worktree D:/SB-APP-worktrees/terms test/integration/<file>.test.js
Unit tests: cd backend && node --test test/unit/<file>.test.js
Lint: cd backend && npx eslint <file>

Background you can use:
- AUD-035 found that GET /societies/:id/terms (backend/src/routes/societies.js, around line 710) has no scope check and populates chair and treasurer name and email. SocietyTerm also has allocatedBudget, openingBalance and closingBalance.
- The same file already has society guards and the AUD-025 PII redaction (canSeeSocietyPii / redactSociety). Existing integration tests society-pii and society-authorization show the harness patterns.
- Harness fixtures: admin, chairA, memberA, chairB, loner (backend/test/integration/helpers/fixtures.js - do not edit helpers; create extra data inside your own test).
- A comparable first-write index race was confirmed and fixed for EventRegistration in backend/src/routes/events.js (model loaded at start-up, await Model.init() before the write). Tests: backend/test/integration/event-registration-index.integration.test.js and backend/test/unit/event-registration-scope.test.js. Use it as the reference pattern, but reproduce NEW-11 for SocietyTerm yourself first.

===== Your task =====
You are Agent A, responsible for NEW-07 / AUD-025 and the evidence-based NEW-11 fix.

Follow the rules above.

Inspect the SocietyTerm route, model, existing authorization helpers, and related tests. Implement same-society read restrictions and field-level sensitive-data protection using only existing, explicitly authorized permissions. Do not invent a new permission.

Investigate the first-write/index race. Reproduce it deterministically before fixing it. If confirmed, implement a minimal safe initialization guard and regression test. Do not drop or rebuild indexes destructively.

Work only in your assigned worktree. Do not edit announcement or conversation files. Do not stage, commit, or push.

Run focused unit tests. Integration tests must use the approved isolated harness (the runner form above) and must not compete with Agent B for a shared port; the runner serialises on a lock and will wait for its turn.

If the existing permission model does not establish who may see emails or budgets, mark that subtask BLOCKED, state the evidence and the options, implement everything else, and stop for a decision.

Report changed files, root cause, tests actually run, remaining policy ambiguity, and Git status (see section 4 of the rules). Stop after your assignment.
