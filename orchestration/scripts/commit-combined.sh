#!/usr/bin/env bash
# Three local commits on integration/combined (owner-authorised 2026-11-01). Explicit file lists only; never `git add .`.
# No push, no merge. Aborts on the first problem.
set -euo pipefail
cd /d/SB-APP-worktrees/combined
[ "$(git rev-parse --abbrev-ref HEAD)" = "integration/combined" ] || { echo "wrong branch"; exit 1; }

TRAILER="Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"

B1=(
backend/src/routes/announcements.js
backend/src/routes/societies.js
backend/test/integration/announcement-ownership.integration.test.js
backend/test/unit/announcement-ownership.test.js
backend/test/unit/society-access.test.js
frontend/src/pages/announcements/AnnouncementFormPage.tsx
frontend/src/services/announcements.ts
frontend/src/types/models.ts
backend/test/integration/announcement-create.integration.test.js
backend/test/integration/society-terms-authorization.integration.test.js
backend/test/integration/society-terms.integration.test.js
backend/test/unit/society-terms.test.js
frontend/tests/session/announcement-create.spec.ts
)
B2=(
backend/src/config/gemini.js
backend/src/controllers/aiController.js
backend/src/middleware/rateLimiter.js
backend/src/routes/ai.js
backend/src/routes/index.js
backend/src/services/ai/GeminiService.js
backend/src/services/ai/financialSummary.js
backend/test/integration/ai-financial-insights.integration.test.js
backend/test/unit/ai-gemini.test.js
frontend/src/pages/reports/AiAuditPage.tsx
frontend/src/services/channels.ts
frontend/src/services/geminiService.ts
frontend/tests/session/ai-audit.spec.ts
frontend/tests/unit/channels-contract.node-test.mjs
frontend/tests/unit/no-client-gemini-key.node-test.mjs
)
C=(
.github/workflows/pr-checks.yml
frontend/.gitignore
backend/scripts/run-integration-tests.js
frontend/scripts/run-session-tests.cjs
)

for f in "${B1[@]}" "${B2[@]}" "${C[@]}"; do [ -f "$f" ] || { echo "missing: $f"; exit 1; }; done
echo "counts: B1=${#B1[@]} B2=${#B2[@]} C=${#C[@]}"

# commit 1
git add -- "${B1[@]}"
git commit -q -F - -- "${B1[@]}" <<EOF
fix(security): society terms privacy and race, announcement audience rules

NEW-07/AUD-025: society terms readable only by administrators and users of the society;
budgets additionally need finance:view; chair/treasurer e-mails are administrator-only (D-01).
NEW-11: load the SocietyTerm model at start-up and wait for its unique index before creating;
503 if the index cannot be built. D-21: nonexistent society is 404, malformed id is 400.
D-23: term handover PATCH needs the society guard, then administrator or settings:edit.
NEW-06/AUD-022: announcement form, service and backend agree on targetAudience; non-administrators
may announce only to their own society; PATCH cannot escalate the audience (D-22 legacy exception).
Tests: unit, integration and browser (see completion/10 and 01-batch1-verification.md).
D-24 (who holds settings:edit) is still awaiting owner confirmation.

$TRAILER
EOF
echo "commit 1: $(git rev-parse --short HEAD)"

# commit 2
git add -- "${B2[@]}"
git commit -q -F - -- "${B2[@]}" <<EOF
fix(security): Gemini key server-side, no transaction data to Google, drop dead channel wrappers

AUD-013: POST /api/v1/ai/financial-insights reads the Gemini key only on the backend; the frontend
no longer imports the Google client or reads VITE_GEMINI_API_KEY. Access: administrator (legacy
ADMIN, D-B11) or finance:view within the caller's scope; payload is only an optional societyId;
per-user rate limit applied after validation. D-B10: the prompt carries only society-level figures
(name, budget, balance); individual transactions are never sent.
NEW-08: remove addMember/removeMember wrappers that called routes the backend never had; add a
contract test that every channel call has a backend route.
Tests: unit, integration, frontend Node, browser; production bundle checked for a fake key.

$TRAILER
EOF
echo "commit 2: $(git rev-parse --short HEAD)"

# commit 3: runner scripts + CI workflow + ignore rules + the 9 staged index deletions of generated files
git add -- "${C[@]}"
STAGED=$(git diff --cached --name-status | awk '{print $1}' | sort | uniq -c | tr -s ' ' | tr '\n' ';')
echo "staged for commit 3: $STAGED"
[ "$(git diff --cached --name-only | wc -l)" = "13" ] || { echo "unexpected staged count"; exit 1; }
git commit -q -F - <<EOF
ci: run integration and browser suites in CI; untrack generated files

AUD-015: add the isolated-harness integration step, a Playwright session job, the frontend build and
Node tests to pr-checks.yml (existing steps unchanged); in-repo runners backend/scripts/run-integration-tests.js
and frontend/scripts/run-session-tests.cjs (one fresh in-memory harness per file/spec, no localhost:5000).
Not yet run on GitHub Actions. AUD-014: untrack nine generated files (Vite cache, Playwright output,
tsbuildinfo) and ignore them; files stay on disk.

$TRAILER
EOF
echo "commit 3: $(git rev-parse --short HEAD)"
git log --oneline -4
echo "status entries left: $(git status --short | wc -l)"
