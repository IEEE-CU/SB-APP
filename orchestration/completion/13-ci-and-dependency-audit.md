# 13 - CI and dependency audit (consolidated, 2026-11-01)

Charter name: `13-CI-AND-DEPENDENCY-AUDIT`. This is a consolidation of findings already on file - no new investigation, no npm command run, no manifest/lockfile/CI-config change. Sources consolidated: `completion/agents/security/2026-11-01-DEP-01.md` (DEP-01, dependency remediation plan), `completion/03-agent-c-report.md` §C1/§C3/§C4 (AUD-015 CI coverage, AUD-014 generated artifacts, the npm audit run), and `completion/raw/c4-audit-summary.md` (full per-package npm audit tables). Status fields match `MASTER-TODO.md`.

## 1. AUD-015 - CI coverage (source: 03-agent-c-report.md §C1)

Status: implemented in worktree `D:\SB-APP-worktrees\batch2-ci`, branch `agent/batch2-regression-ci`, base `70ff8bd`. **Not committed. Verified locally only - never run on a real GitHub Actions runner** (task **CI-01**, Awaiting approval, depends on D-B5).

Before: `.github/workflows/pr-checks.yml` ran frontend lint/typecheck/`test:unit` (a no-op `echo "No tests yet"`); backend lint/typecheck/unit, a CI-started server on :5000 + contract tests + RBAC-matrix check; trufflehog; npm audit. Missing from CI: the backend integration suite, the browser suite, the frontend Node tests, and a frontend build.

Changes made (additions only, 0 existing lines removed):
1. `verify` / frontend step: added `npm run build` and `node --test tests/unit/*.node-test.mjs`.
2. `verify` / new step "Backend - Integration tests (isolated harness)": `node scripts/run-integration-tests.js` (30 min limit), same path filter as the existing backend step.
3. New job `browser` (45 min limit, `permissions: contents: read`): checkout, path filter, Node 20, `npm ci` backend + frontend, `npx playwright install --with-deps chromium`, `node scripts/run-session-tests.cjs`; on failure, uploads `frontend/test-results/session` (traces, 7 days) as artifact `playwright-session-traces`.

New files added: `backend/scripts/run-integration-tests.js` (runs every `test/integration/*.test.js`, each against its own fresh harness) and `frontend/scripts/run-session-tests.cjs` (runs every `tests/session/*.spec.ts`, one spec per fresh harness, `--trace retain-on-failure`). No `package.json` or lockfile change. Isolation: in-memory MongoDB on `127.0.0.1:5057` (+ Vite on `:5174`) via the existing `scripts/start-integration-server.js`, which refuses `MONGODB_URI`, drops the environment, and neutralizes external services; one harness at a time. The pre-existing contract step still uses its own CI-started server on :5000 (unchanged, not touched by this change).

Verified locally (lead orchestrator, not CI): `node scripts/run-integration-tests.js` on 2 files - exit 0, harnesses stopped cleanly. The browser runner on `dm-recipients.spec.ts` with a local Chromium path - exit 0, 3 passed. Backend eslint and a syntax typecheck pass on the new script. Two defects found and fixed along the way: the frontend script was renamed `.js` -> `.cjs` (it sat inside a `"type":"module"` package and threw `ReferenceError`), and a missing local Playwright browser install was worked around with `PW_CHROMIUM_PATH` (CI has its own install step).

Not verified: an actual GitHub Actions run, the Playwright install step in the runner, the `mongod` first-use download in CI, real CI runtimes (local estimate only: integration ~10-15 min, browser ~10-15 min), `actions/upload-artifact` behavior.

Risk carried forward: the new `browser` job will go red intermittently until **NEW-10** (socket-reconnect flake, still OPEN - see `completion/04-security-audit.md` / `MASTER-TODO.md` FIX-02) is fixed. No new secrets; only the new job's read-only `contents` permission; `--with-deps` uses the runner's apt (standard on `ubuntu-latest`).

Open owner question carried from DEP-01/Agent C: should these new jobs be made required for merging, and should the CI security job (`npm audit --audit-level=high`) stay blocking given the findings in §3 below. Task reference: **CI-01** (Awaiting approval, depends on D-B5).

## 2. AUD-014 - generated artifacts tracked in git (source: 03-agent-c-report.md §C3)

Status: implemented in the same `batch2-ci` worktree, **not committed** (task **FIX-03**, Awaiting approval, depends on D-B7).

