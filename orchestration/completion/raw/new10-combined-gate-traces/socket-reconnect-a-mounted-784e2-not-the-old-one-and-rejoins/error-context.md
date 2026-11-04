# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: socket-reconnect.spec.ts >> a mounted Community page after the connection drops >> a reconnect after a password change uses the replacement token, not the old one, and rejoins
- Location: tests\session\socket-reconnect.spec.ts:77:3

# Error details

```
Error: the websocket did not close when offline

the websocket did not close when offline

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 20000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=f1e4]:
  - complementary [ref=f1e5]:
    - navigation [ref=f1e6]:
      - link "Dashboard" [ref=f1e7] [cursor=pointer]:
        - /url: /dashboard
      - link "Societies" [ref=f1e15] [cursor=pointer]:
        - /url: /societies
      - link "Events" [ref=f1e22] [cursor=pointer]:
        - /url: /events
      - link "Projects" [ref=f1e27] [cursor=pointer]:
        - /url: /projects
      - link "Reports" [ref=f1e32] [cursor=pointer]:
        - /url: /reports
      - link "Announcements" [ref=f1e38] [cursor=pointer]:
        - /url: /announcements
      - link "Community Hub" [ref=f1e44] [cursor=pointer]:
        - /url: /community
      - link "Tasks" [ref=f1e49] [cursor=pointer]:
        - /url: /tasks
      - link "Awards & Scholarships" [ref=f1e55] [cursor=pointer]:
        - /url: /opportunities
      - link "Unified Calendar" [ref=f1e61] [cursor=pointer]:
        - /url: /calendar
    - generic [ref=f1e67] [cursor=pointer]:
      - generic [ref=f1e68]: B
      - generic [ref=f1e69]:
        - paragraph [ref=f1e70]: Browser replaced
        - paragraph [ref=f1e71]: sb faculty advisor
  - generic [ref=f1e72]:
    - banner [ref=f1e74]:
      - generic [ref=f1e75]:
        - generic [ref=f1e76]: IEEE
        - generic [ref=f1e77]: Campus Hub
        - button "ITA" [ref=f1e80] [cursor=pointer]
      - generic [ref=f1e88]:
        - button "Toggle theme" [ref=f1e89] [cursor=pointer]
        - button "Browser replaced" [ref=f1e92] [cursor=pointer]
        - button "Logout" [ref=f1e98] [cursor=pointer]
    - main [ref=f1e103]:
      - generic [ref=f1e105]:
        - generic [ref=f1e106]:
          - generic [ref=f1e107]:
            - button "Channels" [ref=f1e108] [cursor=pointer]
            - button "Direct Messages" [ref=f1e109] [cursor=pointer]
          - generic [ref=f1e111]:
            - generic [ref=f1e112]:
              - generic [ref=f1e113]: Channels
              - button [ref=f1e114] [cursor=pointer]
            - generic [ref=f1e117]:
              - paragraph [ref=f1e118]: text channels
              - button "general" [ref=f1e120] [cursor=pointer]
        - generic [ref=f1e125]:
          - heading "general" [level=2] [ref=f1e132]
          - generic [ref=f1e134]:
            - paragraph [ref=f1e138]: No messages here yet
            - paragraph [ref=f1e139]: Start the conversation by sending a message below!
          - generic [ref=f1e141]:
            - button "📊" [ref=f1e142] [cursor=pointer]
            - textbox "Type your message..." [ref=f1e143]
            - button [disabled] [ref=f1e144]
```

# Test source

