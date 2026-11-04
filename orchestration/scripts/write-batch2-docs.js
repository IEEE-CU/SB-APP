// Coordinator: writes the Batch 2 preflight report and tracking documents. Touches only D:\SB-APP-orchestration.
const fs = require("fs");
const ROOT = "D:/SB-APP-orchestration/";
fs.mkdirSync(ROOT + "reports/batch2", { recursive: true });
const w = (f, s) => fs.writeFileSync(ROOT + f, s.trimStart());

w("reports/batch2/2026-10-29_preflight.md", `
# Batch 2 preflight (coordinator, 2026-10-29) - read-only

## Repository state (independently observed; git commands only)
| Location | Branch | HEAD | Status |
|---|---|---|---|
| D:\\SB-APP (protected) | feature/sb-app-security-hardening | 70ff8bd | only \`?? digest.txt\` (never opened) |
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
- **NEW-22** backend conversations message field is \`body\`; no \`lastMessage\` is returned by routes/conversations.js; the UI (CommunityPage.tsx:567) reads conv.lastMessage.content only when lastMessage exists, so the preview is simply never shown. Low severity, small fix possible later; not started.
- **NEW-05** routes/tasks.js POST already validates society ownership/existence; integration tests task-create.integration.test.js exist; no browser test. Not started.
- **AUD-015** .github/workflows/pr-checks.yml (pull_request): frontend lint/typecheck/test:unit (frontend test:unit is \`echo "No tests yet"\` - the 40 frontend Node tests in tests/unit are NOT run); backend lint/typecheck/test:unit; start:test-server on localhost:5000 + test:contract + verify-rbac-matrix (CI-owned server, not the local unsafe one); trufflehog; npm audit. NOT in CI: backend integration suite (41 files), Playwright session suite, frontend Node tests, build.
- **NEW-19** frontend/tests/e2e.spec.ts expects a live backend on localhost:5000; playwright.session.config.ts is the isolated config. No npm script exists for the integration or session suites: they run through orchestration-only scripts (outside the repo): run-integration.js / run-browser.js, which use backend/test/integration/helpers/test-server.js (in repo).
- **AUD-014** Tracked generated files: frontend/test-results/.last-run.json (status "failed") + 5 error-context.md files, and frontend/tsconfig.tsbuildinfo. .gitignore does not ignore test-results or tsbuildinfo (dist/ only). A frontend build rewrites tsbuildinfo.
- **NEW-10** evidence: reports/gate/artifacts-socket-reconnect (trace + error-context); fails in dropConnection (support.ts:211) - the poll for wire.sockets.at(-1).closed after context.setOffline(true) times out at 20 s. Failed first attempt in 2 chain runs, passed 3/3 standalone. No cause established; a hypothesis (offline emulation does not reliably close an already-open websocket in that state) is UNVERIFIED.

## Agents
No Batch 2 agent has been started. Claude Code sessions (claude -p, worktree-scoped permissions, as in Batch 1) are available, but Agent A and Agent B are blocked at policy boundaries, so starting them would only produce guesses. Agent C's read-only investigation above was done by the coordinator directly; it is coordinator-observed, not an independent agent report.

## Not run
No tests, no builds, no npm audit, nothing on localhost:5000, no installs. digest.txt not touched; protected checkout not modified.
`);

w("BATCH2_PLAN.md", `
# Batch 2 plan
Baseline: committed 70ff8bd (Batch 1 stays uncommitted in integration/batch1; combine only after separate approval).
Status 2026-10-29: Phase 0 preflight done (reports/batch2/2026-10-29_preflight.md). Phases 2+ wait on the decisions in BATCH2_DECISIONS.md.
Planned worktrees (not created): D:\\SB-APP-worktrees\\batch2-channel, batch2-gemini, batch2-ci; branches agent/batch2-channel-contract, agent/batch2-gemini-security, agent/batch2-regression-ci; integration D:\\SB-APP-worktrees\\batch2-integration.
File ownership (no overlap): A = backend/src/routes/channels.js (+ model if approved), frontend/src/services/channels.ts, new channel tests. B = frontend/src/services/geminiService.ts, pages/reports/AiAuditPage.tsx, backend routes/ai.js + controllers/aiController.js + services/ai/GeminiService.js + config/gemini.js, routes/index.js mount, new tests. C = read-only until approved; then .github/workflows/pr-checks.yml, frontend/package.json scripts, .gitignore, 7 tracked generated paths.
`);

