// CI-only helper: makes sure a MongoDB binary matching the version the isolated
// integration/browser-test harness expects (see start-integration-server.js) is
// actually present in ~/.cache/mongodb-binaries.
//
// `npm ci`'s mongodb-memory-server postinstall downloads its own default binary
// into backend/node_modules/.cache/mongodb-memory-server, and MongoMemoryServer's
// default binary resolution prefers that location over ~/.cache/mongodb-binaries.
// The harness only ever looks in ~/.cache/mongodb-binaries, so downloadDir must be
// forced explicitly here or the seed is a silent no-op.
const os = require("os");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

const MONGOD_VERSION =
  require("../test/integration/helpers/fixtures").MONGOD_VERSION;
const downloadDir = path.join(os.homedir(), ".cache", "mongodb-binaries");

(async () => {
  try {
    const server = await MongoMemoryServer.create({
      binary: { version: MONGOD_VERSION, downloadDir },
    });
    console.log(
      `[seed-mongo] ready: version ${MONGOD_VERSION} in ${downloadDir}`,
    );
    await server.stop();
  } catch (err) {
    console.error("[seed-mongo] failed:", err);
    process.exitCode = 1;
  }
})();
