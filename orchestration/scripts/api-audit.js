// Read-only static extractor for API-01. Parses backend/src/routes/*.js (mount points from routes/index.js)
// and frontend API calls. Writes JSON to stdout. Heuristic: verify anything surprising by reading the source.
const fs = require("fs");
const path = require("path");
const BACK = "D:/SB-APP/backend/src/routes";
const FRONT = "D:/SB-APP/frontend/src";

// ---- mounts from index.js
const idx = fs.readFileSync(path.join(BACK, "index.js"), "utf8").replace(/\r/g, "");
const varToFile = {};
for (const m of idx.matchAll(/const\s+(\w+)\s*=\s*require\("\.\/(\w+)"\)/g)) varToFile[m[1]] = m[2];
const mounts = {}; // file -> [prefixes]
for (const m of idx.matchAll(/^\s*router\.use\(\s*"([^"]*)"\s*,\s*(\w+)\s*\)/gm)) {
  const file = varToFile[m[2]];
  if (file) (mounts[file] ||= []).push(m[1]);
}
const commented = [...idx.matchAll(/^\s*\/\/\s*router\.use\(\s*"([^"]*)"\s*,\s*(\w+)/gm)].map((m) => ({ prefix: m[1], file: varToFile[m[2]] }));

// ---- scanner helpers
function skipString(src, i) {
  const q = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === "\\") { i += 2; continue; }
    if (src[i] === q) return i + 1;
    if (q === "`" && src[i] === "$" && src[i + 1] === "{") { // template expression
      let d = 1; i += 2;
      while (i < src.length && d) { if (src[i] === "{") d++; else if (src[i] === "}") d--; i++; }
      continue;
    }
    i++;
  }
  return i;
}
// returns array of top-level argument source strings, stopping early at an inline handler
function parseArgs(src, start) { // src[start] === "("
  let i = start + 1, depth = 0, cur = "", args = [];
  const push = () => { if (cur.trim()) args.push(cur.trim()); cur = ""; };
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") { const e = skipString(src, i); cur += src.slice(i, e); i = e; continue; }
    if (depth === 0 && /^(async\b|function\b|\(\s*(req|_req|request)\b|\(\s*\)|\(req)/.test(src.slice(i).trimStart()) && cur.trim() === "") {
      args.push("<inline handler>");
      return args;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    if (c === ")" || c === "]" || c === "}") { if (depth === 0) { push(); return args; } depth--; }
    if (c === "," && depth === 0) { push(); i++; continue; }
    cur += c; i++;
  }
  push();
  return args;
}

const endpoints = [];
const fileInfo = {};
for (const f of fs.readdirSync(BACK).filter((x) => x.endsWith(".js") && x !== "index.js")) {
  const name = f.replace(/\.js$/, "");
  const src = fs.readFileSync(path.join(BACK, f), "utf8").replace(/\r/g, "");
  const fileLevel = [];
  for (const m of src.matchAll(/^router\.use\(([^;\n]*)\)\s*;/gm)) fileLevel.push(m[1].trim());
  fileInfo[name] = { mounts: mounts[name] || [], fileLevel };
  for (const m of src.matchAll(/^\s*router\.(get|post|put|patch|delete)\(/gm)) {
    const open = m.index + m[0].length - 1;
    const args = parseArgs(src, open);
    const routePath = (args[0] || "").replace(/^["'`]|["'`]$/g, "");
    const mw = args.slice(1).filter((a) => a !== "<inline handler>");
    const inline = args.includes("<inline handler>");
    const line = src.slice(0, m.index).split("\n").length;
    endpoints.push({ file: name, line, method: m[1].toUpperCase(), routePath, mw, inline });
  }
}

// ---- frontend calls
const calls = [];
function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(n)) {
      const t = fs.readFileSync(p, "utf8");
      for (const m of t.matchAll(/\b(?:api|axios)\s*\.\s*(get|post|put|patch|delete)\s*(?:<[^()]*?>)?\(\s*([`"'])([^`"']*)\2/g)) {
        calls.push({ file: path.relative(FRONT, p).replace(/\\/g, "/"), method: m[1].toUpperCase(), url: m[3].replace(/\$\{[^}]*\}/g, ":p").replace(/\?.*$/, "") });
      }
    }
  }
}
walk(FRONT);

console.log(JSON.stringify({ fileInfo, commented, endpoints, calls }, null, 0));
