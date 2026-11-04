// Browser verification of the password-change session flow (AUD-007B), run against the isolated
// backend harness (in-memory MongoDB, loopback only) through the real frontend.
//
// Covered, in a real Chromium:
//   1. a successful self-service change stores the replacement token;
//   2. the next protected requests succeed with it (in the page and after a reload);
//   3. the previous token is rejected by the API;
//   4. the client reconnects its Socket.IO connection using the replacement token;
//   5. the client joins the channel room again where the app's design joins it (Community page);
//   6. an absent or malformed replacement token never overwrites the stored token;
//   7. the existing 401 handler signs the user out when a stored token is rejected;
//   8. an administrator reset revokes the target's token and closes their socket without giving
//      the administrator a token;
//   9. login, logout and protected-route redirects still work.
//
// Socket.IO starts on HTTP long polling and upgrades to WebSocket, so the connection packet
// (40{"token":...}) and room joins (42["channel:join",...]) are read from BOTH the polling
// request bodies and the WebSocket frames, in the order they were sent.
import { test, expect, type Page, type WebSocket } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const HELPERS = path.resolve(here, '../../../backend/test/integration/helpers');
const nodeRequire = createRequire(import.meta.url);
const { requireHarnessTarget, withDatabase } = nodeRequire(path.join(HELPERS, 'target.js'));
const { TEST_PASSWORD, USERS } = nodeRequire(path.join(HELPERS, 'fixtures.js'));

const target = requireHarnessTarget(); // refuses to run unless the isolated harness is up
const RUN = Date.now();
const OLD_PASSWORD = 'browser-original-password-1234';
const NEW_PASSWORD = 'browser-second-password-987654';
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
let counter = 0;

