import { defineConfig } from '@playwright/test';

// Browser tests for the session flow (AUD-007B/C). Deliberately separate from tests/e2e.spec.ts,
// which expects a live backend on localhost:5000.
//
// These tests need the ISOLATED backend harness (backend/test/integration/helpers/test-server.js,
// loopback 127.0.0.1:5057, in-memory MongoDB) to be running, with TEST_BASE_URL and
// TEST_READY_FILE set in the environment. The spec refuses to run otherwise. The frontend dev
// server is started here on its own port and pointed at the harness.
//
// Run ONE SPEC FILE per harness instance. The harness enforces the backend's general rate limit
// (300 requests per 15 minutes per address) and all browser traffic, including Socket.IO long
// polling, shares one address, so a long single run receives HTTP 429. A fresh harness per spec
// file starts with fresh counters (the limit is intentionally not relaxed).
//
//   npx playwright test -c playwright.session.config.ts tests/session/<one-spec>.spec.ts
//
// Browser: Playwright's own Chromium if installed; otherwise set PW_CHROMIUM_PATH to an
// existing chrome executable (nothing is downloaded by these tests).
const PORT = 5174; // one of the origins the backend's CORS allow-list already contains

export default defineConfig({
  testDir: './tests/session',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  outputDir: './test-results/session',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    // Optional: use an already-installed Chromium (full path to chrome.exe / chrome) instead of
    // the revision this Playwright version would download. Unset = Playwright's own browser.
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort --host localhost`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:5057/api/v1' },
  },
});