Verified tracked, generated, and not referenced by any script, config or CI:
- `frontend/.vite/deps/_metadata.json` and `package.json` (Vite dependency-optimizer cache, `optimized: {}`);
- `frontend/test-results/.last-run.json` and 5 `error-context.md` files under `frontend/test-results/tests-e2e-IEEE-SB-APP-Full-*` (Playwright output; `.last-run` recorded status "failed");
- `frontend/tsconfig.tsbuildinfo` (TypeScript incremental build info, rewritten by every build).

None of the 9 files was ignored before this change. Done in `batch2-ci`: `git rm --cached` of exactly those 9 paths (files stay on disk - verified present afterwards) and three lines appended to `frontend/.gitignore`: `.vite/`, `test-results/`, `*.tsbuildinfo` (`check-ignore` confirms all match). `frontend/test-results/session/` (the new session-runner output) is now ignored as well. No other file touched.

## 3. NEW-12 - npm audit findings (source: 03-agent-c-report.md §C4 and raw/c4-audit-summary.md)

Status: the audit itself is **done** (read-only, network, no install) - task is now a dependency-plan item, not an open "pending" finding. Counts (`npm audit --json` / `--omit=dev --json`, npm 11.13.0, Node 24.16.0; registry reachable, exit code 1 = vulnerabilities found):

| Project | All dependencies | Production only |
|---|---|---|
| root | 10 (2 critical, 7 high, 1 moderate) | 9 (2 critical, 6 high, 1 moderate) |
| backend | 9 (1 critical, 6 high, 2 moderate) | 9 (same - every finding is a production dependency) |
| frontend | 13 (2 critical, 7 high, 4 moderate) | 6 (1 critical, 3 high, 2 moderate) |

Raw JSON: `completion/raw/c4-audit-*.json`. Full per-package tables: `completion/raw/c4-audit-summary.md`.

### 3.1 Root manifest (`/package.json`)

| Package | Sev | Scope | Direct | Notes |
|---|---|---|---|---|
| proxy-addr | critical | prod | transitive | IP spoofing via IPv4-mapped IPv6 trust subnet (GHSA-jqcg-44mw-7w3h) |
| tar | critical | prod | transitive (via `@mapbox/node-pre-gyp`, pulled in by root `bcrypt`) | hardlink/symlink path traversal on extract |
| @mapbox/node-pre-gyp | high | prod | transitive | via tar |
| body-parser | high | prod | transitive | DoS via trailing bytes after compressed body |
| brace-expansion | high | prod | transitive | DoS via unbounded expansion |
| fast-xml-parser | high | prod | transitive | DOCTYPE entity-expansion-limit reset |
| follow-redirects | high | dev only | transitive | cross-origin credential-stripping bypass |
| ip-address | high | prod | transitive | octal/decimal octet decoding mismatch -> SSRF/trust-boundary bypass |
| multer | high | prod | direct | DoS via crafted multipart field names / fd leak |
| qs | moderate | prod | transitive | array-limit bypass / DoS |

