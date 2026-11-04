// Unit tests for src/lib/socketRejoin.ts (AUD-007D: rejoin rooms after the socket reconnects).
//
// Run with Node's built-in runner, no extra dependency:
//   node --test tests/unit/socket-rejoin.node-test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { rejoinOnConnect } from "../../src/lib/socketRejoin.ts";

/** A stand-in with the three members the helper uses, behaving like a Socket.IO client. */
function fakeSocket(connected = false) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  return Object.assign(emitter, {
    connected,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    connect() {
      this.connected = true;
      this.emit("connect");
    },
    drop() {
      this.connected = false;
      this.emit("disconnect");
    },
  });
}

test("joins once on the first connection, not twice (nothing is sent before it connects)", () => {
  const socket = fakeSocket(false);
  let joins = 0;

  rejoinOnConnect(socket, () => (joins += 1));
  assert.equal(joins, 0);
  socket.connect();

  assert.equal(joins, 1);
});

test("an already-connected socket joins immediately, once", () => {
  const socket = fakeSocket(true);
  let joins = 0;

  rejoinOnConnect(socket, () => (joins += 1));

  assert.equal(joins, 1);
});

test("every reconnect joins again exactly once, without remounting", () => {
  const socket = fakeSocket(false);
  let joins = 0;
  rejoinOnConnect(socket, () => (joins += 1));
  socket.connect();

  for (let i = 0; i < 3; i += 1) {
    socket.drop();
    socket.connect();
  }

  assert.equal(joins, 4);
  assert.equal(socket.listenerCount("connect"), 1);
});

test("the cleanup removes the listener: no join after unmount, and nothing leaks across many mounts", () => {
  const socket = fakeSocket(false);
  let joins = 0;
  for (let i = 0; i < 50; i += 1) {
    const cleanup = rejoinOnConnect(socket, () => (joins += 1));
    cleanup();
  }

  socket.connect();
  socket.drop();
  socket.connect();

  assert.equal(joins, 0);
  assert.equal(socket.listenerCount("connect"), 0);
});

test("re-running with new rooms (a dependency change) replaces the old join instead of stacking", () => {
  const socket = fakeSocket(true);
  const sent = [];
  let cleanup = rejoinOnConnect(socket, () => sent.push("channel:a"));
  cleanup();
  cleanup = rejoinOnConnect(socket, () => sent.push("channel:b"));
  sent.length = 0;

  socket.drop();
  socket.connect();

  assert.deepEqual(sent, ["channel:b"]);
  assert.equal(socket.listenerCount("connect"), 1);
  cleanup();
});

test("two mounted components each rejoin their own room once per reconnect", () => {
  const socket = fakeSocket(true);
  const sent = [];
  const stopA = rejoinOnConnect(socket, () => sent.push("a"));
  const stopB = rejoinOnConnect(socket, () => sent.push("b"));
  sent.length = 0;

  socket.drop();
  socket.connect();

  assert.deepEqual(sent.sort(), ["a", "b"]);
  stopA();
  stopB();
});
