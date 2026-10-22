// AUD-009: (A) reactions use the mounted endpoint, and (B) a non-administrator can load the
// Community page.
//
// Reproduced before the fix, with these same flows:
//   A. clicking a reaction sent POST /api/v1/messages/<id>/reactions with { emoji }: the route
//      does not exist (404); the server's route is POST /api/v1/channels/messages/<id>/reactions
//      with { value }. The channel page's picker then showed a fabricated reaction
//      (users: ["me"]) that the server never stored, and the Community buttons only toasted.
//   B. the Community page loaded channels, conversations AND GET /users in one Promise.all.
//      GET /users is administrator-only (403), so for every other member the whole load failed:
//      "Failed to load community chat" and no channel.
//
// Delivery to the page is proven with real server events from a second client (typing events
// use the same authorized `channel_<id>` room as messages and reaction updates).
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  api,
  disposableAdmin,
  disposableMember,
  emptySociety,
  expectDelivery,
  firstChannelId,
  joinPackets,
  OLD_PASSWORD,
  openProbe,
  postChannelMessage,
  signIn,
  storedToken,
  target,
  watchApi,
  watchWire,
} from './support';

const here = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const { withDatabase } = nodeRequire(path.resolve(here, '../../../backend/test/integration/helpers/target.js'));

