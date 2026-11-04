// NEW-10 DIAGNOSTIC ONLY - not part of any change, never to be committed. Observes, asserts nothing.
// Replays the flow of socket-reconnect.spec.ts test 2 (password change inside the running app, SPA
// navigation back to /community, then the browser goes offline) with different delays between the
// navigation and going offline, and records what Playwright reports for the page's websockets and
// what the app itself does (failed polling requests = the client noticed the outage and retries).
import { test } from '@playwright/test';
import { disposableAdmin, NEW_PASSWORD, OLD_PASSWORD, signIn, spaNavigate } from './support';

test.setTimeout(120_000);

const DELAYS = [0, 0, 0, 300, 1000, 2500, 0, 0];

DELAYS.forEach((delay, i) => {
  test(`replace-flow ${i} (delay ${delay} ms)`, async ({ page }) => {
    const user = await disposableAdmin(`d2-${i}`);
    type Rec = { openedAt: number; closedAt?: number; errorAt?: number };
    const sockets: Rec[] = [];
    const t0 = Date.now();
    const failedPolls: number[] = [];
    page.on('websocket', (ws) => {
      if (!ws.url().includes('/socket.io/')) return;
      const rec: Rec = { openedAt: Date.now() - t0 };
      sockets.push(rec);
      ws.on('close', () => { rec.closedAt = Date.now() - t0; });
      ws.on('socketerror', () => { rec.errorAt = Date.now() - t0; });
    });
    page.on('requestfailed', (r) => {
      if (r.url().includes('/socket.io/') && r.url().includes('transport=polling')) failedPolls.push(Date.now() - t0);
    });

    await signIn(page, user.email, OLD_PASSWORD);
    await page.goto('/community');
    await page.waitForTimeout(2_000);
    await spaNavigate(page, '/change-password');
    await page.locator('input[name="currentPassword"]').fill(OLD_PASSWORD);
    await page.locator('input[name="newPassword"]').fill(NEW_PASSWORD);
    await page.locator('input[name="confirmPassword"]').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Change Password' }).click();
    await page.waitForURL(/\/profile/);
    await spaNavigate(page, '/community');
    if (delay) await page.waitForTimeout(delay);

    const last = sockets.at(-1)!;
    const offlineAt = Date.now() - t0;
    await page.context().setOffline(true);
    const deadline = Date.now() + 25_000;
    while (last.closedAt === undefined && Date.now() < deadline) await page.waitForTimeout(250);
    const reconnectAttemptAfterOffline = failedPolls.find((t) => t >= offlineAt);
    await page.context().setOffline(false);

    console.log('DIAG2 ' + JSON.stringify({
      i, delay,
      sockets: sockets.length,
      lastSocketAgeAtOffline_ms: offlineAt - last.openedAt,
      playwrightCloseEvent: last.closedAt === undefined ? 'NEVER (25 s)' : `${last.closedAt - offlineAt} ms after offline`,
      playwrightSocketError: last.errorAt === undefined ? 'none' : `${last.errorAt - offlineAt} ms after offline`,
      clientRetryAfterOffline: reconnectAttemptAfterOffline === undefined ? 'none seen' : `${reconnectAttemptAfterOffline - offlineAt} ms after offline`,
    }));
  });
});
