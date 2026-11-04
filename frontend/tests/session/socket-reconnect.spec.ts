// AUD-007D: a mounted chat/community page must get its rooms back when the socket reconnects.
//
// Reproduced before the fix: after the connection dropped and Socket.IO reconnected on its own,
// the Community page (still mounted) sent no new channel:join, so messages posted afterwards
// never reached it until the page was remounted. The page's joins were issued once, from an
// effect, never again on 'connect'. Also: logout left the socket connected, and the socket kept
// the token it was created with for every reconnect attempt.
//
// Deterministic synchronization: every wait is on an observable event (a Socket.IO packet, a
// message rendered in the page, a closed WebSocket); the few negative assertions are made after
// a positive control proves the path works.
import { test, expect } from '@playwright/test';
import {
  api,
  connectTokens,
  disposableAdmin,
  dropConnection,
  expectDelivery,
  fixtureToken,
  firstChannelId,
  joinPackets,
  JWT_SHAPE,
  NEW_PASSWORD,
  OLD_PASSWORD,
  openProbe,
  signIn,
  spaNavigate,
  storedToken,
  watchWire,
} from './support';


test.describe.configure({ mode: 'serial' });

test.describe('a mounted Community page after the connection drops', () => {
  test('rejoins its channel on every reconnect without being remounted, once per reconnect', async ({ page }) => {
    const user = await disposableAdmin('reconnect');
    const wire = await watchWire(page);
    await signIn(page, user.email, OLD_PASSWORD);
    const token = (await storedToken(page)) as string;
    const channelId = await firstChannelId(token);
    const probe = await openProbe(channelId);

    await page.goto('/community');
    await page.evaluate(() => {
      (window as unknown as { __notReloaded: boolean }).__notReloaded = true;
    });
    await expect.poll(() => connectTokens(wire).length, { timeout: 20_000 }).toBe(1);

    // positive control: a message posted now reaches the mounted page, so the room is joined.
    // (In development React mounts effects twice, so the first connection may send a join,
    // leave, join sequence; every count below is therefore relative to this baseline.)
    await expectDelivery(wire, probe, channelId, 'before the drop');
    const baseline = joinPackets(wire).length;
    expect(baseline).toBeGreaterThan(0);

    // first drop
    await dropConnection(page, wire);
    await expect.poll(() => connectTokens(wire).length, { timeout: 30_000 }).toBe(2);
    await expectDelivery(wire, probe, channelId, 'after the first drop');
    expect(joinPackets(wire).length - baseline, 'exactly one rejoin for the first reconnect').toBe(1);

    // second, immediately after: still exactly one join per reconnect, never stacked
    await dropConnection(page, wire);
    await expect.poll(() => connectTokens(wire).length, { timeout: 30_000 }).toBe(3);
    await expectDelivery(wire, probe, channelId, 'after the second drop');
    expect(joinPackets(wire).length - baseline, 'exactly one rejoin per reconnect, no duplicates').toBe(2);

    // the document was never reloaded: the page stayed mounted throughout
    expect(await page.evaluate(() => (window as unknown as { __notReloaded?: boolean }).__notReloaded)).toBe(true);
    // every connection used the same valid token
    expect(new Set(connectTokens(wire))).toEqual(new Set([token]));
    expect(token).toMatch(JWT_SHAPE);
    await probe.close();
  });

  test('a reconnect after a password change uses the replacement token, not the old one, and rejoins', async ({ page }) => {
    const user = await disposableAdmin('replaced');
    const wire = await watchWire(page);
    await signIn(page, user.email, OLD_PASSWORD);
    const oldToken = (await storedToken(page)) as string;
    const channelId = await firstChannelId(oldToken);
    const probe = await openProbe(channelId);
    await page.goto('/community');
    await expect.poll(() => joinPackets(wire).length, { timeout: 20_000 }).toBeGreaterThan(0);

    // change the password inside the running app, then come back to the Community page
    await spaNavigate(page, '/change-password');
    await page.locator('input[name="currentPassword"]').fill(OLD_PASSWORD);
    await page.locator('input[name="newPassword"]').fill(NEW_PASSWORD);
    await page.locator('input[name="confirmPassword"]').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(page).toHaveURL(/\/profile/);
    const newToken = (await storedToken(page)) as string;
    expect(newToken).not.toBe(oldToken);
    await spaNavigate(page, '/community');
    await expect.poll(() => connectTokens(wire).includes(newToken), { timeout: 20_000 }).toBe(true);
    const connectsBeforeDrop = connectTokens(wire).length;
    const joinsBeforeDrop = joinPackets(wire).length;
    await expect.poll(() => joinPackets(wire).length, { timeout: 20_000 }).toBeGreaterThan(0);

    // now the connection drops while the page is mounted
    await dropConnection(page, wire);
    await expect.poll(() => connectTokens(wire).length, { timeout: 30_000 }).toBeGreaterThan(connectsBeforeDrop);
    expect(connectTokens(wire).slice(connectsBeforeDrop).every((t) => t === newToken), 'a reconnect used a stale token').toBe(true);
    await expect.poll(() => joinPackets(wire).length, { timeout: 30_000 }).toBeGreaterThan(joinsBeforeDrop);
    await expectDelivery(wire, probe, channelId, 'after replacement and drop');
    await probe.close();
  });
});

