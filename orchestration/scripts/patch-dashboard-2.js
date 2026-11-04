const fs = require("fs");
const file = "D:/SB-APP-orchestration/completion/dashboard/index.html";
let s = fs.readFileSync(file, "utf8");
const rep = (a, b) => {
  if (s.split(a).length !== 2) throw new Error("anchor not unique/found: " + a.slice(0, 70));
  s = s.replace(a, () => b);
};

rep(`{cls:"done", n:16, t:"things finished: 12 verified, 4 written but not fully checked (all uncommitted)"}`,
    `{cls:"done", n:21, t:"things finished: 14 verified, 7 written or code-read but not fully checked"}`);
rep(`{cls:"todo", n:26, t:"not started yet"}`, `{cls:"todo", n:23, t:"not started yet"}`);

rep(`  "<b>Save the flake evidence</b> (QA-01): copy the NEW-10 traces out of the combined worktree. No approval needed, and it is lost if that worktree is ever cleaned.",\n`, ``);

rep(`  ["Phase 0: discovery and 8 documents"`,
`  ["NEW-10 traces saved (QA-01)","Copied out of the combined worktree with matching checksums, so a cleanup can no longer lose them.","ok"],
  ["No stray test processes (OPS-01)","Ports 5057/5174 free, old runner gone, lock free. Free memory is very low right now (59 MB).","ok"],
  ["DOMPurify critical: not reachable in the current code (SEC-01)","All 9 uses are the plain default call; the risky options are never used. Read, not attack-tested. Upgrade still advised.","unv"],
  ["proxy-addr critical: depends on your proxy setup (SEC-02)","Only matters if TRUST_PROXY is an address/subnet list. Settled once you pick the hosting topology.","unv"],
  ["Unused Google Drive code holds no secret (SEC-03)","But it could upload your ledger to Google if ever wired up, which supports deleting it (D-28).","unv"],
  ["Phase 0: discovery and 8 documents"`);

// remove the three finished items from "Not started" (match whole lines by their titles)
const drop = (needle) => {
  const lines = s.split("\n");
  const idx = lines.findIndex((l) => l.includes(needle));
  if (idx < 0) throw new Error("line not found: " + needle);
  lines.splice(idx, 1);
  s = lines.join("\n");
};
drop(`["Save the NEW-10 traces (QA-01)"`);
drop(`["Is DOMPurify`);
drop(`["proxy-addr under the real trust-proxy setting (SEC-02)"`);

rep(`dompurify (DOM XSS), proxy-addr (IP spoofing; the app uses trust proxy) and tar (file overwrite). Not upgraded.`,
    `dompurify looks unreachable in current code; proxy-addr depends on your proxy setup; tar not assessed yet. None upgraded.`);
rep(`~17:30 local (updated after Phase 0 finished)`, `~18:00 local (updated after the first approval-free tasks)`);

fs.writeFileSync(file, s);
console.log("dashboard patched");
