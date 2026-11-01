// AUD-013: the AI financial audit page asks the backend; the browser holds no Gemini key and
// never talks to Google. The harness has no Gemini key (and its fixtures give nobody
// finance:view), so the backend answers are exercised for real (403) or stubbed at the network
// edge (200 / 503) to check how the page renders each.
import { test, expect } from '@playwright/test';
import { disposableMember, OLD_PASSWORD, signIn } from './support';

test.describe.configure({ mode: 'serial' });

const ENDPOINT = '**/api/v1/ai/financial-insights';

function watchAi(page: import('@playwright/test').Page) {
  const external: string[] = [];
  const bodies: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) external.push(url.hostname);
    if (url.pathname === '/api/v1/ai/financial-insights') bodies.push(request.postData() ?? '');
  });
  return { external, bodies };
}

test.describe('AI audit page', () => {
  test('a user without finance:view is told so by the real backend, and nothing goes to Google', async ({ page }) => {
    const me = await disposableMember('aimember');
    const seen = watchAi(page);
    await signIn(page, me.email, OLD_PASSWORD);

    await page.goto('/reports/ai-audit');

    await expect(page.getByText('You do not have permission to run the AI audit.')).toBeVisible({ timeout: 20_000 });
    // (the dev server runs React StrictMode, which mounts the page twice, so more than one request is normal)
    expect(seen.bodies.length).toBeGreaterThan(0);
    expect(seen.bodies.every((body) => body === '{}'), 'the audit request must carry no data').toBe(true);
    expect(seen.external.filter((host) => /google/i.test(host))).toEqual([]);
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
  });

  test('a generated report is shown; choosing a society sends only its id', async ({ page }) => {
    const me = await disposableMember('aiok');
    await page.route(ENDPOINT, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { insights: 'Budget is healthy.' } }) }),
    );
    const seen = watchAi(page);
    await signIn(page, me.email, OLD_PASSWORD);

    await page.goto('/reports/ai-audit');
    await expect(page.getByText('Budget is healthy.')).toBeVisible({ timeout: 20_000 });

    const before = seen.bodies.length;
    const options = await page.locator('select option').evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value).filter(Boolean));
    expect(options.length).toBeGreaterThan(0);
    await page.locator('select').selectOption(options[0]);
    await expect.poll(() => seen.bodies.length, { timeout: 20_000 }).toBeGreaterThan(before);
    expect(JSON.parse(seen.bodies.at(-1)!)).toEqual({ societyId: options[0] });
    expect(seen.external.filter((host) => /google/i.test(host))).toEqual([]);
  });

  test('"not configured" and "too many requests" are reported without a crash', async ({ page }) => {
    const me = await disposableMember('aierr');
    let status = 503;
    await page.route(ENDPOINT, (route) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'x' }) }),
    );
    await signIn(page, me.email, OLD_PASSWORD);

    await page.goto('/reports/ai-audit');
    await expect(page.getByText('The AI audit is not available right now.')).toBeVisible({ timeout: 20_000 });

    status = 429;
    await page.getByRole('button', { name: /Re-Audit/ }).click();
    await expect(page.getByText('Too many AI audit requests. Please try again later.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
  });
});
