// AUD-008: (A) the Community page must render a real incoming message instead of crashing, and
// (B) ChannelDetailPage, opened directly, must connect the socket and join its channel.
//
// Reproduced before the fix, with these same flows:
//   A. a message delivered by a second client made the page throw "Cannot read properties of
//      undefined (reading 'id')" and replace the route with React Router's error screen: the UI
//      read msg.sender.id, but the server sends the author as a populated `authorId` (and the
//      text as `body`, the parent as `parentMessageId`). Message history and the sender's own
//      posts were stored in the same wrong shape.
//   B. visiting /channels/<name> directly never connected the socket (only the Community page
//      called connectSocket), so the feed's channel:join was queued forever.
//
// Delivery to the page is proven with real server events (typing events travel through the same
// authorized `channel_<id>` room as messages) so the checks never depend on the very rendering
// that is under test. Every wait is on an observable event.
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  connectTokens,
  disposableAdmin,
  dropConnection,
  expectDelivery,
  firstChannelId,
  joinPackets,
  OLD_PASSWORD,
  openProbe,
  postChannelMessage,
  signIn,
  spaNavigate,
  storedToken,
  target,
  watchWire,
} from './support';

const here = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const { withDatabase } = nodeRequire(path.resolve(here, '../../../backend/test/integration/helpers/target.js'));

const stamp = () => `msg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test.describe.configure({ mode: 'serial' });

test.describe('Community renders real-time and loaded messages', () => {
  test('a message delivered by a second client renders with its text and sender, without an application error', async ({ page }) => {
    const user = await disposableAdmin('incoming');
    const wire = await watchWire(page);
    await signIn(page, user.email, OLD_PASSWORD);
    const channelId = await firstChannelId((await storedToken(page)) as string);
    const probe = await openProbe(channelId);
    await page.goto('/community');
    await expectDelivery(wire, probe, channelId, 'joined');

    const text = stamp();
    await postChannelMessage(channelId, text); // the second client: the fixture administrator over REST

    await expect(page.getByText(text)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Integration Admin').first()).toBeVisible();
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
    await expect(page).toHaveURL(/\/community/);
    await probe.close();
  });

  test('the signed-in user\'s own message, sent from the UI, renders as theirs', async ({ page }) => {
    const user = await disposableAdmin('own');
    await signIn(page, user.email, OLD_PASSWORD);
    await page.goto('/community');
    const input = page.getByPlaceholder('Type your message...');
    await expect(input).toBeVisible({ timeout: 20_000 });

    const text = stamp();
    await input.fill(text);
    await input.press('Enter');

    await expect(page.getByText(text)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`Browser own`).first()).toBeVisible();
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
  });

  test('a message with reactions in the loaded history shows grouped reactions instead of crashing', async ({ page }) => {
    const user = await disposableAdmin('history');
    await signIn(page, user.email, OLD_PASSWORD);
    const channelId = await firstChannelId((await storedToken(page)) as string);
    const text = stamp();
    await postChannelMessage(channelId, text);
    await withDatabase(target, async (db: any, ObjectId: any) => {
      const message = await db.collection('messages').findOne({ plainText: text });
      await db.collection('reactions').insertOne({
        messageId: message._id,
        userId: new ObjectId(user.id),
        value: '👍',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    await page.goto('/community');

    await expect(page.getByText(text)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /👍\s*1/ })).toBeVisible();
    await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
  });
});

test.describe('ChannelDetailPage opened directly', () => {
  test('connects the socket, joins its channel, rejoins after a reconnect, and stops rejoining once left', async ({ page }) => {
    const user = await disposableAdmin('direct');
    const wire = await watchWire(page);
    await signIn(page, user.email, OLD_PASSWORD);
    const token = (await storedToken(page)) as string;
    const channelId = await firstChannelId(token);
    const probe = await openProbe(channelId);
    const joinedChannel = (packets: string[]) => packets.filter((p) => p.includes(channelId));

    // direct navigation: no Community visit first
    await page.goto('/channels/general');
    await expect.poll(() => connectTokens(wire).includes(token), { timeout: 20_000, message: 'the page never connected its socket' }).toBe(true);
    await expect.poll(() => joinedChannel(joinPackets(wire)).length, { timeout: 20_000, message: 'the page never joined its channel' }).toBeGreaterThan(0);
    await expectDelivery(wire, probe, channelId, 'first connection');
    expect(new Set(connectTokens(wire)), 'one socket, one token').toEqual(new Set([token]));

    // a reconnect while the page stays mounted: exactly one new join, and delivery resumes
    const connectsBefore = connectTokens(wire).length;
    const joinsBefore = joinedChannel(joinPackets(wire)).length;
    await dropConnection(page, wire);
    await expect.poll(() => connectTokens(wire).length, { timeout: 30_000 }).toBe(connectsBefore + 1);
    await expectDelivery(wire, probe, channelId, 'after a reconnect');
    expect(joinedChannel(joinPackets(wire)).length - joinsBefore, 'exactly one rejoin per reconnect').toBe(1);

    // leaving the page releases the room and the listener: a later reconnect sends no join for it
    await spaNavigate(page, '/dashboard');
    await expect.poll(() => wire.packets.some((p) => p.includes('channel:leave') && p.includes(channelId)), { timeout: 20_000 }).toBe(true);
    const joinsAfterLeaving = joinedChannel(joinPackets(wire)).length;
    const connectsAfterLeaving = connectTokens(wire).length;
    await dropConnection(page, wire);
    await expect.poll(() => connectTokens(wire).length, { timeout: 30_000, message: 'no reconnect happened, so the check below proves nothing' }).toBe(connectsAfterLeaving + 1);
    await expect.poll(() => wire.sockets.at(-1)?.closed === false, { timeout: 20_000 }).toBe(true);
    expect(joinedChannel(joinPackets(wire)).length, 'a page that was left still rejoined its room').toBe(joinsAfterLeaving);
    await probe.close();
  });

  test('a channel message arriving on the directly opened page renders with its text and sender', async ({ page }) => {
    const user = await disposableAdmin('direct-msg');
    const wire = await watchWire(page);
    await signIn(page, user.email, OLD_PASSWORD);
    const channelId = await firstChannelId((await storedToken(page)) as string);
    const probe = await openProbe(channelId);
    await page.goto('/channels/general');
    await expectDelivery(wire, probe, channelId, 'joined');

    const text = stamp();
    await postChannelMessage(channelId, text);

    await expect(page.getByText(text)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Integration Admin').first()).toBeVisible();
    await probe.close();
  });
});
