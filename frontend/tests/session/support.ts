// Shared helpers for the browser session specs. Everything runs against the isolated backend
// harness (loopback 127.0.0.1:5057, in-memory MongoDB); requireHarnessTarget() refuses to run
// without it.
import { expect, type Page, type WebSocket } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const HELPERS = path.resolve(here, '../../../backend/test/integration/helpers');
const nodeRequire = createRequire(import.meta.url);
const { requireHarnessTarget, withDatabase } = nodeRequire(path.join(HELPERS, 'target.js'));
const fixtures = nodeRequire(path.join(HELPERS, 'fixtures.js'));

export const target = requireHarnessTarget();
export const TEST_PASSWORD: string = fixtures.TEST_PASSWORD;
export const USERS = fixtures.USERS;
export const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export const OLD_PASSWORD = 'browser-original-password-1234';
export const NEW_PASSWORD = 'browser-second-password-987654';

const RUN = Date.now();
let counter = 0;

export async function api(method: string, route: string, token?: string | null, body?: unknown) {
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

export async function fixtureToken(key: 'admin' | 'chairA' | 'memberA') {
  const res = await api('POST', '/auth/login', null, { email: USERS[key].email, password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  return res.json.data.token as string;
}

/** A disposable account that can use the Community page: ADMIN with the global advisor role. */
export async function disposableAdmin(label: string) {
  const email = `browser-${label}-${RUN}-${++counter}@integration.test`;
  const created = await target.registerAccount({ name: `Browser ${label}`, email, password: OLD_PASSWORD });
  const body = await created.json();
  expect(created.status).toBe(201);
  const id: string = body.data.user.id;
  await withDatabase(target, async (db: any, ObjectId: any) => {
    const role = await db.collection('roles').findOne({ name: 'sb_faculty_advisor' });
    await db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: { role: 'ADMIN' } });
    await db.collection('userroles').insertOne({
      user: new ObjectId(id),
      role: role._id,
      society: null,
      assignedBy: new ObjectId(target.ready.fixtures.users.admin.id),
      assignedAt: new Date(),
    });
  });
  return { id, email, token: body.data.token as string };
}

/**
 * A disposable ordinary member (legacy role OFFICE_BEARER, not an administrator) of a society,
 * holding the seeded `ieee_member` RBAC role: community hub view/create, nothing else.
 */
export async function disposableMember(label: string, societyId: string = target.ready.fixtures.societies.A.id) {
  const email = `browser-${label}-${RUN}-${++counter}@integration.test`;
  const created = await target.registerAccount({ name: `Browser ${label}`, email, password: OLD_PASSWORD });
  const body = await created.json();
  expect(created.status).toBe(201);
  const id: string = body.data.user.id;
  await withDatabase(target, async (db: any, ObjectId: any) => {
    const role = await db.collection('roles').findOne({ name: 'ieee_member' });
    await db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: { societyId: new ObjectId(societyId) } });
    await db.collection('userroles').insertOne({
      user: new ObjectId(id),
      role: role._id,
      society: new ObjectId(societyId),
      assignedBy: new ObjectId(target.ready.fixtures.users.admin.id),
      assignedAt: new Date(),
    });
  });
  return { id, email, token: body.data.token as string };
}

/** A society with no channels, for the empty-list case. */
export async function emptySociety(label: string) {
  return withDatabase(target, async (db: any) => {
    const now = new Date();
    const inserted = await db.collection('societies').insertOne({
      name: `Empty Society ${label} ${RUN}`,
      shortName: `E${String(RUN).slice(-6)}`,
      createdAt: now,
      updatedAt: now,
    });
    return String(inserted.insertedId);
  });
}

/** Records every API request the page makes and the status of each response. */
export function watchApi(page: Page) {
  const requests: { method: string; path: string; body: string | null }[] = [];
  const responses: { path: string; status: number }[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/v1/')) requests.push({ method: request.method(), path: url.pathname, body: request.postData() });
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/v1/')) responses.push({ path: url.pathname, status: response.status() });
  });
  return { requests, responses };
}

/** First channel society A (the channel the Community page auto-selects for a global advisor). */
export async function firstChannelId(token: string) {
  const res = await api('GET', '/channels', token);
  expect(res.status).toBe(200);
  return res.json.data[0].id as string;
}
export async function postChannelMessage(channelId: string, text: string) {
  const res = await api('POST', `/channels/${channelId}/messages`, await fixtureToken('admin'), { body: text });
  expect(res.status).toBe(201);
}

