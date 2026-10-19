#!/usr/bin/env node
"use strict";

/**
 * Isolated integration-test harness for SB-APP.
 *
 * Starts the real Express + Socket.IO application against a disposable
 * in-memory MongoDB, on 127.0.0.1:5057 only, with every background job and
 * outbound HTTP path neutralized. Nothing here touches a persistent database,
 * a public website or any external service, and no application source is
 * modified: the isolation is done from outside, before `src/server.js` loads.
 *
 * Usage (normally driven by test/integration/helpers/test-server.js):
 *   node scripts/start-integration-server.js [--ready-file=<path>] [--max-seconds=<n>]
 *
 * Shutdown: SIGINT/SIGTERM, a line "shutdown" on stdin, the parent
 * disconnecting, or the --max-seconds safety timer (default 900).
 *
 * Two processes are used:
 *   launcher  validates preconditions, then spawns
 *   child     (same file, --child) with an allowlisted environment, which
 *             performs the isolation and runs the application.
 *
 * Environment handling
 *   - The launcher REFUSES to start if MONGODB_URI exists at all (even empty).
 *     It never substitutes a supplied value.
 *   - The child receives only an allowlist of OS variables (PATH, TEMP,
 *     USERPROFILE, ...). Everything else is dropped, notably:
 *       MONGODB_URI, JWT_*, ENABLE_CLUSTER, SCHEDULER_LEADER, WEB_CONCURRENCY,
 *       FRONTEND_URL, AZURE_*, GEMINI_*, EMAIL_*, SMTP_*, PDF_*, BACKUP_*,
 *       UPLOAD*, DB_*, TEST_*, NODE_OPTIONS, NODE_TLS_REJECT_UNAUTHORIZED
 *     so clustering, schedulers, external-service credentials, a custom TLS
 *     policy or preloaded modules cannot leak into the test process.
 *   - The parent's (and the machine's persistent) environment is untouched.
 *
 * Exit codes: 0 clean shutdown, 64 precondition failure, 70 startup failure,
 *             71 runtime failure.
 */

const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const BACKEND_ROOT = path.resolve(__dirname, "..");
const SRC_ROOT = path.join(BACKEND_ROOT, "src");
const {
  HARNESS_HOST,
  HARNESS_PORT,
  HARNESS_DB_NAME,
  MONGOD_VERSION,
  TEST_JWT_SECRET,
  createFixtures,
} = require("../test/integration/helpers/fixtures");

const LOG = "[integration-harness]";
const log = (message) => console.log(`${LOG} ${message}`);
const logError = (message) => console.error(`${LOG} ${message}`);

const arg = (name) => {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
};

// Variables the child is allowed to inherit (names matched case-insensitively
// because Windows environment names are case-insensitive).
const CHILD_ENV_ALLOWLIST = [
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "HOME",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "COMMONPROGRAMFILES",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "OS",
  "USERNAME",
  "USERDOMAIN",
  "COMPUTERNAME",
  "LANG",
  "LC_ALL",
  "TZ",
];

// ---------------------------------------------------------------------------
// Launcher
// ---------------------------------------------------------------------------

function refuse(message) {
  logError(`REFUSING TO START: ${message}`);
  process.exit(64);
}

function findCachedBinary() {
  const dir = path.join(os.homedir(), ".cache", "mongodb-binaries");
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const match = entries.find(
    (name) =>
      name.startsWith("mongod-") &&
      name.includes(`-${MONGOD_VERSION}`) &&
      !/\.(downloading|lock|md5)$/i.test(name),
  );
  if (!match) return null;
  const full = path.join(dir, match);
  try {
    if (fs.statSync(full).size < 1024 * 1024) return null; // not a real binary
  } catch {
    return null;
  }
  return full;
}

function checkPortFree(port, host) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, host, () => probe.close(() => resolve(true)));
  });
}

