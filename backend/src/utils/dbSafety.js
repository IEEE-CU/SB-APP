/**
 * Safety checks for scripts that delete or replace database contents
 * (seed, clearData, restore).
 *
 * The policy fails closed. A destructive operation is permitted only when ALL
 * of the following hold:
 *
 *   1. A database URI is explicitly configured, non-empty and parseable.
 *      There is no fallback to a default database.
 *   2. The environment is not production (NODE_ENV).
 *   3. The target is not a known hosted/production style target (SRV
 *      connection strings, Atlas / Cosmos / DocumentDB hosts, or a database
 *      name that looks like production).
 *   4. The operator has authorized the operation for THIS database by setting
 *      ALLOW_DESTRUCTIVE_DB_OPS to the exact database name in the URI.
 *      NODE_ENV=test and localhost URIs are not authorization.
 *
 * The one exception is a disposable in-memory MongoDB that the current process
 * started itself: the process that created it registers its URI with
 * registerEphemeralTarget(), which authorizes exactly that URI, in this
 * process only (nothing is written to the environment).
 *
 * Error messages never include the URI, credentials or query string.
 */

const AUTHORIZATION_ENV_VAR = "ALLOW_DESTRUCTIVE_DB_OPS";

class DestructiveOperationRefused extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DestructiveOperationRefused";
    this.code = code;
  }
}

const refuse = (code, message) => {
  throw new DestructiveOperationRefused(code, message);
};

const ephemeralTargets = new Set();

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

// Hosted database services that are production by default.
const HOSTED_HOST_PATTERNS = [
  /\.mongodb\.net$/i, // MongoDB Atlas
  /\.mongo\.cosmos\.azure\.com$/i, // Azure Cosmos DB (Mongo API)
  /\.documents\.azure\.com$/i,
  /\.docdb\.amazonaws\.com$/i, // Amazon DocumentDB
];

// Heuristic only: a name that announces itself as production is refused even
// if someone authorized it. The primary control is the explicit authorization.
const PRODUCTION_NAME_PATTERN = /(^|[-_.])(prod|production|live)([-_.]|$)/i;

