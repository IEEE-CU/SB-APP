// Coordinator patch (integration worktree): society-terms.integration.test.js must follow D-23.
const fs = require("fs");
const file = "D:/SB-APP-worktrees/batch1-integration/backend/test/integration/society-terms.integration.test.js";
let s = fs.readFileSync(file, "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");
const rep = (a, b) => {
  if (s.split(a).length !== 2) throw new Error("anchor not unique/found: " + a.slice(0, 80));
  s = s.replace(a, () => b);
};

// 1. setup: settings:edit exists and society_chair holds it (the fixtures define none), plus a role
//    that holds settings:edit but NOT finance:view, for the response-shaping test.
rep(
  `    await db.collection("rolepermissions").insertOne({
      role: role._id,
      permission: permission.insertedId,
      accessLevel: "limited_own_scope",
    });
  });
});`,
  `    await db.collection("rolepermissions").insertOne({
      role: role._id,
      permission: permission.insertedId,
      accessLevel: "limited_own_scope",
    });

    // D-23: handover writes need the existing settings:edit permission. The fixtures define no
    // settings permission, so (as in society-patch.integration.test.js) it is created here and
    // granted to society_chair. A second role holds settings:edit and nothing else.
    const settings = await db.collection("permissions").insertOne({ module: "settings", action: "edit", key: "settings:edit" });
    await db.collection("rolepermissions").insertOne({
      role: role._id,
      permission: settings.insertedId,
      accessLevel: "limited_own_scope",
    });
    const { _id, ...roleFields } = role;
    const settingsOnly = await db.collection("roles").insertOne({ ...roleFields, name: "terms_settings_only" });
    await db.collection("rolepermissions").insertOne({
      role: settingsOnly.insertedId,
      permission: settings.insertedId,
      accessLevel: "limited_own_scope",
    });
  });

  // An account of society A that may edit settings but has no finance:view.
  const email = \`terms-settings-only-\${Date.now()}@integration.test\`;
  const created = await target.registerAccount({ name: "Settings only", email, password: "Integration-Test-Pw-2026!" });
  const body = await created.json();
  assert.equal(created.status, 201, JSON.stringify(body).slice(0, 160));
  settingsOnlyToken = body.data.token;
  await withDatabase(target, async (db, ObjectId) => {
    const roleDoc = await db.collection("roles").findOne({ name: "terms_settings_only" });
    await db.collection("users").updateOne({ _id: new ObjectId(body.data.user.id) }, { $set: { societyId: new ObjectId(A.id) } });
    await db.collection("userroles").insertOne({
      user: new ObjectId(body.data.user.id),
      role: roleDoc._id,
      society: new ObjectId(A.id),
      assignedBy: new ObjectId(users.admin.id),
      assignedAt: new Date(),
    });
  });
});`,
);
rep(
  `let termA;
let termB;`,
  `let termA;
let termB;
let settingsOnlyToken;`,
);

// 2. member test: the guard's decision is now settled (D-23) - assert it, and keep the no-leak check
rep(
  `    // Whether this caller may update the checklist is the existing society guard's decision
    // (not changed here); whatever it answers must not carry the budgets.
    textHasNone(res.text, [...BUDGET_KEYS, ...Object.values(BUDGETS_A)], "a member's handover response");
  });`,
  `    // D-23: an ordinary member has no settings:edit and is refused; the refusal must not carry budgets either.
    assert.equal(res.status, 403, res.text.slice(0, 200));
    textHasNone(res.text, [...BUDGET_KEYS, ...Object.values(BUDGETS_A)], "a member's handover response");
  });

  test("a settings:edit holder without finance:view updates the handover and gets the term without budgets or e-mails", async () => {
    const res = await session.request(null, "PATCH", \`/societies/\${A.id}/terms/\${termA}/handover\`, {
      body: { notes: "settings-only note" },
      headers: { Authorization: \`Bearer \${settingsOnlyToken}\` },
    });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.data.handoverChecklist.notes, "settings-only note");
    textHasNone(res.text, [...BUDGET_KEYS, ...Object.values(BUDGETS_A)], "a settings-only caller's handover response");
    textHasNone(res.text, [EMAILS.chairA, EMAILS.memberA], "a settings-only caller's handover response");
  });`,
);

if (crlf) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(file, s);
console.log("patched");
