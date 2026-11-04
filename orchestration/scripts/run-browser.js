// Runs ONE Playwright session spec against a fresh isolated harness, from the worktree named by
// SB_WORKTREE. Fresh harness per invocation because the general rate limit (300 requests per
// 15 minutes per address) is shared by all traffic from one harness; the limit is never relaxed.
//
//   set SB_WORKTREE=D:\SB-APP-worktrees\announcements
//   node D:\SB-APP-orchestration\scripts\run-browser.js tests/session/<name>.spec.ts [--trace retain-on-failure]
//
// Takes the shared harness lock first (backend 5057 + Vite 5174). Uses the already-installed
// Chromium 1248 unless PW_CHROMIUM_PATH is set; nothing is downloaded.
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
const FRONTEND = path.join(WORKTREE, "frontend");
const extraArgs = argv;
if (extraArgs.length === 0) throw new Error("pass a spec path (relative to frontend/)");

const CHROME = "C:\\Users\\Arrin Paul\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe";
const mongods = () =>
  ((spawnSync("tasklist", ["/FI", "IMAGENAME eq mongod*", "/FO", "CSV", "/NH"], { encoding: "utf8" }).stdout || "")
    .split(/\r?\n/).filter((l) => /^"mongod[^"]*\.exe"/i.test(l))).length;
const temp = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("sb-app-integration-"));
const busy = (port) =>
  spawnSync("netstat", ["-ano"], { encoding: "utf8" }).stdout.split(/\r?\n/).some((l) => /LISTENING/.test(l) && new RegExp(`:${port}\\s`).test(l));

(async () => {
  await acquire(`browser:${path.basename(WORKTREE)}`);
  const { startHarness } = require(path.join(BACKEND, "test/integration/helpers/test-server.js"));
  const harness = await startHarness({ timeoutMs: 90_000, maxSeconds: 900 });
  console.log(`[runner] harness ready (pid ${harness.info.pid})`);
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_TLS_REJECT_UNAUTHORIZED;
  delete env.MONGODB_URI;
  env.TEST_BASE_URL = "http://127.0.0.1:5057";
  env.TEST_READY_FILE = harness.readyFile;
  if (!env.PW_CHROMIUM_PATH) env.PW_CHROMIUM_PATH = CHROME;

  const args = ["playwright", "test", "-c", "playwright.session.config.ts", ...extraArgs];
  const code = await new Promise((resolve) => {
    const t = spawn("npx", args, { cwd: FRONTEND, env, stdio: "inherit", shell: true });
    t.on("exit", (c) => resolve(c));
  });
  const stopped = await harness.stop();
  await new Promise((r) => setTimeout(r, 2000));
  const clean = !mongods() && !busy(5057) && !busy(5174) && temp().length === 0;
  console.log(
    `[runner] ${extraArgs.join(" ")}: playwright exit=${code}; harness exit=${stopped.exitCode}; ready-file removed=${stopped.readyFileRemoved}; ` +
      `mongod=${mongods()}, port5057 busy=${busy(5057)}, port5174 busy=${busy(5174)}, temp artifacts=${temp().length}`,
  );
  process.exit(code === 0 && stopped.exitCode === 0 && clean ? 0 : 1);
})().catch((e) => {
  console.error("[runner] ERROR", e.message);
  process.exit(2);
});
