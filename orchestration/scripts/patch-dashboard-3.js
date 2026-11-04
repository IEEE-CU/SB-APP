const fs = require("fs");
const file = "D:/SB-APP-orchestration/completion/dashboard/index.html";
let s = fs.readFileSync(file, "utf8");
const rep = (a, b) => {
  if (s.split(a).length !== 2) throw new Error("anchor not unique/found: " + a.slice(0, 70));
  s = s.replace(a, () => b);
};
const drop = (needle) => {
  const lines = s.split("\n");
  const i = lines.findIndex((l) => l.includes(needle));
  if (i < 0) throw new Error("line not found: " + needle);
  lines.splice(i, 1);
  s = lines.join("\n");
};

rep(`{cls:"done", n:21, t:"things finished: 14 verified, 7 written or code-read but not fully checked"}`,
    `{cls:"done", n:24, t:"things finished: 14 verified, 10 written or code-read but not fully checked"}`);
rep(`{cls:"todo", n:23, t:"not started yet"}`, `{cls:"todo", n:22, t:"not started yet"}`);

rep(`  ["Phase 0: discovery and 8 documents"`,
`  ["Endpoint audit, first pass (API-01)","All 129 declarations classified; the 12 mutating ones with no guard in the route were read by hand and all check inside. 27 GET endpoints and the database half remain.","unv"],
  ["Frontend audit, static pass only (FE-01)","Nothing run in a browser. Confirmed no 429 handling; 3 submit buttons can double-fire; form pages are not gated in the UI.","unv"],
  ["Role-permission matrix (AUTHZ-01)","Seed grants settings:edit to exactly your four D-24 roles. Per-endpoint tests still to do.","unv"],
  ["Phase 0: discovery and 8 documents"`);

drop(`["Role-permission matrix (AUTHZ-01)","After D-24","P1"]`);
drop(`["Audit all 129 endpoints (API-01)"`);
drop(`["Frontend functional audit (FE-01)"`);

rep(`  ["Sidebar last-message bug","NEW-22","P2"],`,
`  ["Sidebar last-message bug","NEW-22","P2"],
  ["Small cleanups found by the audits","FE-F1 double-click on Calendar/Kanban/chat; FE-F2 form pages not gated in the UI; API-F2 unused getConversation wrapper","P3"],
  ["Who may edit any role's permissions","NEW-15: society faculty advisors can change any role globally; also picks an arbitrary role if a user has several. Needs your decision.","P2"],`);

rep(`~18:00 local (updated after the first approval-free tasks)`, `~18:40 local (updated after the endpoint and frontend audits)`);
fs.writeFileSync(file, s);
console.log("dashboard patched");
