# Batch 2 preflight (coordinator, 2026-10-29) - read-only

## Repository state (independently observed; git commands only)
| Location | Branch | HEAD | Status |
|---|---|---|---|
| D:\SB-APP (protected) | feature/sb-app-security-hardening | 70ff8bd | only `?? digest.txt` (never opened) |
| worktrees/batch1-integration | integration/batch1 | 70ff8bd | 8 modified + 5 untracked = 13 entries, NOT committed |
| worktrees/terms | agent/batch1-terms | 70ff8bd | 1 modified + 2 untracked |
| worktrees/announcements | agent/batch1-announcements | 70ff8bd | 6 modified + 2 untracked |
| worktrees/qa | agent/batch1-qa | 70ff8bd | clean |
No Batch 2 branch or worktree exists (names agent/batch2-* and batch2-* are free). No commits ahead of 70ff8bd on any branch.

## Baseline decision
Batch 1 is uncommitted and D-24 is unconfirmed. Batch 2 findings touch different files (channels, Gemini, CI/test config) from Batch 1 (societies.js, announcements.js and their tests), so Batch 2 would be based on the COMMITTED 70ff8bd and not silently incorporate Batch 1. A final candidate containing both would need Batch 1 committed first (separate approval) or an explicit combined worktree. No worktrees were created yet because of the blockers below.

## Verified facts per finding (code read, nothing executed)
- **NEW-08** frontend/src/services/channels.ts defines addMember (POST /channels/:id/members) and removeMember (DELETE ... body {userId}). Backend routes/channels.js has no such routes. BUT: nothing in frontend/src calls addMember/removeMember (grep: only the two definitions), and models/Channel.js has NO members field - channels are society-wide, access is by society scope + community_hub permission. So no user-visible failure exists, and there is no membership concept to implement. Implementing it would need a new schema/relationship and policy => REQUIRES POLICY DECISION (D-B1). Smallest alternative: delete the two unused wrappers.
- **AUD-013** VERIFIED. frontend/src/services/geminiService.ts reads import.meta.env.VITE_GEMINI_API_KEY (Vite inlines it into the bundle) and calls @google/genai from the browser. Sole consumer: pages/reports/AiAuditPage.tsx (route /reports/ai-audit, reachable from ReportListPage; no role guard in routes.tsx beyond sign-in). Backend has only unmounted placeholders (routes/ai.js, controllers/aiController.js, services/ai/GeminiService.js throws TODO, config/gemini.js reads GEMINI_API_KEY server-side). @google/genai is not a backend dependency and installs are not allowed => a server-side call would use Node's built-in fetch. Open design/policy questions: who may run the audit, and whether the server builds the prompt from its own data (safer; avoids an open Gemini proxy) or relays client text (D-B2, D-B3).
- **NEW-22** backend conversations message field is `body`; no `lastMessage` is returned by routes/conversations.js; the UI (CommunityPage.tsx:567) reads conv.lastMessage.content only when lastMessage exists, so the preview is simply never shown. Low severity, small fix possible later; not started.
- **NEW-05** routes/tasks.js POST already validates society ownership/existence; integration tests task-create.integration.test.js exist; no browser test. Not started.
- **AUD-015** .github/workflows/pr-checks.yml (pull_request): frontend lint/typecheck/test:unit (frontend test:unit is `echo "No tests yet"` - the 40 frontend Node tests in tests/unit are NOT run); backend lint/typecheck/test:unit; start:test-server on localhost:5000 + test:contract + verify-rbac-matrix (CI-owned server, not the local unsafe one); trufflehog; npm audit. NOT in CI: backend integration suite (41 files), Playwright session suite, frontend Node tests, build.
- **NEW-19** frontend/tests/e2e.spec.ts expects a live backend on localhost:5000; playwright.session.config.ts is the isolated config. No npm script exists for the integration or session suites: they run through orchestration-only scripts (outside the repo): run-integration.js / run-browser.js, which use backend/test/integration/helpers/test-server.js (in repo).
- **AUD-014** Tracked generated files: frontend/test-results/.last-run.json (status "failed") + 5 error-context.md files, and frontend/tsconfig.tsbuildinfo. .gitignore does not ignore test-results or tsbuildinfo (dist/ only). A frontend build rewrites tsbuildinfo.
- **NEW-10** evidence: reports/gate/artifacts-socket-reconnect (trace + error-context); fails in dropConnection (support.ts:211) - the poll for wire.sockets.at(-1).closed after context.setOffline(true) times out at 20 s. Failed first attempt in 2 chain runs, passed 3/3 standalone. No cause established; a hypothesis (offline emulation does not reliably close an already-open websocket in that state) is UNVERIFIED.

## Agents
No Batch 2 agent has been started. Claude Code sessions (claude -p, worktree-scoped permissions, as in Batch 1) are available, but Agent A and Agent B are blocked at policy boundaries, so starting them would only produce guesses. Agent C's read-only investigation above was done by the coordinator directly; it is coordinator-observed, not an independent agent report.

## Not run
No tests, no builds, no npm audit, nothing on localhost:5000, no installs. digest.txt not touched; protected checkout not modified.