test.describe('logout and revoked sessions', () => {
  test('logout closes the socket and no later connection uses the previous user\'s token', async ({ page }) => {
    const alice = await disposableAdmin('logout-a');
    const bob = await disposableAdmin('logout-b');
    const wire = await watchWire(page);

    await signIn(page, alice.email, OLD_PASSWORD);
    const aliceToken = (await storedToken(page)) as string;
    await page.goto('/community');
    await expect.poll(() => connectTokens(wire).includes(aliceToken), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => joinPackets(wire).length, { timeout: 20_000 }).toBeGreaterThan(0);
    const aliceConnects = connectTokens(wire).length;

    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    expect(await storedToken(page)).toBeNull();
    await expect.poll(() => wire.sockets.some((s) => s.closed), { timeout: 20_000 }).toBe(true);

    // another user signs in on the same page; every later connection belongs to that user only
    await signIn(page, bob.email, OLD_PASSWORD);
    const bobToken = (await storedToken(page)) as string;
    expect(bobToken).not.toBe(aliceToken);
    await page.goto('/community');
    await expect.poll(() => connectTokens(wire).slice(aliceConnects).includes(bobToken), { timeout: 20_000 }).toBe(true);
    expect(connectTokens(wire).slice(aliceConnects).includes(aliceToken), 'the previous user\'s token was used again').toBe(false);
  });

  test('a session revoked by a password reset does not get its room back, and the page signs out on its next request', async ({ page }) => {
    const user = await disposableAdmin('revoked-room');
    const wire = await watchWire(page);
    await signIn(page, user.email, OLD_PASSWORD);
    const token = (await storedToken(page)) as string;
    const channelId = await firstChannelId(token);
    const probe = await openProbe(channelId);
    await page.goto('/community');
    await expectDelivery(wire, probe, channelId, 'before the reset');
    const joinsBeforeReset = joinPackets(wire).length;

    const reset = await api('POST', `/users/${user.id}/reset-password`, await fixtureToken('admin'), { newPassword: NEW_PASSWORD });
    expect(reset.status).toBe(200);
    await expect.poll(() => wire.sockets.every((s) => s.closed), { timeout: 20_000 }).toBe(true);

    // the old token is dead: it can neither call the API nor open a connection (handshake refused)
    expect((await api('GET', '/auth/me', token)).status).toBe(401);
    const receivedBeforeProbe = wire.received.length;
    probe.emit('typing:start', { channelId }); // the revoked page is in no room, and no socket is open
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    expect(await storedToken(page)).toBeNull();
    expect(joinPackets(wire).length, 'a join was sent with a revoked session').toBe(joinsBeforeReset);
    expect(wire.received.slice(receivedBeforeProbe).filter((f) => f.startsWith('42["typing:')), 'a room event reached a revoked session').toEqual([]);
    await probe.close();
  });
});
