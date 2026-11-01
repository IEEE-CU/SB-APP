// Turns completion/raw/api-audit-extract.json into tables + flags (read-only). Prints markdown to stdout.
const d = require("D:/SB-APP-orchestration/completion/raw/api-audit-extract.json");
const UNMOUNTED = new Set(["storage", "email", "pdf", "ai"]);
const rows = d.endpoints.map((e) => {
  const info = d.fileInfo[e.file];
  const fileAuth = info.fileLevel.some((x) => /\bauthenticate\b/.test(x));
  const chain = e.mw.join(" ; ");
  const auth = fileAuth || /\bauthenticate\b/.test(chain);
  const perm = (chain.match(/requirePermission\([^)]*\)/g) || []).map((s) => s.replace(/requirePermission\(|\)|"|\s/g, "")).join("+");
  const admin = /adminOnly|authorize\(|requireSuperAdmin|requireRole\(|officeBearerOrAdmin/.test(chain) || info.fileLevel.some((x) => /adminOnly|authorize\(|requireRole\(/.test(x));
  const scope = /societyAccess|attachScope/.test(chain) || info.fileLevel.some((x) => /societyAccess|attachScope/.test(x));
  const limiter = (chain.match(/\w*Limiter\b/g) || []).join("+");
  const prefixes = info.mounts.length ? info.mounts : UNMOUNTED.has(e.file) ? ["(UNMOUNTED)"] : ["(no mount found)"];
  const full = prefixes.map((p) => (p === "/" ? "" : p) + (e.routePath === "/" ? "" : e.routePath) || "/");
  return { ...e, unmounted: info.mounts.length === 0, auth, perm, admin, scope, limiter, full, fileLevel: info.fileLevel.join(" | ") };
});
const norm = (p) => p.replace(/:\w+/g, ":p").replace(/\/+$/, "") || "/";
const callKey = (c) => c.method + " " + norm(c.url);
const callSet = new Map();
d.calls.forEach((c) => (callSet.get(callKey(c)) || callSet.set(callKey(c), []).get(callKey(c))).push(c.file));
rows.forEach((r) => {
  r.callers = [...new Set(r.full.flatMap((f) => callSet.get(r.method + " " + norm(f)) || []))];
});
const matchedKeys = new Set(rows.flatMap((r) => r.full.map((f) => r.method + " " + norm(f))));
const unmatchedCalls = [...callSet.keys()].filter((k) => !matchedKeys.has(k));

const mut = (m) => m !== "GET";
const out = [];
const P = (s = "") => out.push(s);
const unmounted = rows.filter((r) => r.unmounted);
const mounted = rows.filter((r) => !r.unmounted);

P(`Totals: ${rows.length} declarations in routes/*.js (excl. 1 inline \`GET /health\` in routes/index.js = 129); ${mounted.length} mounted, ${unmounted.length} in unmounted files; ${d.calls.length} frontend API call sites.`);
P();
P("### Flag A - mounted endpoints with NO authentication in the chain");
rows.filter((r) => !r.auth && !r.unmounted).forEach((r) => P(`- \`${r.method} ${r.full.join(" , ")}\` (${r.file}.js:${r.line}) chain: ${r.mw.join(" ; ") || "(none)"}`));
P();
P("### Flag B - authenticated MUTATING endpoints with no permission / admin / society guard in the route chain (inline checks possible: review the handler)");
rows.filter((r) => r.auth && mut(r.method) && !r.perm && !r.admin && !r.scope && !r.unmounted).forEach((r) => P(`- \`${r.method} ${r.full.join(" , ")}\` (${r.file}.js:${r.line}) chain: ${r.mw.join(" ; ") || "(none)"}`));
P();
P("### Flag C - authenticated GET endpoints with no permission / admin / society guard in the route chain");
rows.filter((r) => r.auth && !mut(r.method) && !r.perm && !r.admin && !r.scope && !r.unmounted).forEach((r) => P(`- \`${r.method} ${r.full.join(" , ")}\` (${r.file}.js:${r.line})`));
P();
P("### Flag D - frontend API calls with no matching backend route (possible contract mismatch)");
unmatchedCalls.forEach((k) => P(`- \`${k}\` from ${[...new Set(callSet.get(k))].join(", ")}`));
P();
P("### Flag E - mounted endpoints with no frontend call site found (informational)");
P(mounted.filter((r) => !r.callers.length).map((r) => `\`${r.method} ${r.full[0]}\``).join(", "));
P();
P("### Full table (mounted)");
P("| Method | Path | Auth | Permission | Admin/role | Society guard | Limiter | Frontend callers | Source |");
P("|---|---|---|---|---|---|---|---|---|");
mounted.forEach((r) => P(`| ${r.method} | \`${r.full.join(" , ")}\` | ${r.auth ? "yes" : "**NO**"} | ${r.perm || "-"} | ${r.admin ? "yes" : "-"} | ${r.scope ? "yes" : "-"} | ${r.limiter || "-"} | ${r.callers.length ? r.callers.length + " file(s)" : "none"} | ${r.file}.js:${r.line} |`));
P();
P("### Declared in UNMOUNTED files (not reachable)");
unmounted.forEach((r) => P(`- \`${r.method} ${r.routePath}\` (${r.file}.js:${r.line}) chain: ${r.mw.join(" ; ") || "(none)"}`));
console.log(out.join("\n"));