const stamp = () => `rx-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const REACTION_PATH = /^\/api\/v1\/channels\/messages\/[0-9a-f]{24}\/reactions$/;
const reactionCount = (text: string) =>
  withDatabase(target, async (db: any) => {
    const message = await db.collection('messages').findOne({ plainText: text });
    return db.collection('reactions').countDocuments({ messageId: message._id });
  });

test.describe.configure({ mode: 'serial' });

test.describe('reactions', () => {
  test('Community: add and remove use the mounted endpoint; the badge follows; no duplicates', async ({ page }) => {
    const user = await disposableAdmin('react');
    const wire = await watchWire(page);
    const apiLog = watchApi(page);
    await signIn(page, user.email, OLD_PASSWORD);
    const channelId = await firstChannelId((await storedToken(page)) as string);
    const probe = await openProbe(channelId);
    await page.goto('/community');
    await expectDelivery(wire, probe, channelId, 'joined');
    const text = stamp();
    await postChannelMessage(channelId, text);
    const bubble = page.locator('.group\\/msg', { hasText: text });
    await expect(bubble).toBeVisible({ timeout: 20_000 });

    // add
    await bubble.hover();
    const addRequest = page.waitForRequest((r) => r.url().includes('/reactions'));
    await bubble.getByRole('button', { name: '👍', exact: true }).click();
    const sent = await addRequest;
    expect(sent.method()).toBe('POST');
    expect(new URL(sent.url()).pathname).toMatch(REACTION_PATH);
    expect(JSON.parse(sent.postData() ?? '{}')).toEqual({ value: '👍' });
    const badge = page.getByRole('button', { name: /👍\s*1/ });
    await expect(badge).toBeVisible({ timeout: 20_000 });
    expect(await reactionCount(text)).toBe(1);

    // remove: the same request again toggles it off
    await badge.click();
    await expect(badge).toHaveCount(0, { timeout: 20_000 });
    expect(await reactionCount(text)).toBe(0);

    // add again: still at most one record for this user and emoji
    await bubble.hover();
    await bubble.getByRole('button', { name: '👍', exact: true }).click();
    await expect(badge).toBeVisible({ timeout: 20_000 });
    expect(await reactionCount(text)).toBe(1);
    expect(apiLog.requests.filter((r) => r.path.endsWith('/reactions') && !REACTION_PATH.test(r.path))).toEqual([]);
    expect(apiLog.responses.filter((r) => r.path.endsWith('/reactions')).every((r) => r.status === 200)).toBe(true);
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
    await probe.close();
  });

  test("the channel page picker uses the same endpoint and shows the server's answer", async ({ page }) => {
    const user = await disposableAdmin('picker');
    const apiLog = watchApi(page);
    await signIn(page, user.email, OLD_PASSWORD);
    const channelId = await firstChannelId((await storedToken(page)) as string);
    const text = stamp();
    await postChannelMessage(channelId, text);

    await page.goto('/channels/general');
    await expect(page.getByText(text)).toBeVisible({ timeout: 20_000 });
    const row = page.locator('div.group', { hasText: text }).first();
    await row.getByTitle('Add reaction').click();
    const addRequest = page.waitForRequest((r) => r.url().includes('/reactions'));
    await row.getByRole('button', { name: '🎉', exact: true }).click();
    const sent = await addRequest;

    expect(sent.method()).toBe('POST');
    expect(new URL(sent.url()).pathname).toMatch(REACTION_PATH);
    expect(JSON.parse(sent.postData() ?? '{}')).toEqual({ value: '🎉' });
    await expect(page.getByRole('button', { name: /🎉\s*1/ })).toBeVisible({ timeout: 20_000 });
    expect(await reactionCount(text)).toBe(1);
    expect(apiLog.responses.filter((r) => r.path.endsWith('/reactions')).map((r) => r.status)).toEqual([200]);
  });

  test('a rejected reaction is reported and no reaction is invented', async ({ page }) => {
    const user = await disposableAdmin('rejected');
    await signIn(page, user.email, OLD_PASSWORD);
    const channelId = await firstChannelId((await storedToken(page)) as string);
    const text = stamp();
    await postChannelMessage(channelId, text);
    await page.route('**/api/v1/channels/messages/*/reactions', (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Access denied' }) }),
    );

    await page.goto('/channels/general');
    await expect(page.getByText(text)).toBeVisible({ timeout: 20_000 });
    const row = page.locator('div.group', { hasText: text }).first();
    await row.getByTitle('Add reaction').click();
    await row.getByRole('button', { name: '🔥', exact: true }).click();

    await expect(page.getByText('Failed to update reaction')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /🔥\s*\d/ })).toHaveCount(0);
    expect(await reactionCount(text)).toBe(0);
  });
});

test.describe('Community for a non-administrator', () => {
  test("a member loads their society's channel without ever requesting the user directory, and joins it", async ({ page }) => {
    const member = await disposableMember('member');
    const wire = await watchWire(page);
    const apiLog = watchApi(page);
    await signIn(page, member.email, OLD_PASSWORD);
    const channelId = await firstChannelId(member.token);
    const probe = await openProbe(channelId);

    await page.goto('/community');

    await expect(page.getByRole('button', { name: /general/ }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Failed to load community chat')).toHaveCount(0);
    await expectDelivery(wire, probe, channelId, 'member joined their channel');
    expect(joinPackets(wire).length).toBeGreaterThan(0);
    expect(apiLog.requests.some((r) => r.path === '/api/v1/users'), 'a non-administrator requested the user directory').toBe(false);
    expect(apiLog.responses.find((r) => r.path === '/api/v1/channels')?.status).toBe(200);
    expect(apiLog.responses.find((r) => r.path === '/api/v1/conversations')?.status).toBe(200);
    await probe.close();
  });

  test("only the member's own society is exposed: the list holds that one channel, other societies are refused", async () => {
    const member = await disposableMember('scope');
    const own = await api('GET', '/channels', member.token);
    const otherSociety = await api('GET', `/channels?societyId=${target.ready.fixtures.societies.B.id}`, member.token);
    const otherChannel = await api('GET', `/channels/${target.ready.fixtures.channels.B.id}`, member.token);

    expect(own.status).toBe(200);
    expect(own.json.data.map((c: { id: string }) => c.id)).toEqual([target.ready.fixtures.channels.A.id]);
    expect(otherSociety.status).toBe(403);
    expect(otherChannel.status).toBe(403);
    expect((await api('GET', '/users', member.token)).status, 'the user directory must stay administrator-only').toBe(403);
  });

  test('an account without the community permission gets the existing error, not a crash', async ({ page }) => {
    const email = `browser-noperm-${Date.now()}@integration.test`;
    const created = await target.registerAccount({ name: 'Browser noperm', email, password: OLD_PASSWORD });
    expect(created.status).toBe(201);
    const apiLog = watchApi(page);
    await signIn(page, email, OLD_PASSWORD);

    await page.goto('/community');

    await expect(page.getByText('Failed to load community chat').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
    expect(apiLog.requests.some((r) => r.path === '/api/v1/users')).toBe(false);
  });

  test('a society with no channels shows the empty Community page, not an error', async ({ page }) => {
    const societyId = await emptySociety('none');
    const member = await disposableMember('empty', societyId);
    const apiLog = watchApi(page);
    await signIn(page, member.email, OLD_PASSWORD);

    await page.goto('/community');

    await expect(page.getByText('Welcome to the Community Hub')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Failed to load community chat')).toHaveCount(0);
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
    expect(apiLog.responses.find((r) => r.path === '/api/v1/channels')?.status).toBe(200);
  });

  test('an administrator still loads the user directory and can pick a member for a direct message', async ({ page }) => {
    const admin = await disposableAdmin('dm');
    const apiLog = watchApi(page);
    await signIn(page, admin.email, OLD_PASSWORD);

    await page.goto('/community');
    await expect(page.getByRole('button', { name: /general/ }).first()).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => apiLog.responses.find((r) => r.path === '/api/v1/users')?.status, { timeout: 20_000 }).toBe(200);
    await page.getByRole('button', { name: 'Direct Messages' }).click();
    await page.locator('button:has(svg.lucide-plus)').first().click();

    await expect(page.getByText('New Direct Message')).toBeVisible();
    await expect(page.getByRole('button', { name: /Integration Admin/ })).toBeVisible();
  });
});
