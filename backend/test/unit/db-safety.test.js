// AUD-002: pure tests for the destructive-operation target policy. No database,
// network or filesystem access; every URI below is an inert placeholder.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  AUTHORIZATION_ENV_VAR,
  DestructiveOperationRefused,
  assertDestructiveTargetAllowed,
  assertConnectedToValidatedTarget,
  assertExplicitTarget,
  registerEphemeralTarget,
  clearEphemeralTargets,
} = require("../../src/utils/dbSafety");

const URI = "mongodb://127.0.0.1:27017/sbapp_fixture";
const NAME = "sbapp_fixture";

beforeEach(() => clearEphemeralTargets());

function check(env, options = {}) {
  return assertDestructiveTargetAllowed({ operation: "test-op", env, ...options });
}

function refusal(env, options) {
  try {
    check(env, options);
  } catch (error) {
    return error;
  }
  return null;
}

test("authorization variable name is the documented one", () => {
  assert.equal(AUTHORIZATION_ENV_VAR, "ALLOW_DESTRUCTIVE_DB_OPS");
});

test("rejects a missing database URI", () => {
  for (const env of [{}, { MONGODB_URI: "" }, { MONGODB_URI: "   " }]) {
    const err = refusal({ ...env, ALLOW_DESTRUCTIVE_DB_OPS: NAME });
    assert.ok(err instanceof DestructiveOperationRefused);
    assert.equal(err.code, "MISSING_URI");
  }
});

test("rejects malformed database URIs", () => {
  for (const bad of [
    "garbage",
    "http://127.0.0.1:27017/db",
    "mongodb://",
    "mongodb:///db",
    "mongodb://host with space/db",
    "mongodb://user:p@ss@host/db",
    "postgres://127.0.0.1/db",
  ]) {
    const err = refusal({ MONGODB_URI: bad, ALLOW_DESTRUCTIVE_DB_OPS: "db" });
    assert.ok(err, `accepted ${bad}`);
    assert.equal(err.code, "MALFORMED_URI", bad);
  }
});

test("rejects a URI that does not name a database (no silent default)", () => {
  for (const uri of ["mongodb://127.0.0.1:27017", "mongodb://127.0.0.1:27017/"]) {
    const err = refusal({ MONGODB_URI: uri, ALLOW_DESTRUCTIVE_DB_OPS: "test" });
    assert.equal(err.code, "NO_DATABASE_NAME", uri);
  }
});

test("rejects a production environment even when fully authorized", () => {
  for (const nodeEnv of ["production", "Production", " PRODUCTION ", "prod"]) {
    const err = refusal({
      MONGODB_URI: URI,
      ALLOW_DESTRUCTIVE_DB_OPS: NAME,
      NODE_ENV: nodeEnv,
    });
    assert.equal(err.code, "PRODUCTION_ENVIRONMENT", nodeEnv);
  }
});

test("rejects hosted / production style targets even when authorized", () => {
  for (const uri of [
    "mongodb+srv://cluster0.example.mongodb.net/sbapp_fixture",
    "mongodb://shard-00-00.example.mongodb.net:27017/sbapp_fixture",
    "mongodb://acct.mongo.cosmos.azure.com:10255/sbapp_fixture",
    "mongodb://cluster.docdb.amazonaws.com:27017/sbapp_fixture",
  ]) {
    const err = refusal({ MONGODB_URI: uri, ALLOW_DESTRUCTIVE_DB_OPS: NAME });
    assert.equal(err.code, "PRODUCTION_TARGET", uri);
  }
});

test("rejects database names that announce production", () => {
  for (const name of ["prod", "app_prod", "app-production", "live", "prod.main"]) {
    const err = refusal({
      MONGODB_URI: `mongodb://127.0.0.1:27017/${name}`,
      ALLOW_DESTRUCTIVE_DB_OPS: name,
    });
    assert.equal(err.code, "PRODUCTION_TARGET", name);
  }
});

test("NODE_ENV=test alone is not authorization", () => {
  const err = refusal({ MONGODB_URI: URI, NODE_ENV: "test" });
  assert.equal(err.code, "AUTHORIZATION_REQUIRED");
});

test("a localhost URI alone is not authorization", () => {
  for (const uri of [
    "mongodb://127.0.0.1:27017/sbapp_fixture",
    "mongodb://localhost:27017/sbapp_fixture",
  ]) {
    const err = refusal({ MONGODB_URI: uri });
    assert.equal(err.code, "AUTHORIZATION_REQUIRED", uri);
  }
});

test("an unapproved database name is rejected (authorization must match exactly)", () => {
  for (const approved of ["other_db", "SBAPP_FIXTURE", "sbapp_fixture ", "*", "true", "1"]) {
    const err = refusal({ MONGODB_URI: URI, ALLOW_DESTRUCTIVE_DB_OPS: approved });
    assert.equal(err.code, "AUTHORIZATION_MISMATCH", JSON.stringify(approved));
  }
});