w("BATCH2_TODO.md", `
# Batch 2 TODO
Status vocabulary: Verified defect / Suspected / Not reproduced / Blocked / Requires policy decision / Fixed-unverified / Independently verified / Integrated+regression-tested.
| ID | Verified fact | Severity | Agent | Status | Depends on |
|---|---|---|---|---|---|
| NEW-08 | Frontend wrappers call routes that do not exist; no UI caller; Channel has no members field | Low (dead code); Medium only if membership is wanted | A | Requires policy decision | D-B1 |
| AUD-013 | VITE_GEMINI_API_KEY inlined into the browser bundle; backend AI route is an unmounted placeholder | High (secret exposure) | B | Verified defect; implementation blocked | D-B2, D-B3, D-B4 |
| AUD-015 | CI omits integration suite (41 files), Playwright session suite, 40 frontend Node tests, frontend build | Medium-High | C | Verified (read-only); change needs approval | D-B5 |
| NEW-10 | socket-reconnect flake, fails at dropConnection, only when run last in a chain; no cause established | Medium (CI reliability) | C | Suspected; open | D-B6 |
| NEW-19 | e2e.spec.ts targets localhost:5000 | Low | C | Verified; no change yet | D-B5 |
| AUD-014 | 6 test-results files + tsbuildinfo tracked, not ignored | Low | C | Verified; change needs approval | D-B7 |
| NEW-22 | Backend returns no lastMessage; UI preview never shows | Low | follow-up | Verified by code read; not started | after A/B/C |
| NEW-05 | Backend society check present with integration tests; no browser test | Low | follow-up | Not started | after A/B/C |
| NEW-12 | npm audit | - | - | Pending network approval | D-B8 |
Dependencies: none of these touch the Batch 1 files.
`);

w("BATCH2_DECISIONS.md", `
# Batch 2 decisions needed (none made yet)
- **D-B1 (NEW-08)** Channels have no membership concept. Choose: (a) delete the two unused frontend wrappers addMember/removeMember (smallest, recommended); (b) design real channel membership (new schema + who may add/remove + effect on message visibility) - a new feature, needs its own spec.
- **D-B2 (AUD-013)** Who may run the AI financial audit? Today any signed-in user can open /reports/ai-audit. Options: keep sign-in only; require an existing permission such as finance:view (recommended: the page reports budgets); admin only.
- **D-B3 (AUD-013)** Server-side design: (a) POST /ai/financial-insights takes only an optional societyId and the server builds the prompt from its own data within the caller's scope (recommended: not an open Gemini proxy); (b) relay a client-supplied summary (smaller change, but lets a caller send arbitrary text and unscoped figures).
- **D-B4 (AUD-013)** Server-side call without a new dependency: Node built-in fetch to the Gemini REST API with GEMINI_API_KEY (and GEMINI_MODEL) read only on the backend; remove @google/genai from the frontend? Removing it edits package.json/lockfile, which is not allowed without approval - the import would just be dropped and the package left as unused.
- **D-B5 (AUD-015/NEW-19)** CI additions need new in-repo files/scripts: an npm script (or small runner) to run each integration file against its own harness, a job for the Playwright session specs (needs browser installation in CI = download), and running the existing frontend Node tests. Approve workflow changes? Also: keep or drop the existing localhost:5000 contract step in CI (it uses a CI-started server)?
- **D-B6 (NEW-10)** Authorize a diagnostic-only investigation (repeat chain runs with traces; no test or product change) before any fix?
- **D-B7 (AUD-014)** Untrack the 6 test-results files and frontend/tsconfig.tsbuildinfo (git rm --cached) and add them to .gitignore?
- **D-B8 (NEW-12)** Approve a network npm audit?
- **D-B9** Baseline: base Batch 2 on committed 70ff8bd (recommended, independent of Batch 1) or first commit Batch 1 / build on integration/batch1?
`);

w("BATCH2_TASK_BOARD.md", `
# Batch 2 task board (2026-10-29)
| Workstream | Agent | Worktree | State |
|---|---|---|---|
| Phase 0 preflight | coordinator | - | DONE (reports/batch2/2026-10-29_preflight.md) |
| A channel membership | not started | not created | BLOCKED on D-B1 |
| B Gemini key | not started | not created | BLOCKED on D-B2/D-B3/D-B4 |
| C CI / flake / artifacts | read-only investigation done by coordinator | not created | Awaiting D-B5/D-B6/D-B7 for any change |
| Integration candidate | - | not created | Waiting |
`);

w("BATCH2_CHANGELOG.md", `
# Batch 2 changelog
## 2026-10-29 - Phase 0 preflight and plan only
Read-only inspection (git status/log, file reads, grep). No code changed anywhere, no worktree or branch created, no test or build run, no agent started. Documents written in D:\\SB-APP-orchestration: BATCH2_PLAN/TODO/DECISIONS/TASK_BOARD/CHANGELOG, reports/batch2/2026-10-29_preflight.md. Stopped at policy boundaries (D-B1..D-B9).
`);

fs.appendFileSync(ROOT + "CHANGELOG.md", "\n## 2026-10-29 - Batch 2 preflight\nRead-only preflight and planning only; see BATCH2_CHANGELOG.md. No code, branch or worktree changes.\n");
fs.appendFileSync(ROOT + "MASTER_TODO.md", "\n- Batch 2 (2026-10-29): preflight done; NEW-08, AUD-013, AUD-015, NEW-10, NEW-19, AUD-014 tracked in BATCH2_TODO.md. Statuses above unchanged (nothing fixed).\n");
fs.appendFileSync(ROOT + "TASK_BOARD.md", "\n## Batch 2 (2026-10-29)\nPreflight done; no agents started; blocked on decisions - see BATCH2_TASK_BOARD.md.\n");
console.log("batch2 docs written");