const VALID_DB_NAME = /^[A-Za-z0-9_.-]{1,63}$/;
const VALID_HOST = /^[A-Za-z0-9._\-[\]:]+$/;
const URI_PATTERN =
  /^(mongodb(?:\+srv)?):\/\/(?:([^@/?#]*)@)?([^/?#]+)(?:\/([^?#]*))?(?:\?([^#]*))?$/;

/**
 * Registers a URI belonging to a disposable database that this process
 * created (for example from MongoMemoryServer). Authorizes exactly that URI.
 */
function registerEphemeralTarget(uri) {
  if (typeof uri !== "string" || uri.trim() === "") {
    throw new TypeError("registerEphemeralTarget requires a non-empty URI");
  }
  ephemeralTargets.add(uri.trim());
}

function clearEphemeralTargets() {
  ephemeralTargets.clear();
}

/**
 * Parses a MongoDB URI without ever echoing it. Throws a refusal for a
 * missing or malformed value.
 */
function parseMongoUri(uri) {
  if (typeof uri !== "string" || uri.trim() === "") {
    refuse(
      "MISSING_URI",
      "No database URI is configured (MONGODB_URI). Refusing to proceed.",
    );
  }

  const match = URI_PATTERN.exec(uri.trim());
  if (!match) {
    refuse(
      "MALFORMED_URI",
      "The configured database URI is not a valid mongodb:// or mongodb+srv:// URI. Refusing to proceed.",
    );
  }

  const hosts = match[3]
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hosts.length === 0 || !hosts.every((h) => VALID_HOST.test(h))) {
    refuse(
      "MALFORMED_URI",
      "The configured database URI has no valid host. Refusing to proceed.",
    );
  }

  let dbName = null;
  if (match[4]) {
    try {
      dbName = decodeURIComponent(match[4]);
    } catch {
      refuse(
        "MALFORMED_URI",
        "The configured database URI has an invalid database name. Refusing to proceed.",
      );
    }
  }

  return {
    srv: match[1] === "mongodb+srv",
    hosts,
    dbName: dbName || null,
  };
}

function isProductionEnv(env) {
  const value = String((env && env.NODE_ENV) || "")
    .trim()
    .toLowerCase();
  return value === "production" || value === "prod";
}

function stripPort(host) {
  if (host.startsWith("[")) return host.replace(/^(\[[^\]]+\]).*$/, "$1");
  const idx = host.lastIndexOf(":");
  return idx > -1 ? host.slice(0, idx) : host;
}

/**
 * Throws DestructiveOperationRefused unless a destructive operation against
 * the configured database is explicitly permitted.
 *
 * @param {object}  options
 * @param {string}  options.operation - Label used in messages (e.g. "seed")
 * @param {object} [options.env]      - Environment (defaults to process.env)
 * @param {string} [options.uri]      - URI override (defaults to env.MONGODB_URI)
 * @returns {{operation: string, dbName: string|null, ephemeral: boolean}}
 */
function assertDestructiveTargetAllowed({
  operation,
  env = process.env,
  uri,
} = {}) {
  const label = operation || "destructive operation";
  const configuredUri = uri === undefined ? env.MONGODB_URI : uri;

  if (isProductionEnv(env)) {
    refuse(
      "PRODUCTION_ENVIRONMENT",
      `Refusing to run ${label}: NODE_ENV indicates a production environment.`,
    );
  }

  const target = parseMongoUri(configuredUri);
  const ephemeral = ephemeralTargets.has(String(configuredUri).trim());

  if (ephemeral) {
    if (!target.hosts.every((h) => LOOPBACK_HOSTS.has(stripPort(h)))) {
      refuse(
        "EPHEMERAL_TARGET_NOT_LOCAL",
        `Refusing to run ${label}: the registered in-memory target is not a loopback address.`,
      );
    }
    return { operation: label, dbName: target.dbName, ephemeral: true };
  }

  if (
    target.srv ||
    target.hosts.some((h) =>
      HOSTED_HOST_PATTERNS.some((p) => p.test(stripPort(h))),
    )
  ) {
    refuse(
      "PRODUCTION_TARGET",
      `Refusing to run ${label}: the database target looks like a hosted/production service.`,
    );
  }

  if (!target.dbName) {
    refuse(
      "NO_DATABASE_NAME",
      `Refusing to run ${label}: the database URI must name a database explicitly (no default database).`,
    );
  }

  if (!VALID_DB_NAME.test(target.dbName)) {
    refuse(
      "INVALID_DATABASE_NAME",
      `Refusing to run ${label}: the database name is not valid.`,
    );
  }

  if (PRODUCTION_NAME_PATTERN.test(target.dbName)) {
    refuse(
      "PRODUCTION_TARGET",
      `Refusing to run ${label}: the database name looks like a production database.`,
    );
  }

  const authorization = env[AUTHORIZATION_ENV_VAR];
  if (typeof authorization !== "string" || authorization === "") {
    refuse(
      "AUTHORIZATION_REQUIRED",
      `Refusing to run ${label}: authorization required. Set ${AUTHORIZATION_ENV_VAR} to the exact name of the database to be modified ("${target.dbName}") to proceed.`,
    );
  }

  if (authorization !== target.dbName) {
    refuse(
      "AUTHORIZATION_MISMATCH",
      `Refusing to run ${label}: ${AUTHORIZATION_ENV_VAR} does not match the target database name.`,
    );
  }

  return { operation: label, dbName: target.dbName, ephemeral: false };
}

/**
 * After connecting, confirms the live connection is the database that was
 * validated, before the first destructive write.
 */
function assertConnectedToValidatedTarget(validated, connectedName) {
  if (validated && validated.dbName && connectedName !== validated.dbName) {
    refuse(
      "TARGET_MISMATCH",
      `Refusing to run ${validated.operation}: the connected database does not match the validated target.`,
    );
  }
}

/**
 * For read-only utilities (backup): require an explicit, parseable target
 * instead of silently using an unset or malformed value.
 */
function assertExplicitTarget({ operation, env = process.env, uri } = {}) {
  const configuredUri = uri === undefined ? env.MONGODB_URI : uri;
  const target = parseMongoUri(configuredUri);
  return { operation: operation || "operation", dbName: target.dbName };
}

module.exports = {
  AUTHORIZATION_ENV_VAR,
  DestructiveOperationRefused,
  assertDestructiveTargetAllowed,
  assertConnectedToValidatedTarget,
  assertExplicitTarget,
  parseMongoUri,
  registerEphemeralTarget,
  clearEphemeralTargets,
};