/**
 * A second, API-level client (the fixture administrator) that is a member of the channel room
 * and can make the server send room events to everyone else in it. The Community page cannot
 * be used to observe delivery by rendered messages: it currently crashes when a real-time
 * message arrives (it reads msg.author.id, but the server sends authorId) - a separate,
 * pre-existing defect. Typing events travel through the same authorized `channel_<id>` room as
 * messages, so receiving one proves the page's socket is a member of that room.
 */
export async function openProbe(channelId: string) {
  const { connectSocket } = nodeRequire(path.join(HELPERS, 'socket-client.js'));
  const result = await connectSocket(target.baseUrl, { token: await fixtureToken('admin') });
  expect(result.ok, 'the probe client could not connect').toBe(true);
  const joined = await result.client.emitWithAck('channel:join', channelId);
  expect(joined).toEqual({ success: true });
  return result.client as { emit: (event: string, payload: unknown) => void; close: () => Promise<void> };
}

/**
 * Waits until the page receives a room event sent AFTER this call starts. The probe keeps
 * emitting typing:start (one per poll) because an event sent before the server has processed
 * the page's join is simply missed; retrying removes that race without a fixed sleep. Times
 * out if the page's socket is in no room - which is what the reconnect defect looked like.
 */
export async function expectDelivery(wire: Wire, probe: { emit: (e: string, p: unknown) => void }, channelId: string, label: string, timeout = 30_000) {
  const from = wire.received.length;
  await expect
    .poll(
      () => {
        probe.emit('typing:start', { channelId });
        return wire.received.slice(from).some((frame) => frame.startsWith('42["typing:') && frame.includes(channelId));
      },
      { timeout, message: `the page received no room event (${label})` },
    )
    .toBe(true);
}

// ---- observing the browser's socket traffic -----------------------------------------------------------

export interface Wire {
  packets: string[];
  received: string[];
  sockets: { url: string; closed: boolean }[];
}
/**
 * Records Socket.IO packets (long-polling request bodies and WebSocket frames, in send order),
 * the frames the page receives, and which Socket.IO WebSockets are open or closed. Install
 * BEFORE the page opens its socket.
 */
export async function watchWire(page: Page): Promise<Wire> {
  const wire: Wire = { packets: [], received: [], sockets: [] };
  page.on('request', (request) => {
    if (request.url().includes('/socket.io/') && request.method() === 'POST') {
      const data = request.postData();
      if (data) wire.packets.push(data);
    }
  });
  page.on('websocket', (ws: WebSocket) => {
    if (!ws.url().includes('/socket.io/')) return; // not Vite's own hot-reload socket
    const record = { url: ws.url(), closed: false };
    wire.sockets.push(record);
    ws.on('framesent', (frame) => wire.packets.push(String(frame.payload)));
    ws.on('framereceived', (frame) => wire.received.push(String(frame.payload)));
    ws.on('close', () => {
      record.closed = true;
    });
  });
  return wire;
}
const packetsOf = (wire: Wire) => wire.packets.flatMap((p) => p.split(String.fromCharCode(30)));
export const connectTokens = (wire: Wire) =>
  packetsOf(wire).filter((p) => p.startsWith('40{')).map((p) => (JSON.parse(p.slice(2)) as { token: string }).token);
export const joinPackets = (wire: Wire, event = 'channel:join') => packetsOf(wire).filter((p) => p.startsWith(`42["${event}"`));

/**
 * Interrupts the network like a real outage: the browser goes offline until its Socket.IO
 * WebSocket has closed (observed, not slept on), then comes back, and Socket.IO reconnects on
 * its own. The server sees the connection end and releases that socket's rooms. (Closing a
 * proxied WebSocket from the test did not reliably end the real connection, so it is not used.)
 */
export async function dropConnection(page: Page, wire: Wire) {
  expect(wire.sockets.length, 'no live websocket to drop').toBeGreaterThan(0);
  await page.context().setOffline(true);
  try {
    await expect
      .poll(() => wire.sockets.at(-1)?.closed, { timeout: 20_000, message: 'the websocket did not close when offline' })
      .toBe(true);
  } finally {
    await page.context().setOffline(false);
  }
}

// ---- UI helpers ---------------------------------------------------------------------------------------------

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
export const storedToken = (page: Page) => page.evaluate(() => localStorage.getItem('token'));
/** Client-side navigation: keeps the running app (and its socket) alive, unlike page.goto. */
export async function spaNavigate(page: Page, to: string) {
  await page.evaluate((url) => {
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, to);
  await expect(page).toHaveURL(new RegExp(`${to}$`));
}
