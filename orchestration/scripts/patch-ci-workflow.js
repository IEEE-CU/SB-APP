// Agent C / C1 (lead orchestrator, batch2-ci worktree): extend .github/workflows/pr-checks.yml.
// Existing steps are kept as they are; only additions.
const fs = require("fs");
const file = "D:/SB-APP-worktrees/batch2-ci/.github/workflows/pr-checks.yml";
let s = fs.readFileSync(file, "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");
const rep = (a, b) => {
  if (s.split(a).length !== 2) throw new Error("anchor not unique/found: " + a.slice(0, 60));
  s = s.replace(a, () => b);
};

// 1. frontend: also run the production build and the frontend Node tests (they were never in CI)
rep(
  `          cd frontend
          npm ci
          npm run lint
          npm run typecheck
          npm run test:unit
`,
  `          cd frontend
          npm ci
          npm run lint
          npm run typecheck
          npm run test:unit
          npm run build
          node --test tests/unit/*.node-test.mjs
`,
);

// 2. backend integration step + 3. new browser job, both before the security job
rep(
  `          node scripts/verify-rbac-matrix.js --baseUrl=http://localhost:5000

  security:`,
  `          node scripts/verify-rbac-matrix.js --baseUrl=http://localhost:5000

      # Integration suite: every file against its own isolated in-memory harness on 127.0.0.1:5057
      # (no secrets, no persistent database, nothing on localhost:5000).
      - name: Backend - Integration tests (isolated harness)
        if: steps.filter.outputs.backend == 'true' && hashFiles('backend/package.json') != ''
        timeout-minutes: 30
        run: |
          cd backend
          node scripts/run-integration-tests.js

  # Browser (Playwright) session specs, one spec per fresh isolated harness. Separate job so the
  # browser download and the long run do not delay the fast checks above.
  browser:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false

      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            changed:
              - 'frontend/**'
              - 'backend/**'

      - uses: actions/setup-node@v4
        if: steps.filter.outputs.changed == 'true'
        with:
          node-version: 20
          cache: 'npm'

      - name: Install backend and frontend dependencies
        if: steps.filter.outputs.changed == 'true'
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci

      - name: Install Chromium for Playwright
        if: steps.filter.outputs.changed == 'true'
        run: cd frontend && npx playwright install --with-deps chromium

      - name: Browser session specs (isolated harness)
        if: steps.filter.outputs.changed == 'true'
        run: cd frontend && node scripts/run-session-tests.js

      - name: Keep Playwright traces of failures
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-session-traces
          path: frontend/test-results/session
          retention-days: 7
          if-no-files-found: ignore

  security:`,
);

fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("workflow patched");
