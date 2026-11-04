# 03 - Agent C report: CI, NEW-10, generated artifacts, npm audit (2026-10-30)

Worktree D:\SB-APP-worktrees\batch2-ci, branch agent/batch2-regression-ci, base 70ff8bd, NOT committed. Done directly by the lead orchestrator (no separate agent session was started). The 9 `git rm --cached` deletions are staged in THIS worktree's index only (needed to untrack); nothing else is staged.
The C1 additions are tested locally, not on GitHub Actions.

## C1 - CI coverage
Before (.github/workflows/pr-checks.yml): frontend lint/typecheck/`test:unit` (an `echo "No tests yet"`); backend lint/typecheck/unit, a CI-started test server on :5000 + contract tests + RBAC-matrix check; trufflehog; npm audit. NOT in CI: backend integration suite, browser suite, frontend Node tests, frontend build.

Changes (all additions; 0 existing lines removed; YAML parses; jobs verify, browser, security):
1. verify / frontend step: + `npm run build` and `node --test tests/unit/*.node-test.mjs`.
2. verify / new step "Backend - Integration tests (isolated harness)": `node scripts/run-integration-tests.js` (30 min limit), same path-filter condition as the other backend step.
3. New job `browser` (45 min limit, `permissions: contents: read`): checkout, path filter, Node 20, `npm ci` backend + frontend, `npx playwright install --with-deps chromium`, `node scripts/run-session-tests.cjs`, and on failure upload `frontend/test-results/session` (traces, 7 days) as artifact `playwright-session-traces`.

