const { spawn } = require("child_process");
const path = require("path");

const projectRoot = __dirname;

console.log(" Starting IEEE SB-APP Backend and Frontend servers...\n");

// Spawn Backend Server with In-Memory DB & automatic seeding
const backend = spawn("node", ["backend/src/scripts/runWithMemoryDb.js", "dev"], {
  cwd: projectRoot,
  shell: true,
  stdio: "inherit",
});

// Spawn Frontend Server
const frontend = spawn("npm", ["run", "dev"], {
  cwd: path.join(projectRoot, "frontend"),
  shell: true,
  stdio: "inherit",
});

const cleanup = () => {
  console.log("\n Stopping servers...");
  backend.kill();
  frontend.kill();
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