```ts
  117 |   });
  118 |   return { requests, responses };
  119 | }
  120 | 
  121 | /** First channel society A (the channel the Community page auto-selects for a global advisor). */
  122 | export async function firstChannelId(token: string) {
  123 |   const res = await api('GET', '/channels', token);
  124 |   expect(res.status).toBe(200);
  125 |   return res.json.data[0].id as string;
  126 | }
  127 | export async function postChannelMessage(channelId: string, text: string) {
  128 |   const res = await api('POST', `/channels/${channelId}/messages`, await fixtureToken('admin'), { body: text });
  129 |   expect(res.status).toBe(201);
  130 | }
  131 | 
  132 | /**
  133 |  * A second, API-level client (the fixture administrator) that is a member of the channel room
  134 |  * and can make the server send room events to everyone else in it. The Community page cannot
  135 |  * be used to observe delivery by rendered messages: it currently crashes when a real-time
  136 |  * message arrives (it reads msg.author.id, but the server sends authorId) - a separate,
  137 |  * pre-existing defect. Typing events travel through the same authorized `channel_<id>` room as
  138 |  * messages, so receiving one proves the page's socket is a member of that room.
  139 |  */
  140 | export async function openProbe(channelId: string) {
  141 |   const { connectSocket } = nodeRequire(path.join(HELPERS, 'socket-client.js'));
  142 |   const result = await connectSocket(target.baseUrl, { token: await fixtureToken('admin') });
  143 |   expect(result.ok, 'the probe client could not connect').toBe(true);
  144 |   const joined = await result.client.emitWithAck('channel:join', channelId);
  145 |   expect(joined).toEqual({ success: true });
  146 |   return result.client as { emit: (event: string, payload: unknown) => void; close: () => Promise<void> };
  147 | }
  148 | 
  149 | /**
  150 |  * Waits until the page receives a room event sent AFTER this call starts. The probe keeps
  151 |  * emitting typing:start (one per poll) because an event sent before the server has processed
  152 |  * the page's join is simply missed; retrying removes that race without a fixed sleep. Times
  153 |  * out if the page's socket is in no room - which is what the reconnect defect looked like.
  154 |  */
  155 | export async function expectDelivery(wire: Wire, probe: { emit: (e: string, p: unknown) => void }, channelId: string, label: string, timeout = 30_000) {
  156 |   const from = wire.received.length;
  157 |   await expect
  158 |     .poll(
  159 |       () => {
  160 |         probe.emit('typing:start', { channelId });
  161 |         return wire.received.slice(from).some((frame) => frame.startsWith('42["typing:') && frame.includes(channelId));
  162 |       },
  163 |       { timeout, message: `the page received no room event (${label})` },
  164 |     )
  165 |     .toBe(true);
  166 | }
  167 | 
  168 | // ---- observing the browser's socket traffic -----------------------------------------------------------
  169 | 
  170 | export interface Wire {
  171 |   packets: string[];
  172 |   received: string[];
  173 |   sockets: { url: string; closed: boolean }[];
  174 | }
  175 | /**
  176 |  * Records Socket.IO packets (long-polling request bodies and WebSocket frames, in send order),
  177 |  * the frames the page receives, and which Socket.IO WebSockets are open or closed. Install
  178 |  * BEFORE the page opens its socket.
  179 |  */
  180 | export async function watchWire(page: Page): Promise<Wire> {
  181 |   const wire: Wire = { packets: [], received: [], sockets: [] };
  182 |   page.on('request', (request) => {
  183 |     if (request.url().includes('/socket.io/') && request.method() === 'POST') {
  184 |       const data = request.postData();
  185 |       if (data) wire.packets.push(data);
  186 |     }
  187 |   });
  188 |   page.on('websocket', (ws: WebSocket) => {
  189 |     if (!ws.url().includes('/socket.io/')) return; // not Vite's own hot-reload socket
  190 |     const record = { url: ws.url(), closed: false };
  191 |     wire.sockets.push(record);
  192 |     ws.on('framesent', (frame) => wire.packets.push(String(frame.payload)));
  193 |     ws.on('framereceived', (frame) => wire.received.push(String(frame.payload)));
  194 |     ws.on('close', () => {
  195 |       record.closed = true;
  196 |     });
  197 |   });
  198 |   return wire;
  199 | }
  200 | const packetsOf = (wire: Wire) => wire.packets.flatMap((p) => p.split(String.fromCharCode(30)));
  201 | export const connectTokens = (wire: Wire) =>
  202 |   packetsOf(wire).filter((p) => p.startsWith('40{')).map((p) => (JSON.parse(p.slice(2)) as { token: string }).token);
  203 | export const joinPackets = (wire: Wire, event = 'channel:join') => packetsOf(wire).filter((p) => p.startsWith(`42["${event}"`));
  204 | 
  205 | /**
  206 |  * Interrupts the network like a real outage: the browser goes offline until its Socket.IO
  207 |  * WebSocket has closed (observed, not slept on), then comes back, and Socket.IO reconnects on
  208 |  * its own. The server sees the connection end and releases that socket's rooms. (Closing a
  209 |  * proxied WebSocket from the test did not reliably end the real connection, so it is not used.)
  210 |  */
  211 | export async function dropConnection(page: Page, wire: Wire) {
  212 |   expect(wire.sockets.length, 'no live websocket to drop').toBeGreaterThan(0);
  213 |   await page.context().setOffline(true);
  214 |   try {
  215 |     await expect
  216 |       .poll(() => wire.sockets.at(-1)?.closed, { timeout: 20_000, message: 'the websocket did not close when offline' })
> 217 |       .toBe(true);
      |        ^ Error: the websocket did not close when offline
  218 |   } finally {
  219 |     await page.context().setOffline(false);
  220 |   }
  221 | }
  222 | 
  223 | // ---- UI helpers ---------------------------------------------------------------------------------------------
  224 | 
  225 | export async function signIn(page: Page, email: string, password: string) {
  226 |   await page.goto('/login');
  227 |   await page.locator('input[type="email"]').fill(email);
  228 |   await page.locator('input[type="password"]').fill(password);
  229 |   await page.getByRole('button', { name: 'Sign in' }).click();
  230 |   await expect(page).toHaveURL(/\/dashboard/);
  231 | }
  232 | export const storedToken = (page: Page) => page.evaluate(() => localStorage.getItem('token'));
  233 | /** Client-side navigation: keeps the running app (and its socket) alive, unlike page.goto. */
  234 | export async function spaNavigate(page: Page, to: string) {
  235 |   await page.evaluate((url) => {
  236 |     window.history.pushState({}, '', url);
  237 |     window.dispatchEvent(new PopStateEvent('popstate'));
  238 |   }, to);
  239 |   await expect(page).toHaveURL(new RegExp(`${to}$`));
  240 | }
  241 | 
```