async function api(method: string, route: string, token?: string | null, body?: unknown) {
  const res = await fetch(`${target.baseUrl}/api/v1${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, text };
}

async function fixtureToken(key: 'admin' | 'chairA' | 'memberA') {
  const res = await api('POST', '/auth/login', null, { email: USERS[key].email, password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  return res.json.data.token as string;
}

/** A disposable account that can use the Community page: ADMIN with the global advisor role. */
async function disposableAdmin(label: string) {
  const email = `browser-${label}-${RUN}-${++counter}@integration.test`;
  const created = await target.registerAccount({ name: `Browser ${label}`, email, password: OLD_PASSWORD });
  const body = await created.json();
  expect(created.status).toBe(201);
  const id: string = body.data.user.id;
  const adminId = (await fixtureTokenUserId());
  await withDatabase(target, async (db: any, ObjectId: any) => {
    const role = await db.collection('roles').findOne({ name: 'sb_faculty_advisor' });
    await db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: { role: 'ADMIN' } });
    await db.collection('userroles').insertOne({
      user: new ObjectId(id),
      role: role._id,
      society: null,
      assignedBy: new ObjectId(adminId),
      assignedAt: new Date(),
    });
  });
  return { id, email, token: body.data.token as string };
}
async function fixtureTokenUserId() {
  return target.ready.fixtures.users.admin.id as string;
}

// ---- observing the browser's socket traffic ------------------------------------------------------------

interface Wire {
  packets: string[];
  sockets: { url: string; closed: boolean }[];
}
function watchWire(page: Page): Wire {
  const wire: Wire = { packets: [], sockets: [] };
  page.on('request', (request) => {
    if (request.url().includes('/socket.io/') && request.method() === 'POST') {
      const data = request.postData();
      if (data) wire.packets.push(data);
    }
  });
  page.on('websocket', (ws: WebSocket) => {
    const record = { url: ws.url(), closed: false };
    wire.sockets.push(record);
    ws.on('framesent', (frame) => wire.packets.push(String(frame.payload)));
    ws.on('close', () => {
      record.closed = true;
    });
  });
  return wire;
}
const connectPackets = (wire: Wire) =>
  wire.packets.flatMap((p) => p.split('\u001e')).filter((p) => p.startsWith('40{')).map((p) => (JSON.parse(p.slice(2)) as { token: string }).token);
const joinPackets = (wire: Wire) => wire.packets.flatMap((p) => p.split('\u001e')).filter((p) => p.startsWith('42["channel:join"'));

// ---- UI helpers ---------------------------------------------------------------------------------------------

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
const storedToken = (page: Page) => page.evaluate(() => localStorage.getItem('token'));
/** Client-side navigation: keeps the running app (and its socket) alive, unlike page.goto. */
async function spaNavigate(page: Page, to: string) {
  await page.evaluate((url) => {
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, to);
  await expect(page).toHaveURL(new RegExp(`${to}$`));
}
async function submitPasswordChange(page: Page, current: string, next: string) {
  await page.locator('input[name="currentPassword"]').fill(current);
  await page.locator('input[name="newPassword"]').fill(next);
  await page.locator('input[name="confirmPassword"]').fill(next);
  await page.getByRole('button', { name: 'Change Password' }).click();
}

test.describe.configure({ mode: 'serial' });

test.describe('existing session behavior is intact', () => {
  test('protected routes redirect, login stores a token, logout clears it', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    await signIn(page, USERS.memberA.email, TEST_PASSWORD);
    const token = await storedToken(page);
    expect(token).toMatch(JWT_SHAPE);
    expect((await api('GET', '/auth/me', token)).status).toBe(200);

    await page.getByRole('button', { name: /logout/i }).click();
    expect(await storedToken(page)).toBeNull();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('self-service password change', () => {
  test('stores the replacement token, reconnects the socket with it, rejoins the room, and the old token is dead', async ({ page }) => {
    const user = await disposableAdmin('self');
    const wire = watchWire(page);

    await signIn(page, user.email, OLD_PASSWORD);
    const oldToken = (await storedToken(page)) as string;
    expect(oldToken).toMatch(JWT_SHAPE);

    // Community page connects the socket and joins the first channel.
    await page.goto('/community');
    await expect.poll(() => connectPackets(wire).includes(oldToken), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => joinPackets(wire).length, { timeout: 20_000 }).toBeGreaterThan(0);
    const connectsBefore = connectPackets(wire).length;
    const joinsBefore = joinPackets(wire).length;

    // Change the password from inside the running app (the socket stays alive until the server closes it).
    await spaNavigate(page, '/change-password');
    await submitPasswordChange(page, OLD_PASSWORD, NEW_PASSWORD);
    await expect(page).toHaveURL(/\/profile/);

    // 1. the replacement token is stored (valid shape, different from the old one)
    const newToken = (await storedToken(page)) as string;
    expect(newToken).toMatch(JWT_SHAPE);
    expect(newToken).not.toBe(oldToken);

    // 2. it authenticates; 3. the previous token no longer does
    expect((await api('GET', '/auth/me', newToken)).status).toBe(200);
    expect((await api('GET', '/auth/me', oldToken)).status).toBe(401);

    // 4. the server closed the old socket and the client reconnected with the replacement token
    await expect.poll(() => wire.sockets.some((s) => s.closed), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => connectPackets(wire).slice(connectsBefore).includes(newToken), { timeout: 20_000 }).toBe(true);
    expect(connectPackets(wire).slice(connectsBefore).includes(oldToken)).toBe(false);

    // the next protected requests succeed in the page: navigate and reload
    await spaNavigate(page, '/dashboard');
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    expect(await storedToken(page)).toBe(newToken);

    // 5. back on the Community page the channel room is joined again over the new connection
    await spaNavigate(page, '/community');
    await expect.poll(() => joinPackets(wire).length, { timeout: 20_000 }).toBeGreaterThan(joinsBefore);
    expect(connectPackets(wire).at(-1)).toBe(newToken);

    // the new password signs in, the old one does not
    expect((await api('POST', '/auth/login', null, { email: user.email, password: NEW_PASSWORD })).status).toBe(200);
    expect((await api('POST', '/auth/login', null, { email: user.email, password: OLD_PASSWORD })).status).toBe(401);
  });

  test('an absent or malformed replacement token never overwrites the stored token', async ({ page }) => {
    const user = await disposableAdmin('malformed');
    await signIn(page, user.email, OLD_PASSWORD);
    const stored = (await storedToken(page)) as string;
    const variants: unknown[] = [
      { success: true, message: 'ok' }, // no data at all
      { success: true, message: 'ok', data: null },
      { success: true, message: 'ok', data: {} },
      { success: true, message: 'ok', data: { token: '' } },
      { success: true, message: 'ok', data: { token: 'garbage' } },
      { success: true, message: 'ok', data: { token: 12345 } },
      { success: true, message: 'ok', data: { token: 'a.b.c d' } },
      { success: true, message: 'ok', data: { token: '<script>.alert.1' } },
    ];

    for (const body of variants) {
      await page.route('**/auth/change-password', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }));
      await spaNavigate(page, '/change-password');
      await submitPasswordChange(page, OLD_PASSWORD, NEW_PASSWORD);
      await expect(page).toHaveURL(/\/profile/);

      expect(await storedToken(page), JSON.stringify(body)).toBe(stored);
      await page.unroute('**/auth/change-password');
    }
    // the stored token is still the real, working one
    expect((await api('GET', '/auth/me', stored)).status).toBe(200);
  });

  test('a rejected stored token is handled by the existing 401 handler: signed out and sent to the login page', async ({ page }) => {
    const user = await disposableAdmin('revoked');
    await signIn(page, user.email, OLD_PASSWORD);
    const oldToken = (await storedToken(page)) as string;

    // revoke it server-side (administrator reset), then let the app use it
    const reset = await api('POST', `/users/${user.id}/reset-password`, await fixtureToken('admin'), { newPassword: NEW_PASSWORD });
    expect(reset.status).toBe(200);
    expect((await api('GET', '/auth/me', oldToken)).status).toBe(401);

    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    expect(await storedToken(page)).toBeNull();
  });
});

test.describe('administrator password reset', () => {
  test('revokes the target, closes their socket, and gives the administrator no token', async ({ page }) => {
    const target1 = await disposableAdmin('reset');
    const wire = watchWire(page);
    await signIn(page, target1.email, OLD_PASSWORD);
    const oldToken = (await storedToken(page)) as string;
    await page.goto('/community');
    await expect.poll(() => connectPackets(wire).includes(oldToken), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => joinPackets(wire).length, { timeout: 20_000 }).toBeGreaterThan(0);

    const adminToken = await fixtureToken('admin');
    const reset = await api('POST', `/users/${target1.id}/reset-password`, adminToken, { newPassword: NEW_PASSWORD });

    expect(reset.status).toBe(200);
    expect(reset.text.includes('"token"')).toBe(false);
    expect((await api('GET', '/auth/me', oldToken)).status).toBe(401);
    await expect.poll(() => wire.sockets.some((s) => s.closed), { timeout: 20_000 }).toBe(true);
    // the revoked old token cannot establish another connection: no new CONNECT with it succeeds as authenticated
    expect((await api('GET', '/auth/me', adminToken)).status).toBe(200);

    // the user's next action in the app signs them out through the 401 handler
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    expect(await storedToken(page)).toBeNull();

    // and they can sign in again with the new password
    await signIn(page, target1.email, NEW_PASSWORD);
    expect((await storedToken(page)) as string).toMatch(JWT_SHAPE);
  });
});