DEP-01 finding: **the root manifest is not used at runtime.** `backend/src/server.js` resolves `require` from `backend/node_modules` upward; the backend manifest is a superset of root except it uses `bcryptjs` (not `bcrypt`) and supplies `cors`, `helmet`, `jsonwebtoken`, `express-rate-limit`, etc., which exist only in the backend manifest - a root-only install could not run the server. A repo-wide grep for the string `"bcrypt"` (excluding `bcryptjs`) finds it only in root `package.json`/`package-lock.json`; nothing imports it. `tar`/`@mapbox/node-pre-gyp` reach the root tree only through root `bcrypt -> node-pre-gyp -> tar` (a build-time prebuilt-binary download during `npm install`, on a developer machine, from the project's own registry/GitHub release - practical exploitability assessed as very low). CI only installs in `frontend/` and `backend/`, never root. Not determined: whether any deployment runs a root `npm install` (no deployment manifest found in-repo - SEC-02).

Smallest fix per DEP-01: **remove `bcrypt` from the root `package.json`** (one-line manifest edit + regenerated lockfile; removes tar, node-pre-gyp and their transitive set together). This is a manifest/lockfile change and needs owner approval (open decision candidate, not yet in `DECISION-REGISTER.md` as a numbered D-xx: "should the root manifest shed runtime dependencies, keep only husky/lint-staged and scripts?"). The remaining root findings (brace-expansion, fast-xml-parser, follow-redirects, ip-address, multer, qs, and the Express-5 tree carrying proxy-addr) are the same class - a parallel, unused install - and would go with a broader root cleanup if the owner chooses that over the narrower `bcrypt`-only removal.

### 3.2 Backend (`backend/package.json`) - production runtime

| Package | Sev | Direct | Installed | Fixed in | Exploitable here? | Smallest non-breaking fix |
|---|---|---|---|---|---|---|
| proxy-addr | critical | transitive (express `~2.0.7`) | 2.0.7 | 2.0.8 | Depends on the real `TRUST_PROXY` value (NEW-18, undecided - SEC-02 is tracking this). Advisory concerns a trusted address/CIDR subnet; likely moot if the deployed value is a hop count or `none`/`0`. If hit: `req.ip` spoofable, feeding rate-limit keys and audit-log addresses. | Lockfile-only bump of `proxy-addr` to 2.0.8, inside Express's own declared range - no Express update, no `overrides` entry needed. |
| axios | high | direct `^1.18.1` | 1.18.1 | 1.20.0 | Prototype-pollution gadgets in the fetch adapter/default instance (title only). Sole backend use: `services/opportunityScraper.js:75`, fixed society URLs via a `safeFetch` guard. Low direct reachability. | Refresh within `^1.18.1`; raise floor to `^1.20.0` (manifest edit). |
| body-parser | high | transitive (express 4) | 1.20.8 | 1.20.9 | DoS, reachable on every API request (availability only). | Lockfile refresh if Express 4's range admits it (not verified). |
| compression | high | direct `^1.8.1` | 1.8.1 | 1.8.2 | `server.js:108`, applied to all responses; DoS via memory leak on premature close, reachable by any unauthenticated client (availability only). | Refresh to 1.8.2; raise floor. |
| follow-redirects | high | transitive (axios) | 1.16.0 | 1.16.1 | Cross-origin credential-stripping bypass; scraper sends only a User-Agent to public URLs - low practical reachability. | Refresh to 1.16.1. |
| multer | high | direct `^2.2.0` | 2.4.0 | 2.5.0 | **Not reachable as read**: the only upload router mount is commented out (AUD-001); uses `memoryStorage` with no `fileFilter`, so the relevant advisories are moot today. Becomes live the moment AUD-001's mount is re-enabled. | Refresh to 2.5.0 before any remount; raise floor. |
| undici | high | transitive (cheerio) | 7.29.1 | 7.30.1 | Cheerio only uses undici for its own `fromURL` helper; the scraper calls `cheerio.load(html)` on text - not exercised. | Refresh. |
| ip-address | moderate | transitive (express-rate-limit) | 10.7.2 | >10.7.3 | Sits on the rate-limit IP-keying path; whether a hostile `X-Forwarded-For` reaches it depends on TRUST_PROXY (pairs with proxy-addr). | Refresh. |
| qs | moderate | transitive (express 4) | 6.16.0 | >6.16.0 | Stringify-side DoS; app does not call `qs.stringify` with `arrayFormat: comma` (not exhaustively grepped). | Refresh. |

### 3.3 Frontend (`frontend/package.json`)

Production: 6 findings; dev-only: 7.

| Package | Sev | Scope | Direct | Installed | Fixed in | Exploitable here? | Smallest fix |
|---|---|---|---|---|---|---|---|
| dompurify | critical | prod | direct `^3.2.0` | 3.4.13 | >3.4.16 | **No, by reading** (SEC-01, cross-referenced): all 9 call sites are `DOMPurify.sanitize(str)` with no options - no `addHook`, `IN_PLACE`, `SAFE_FOR_TEMPLATES`, `RETURN_DOM*`. The critical advisory is the `SAFE_FOR_TEMPLATES` one; keep the upgrade regardless since content is user-authored (notes, announcements, reports). | Refresh within `^3.2.0` to latest 3.x. |
| axios | high | prod | direct `^1.7.0` | 1.18.1 | 1.20.0 | Browser client uses the default XHR adapter, not the fetch adapter the advisories target. Low. | Refresh within `^1.7.0`; raise floor. |
| follow-redirects | high | prod | transitive (axios) | 1.16.0 | 1.16.1 | Browser builds of axios do not use follow-redirects at all (Node-only) - effectively unreachable in the shipped bundle. | Refresh. |
| zod | high | prod | direct `^3.24.0` | 3.25.76 | 4.6.7 (**semver-major**; no fixed 3.x offered) | **No, by reading.** Advisory is memory exhaustion on oversized constrained collections; all 8 schema files use string/number/coerce objects with no bounded array/set/record/map. Runs client-side against the user's own form input - worst case is self-DoS. | None non-breaking per the audit. Zod 4 would touch 8 form pages and needs `@hookform/resolvers` compatibility verified (not done); `z.coerce.number()` behavior changed in v4. |
| react-router / react-router-dom | moderate | prod | direct `^6.28.0` | 6.30.6 | 7.18.5 (**semver-major**) | None offered within 6.x. Advisories: open redirect via backslash in `<Link>`/`useNavigate`; a deserialization-constructor-injection item believed SSR/framework-only (not verified). SPA with client-side `RouterProvider`; grep for user-controlled redirect targets found none, but not every `to=`/`navigate()` call was audited (notification links are the likely place to check). | v7 (breaking, 40 importing files; needs the v6 future-flag migration first). |
| vite | high | dev | direct `^6.4.3` | - | fix in 6.x (non-major) | Dev server only (Windows launch-editor command injection) - not in the shipped bundle. | Refresh. |
| body-parser, compression, proxy-addr, qs | high/crit/mod | dev | transitive via `json-server` (bundles Express 4) | - | - | Used only by `npm run mock` - not production. | Refresh, or drop `json-server` if the mock server is retired (owner decision). |
| source-map-js, postcss-selector-parser | high/mod | dev | transitive | - | - | Build tooling only. | Refresh. |

### 3.4 Ordered remediation batches (plan only - DEP-01, task **DEP-01**, Verified complete as a *plan*; no install run)

- **Batch 0** - owner decisions needed first: (a) approve lockfile refresh + floor bumps; (b) root-manifest policy (§3.1); (c) the TRUST_PROXY value / hosting topology (NEW-18), which determines the real severity of proxy-addr and ip-address.
- **Batch 1** - backend lockfile refresh (non-breaking): proxy-addr, axios, follow-redirects, compression, multer, undici, ip-address, qs, body-parser; raise manifest floors for axios/compression/multer. Regression: `npm audit --omit=dev` must drop to no high/critical; lint/typecheck/`test:unit`/`test:contract`; a trust-proxy spoof test (untrusted `X-Forwarded-For` ignored); gzip response check; scraper smoke test with mocked `axios.get`; a JSON body over the size limit and a malformed gzip body returning 4xx not 500.
- **Batch 2** - frontend non-breaking refresh: dompurify (latest 3.x), axios, vite (dev), follow-redirects, plus dev-only transitives. Regression: lint/typecheck/build; browser harness over the 9 DOMPurify call sites with a seeded `<img onerror>`/`<svg onload>` payload to confirm it is still stripped; login flow.
- **Batch 3** - root manifest cleanup (gated on the Batch 0 decision): remove `bcrypt` at minimum. Regression: root `npm install`/`ci` still works, `node start.js`, `npm run test:memory`, husky hooks; confirm CI stays green (CI never touches root); re-audit root.
- **Batch 4** - semver-major, separate, optional: zod 3->4 and react-router-dom 6->7. Recommended deferred behind Batches 1-3, treated as its own feature-sized task with owner approval. Regression if approved: all 8 zod form pages (valid/invalid/empty, especially `z.coerce.number()`), `@hookform/resolvers` compatibility, a full route walk of all 40 router-importing files, protected-route redirects, deep links, 404, browser back/forward, and `Link`/`navigate()` with API-sourced targets.

Owner decisions outstanding (none of these is answered yet in `DECISION-REGISTER.md`):
1. Approve Batch 1 and Batch 2 manifest/lockfile changes (installs stay outside every agent's authority regardless).
2. Root manifest: remove `bcrypt` only, remove all duplicated runtime dependencies, or leave as-is.
3. Zod 4 / react-router 7: do now, defer, or accept the risk.
4. TRUST_PROXY value (NEW-18) - needed to rate proxy-addr/ip-address honestly; out of DEP-01's scope, tracked separately.
5. Whether the CI security gate (`npm audit --audit-level=high`) should stay blocking while the above is pending.

## 4. Cross-references

- `MASTER-TODO.md` task rows: **CI-01**, **CI-02**, **FIX-03**, **DEP-01**, **SEC-01**, **SEC-02**.
- `DECISION-REGISTER.md`: D-B5 (CI), D-B7 (generated files), D-26 (dependency plan authorization), NEW-18 (trusted-proxy topology).
- `completion/04-security-audit.md`: SEC-01/SEC-02 exploitability findings referenced above.
- Full per-package raw tables: `completion/raw/c4-audit-summary.md`; raw JSON: `completion/raw/c4-audit-*.json`.

No file outside this document was created or modified to produce it. No command was run.
