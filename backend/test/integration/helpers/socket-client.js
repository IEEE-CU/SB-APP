"use strict";

/**
 * Minimal, test-only Socket.IO v4 client over Node's built-in WebSocket
 * (Engine.IO v4, websocket transport, default namespace "/").
 *
 * Implements only what the integration tests need:
 *   - Engine.IO open packet, ping/pong
 *   - Socket.IO CONNECT with an auth payload, CONNECT_ERROR, DISCONNECT
 *   - EVENT packets (with and without acknowledgement ids) and ACK packets
 *   - bounded waits, an event log, and deterministic cleanup
 *
 * Not implemented: polling, upgrades, namespaces other than "/", binary
 * attachments, reconnection. Tokens are never logged.
 *
 * Wire format (text frames):
 *   Engine.IO:  0 open  1 close  2 ping  3 pong  4 message
 *   Socket.IO (inside an Engine.IO "4" message):
 *     0 CONNECT   1 DISCONNECT   2 EVENT   3 ACK   4 CONNECT_ERROR
 *     EVENT/ACK may carry a numeric id before the JSON payload.
 */

const DEFAULT_CONNECT_TIMEOUT_MS = 5000;

class TestSocket {
  constructor(ws) {
    this.ws = ws;
    this.events = []; // { event, args, at }
    this.closed = false;
    this.closedAt = null;
    this.closeReason = null;
    this.sid = null;
    this._waiters = new Set();
    this._acks = new Map();
    this._nextAckId = 1;
    this._closeWaiters = new Set();
  }

  /** Index into the event log; pass to waitFor/quiet to ignore earlier events. */
  mark() {
    return this.events.length;
  }

  /** Fire-and-forget event. Throws if the socket is closed. */
  emit(event, ...args) {
    this._assertOpen();
    this.ws.send(`42${JSON.stringify([event, ...args])}`);
  }

