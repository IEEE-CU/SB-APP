// NEW-10 DIAGNOSTIC ONLY - not part of any change, never to be committed.
// Observes (does not assert on) when the browser's Socket.IO WebSocket closes after
// context.setOffline(true), relative to the server's Socket.IO ping frames ("2").
import { test } from '@playwright/test';
import { disposableAdmin, OLD_PASSWORD, signIn, firstChannelId, storedToken } from './support';

test.setTimeout(300_000);

test('diagnostic: when does the websocket close while offline?', async ({ page }) => {
  const user = await disposableAdmin('diag');
  type Rec = { openedAt: number; closedAt?: number; pings: number[] };
  const sockets: Rec[] = [];
  page.on('websocket', (ws) => {
    if (!ws.url().includes('/socket.io/')) return;
    const rec: Rec = { openedAt: Date.now(), pings: [] };
    sockets.push(rec);
    ws.on('framereceived', (f) => {
      if (String(f.payload) === '2') rec.pings.push(Date.now());
    });
    ws.on('close', () => {
      rec.closedAt = Date.now();
    });
  });
  await signIn(page, user.email, OLD_PASSWORD);
  const token = (await storedToken(page)) as string;
  await firstChannelId(token);
  await page.goto('/community');
  await page.waitForTimeout(4_000);

  const out: unknown[] = [];
  for (const waitBefore of [0, 8_000, 0, 15_000]) {
    if (waitBefore) await page.waitForTimeout(waitBefore);
    const rec = sockets.at(-1)!;
    const offlineAt = Date.now();
    const lastPing = rec.pings.at(-1);
    await page.context().setOffline(true);
    const deadline = Date.now() + 60_000;
    while (!rec.closedAt && Date.now() < deadline) await page.waitForTimeout(250);
    const closeDelay = rec.closedAt ? rec.closedAt - offlineAt : null;
    await page.context().setOffline(false);
    out.push({
      socketAgeAtOffline_s: +((offlineAt - rec.openedAt) / 1000).toFixed(1),
      sinceLastServerPing_s: lastPing ? +((offlineAt - lastPing) / 1000).toFixed(1) : null,
      pingsSeen: rec.pings.length,
      closeDelay_s: closeDelay === null ? 'NOT CLOSED in 60 s' : +(closeDelay / 1000).toFixed(1),
    });
    // wait for the automatic reconnect to produce a new websocket
    const before = sockets.length;
    const until = Date.now() + 40_000;
    while (sockets.length === before && Date.now() < until) await page.waitForTimeout(250);
    await page.waitForTimeout(1_500);
  }
  console.log('DIAG_RESULT ' + JSON.stringify(out));
});
