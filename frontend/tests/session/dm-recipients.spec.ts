// AUD-033: a non-administrator can find and start a direct message with the other members of
// their own society, without the administrator-only user directory.
//
// Before the fix the picker's only data source was GET /users (administrator-only), so for a
// member the "New Direct Message" list was empty and no conversation could be started.
// The picker now reads GET /api/v1/conversations/recipients (own society, { id, name } only).
import { test, expect } from '@playwright/test';
import { disposableMember, emptySociety, OLD_PASSWORD, signIn, target, watchApi } from './support';

test.describe.configure({ mode: 'serial' });

const SOCIETY_B = target.ready.fixtures.societies.B.id;

async function openPicker(page: import('@playwright/test').Page) {
  await expect(page.getByRole('button', { name: /general/ }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Direct Messages' }).click();
  await page.locator('button:has(svg.lucide-plus)').first().click();
  await expect(page.getByText('New Direct Message')).toBeVisible();
}

test.describe('direct-message recipients for a non-administrator', () => {
  test('lists same-society members only, never calls GET /users, and starts a conversation', async ({ page }) => {
    const me = await disposableMember('dmself');
    const peer = await disposableMember('dmpeer');
    await disposableMember('dmother', SOCIETY_B);
    const apiLog = watchApi(page);
    await signIn(page, me.email, OLD_PASSWORD);

    await page.goto('/community');
    await openPicker(page);
    const picker = page.locator('div.fixed', { hasText: 'New Direct Message' });

    await expect(picker.getByRole('button', { name: /Browser dmpeer/ })).toBeVisible({ timeout: 20_000 });
    await expect(picker.getByRole('button', { name: /Browser dmother/ })).toHaveCount(0);
    await expect(picker.getByRole('button', { name: /Browser dmself/ })).toHaveCount(0);
    expect(apiLog.requests.some((r) => r.path === '/api/v1/users'), 'a non-administrator requested the user directory').toBe(false);
    expect(apiLog.responses.find((r) => r.path === '/api/v1/conversations/recipients')?.status).toBe(200);

    await picker.getByRole('button', { name: /Browser dmpeer/ }).click();
    await expect(page.getByText('New Direct Message')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('Failed to start conversation')).toHaveCount(0);
    expect(apiLog.responses.find((r) => r.path === '/api/v1/conversations' && r.status === 201)).toBeTruthy();
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
    expect(peer.id).toBeTruthy();
  });

  test('a member alone in their society sees an empty-state message, not a crash', async ({ page }) => {
    const societyId = await emptySociety('dm');
    const me = await disposableMember('dmalone', societyId);
    await signIn(page, me.email, OLD_PASSWORD);

    await page.goto('/community');
    await page.getByRole('button', { name: 'Direct Messages' }).click();
    await page.locator('button:has(svg.lucide-plus)').first().click();

    await expect(page.getByText('No other members are available to message.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
  });

  test('a failed lookup is reported without a crash and without falling back to the user directory', async ({ page }) => {
    const me = await disposableMember('dmfail');
    const apiLog = watchApi(page);
    await page.route('**/api/v1/conversations/recipients', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) }),
    );
    await signIn(page, me.email, OLD_PASSWORD);

    await page.goto('/community');
    await openPicker(page);

    await expect(page.getByText('Could not load members. Close and try again.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
    expect(apiLog.requests.some((r) => r.path === '/api/v1/users')).toBe(false);
  });
});