async function runLauncher() {
  // 1. Inherited MONGODB_URI is never accepted or replaced.
  if (Object.keys(process.env).some((k) => k.toUpperCase() === "MONGODB_URI")) {
    refuse(
      "MONGODB_URI is present in the environment. The harness always creates its own " +
        "disposable database and will not silently replace a supplied value. " +
        "Start it from an environment that does not define MONGODB_URI.",
    );
  }

  // 2. No .env may exist where dotenv could read it (cwd or backend root).
  for (const dir of new Set([process.cwd(), BACKEND_ROOT])) {
    if (fs.existsSync(path.join(dir, ".env"))) {
      refuse(`a .env file exists in ${dir}; remove it or run elsewhere.`);
    }
  }

  // 3. The cached binary must exist; the harness never downloads.
  const binary = findCachedBinary();
  if (!binary) {
    refuse(
      `cached MongoDB ${MONGOD_VERSION} binary not found in ~/.cache/mongodb-binaries. ` +
        "This harness never downloads binaries.",
    );
  }

  // 4. Port 5057 must be free; another port is never chosen.
  if (!(await checkPortFree(HARNESS_PORT, HARNESS_HOST))) {
    refuse(`${HARNESS_HOST}:${HARNESS_PORT} is already in use.`);
  }

  // 5. Ready-file: unique per run, always inside the OS temp directory.
  const tmp = os.tmpdir();
  const requested = arg("ready-file");
  const readyFile =
    requested ||
    path.join(
      tmp,
      `sb-app-integration-${process.pid}-${crypto.randomBytes(6).toString("hex")}.ready`,
    );
  const resolvedReady = path.resolve(readyFile);
  if (
    path.dirname(resolvedReady).toLowerCase() !== path.resolve(tmp).toLowerCase() ||
    !/^sb-app-integration-.+\.ready$/.test(path.basename(resolvedReady))
  ) {
    refuse("--ready-file must be sb-app-integration-*.ready inside the OS temp directory.");
  }
  if (fs.existsSync(resolvedReady)) {
    refuse("the ready-file already exists; a unique path is required per run.");
  }

  // 6. A fresh scratch working directory for the child (guaranteed no .env).
  const scratch = fs.mkdtempSync(path.join(tmp, "sb-app-integration-cwd-"));

  const childEnv = {};
  for (const key of Object.keys(process.env)) {
    if (CHILD_ENV_ALLOWLIST.includes(key.toUpperCase())) {
      childEnv[key] = process.env[key];
    }
  }
  childEnv.SBAPP_IT_READY_FILE = resolvedReady;
  childEnv.SBAPP_IT_MONGOD_BINARY = binary;
  childEnv.SBAPP_IT_MAX_SECONDS = arg("max-seconds") || "900";

  const dropped = Object.keys(process.env)
    .filter((k) => !CHILD_ENV_ALLOWLIST.includes(k.toUpperCase()))
    .filter((k) =>
      /^(MONGO|JWT|ENABLE_CLUSTER|SCHEDULER|WEB_CONCURRENCY|FRONTEND_URL|AZURE|GEMINI|EMAIL|SMTP|PDF|BACKUP|UPLOAD|DB_|TEST_|NODE_OPTIONS|NODE_TLS|PORT|NODE_ENV)/i.test(k),
    );
  log(
    `preconditions ok; ready-file=${path.basename(resolvedReady)}; ` +
      `dropping ${dropped.length} inherited variable(s)${dropped.length ? `: ${dropped.join(", ")}` : ""}`,
  );

  const child = spawn(process.execPath, [__filename, "--child"], {
    cwd: scratch,
    env: childEnv,
    stdio: ["ignore", "inherit", "inherit", "ipc"],
    windowsHide: true,
  });

  let shutdownRequested = false;
  const requestShutdown = (why) => {
    if (shutdownRequested) return;
    shutdownRequested = true;
    log(`shutdown requested (${why})`);
    try {
      child.send({ type: "shutdown" });
    } catch {
      /* child already gone */
    }
    // Hard stop only if the child cannot clean up in time.
    setTimeout(() => {
      logError("child did not exit in time; terminating it");
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, 30_000).unref();
  };

  process.on("SIGINT", () => requestShutdown("SIGINT"));
  process.on("SIGTERM", () => requestShutdown("SIGTERM"));

  if (process.stdin && !process.stdin.destroyed) {
    process.stdin.setEncoding("utf8");
    let buffer = "";
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
      if (/^\s*shutdown\s*$/m.test(buffer)) requestShutdown("stdin");
    });
    process.stdin.on("error", () => {});
  }

  child.on("exit", async (code, signal) => {
    // Remove only what this run created: the ready-file and the scratch
    // directory (which also holds the disposable database files). mongod may
    // still be releasing those files for a moment after the child exits, so
    // retry for a while.
    try {
      fs.rmSync(resolvedReady, { force: true });
    } catch {
      /* ignore */
    }
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        fs.rmSync(scratch, { recursive: true, force: true });
      } catch {
        /* still in use; retry */
      }
      if (!fs.existsSync(scratch)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (fs.existsSync(scratch)) {
      logError(`could not remove scratch directory ${path.basename(scratch)}`);
    }
    log(`child exited (code=${code}, signal=${signal || "none"})`);
    process.exit(code === null ? 71 : code);
  });
}

