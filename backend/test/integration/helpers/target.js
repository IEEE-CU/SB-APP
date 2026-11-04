"use strict";

/**
 * Validates and describes the integration target for a test process.
 *
 * Tests never start servers or databases. They are pointed at a harness that
 * was started by scripts/start-integration-server.js, via two explicit
 * variables, and refuse to run against anything else:
 *
 *   TEST_BASE_URL    exactly http://127.0.0.1:5057
 *   TEST_READY_FILE  the harness's unique ready-file (proves the harness is up
 *                    and names its disposable database)
 *
 * There is no default and no fallback to localhost:5000.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  HARNESS_HOST,
  HARNESS_PORT,
  HARNESS_DB_NAME,
} = require("./fixtures");

const EXPECTED_BASE_URL = `http://${HARNESS_HOST}:${HARNESS_PORT}`;

function refuse(message) {
  throw new Error(`Refusing to run integration tests: ${message}`);
}

function requireHarnessTarget() {
  const raw = process.env.TEST_BASE_URL;
  if (!raw) {
    refuse(`TEST_BASE_URL is not set (expected ${EXPECTED_BASE_URL}).`);
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    refuse("TEST_BASE_URL is not a valid URL.");
  }
  if (
    url.protocol !== "http:" ||
    url.hostname !== HARNESS_HOST ||
    url.port !== String(HARNESS_PORT) ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    refuse(`TEST_BASE_URL must be exactly ${EXPECTED_BASE_URL}.`);
  }

  const readyPath = process.env.TEST_READY_FILE;
  if (!readyPath) {
    refuse("TEST_READY_FILE is not set (start the harness and pass its ready-file).");
  }
  const resolved = path.resolve(readyPath);
  if (
    path.dirname(resolved).toLowerCase() !== path.resolve(os.tmpdir()).toLowerCase() ||
    !/^sb-app-integration-.+\.ready$/.test(path.basename(resolved))
  ) {
    refuse("TEST_READY_FILE is not a harness ready-file in the OS temp directory.");
  }
  let ready;
  try {
    ready = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch {
    refuse("the harness ready-file cannot be read; is the harness running?");
  }
  if (
    ready.ready !== true ||
    ready.baseUrl !== EXPECTED_BASE_URL ||
    ready.host !== HARNESS_HOST ||
    ready.port !== HARNESS_PORT ||
    !ready.database ||
    ready.database.host !== HARNESS_HOST ||
    ready.database.name !== HARNESS_DB_NAME
  ) {
    refuse("the ready-file does not describe the expected loopback harness.");
  }
  try {
    process.kill(ready.pid, 0);
  } catch {
    refuse("the harness process named in the ready-file is not running.");
  }

  const baseUrl = EXPECTED_BASE_URL;
  const api = (route, init = {}) => fetch(`${baseUrl}/api/v1${route}`, init);

  // Accounts can only be created by an administrator (POST /auth/register requires an
  // ADMIN token), so tests that need a disposable account create it as the fixture admin.
  const registerAccount = async (body) => {
    const { TEST_PASSWORD, USERS } = require("./fixtures");
    const login = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: USERS.admin.email, password: TEST_PASSWORD }),
    });
    const { data } = await login.json();
    return api("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
      body: JSON.stringify(body),
    });
  };

  return { baseUrl, api, registerAccount, ready, database: ready.database };
}

/**
 * Deletes ONE user created by a test from the harness's disposable database.
 * Guarded: loopback host and the harness database name only, and only a user
 * whose e-mail is in the integration test domain.
 */
async function deleteDisposableUser(target, userId, email) {
  const { host, port, name } = target.database;
  if (host !== HARNESS_HOST || name !== HARNESS_DB_NAME) {
    refuse("database descriptor is not the harness's disposable database.");
  }
  if (!/@integration\.test$/.test(String(email))) {
    refuse("will only delete users in the @integration.test domain.");
  }

  const { MongoClient, ObjectId } = require("mongodb");
  const client = new MongoClient(`mongodb://${host}:${port}/${name}`, {
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const result = await client
      .db(name)
      .collection("users")
      .deleteOne({ _id: new ObjectId(String(userId)), email });
    return result.deletedCount;
  } finally {
    await client.close();
  }
}

/**
 * Read-only access to the harness's disposable database, for verifying that
 * denied requests left state unchanged. Same guard as deleteDisposableUser:
 * loopback host and the harness database name only.
 */
async function withDatabase(target, fn) {
  const { host, port, name } = target.database;
  if (host !== HARNESS_HOST || name !== HARNESS_DB_NAME) {
    refuse("database descriptor is not the harness's disposable database.");
  }
  const { MongoClient, ObjectId } = require("mongodb");
  const client = new MongoClient(`mongodb://${host}:${port}/${name}`, {
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    return await fn(client.db(name), ObjectId);
  } finally {
    await client.close();
  }
}

/** One document by id, or null. */
function readDocument(target, collection, id) {
  return withDatabase(target, (db, ObjectId) =>
    db.collection(collection).findOne({ _id: new ObjectId(String(id)) }),
  );
}

function countDocuments(target, collection, filter = {}) {
  return withDatabase(target, (db) => db.collection(collection).countDocuments(filter));
}

module.exports = {
  requireHarnessTarget,
  deleteDisposableUser,
  withDatabase,
  readDocument,
  countDocuments,
  EXPECTED_BASE_URL,
};
