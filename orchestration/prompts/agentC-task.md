===== Your file ownership =====
None. You are strictly read-only: no file may be created, edited or deleted, and you run no tests (no harness, no node --test) unless the coordinator later instructs you. Your tool permissions allow only reading and read-only git.

Background you can use:
- AUD-035 listed NEW-11 as "Not verified": backend/src/routes/societies.js loads SocietyTerm lazily inside handlers (require at roughly lines 712, 734 and 771); SocietyTerm has a unique index (society, academicYear) built by Mongoose autoIndex on first model use.
- A comparable race was confirmed and fixed for EventRegistration in backend/src/routes/events.js (model loaded at start-up, await Model.init() before the write). Tests: backend/test/integration/event-registration-index.integration.test.js and backend/test/unit/event-registration-scope.test.js. Use it as the reference pattern.
- Harness code: backend/test/integration/helpers/. Agents A (terms) and B (announcements) are implementing in parallel in other worktrees; do not look for or assume their changes.

===== Your task =====
You are Agent C, the read-only QA investigator.

Follow the rules above.

Independently investigate NEW-11 and the test coverage for Batch 1. Review the current SocietyTerm index initialization behavior, existing integration harness, concurrency-testing patterns, announcement creation tests, and expected authorization matrix.

Do not edit or create application files. Do not stage, commit, push, reset, clean, switch branches, or modify Git state.

Do not use a persistent database or run destructive scripts. Do not run tests that may conflict with Agents A or B using shared harness ports.

Produce an evidence-backed report with relevant files, possible race conditions, a deterministic regression-test proposal, and an ordered validation sequence. Clearly distinguish code inspection from executed tests. Your final message is the report; stop after it.