New files: backend/scripts/run-integration-tests.js (every test/integration/*.test.js, each against its own fresh harness) and frontend/scripts/run-session-tests.cjs (every tests/session/*.spec.ts, one spec per fresh harness, `--trace retain-on-failure`). They are the in-repo equivalents of the orchestration-only runners; no package.json or lockfile change.

Isolation: the harness is an in-memory MongoDB on 127.0.0.1:5057 (+ Vite on :5174), launched by the existing scripts/start-integration-server.js, which refuses MONGODB_URI, drops the environment and neutralizes external services. One harness at a time (sequential). Nothing new targets localhost:5000 (the pre-existing contract step, kept, uses its own CI-started server as before). No secrets or environment variables are needed. Browser: Playwright's Chromium is downloaded in CI by the install step (not on this machine). mongodb-memory-server downloads its mongod binary on first use in CI.

Verified locally (lead orchestrator): `node scripts/run-integration-tests.js` on 2 files: exit 0, harnesses stopped cleanly. The browser runner on dm-recipients.spec.ts with the local Chromium (PW_CHROMIUM_PATH): exit 0, 3 passed. Backend eslint and syntax typecheck pass with the new script.
Two defects of my own found and fixed on the way: the frontend script first had a `.js` name inside a `"type":"module"` package (ReferenceError), so it was renamed `.cjs`; and its first run failed because Playwright's own browser is not installed on this machine (environmental - CI has the install step; local runs use PW_CHROMIUM_PATH).
NOT verified: an actual GitHub Actions run, the Playwright install in the runner, the mongod download, real CI runtimes (estimate from the local gate: integration ~10-15 min, browser ~10-15 min), `actions/upload-artifact`.

Costs/risks: the browser job will go red intermittently until NEW-10 is fixed (below). Workflow permissions: only the new job's read-only `contents`. No new secrets. `--with-deps` uses the runner's apt (standard on ubuntu-latest). Decision for you: also make these jobs required for merging?

## C2 - NEW-10 socket-reconnect: diagnostic only
No production code, test, timeout or retry was changed. Evidence: two saved failure traces (Batch 1 gate, Batch 2 gate) and two diagnostic specs (archived in completion/raw/diag-*.spec.ts, removed from the worktree).

1. Traces (both failures, same shape): the failing test is #2 (password change). After the change the app replaces its socket (second connection: polling handshake, websocket 101, upgrade done). The test navigates back to /community and calls setOffline(true) only ~0.1 s later. The client logs failed polling requests (ERR_INTERNET_DISCONNECTED) within ~0.2-1 s and keeps retrying for the whole ~19 s outage - the APPLICATION noticed the outage and tried to reconnect - while Playwright's `close` event for that second websocket never arrived inside the helper's 20 s wait ("the websocket did not close when offline").
2. Diagnostic 1 (3 runs x 4 cycles = 12 cycles, sockets aged 1.5-16.7 s): the websocket closed immediately (<250 ms) every time, whatever the server-ping phase. My earlier hypothesis "it only closes at the next Socket.IO ping" is REFUTED.
3. Diagnostic 2 (replaying test 2's flow, 7 completed iterations): offline set <=100 ms after the new socket opened (4 iterations): Playwright's `close` event arrived 9.78-9.90 s later, while the client retried 130-260 ms after going offline. Offline set 300 ms, 1 s and 2.5 s after the socket opened (3 iterations): `close` arrived in 12-14 ms. No `socketerror` event in any case. An 8th iteration timed out earlier in the flow (most likely the 300-request rate limit, spent by my own repeated flows - an artifact of the diagnostic).

Root-cause assessment: PARTIALLY EXPLAINED, NOT PROVEN.
- Supported: the spec calls dropConnection almost immediately after the replacement socket is created (its "joined" wait is already satisfied by the FIRST socket's join), and a websocket cut within ~100 ms of opening reports its close late to Playwright (~10 s in the replay; more than 19 s in the two real failures, which I did not reproduce). The app's reconnect behaviour looked correct in the traces.
- Unknown: why Playwright/Chromium delays that close event, and why the delay was ~10 s in the replay but >19 s in the real failures.
- Not shown: that the standalone failure seen once on the Batch 2 tree has the same mechanism.

Proposed fix (NOT applied, needs your approval): in test 2, before dropConnection, wait until the replacement connection has actually joined the channel (a channel:join packet sent after the new token's connect, i.e. a join count above the count seen on the first socket), then drop. This waits on the right observable and weakens no assertion; it changes no production code. After it is applied it must be run repeatedly (chain and standalone) before NEW-10 can be called resolved. NEW-10 stays OPEN.

## C3 - Generated artifacts (AUD-014)
Verified tracked, generated, and not referenced by any script, config or CI:
- frontend/.vite/deps/_metadata.json and package.json (Vite dependency-optimizer cache, `optimized: {}`);
- frontend/test-results/.last-run.json and 5 `error-context.md` files under frontend/test-results/tests-e2e-IEEE-SB-APP-Full-* (Playwright output; .last-run says status "failed");
- frontend/tsconfig.tsbuildinfo (TypeScript incremental build info, rewritten by every build).
None was ignored.

Done in batch2-ci: `git rm --cached` of exactly those 9 paths (the files stay on disk - verified present afterwards) and three lines appended to frontend/.gitignore: `.vite/`, `test-results/`, `*.tsbuildinfo` (check-ignore confirms all match). No other file touched. `frontend/test-results/session/` (untracked output of the session runs) is now ignored as well.

## C4 - npm audit (network; read-only)
No fix, no install, no lockfile change: package.json and lockfiles verified unchanged before and after. Commands: `npm audit --json` and `npm audit --omit=dev --json` in root, backend and frontend (npm 11.13.0, Node 24.16.0). Exit code 1 each = vulnerabilities found (stderr empty; the registry was reachable). Raw JSON: completion/raw/c4-audit-*.json. Full per-package tables (severity, scope, direct/transitive, advisory, fix availability): completion/raw/c4-audit-summary.md.

| Project | all dependencies | production only |
|---|---|---|
| root | 10 (2 critical, 7 high, 1 moderate) | 9 (2 critical, 6 high, 1 moderate) |
| backend | 9 (1 critical, 6 high, 2 moderate) | 9 (same: every finding is a production dependency) |
| frontend | 13 (2 critical, 7 high, 4 moderate) | 6 (1 critical, 3 high, 2 moderate) |

Highlights (all report a fix available; none applied):
- backend: critical `proxy-addr` (IP spoofing via IPv4-mapped IPv6 trust subnet - relevant because the app configures `trust proxy`); high direct dependencies `axios`, `compression`, `multer`; high transitive `body-parser`, `follow-redirects`, `undici`; moderate `ip-address`, `qs`.
- frontend: critical `dompurify` (direct, production: DOM XSS in IN_PLACE mode); high `axios`, `follow-redirects`, `zod` (fix is semver-major); moderate `react-router(-dom)` (fix is semver-major). Dev-only: vite, source-map-js, postcss-selector-parser, body-parser, compression, qs, proxy-addr.
- root manifest lists backend-style dependencies of its own (tar, @mapbox/node-pre-gyp, fast-xml-parser, brace-expansion, multer, proxy-addr, ip-address, body-parser).

NEW-12 is therefore no longer "pending": it is a set of real findings. The `dompurify` and `proxy-addr` criticals in particular need an upgrade decision. I upgraded nothing.

## Files changed in batch2-ci
M .github/workflows/pr-checks.yml; M frontend/.gitignore; new backend/scripts/run-integration-tests.js; new frontend/scripts/run-session-tests.cjs; 9 staged deletions from the index (the generated files). Diagnostic specs removed.

Status: READY FOR REVIEW (C1 pending a real Actions run; C2 diagnostic complete, fix awaiting approval; C3 and C4 complete).
