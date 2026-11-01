// Shared lock for the isolated test harness. Every harness-using command (integration files and
// browser specs) binds the same fixed ports (backend harness 127.0.0.1:5057, Vite 5174), so only
// ONE such command may run at a time across all worktrees.
//
// The lock is a directory created with mkdir (atomic). It is released when the owning command
// ends. A lock is NEVER stolen automatically: if it looks stale (older than STALE_MS) the waiter
// prints a warning and keeps waiting until its own timeout, then exits non-zero so a human or the
// coordinator can look at it.
const fs = require("fs");
const path = require("path");

const LOCK_DIR = path.join(__dirname, "..", "locks", "harness.lock");
const STALE_MS = 45 * 60 * 1000;
const WAIT_MS = 30 * 60 * 1000;
const POLL_MS = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function acquire(label) {
  const started = Date.now();
  let warned = false;
  for (;;) {
    try {
      fs.mkdirSync(LOCK_DIR);
      fs.writeFileSync(
        path.join(LOCK_DIR, "owner.json"),
        JSON.stringify({ pid: process.pid, label, worktree: process.env.SB_WORKTREE || null, acquiredAt: new Date().toISOString() }),
      );
      const release = () => {
        try {
          fs.rmSync(LOCK_DIR, { recursive: true, force: true });
        } catch {
          /* leave it for the coordinator */
        }
      };
      process.on("exit", release);
      process.on("SIGINT", () => process.exit(130));
      process.on("SIGTERM", () => process.exit(143));
      return release;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner = "unknown owner";
      try {
        const info = JSON.parse(fs.readFileSync(path.join(LOCK_DIR, "owner.json"), "utf8"));
        owner = `${info.label} (pid ${info.pid}, since ${info.acquiredAt})`;
        if (!warned && Date.now() - Date.parse(info.acquiredAt) > STALE_MS) {
          warned = true;
          console.error(`[lock] WARNING: the lock held by ${owner} is older than 45 minutes; not stealing it.`);
        }
      } catch {
        /* owner file not written yet */
      }
      if (Date.now() - started > WAIT_MS) {
        console.error(`[lock] gave up waiting for the harness lock held by ${owner}`);
        process.exit(3);
      }
      console.error(`[lock] waiting for the harness lock held by ${owner}`);
      await sleep(POLL_MS);
    }
  }
}

module.exports = { acquire };