  /** Emit with an acknowledgement; rejects on timeout or disconnect. */
  emitWithAck(event, payload, timeoutMs = 3000) {
    try {
      this._assertOpen();
    } catch (error) {
      return Promise.reject(error); // always asynchronous failure
    }
    const id = this._nextAckId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._acks.delete(id);
        reject(new Error(`no acknowledgement for "${event}" within ${timeoutMs} ms`));
      }, timeoutMs);
      this._acks.set(id, { resolve, reject, timer });
      this.ws.send(`42${id}${JSON.stringify([event, payload])}`);
    });
  }

  /**
   * Resolves with the first matching event's first argument. Looks at events
   * already logged at index `since` or later, then waits.
   */
  waitFor(event, predicate = () => true, timeoutMs = 3000, since = this.events.length) {
    const found = this.events
      .slice(since)
      .find((e) => e.event === event && predicate(e.args[0]));
    if (found) return Promise.resolve(found.args[0]);
    if (this.closed) {
      return Promise.reject(new Error(`socket closed while waiting for "${event}"`));
    }
    return new Promise((resolve, reject) => {
      const waiter = { event, predicate, resolve, reject };
      waiter.timer = setTimeout(() => {
        this._waiters.delete(waiter);
        reject(new Error(`timed out after ${timeoutMs} ms waiting for "${event}"`));
      }, timeoutMs);
      this._waiters.add(waiter);
    });
  }

  /**
   * Waits `ms` and returns the matching events received in that window since
   * `since` (use for negative assertions; pair with a positive control).
   */
  async collect(event, predicate = () => true, ms = 1000, since = this.events.length) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return this.events
      .slice(since)
      .filter((e) => e.event === event && predicate(e.args[0]))
      .map((e) => e.args[0]);
  }

  /** Resolves when the connection has closed (immediately if already closed). */
  waitForClose(timeoutMs = 5000) {
    if (this.closed) return Promise.resolve(this.closedAt);
    return new Promise((resolve, reject) => {
      const waiter = { resolve };
      waiter.timer = setTimeout(() => {
        this._closeWaiters.delete(waiter);
        reject(new Error(`socket still open after ${timeoutMs} ms`));
      }, timeoutMs);
      this._closeWaiters.add(waiter);
    });
  }

  /** Client-initiated, clean close. Safe to call repeatedly. */
  close() {
    if (this.closed) return Promise.resolve();
    const closing = this.waitForClose(3000).catch(() => {});
    try {
      this.ws.send("1");
    } catch {
      /* already closing */
    }
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
    return closing;
  }

  _assertOpen() {
    if (this.closed || this.ws.readyState !== 1) {
      throw new Error("socket is not open");
    }
  }

  _onFrame(data) {
    if (typeof data !== "string" || data.length === 0) return;
    const engineType = data[0];
    if (engineType === "2") {
      // Engine.IO ping -> pong
      this.ws.send("3");
    } else if (engineType === "1") {
      this._onClosed("server closed the engine");
    } else if (engineType === "4") {
      this._onSocketIoPacket(data.slice(1));
    }
  }

  _onSocketIoPacket(packet) {
    const type = packet[0];
    let rest = packet.slice(1);
    let id = null;
    const idMatch = /^(\d+)/.exec(rest);
    if (idMatch && (type === "2" || type === "3")) {
      id = Number(idMatch[1]);
      rest = rest.slice(idMatch[1].length);
    }
    if (type === "2") {
      let parsed;
      try {
        parsed = JSON.parse(rest);
      } catch {
        return;
      }
      const [event, ...args] = parsed;
      this.events.push({ event, args, at: Date.now() });
      for (const waiter of [...this._waiters]) {
        if (waiter.event === event && waiter.predicate(args[0])) {
          clearTimeout(waiter.timer);
          this._waiters.delete(waiter);
          waiter.resolve(args[0]);
        }
      }
    } else if (type === "3") {
      const pending = this._acks.get(id);
      if (pending) {
        clearTimeout(pending.timer);
        this._acks.delete(id);
        let args = [];
        try {
          args = JSON.parse(rest);
        } catch {
          /* leave empty */
        }
        pending.resolve(args[0]);
      }
    } else if (type === "1") {
      this._onClosed("server disconnected the socket");
    }
  }

  _onClosed(reason) {
    if (this.closed) return;
    this.closed = true;
    this.closedAt = Date.now();
    this.closeReason = reason;
    const error = new Error(`socket disconnected (${reason})`);
    for (const pending of this._acks.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this._acks.clear();
    for (const waiter of this._waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this._waiters.clear();
    for (const waiter of this._closeWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(this.closedAt);
    }
    this._closeWaiters.clear();
  }
}

/**
 * Opens a connection and performs the Socket.IO CONNECT handshake.
 *
 * @param {string} baseUrl  http://127.0.0.1:5057
 * @param {object} [opts]
 * @param {string} [opts.token]  JWT for the auth payload; omit for none
 * @returns {Promise<{ok:true, client:TestSocket} | {ok:false, error:string}>}
 */
function connectSocket(baseUrl, { token, timeoutMs = DEFAULT_CONNECT_TIMEOUT_MS } = {}) {
  const url = `${baseUrl.replace(/^http/, "ws")}/socket.io/?EIO=4&transport=websocket`;

  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const client = new TestSocket(ws);
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!result.ok) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ ok: false, error: `handshake timed out after ${timeoutMs} ms` }),
      timeoutMs,
    );

    ws.addEventListener("message", (event) => {
      const data = event.data;
      if (!settled && typeof data === "string") {
        if (data[0] === "0") {
          // Engine.IO open -> send Socket.IO CONNECT (with auth if given).
          ws.send(token === undefined ? "40" : `40${JSON.stringify({ token })}`);
          return;
        }
        if (data.startsWith("40")) {
          try {
            client.sid = JSON.parse(data.slice(2)).sid;
          } catch {
            /* ignore */
          }
          finish({ ok: true, client });
          return;
        }
        if (data.startsWith("44")) {
          let message = "connect_error";
          try {
            message = JSON.parse(data.slice(2)).message || message;
          } catch {
            /* ignore */
          }
          finish({ ok: false, error: message });
          return;
        }
      }
      client._onFrame(data);
    });
    ws.addEventListener("close", () => {
      client._onClosed("websocket closed");
      finish({ ok: false, error: "connection closed before the handshake completed" });
    });
    ws.addEventListener("error", () => {
      finish({ ok: false, error: "websocket error" });
    });
  });
}

/**
 * Tracks every socket a test file opens so `closeAll()` (call it from
 * `after()`) disconnects them even when a test failed.
 */
function createSocketTracker() {
  const sockets = new Set();
  return {
    async connect(baseUrl, options) {
      const result = await connectSocket(baseUrl, options);
      if (result.ok) sockets.add(result.client);
      return result;
    },
    async closeAll() {
      await Promise.all([...sockets].map((client) => client.close()));
      sockets.clear();
    },
    openCount: () => [...sockets].filter((client) => !client.closed).length,
  };
}

module.exports = { connectSocket, createSocketTracker, TestSocket };