test("an empty authorization value is treated as missing", () => {
  const err = refusal({ MONGODB_URI: URI, ALLOW_DESTRUCTIVE_DB_OPS: "" });
  assert.equal(err.code, "AUTHORIZATION_REQUIRED");
});

test("an exact, explicit authorization for a non-production name is accepted", () => {
  const result = check({ MONGODB_URI: URI, ALLOW_DESTRUCTIVE_DB_OPS: NAME });

  assert.equal(result.dbName, NAME);
  assert.equal(result.ephemeral, false);
  assert.equal(result.operation, "test-op");
});

test("error messages never include the URI, credentials or query string", () => {
  const secretUri =
    "mongodb://svc_user:Sup3rS3cretPw@db.internal.example:27017/sbapp_fixture?authSource=admin&tlsCertificateKeyFilePassword=QueryS3cret";
  const cases = [
    { MONGODB_URI: secretUri }, // authorization missing
    { MONGODB_URI: secretUri, ALLOW_DESTRUCTIVE_DB_OPS: "wrong" },
    { MONGODB_URI: secretUri, ALLOW_DESTRUCTIVE_DB_OPS: NAME, NODE_ENV: "production" },
    {
      MONGODB_URI: "mongodb+srv://svc_user:Sup3rS3cretPw@c.example.mongodb.net/x?w=QueryS3cret",
      ALLOW_DESTRUCTIVE_DB_OPS: "x",
    },
    { MONGODB_URI: "svc_user:Sup3rS3cretPw@nonsense?QueryS3cret" },
  ];

  for (const env of cases) {
    const err = refusal(env);
    assert.ok(err, "expected a refusal");
    const text = `${err.message} ${err.stack.split("\n")[0]}`;
    for (const leaked of ["Sup3rS3cretPw", "svc_user", "QueryS3cret", "db.internal"]) {
      assert.equal(text.includes(leaked), false, `message leaked ${leaked}`);
    }
  }
});

test("a registered ephemeral target is authorized without a token", () => {
  const memoryUri = "mongodb://127.0.0.1:51234/";
  registerEphemeralTarget(memoryUri);

  const result = check({ MONGODB_URI: memoryUri });

  assert.equal(result.ephemeral, true);
});

test("registration authorizes only the exact URI that was registered", () => {
  registerEphemeralTarget("mongodb://127.0.0.1:51234/");

  const err = refusal({ MONGODB_URI: "mongodb://127.0.0.1:51235/" });

  assert.equal(err.code, "NO_DATABASE_NAME");
});

test("an ephemeral registration does not override a production environment", () => {
  const memoryUri = "mongodb://127.0.0.1:51234/";
  registerEphemeralTarget(memoryUri);

  const err = refusal({ MONGODB_URI: memoryUri, NODE_ENV: "production" });

  assert.equal(err.code, "PRODUCTION_ENVIRONMENT");
});

test("a non-loopback URI cannot be used as an ephemeral target", () => {
  const remote = "mongodb://db.example.org:27017/";
  registerEphemeralTarget(remote);

  const err = refusal({ MONGODB_URI: remote });

  assert.equal(err.code, "EPHEMERAL_TARGET_NOT_LOCAL");
});

test("registerEphemeralTarget rejects empty values", () => {
  assert.throws(() => registerEphemeralTarget(""), TypeError);
  assert.throws(() => registerEphemeralTarget(undefined), TypeError);
});

test("uri option overrides env.MONGODB_URI", () => {
  const err = refusal(
    { MONGODB_URI: URI, ALLOW_DESTRUCTIVE_DB_OPS: NAME },
    { uri: "" },
  );

  assert.equal(err.code, "MISSING_URI");
});

test("assertConnectedToValidatedTarget refuses a different live database", () => {
  const validated = check({ MONGODB_URI: URI, ALLOW_DESTRUCTIVE_DB_OPS: NAME });

  assert.doesNotThrow(() => assertConnectedToValidatedTarget(validated, NAME));
  assert.throws(
    () => assertConnectedToValidatedTarget(validated, "someone_elses_db"),
    (err) => err.code === "TARGET_MISMATCH",
  );
});

test("assertConnectedToValidatedTarget skips the check when no name was validated (ephemeral)", () => {
  registerEphemeralTarget("mongodb://127.0.0.1:51234/");
  const validated = check({ MONGODB_URI: "mongodb://127.0.0.1:51234/" });

  assert.doesNotThrow(() => assertConnectedToValidatedTarget(validated, "test"));
});

test("assertExplicitTarget (read-only utilities) requires a parseable URI but no authorization", () => {
  assert.doesNotThrow(() =>
    assertExplicitTarget({ operation: "backup", env: { MONGODB_URI: URI } }),
  );
  assert.throws(
    () => assertExplicitTarget({ operation: "backup", env: {} }),
    (err) => err.code === "MISSING_URI",
  );
  assert.throws(
    () =>
      assertExplicitTarget({ operation: "backup", env: { MONGODB_URI: "nope" } }),
    (err) => err.code === "MALFORMED_URI",
  );
});
