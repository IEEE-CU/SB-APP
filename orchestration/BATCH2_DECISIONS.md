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

## Decided (user, 2026-10-29)
- **D-B1** (a): delete the unused channel-member wrappers. **D-B2**: finance:view. **D-B3** (a): server builds the prompt from its own data within the caller's scope. **D-B4**: @google/genai left installed but unused in the frontend (no manifest/lockfile change). **D-B9**: base on committed 70ff8bd.
## New / still open
- **D-B10** Single-society audits now send up to 20 recent APPROVED transactions (category + description, clipped to 100 chars) to Google; the old page always sent none ("No transactions recorded yet"). Keep, or send no transactions (previous behavior)?
- **D-B11** A legacy ADMIN with no RBAC role does not hold finance:view and gets 403 (same as the finance routes); fixture admin works because of its sb_faculty_advisor role. Accept?
- D-B5, D-B6, D-B7, D-B8 still unanswered (CI changes, NEW-10 diagnostics, artifact untracking, npm audit).