// ---------------------------------------------------------------------------
// Child: the actual isolation + application
// ---------------------------------------------------------------------------

async function runChild() {
  const readyFile = process.env.SBAPP_IT_READY_FILE;
  const binaryPath = process.env.SBAPP_IT_MONGOD_BINARY;
  const maxSeconds = Number(process.env.SBAPP_IT_MAX_SECONDS) || 900;

  const state = {
    mongod: null,
    server: null,
    io: null,
    mongoose: null,
    stopping: null,
    maxTimer: null,
    counters: { blockedHttpRequests: 0, cronSchedules: [] },
  };

  const cleanup = async () => {
    const step = async (name, fn) => {
      try {
        await fn();
      } catch (error) {
        logError(`cleanup step "${name}" failed: ${error.message}`);
      }
    };

    if (state.maxTimer) clearTimeout(state.maxTimer);

    await step("socket.io + http server", async () => {
      if (state.io) {
        await Promise.race([
          state.io.close(),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
      } else if (state.server && state.server.listening) {
        await new Promise((resolve) => state.server.close(() => resolve()));
      }
      if (state.server && typeof state.server.closeAllConnections === "function") {
        state.server.closeAllConnections();
      }
    });
    await step("mongoose", async () => {
      if (state.mongoose) await state.mongoose.disconnect();
    });
    await step("mongodb-memory-server", async () => {
      if (state.mongod) await state.mongod.stop();
    });
    await step("ready-file", async () => {
      if (readyFile) fs.rmSync(readyFile, { force: true });
    });
  };

  // Idempotent: repeated signals reuse the same cleanup.
  const shutdown = (reason, exitCode = 0) => {
    if (!state.stopping) {
      log(`stopping (${reason})`);
      state.stopping = cleanup().then(() => exitCode);
    }
    return state.stopping.then((code) => {
      process.exit(code);
    });
  };

  const fail = (message, error) => {
    logError(`${message}${error ? `: ${error.message}` : ""}`);
    return shutdown("startup failure", 70);
  };

  process.on("message", (m) => {
    if (m && m.type === "shutdown") shutdown("requested by launcher", 0);
  });
  process.on("disconnect", () => shutdown("launcher disconnected", 0));
  process.on("SIGINT", () => shutdown("SIGINT", 0));
  process.on("SIGTERM", () => shutdown("SIGTERM", 0));
  process.on("uncaughtException", (error) => {
    logError(`uncaught exception: ${error.message}`);
    shutdown("uncaught exception", 71);
  });
  process.on("unhandledRejection", (error) => {
    logError(`unhandled rejection: ${error && error.message ? error.message : error}`);
    shutdown("unhandled rejection", 71);
  });

  state.maxTimer = setTimeout(
    () => shutdown(`max lifetime ${maxSeconds}s reached`, 0),
    maxSeconds * 1000,
  );

  try {
    // ---- re-validate preconditions inside the child ---------------------
    if (!readyFile || !binaryPath) {
      return await fail("missing launcher parameters (run through the launcher)");
    }
    if (Object.keys(process.env).some((k) => k.toUpperCase() === "MONGODB_URI")) {
      return await fail("MONGODB_URI leaked into the isolated environment");
    }
    if (fs.existsSync(path.join(process.cwd(), ".env"))) {
      return await fail("a .env file exists in the working directory");
    }

    // ---- fixed, test-only configuration for the application -------------
    process.env.NODE_ENV = "test";
    process.env.PORT = String(HARNESS_PORT);
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = "1h";

    // ---- 1. neutralize background jobs BEFORE anything loads the app ----
    installBackgroundJobStubs(state.counters);

    // ---- 2. loopback-only listener, Socket.IO instance capture ----------
    installLoopbackListener(state);

    // ---- 3. disposable MongoDB from the cached binary only --------------
    const { MongoMemoryServer } = require("mongodb-memory-server");
    // The database files live inside the launcher-owned scratch directory
    // (this process's working directory), so the launcher removes them with
    // it even if this process is killed.
    const dbPath = path.join(process.cwd(), "mongod-data");
    fs.mkdirSync(dbPath);
    state.mongod = await MongoMemoryServer.create({
      binary: { version: MONGOD_VERSION, systemBinary: binaryPath },
      instance: { ip: HARNESS_HOST, dbName: HARNESS_DB_NAME, dbPath },
    });
    const uri = state.mongod.getUri(HARNESS_DB_NAME);
    const parsed = new URL(uri);
    const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (parsed.hostname !== HARNESS_HOST || !parsed.port || dbName !== HARNESS_DB_NAME) {
      return await fail("the disposable database is not bound to the expected loopback target");
    }
    log(`disposable database on ${parsed.hostname}:${parsed.port}/${dbName}`);

    // Verify the existing safeguard accepts exactly this ephemeral target.
    const dbSafety = require(path.join(SRC_ROOT, "utils", "dbSafety"));
    dbSafety.registerEphemeralTarget(uri);
    const verdict = dbSafety.assertDestructiveTargetAllowed({
      operation: "integration-harness",
      env: { MONGODB_URI: uri, NODE_ENV: "test" },
    });
    if (!verdict.ephemeral) {
      return await fail("dbSafety did not classify the target as ephemeral");
    }

    // ---- 4. load the application (starts connecting and listening) ------
    process.env.MONGODB_URI = uri;
    require(path.join(SRC_ROOT, "server.js"));
    // server.js installs its own SIGINT/SIGTERM handlers that call
    // process.exit() after closing only the HTTP server; the harness needs an
    // ordered shutdown (HTTP + Socket.IO, then MongoDB, then mongod).
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
    process.on("SIGINT", () => shutdown("SIGINT", 0));
    process.on("SIGTERM", () => shutdown("SIGTERM", 0));

    state.mongoose = require("mongoose");

    // ---- 5. wait for database + listener --------------------------------
    await waitFor(
      () => state.mongoose.connection.readyState === 1,
      30_000,
      "database connection",
    );
    await waitFor(
      () => state.server && state.server.listening,
      15_000,
      "HTTP listener",
    );

    const address = state.server.address();
    if (
      !address ||
      address.address !== HARNESS_HOST ||
      address.port !== HARNESS_PORT
    ) {
      return await fail(
        `listener is not bound to ${HARNESS_HOST}:${HARNESS_PORT} only ` +
          `(effective: ${address ? `${address.address}:${address.port}` : "none"})`,
      );
    }
    if (!state.io || state.io.httpServer !== state.server) {
      return await fail("Socket.IO is not attached to the loopback HTTP server");
    }
    if (state.mongoose.connection.name !== HARNESS_DB_NAME) {
      return await fail("the application connected to an unexpected database");
    }
    if (state.mongoose.connection.host !== HARNESS_HOST) {
      return await fail("the application connected to a non-loopback host");
    }

    // ---- 6. fixtures ----------------------------------------------------
    const model = (name) => require(path.join(SRC_ROOT, "models", name));
    const fixtures = await createFixtures({
      User: model("User"),
      Society: model("Society"),
      Role: model("Role"),
      Permission: model("Permission"),
      RolePermission: model("RolePermission"),
      UserRole: model("UserRole"),
      Channel: model("Channel"),
      Conversation: model("Conversation"),
      ProjectReport: model("ProjectReport"),
    });

    // Let the startup scrape (blocked by the stub) settle so the evidence in
    // the ready-file is final.
    await sleep(1500);

    // ---- 7. loopback health check, then readiness -----------------------
    const health = await fetch(`http://${HARNESS_HOST}:${HARNESS_PORT}/api/v1/health`);
    const healthBody = await health.json();
    if (health.status !== 200 || healthBody.db !== "connected") {
      return await fail(`health check failed (status ${health.status})`);
    }

    const info = {
      ready: true,
      pid: process.pid,
      host: HARNESS_HOST,
      port: HARNESS_PORT,
      baseUrl: `http://${HARNESS_HOST}:${HARNESS_PORT}`,
      database: { host: parsed.hostname, port: Number(parsed.port), name: dbName },
      startedAt: new Date().toISOString(),
      fixtures,
      backgroundJobs: {
        blockedHttpRequests: state.counters.blockedHttpRequests,
        cronSchedules: state.counters.cronSchedules.length,
        cronCallbacksExecuted: 0,
      },
    };
    const tmpFile = `${readyFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(info, null, 2), "utf8");
    fs.renameSync(tmpFile, readyFile);
    log(
      `ready on ${info.baseUrl} (blocked outbound requests: ${info.backgroundJobs.blockedHttpRequests}, ` +
        `cron schedules neutralized: ${info.backgroundJobs.cronSchedules})`,
    );
  } catch (error) {
    return fail("startup failed", error);
  }
  return undefined;
}

function installBackgroundJobStubs(counters) {
  const Module = require("module");
  const modulePath = (name) => {
    try {
      return require.resolve(name, { paths: [BACKEND_ROOT] });
    } catch (error) {
      throw new Error(`cannot resolve "${name}" for stubbing: ${error.message}`);
    }
  };

  const axiosPath = modulePath("axios");
  const cronPath = modulePath("node-cron");
  for (const resolved of [axiosPath, cronPath]) {
    if (require.cache[resolved]) {
      throw new Error(`"${resolved}" is already loaded; refusing to continue without a reliable stub`);
    }
  }

  const blocked = (what) => {
    counters.blockedHttpRequests += 1;
    return Promise.reject(
      new Error(`TEST-SAFETY: outbound HTTP is blocked by the integration harness (${what})`),
    );
  };
  const axiosStub = new Proxy(function axios() {}, {
    apply: () => blocked("axios()"),
    get(_target, prop) {
      if (typeof prop === "symbol" || prop === "then") return undefined;
      if (prop === "default" || prop === "create") {
        return prop === "create" ? () => axiosStub : axiosStub;
      }
      if (prop === "isAxiosError") return () => false;
      if (prop === "__esModule") return false;
      return (...args) => blocked(`axios.${String(prop)}(${typeof args[0] === "string" ? "url" : "..."})`);
    },
  });

  const cronStub = {
    schedule(expression) {
      // Registered but never executed.
      counters.cronSchedules.push(String(expression));
      return { start() {}, stop() {}, destroy() {} };
    },
    validate: () => true,
  };
  cronStub.default = cronStub;

  const install = (resolved, exportsValue) => {
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports: exportsValue,
      children: [],
      paths: [],
    };
  };
  install(axiosPath, axiosStub);
  install(cronPath, cronStub);

  // Prove the stubs are what the scraper and the server will actually receive.
  const fromScraper = Module.createRequire(
    path.join(SRC_ROOT, "services", "opportunityScraper.js"),
  );
  const fromServer = Module.createRequire(path.join(SRC_ROOT, "server.js"));
  if (fromScraper("axios") !== axiosStub) {
    throw new Error("axios stub does not cover the module imported by the scraper");
  }
  if (fromServer("node-cron") !== cronStub) {
    throw new Error("node-cron stub does not cover the module imported by the server");
  }
}

function installLoopbackListener(state) {
  const express = require("express");
  const originalListen = express.application.listen;
  express.application.listen = function listenOnLoopbackOnly(...args) {
    const callback = args.find((a) => typeof a === "function");
    if (Number(args[0]) !== HARNESS_PORT) {
      throw new Error(`unexpected listen port ${String(args[0])}; only ${HARNESS_PORT} is allowed`);
    }
    // Always add the host; production listener code is not changed.
    const server = originalListen.call(this, HARNESS_PORT, HARNESS_HOST, callback);
    state.server = server;
    return server;
  };

  // Capture the Socket.IO instance the application creates.
  const socketio = require("socket.io");
  const BaseServer = socketio.Server;
  socketio.Server = class HarnessSocketServer extends BaseServer {
    constructor(...ctorArgs) {
      super(...ctorArgs);
      state.io = this;
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${what}`);
}

if (process.argv.includes("--child")) {
  runChild();
} else {
  runLauncher().catch((error) => {
    logError(`launcher error: ${error.message}`);
    process.exit(64);
  });
}
