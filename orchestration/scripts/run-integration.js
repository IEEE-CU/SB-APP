// Runs backend integration test files, each against its OWN fresh isolated harness
// (in-memory MongoDB at 127.0.0.1:5057), from the worktree named by SB_WORKTREE.
//
//   set SB_WORKTREE=D:\SB-APP-worktrees\terms
//   node D:\SB-APP-orchestration\scripts\run-integration.js test/integration/<file>.test.js [...]
//
// Takes the shared harness lock first (see harness-lock.js). Prints the observed result and the
// cleanup state of every file. Never relaxes a rate limit; never touches a persistent database.
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { acquire } = require("./harness-lock");

// Worktree root: "--worktree <path>" as the first two arguments (preferred), else SB_WORKTREE.
let argv = process.argv.slice(2);
let WORKTREE = process.env.SB_WORKTREE;
if (argv[0] === "--worktree") { WORKTREE = argv[1]; argv = argv.slice(2); }
if (!WORKTREE) throw new Error("pass --worktree <worktree root> (or set SB_WORKTREE)");
process.env.SB_WORKTREE = WORKTREE;
const BACKEND = path.join(WORKTREE, "backend");
const files = argv;
if (files.length === 0) throw new Error("pass explicit test files (relative to backend/)");

const mongods = () =>
  ((spawnSync("tasklist", ["/FI", "IMAGENAME eq mongod*", "/FO", "CSV", "/NH"], { encoding: "utf8" }).stdout || "")
    .split(/\r?\n/).filter((l) => /^"mongod[^"]*\.exe"/i.test(l))).length;
const temp = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("sb-app-integration-"));
const portBusy = () =>
  spawnSync("netstat", ["-ano"], { encoding: "utf8" }).stdout.split(/\r?\n/).some((l) => /LISTENING/.test(l) && /:5057\s/.test(l));

(async () => {
  await acquire(`integration:${path.basename(WORKTREE)}`);
  const { startHarness } = require(path.join(BACKEND, "test/integration/helpers/test-server.js"));
  let worst = 0;
  for (const file of files) {
    console.log(`\n[runner] ===== ${file}`);
    const harness = await startHarness({ timeoutMs: 90_000, maxSeconds: 300 });
    console.log(`[runner] fresh harness ready (pid ${harness.info.pid})`);

    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.NODE_TLS_REJECT_UNAUTHORIZED;
    delete env.MONGODB_URI;
    env.TEST_BASE_URL = "http://127.0.0.1:5057";
    env.TEST_READY_FILE = harness.readyFile;

    const code = await new Promise((resolve) => {
      const t = spawn(process.execPath, ["--test", file], { cwd: BACKEND, env, stdio: "inherit" });
      t.on("exit", (c) => resolve(c));
    });

    const stopped = await harness.stop();
    await new Promise((r) => setTimeout(r, 1000));
    console.log(
      `[runner] ${file}: tests exit=${code}; harness exit=${stopped.exitCode}; ready-file removed=${stopped.readyFileRemoved}; ` +
        `mongod=${mongods()}, port5057 busy=${portBusy()}, temp artifacts=${temp().length}`,
    );
    if (code !== 0 || stopped.exitCode !== 0 || mongods() || portBusy() || temp().length) worst = 1;
  }
  process.exit(worst);
})().catch((e) => {
  console.error("[runner] ERROR", e.message);
  process.exit(2);
});
