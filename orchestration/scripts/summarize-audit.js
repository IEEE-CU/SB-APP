// Summarises npm audit JSON (read-only) into markdown tables. Usage: node summarize-audit.js <dir>
const fs = require("fs");
const dir = process.argv[2];
const projects = [["root (/)", "r"], ["backend", "backend"], ["frontend", "frontend"]];
const rank = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 };
let out = "";
for (const [label, key] of projects) {
  const all = JSON.parse(fs.readFileSync(`${dir}/c4-audit-${key}-all.json`, "utf8"));
  const prod = JSON.parse(fs.readFileSync(`${dir}/c4-audit-${key}-prod.json`, "utf8"));
  const prodSet = new Set(Object.keys(prod.vulnerabilities || {}));
  out += `\n### ${label}: ${JSON.stringify(all.metadata.vulnerabilities)} (production-only: ${JSON.stringify(prod.metadata.vulnerabilities)})\n`;
  out += "| Package | Severity | Scope | Direct | Advisory / via | Dependency path (first effect) | Fix available |\n|---|---|---|---|---|---|---|\n";
  const rows = Object.values(all.vulnerabilities).sort((a, b) => rank[b.severity] - rank[a.severity] || a.name.localeCompare(b.name));
  for (const v of rows) {
    const via = v.via.map((x) => (typeof x === "string" ? x : `${x.title} (${x.url ? x.url.replace("https://github.com/advisories/", "") : x.source})`)).join("; ").slice(0, 170);
    const path = (v.effects && v.effects.length ? "affects " + v.effects.slice(0, 3).join(", ") : "-") + (v.nodes ? "; at " + v.nodes.slice(0, 1).join("") : "");
    const fix = v.fixAvailable === true ? "yes" : v.fixAvailable === false ? "no" : `yes, ${v.fixAvailable.name}@${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? " (semver-major)" : ""}`;
    out += `| ${v.name} | ${v.severity} | ${prodSet.has(v.name) ? "production" : "dev only"} | ${v.isDirect ? "direct" : "transitive"} | ${via} | ${path} | ${fix} |\n`;
  }
}
fs.writeFileSync(`${dir}/c4-audit-summary.md`, out);
console.log(out.length, "chars written");
