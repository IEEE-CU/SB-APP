===== Your file ownership (TASK_BOARD.md) =====
Edit ONLY:
- backend/src/routes/announcements.js
- frontend/src/pages/announcements/** (Form, List, Detail pages)
- frontend/src/services/announcements.ts
- frontend/src/types/models.ts (the Announcement interface only)
- new backend/test/unit/announcement-*.test.js
- new backend/test/integration/announcement-*.integration.test.js (existing announcement-ownership / announcement-visibility files only if directly required, and then report it)
- new frontend/tests/session/announcement-create.spec.ts
backend/src/models/Announcement.js is NOT yours (no schema change expected). Your tool permissions enforce this list.

Harness commands (the only permitted forms, run from the worktree root):
  node D:/SB-APP-orchestration/scripts/run-integration.js --worktree D:/SB-APP-worktrees/announcements test/integration/<file>.test.js
  node D:/SB-APP-orchestration/scripts/run-browser.js --worktree D:/SB-APP-worktrees/announcements tests/session/announcement-create.spec.ts --trace retain-on-failure
Unit tests: cd backend && node --test test/unit/<file>.test.js
Lint: cd backend && npx eslint <file>  (or cd frontend && npx eslint <file>)
Typecheck, full lint and build are run by the coordinator at integration.

Background you can use:
- AUD-035 found that the frontend create call sends only {title, content, priority} while POST /announcements (backend/src/routes/announcements.js, around line 121) requires targetAudience in ALL | LEADERSHIP | SOCIETY (and societyId for SOCIETY). Creating an announcement from the UI therefore returns 400 "Invalid target audience". The backend already refuses a non-admin ALL (403).
- Existing announcement ownership (createdBy) and visibility (list and detail share one visibilityFilter) must be preserved.
- Browser tests follow frontend/tests/session/*.spec.ts and import helpers from ./support (disposableAdmin, disposableMember, signIn, watchApi ...; do not edit support.ts). One spec per runner invocation (a fresh harness each, the shared rate limit is never relaxed).

===== Your task =====
You are Agent B, responsible for NEW-06 / AUD-022 announcement creation.

Follow the rules above.

Align the announcement form/service with the backend's targetAudience contract. Administrators may select ALL, SOCIETY, and LEADERSHIP; non-administrators may create only for their own SOCIETY. The backend is authoritative and must reject unauthorized audiences and society targeting.

Preserve existing announcement ownership and visibility behavior. Do not redesign the LEADERSHIP audience or change unrelated authorization policies.

Add focused integration tests and a browser test for authorized creation if supported by the existing test infrastructure.

Work only in your assigned worktree. Do not edit SocietyTerm or conversation files. Do not stage, commit, or push. Do not weaken tests to obtain a pass.

Report changed files, behavior before/after, exact tests and results, remaining risks, and Git status (see section 4 of the rules). Stop after your assignment.
