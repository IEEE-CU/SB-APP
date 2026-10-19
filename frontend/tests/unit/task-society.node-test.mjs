// Unit tests for src/lib/taskSociety.ts (the society a new task is created under).
//
// Run with Node's built-in runner, no extra dependency:
//   node --test tests/unit/task-society.node-test.mjs
// (Node strips the TypeScript types when importing the .ts module directly; the
// module has no imports. The file is named *.node-test.mjs on purpose so that
// Playwright's default *.test.* pattern does not pick it up.)

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveTaskSociety, taskSocietyNotice } from "../../src/lib/taskSociety.ts";

// Alphabetical order, as the society list is returned: "alpha" is first.
const societies = [{ id: "alpha" }, { id: "beta" }, { id: "gamma" }];

const nonAdmin = (societyId) => ({ role: "OFFICE_BEARER", societyId });
const admin = (societyId = null) => ({ role: "ADMIN", societyId });

// ---- non-admin ------------------------------------------------------------------

test("a non-admin defaults to their own society even when it is not alphabetically first", () => {
  const context = resolveTaskSociety({ user: nonAdmin("gamma"), activeSocietyId: null, societies });

  assert.deepEqual(context, { status: "ready", societyId: "gamma", canChoose: false });
});

test("a non-admin cannot select another society for tasks", () => {
  for (const activeSocietyId of ["alpha", "beta", "gamma", null, undefined, "not-a-society"]) {
    const context = resolveTaskSociety({ user: nonAdmin("gamma"), activeSocietyId, societies });

    assert.equal(context.status, "ready");
    assert.equal(context.societyId, "gamma", `active=${activeSocietyId}`);
    assert.equal(context.canChoose, false);
  }
});

test("a non-admin does not depend on the society list having loaded", () => {
  const context = resolveTaskSociety({ user: nonAdmin("gamma"), activeSocietyId: null, societies: [] });

  assert.equal(context.status, "ready");
  assert.equal(context.societyId, "gamma");
});

test("a non-admin with no society cannot create tasks and is never given a default", () => {
  for (const societyId of [null, undefined, ""]) {
    const context = resolveTaskSociety({ user: nonAdmin(societyId), activeSocietyId: "alpha", societies });

    assert.deepEqual(context, { status: "missing", reason: "no-society" }, JSON.stringify(societyId));
  }
});

test("a role other than ADMIN is treated as a non-admin", () => {
  for (const role of [undefined, null, "", "admin", "OFFICE_BEARER", "SUPER"]) {
    const context = resolveTaskSociety({ user: { role, societyId: "gamma" }, activeSocietyId: "alpha", societies });

    assert.equal(context.societyId, "gamma", String(role));
    assert.equal(context.canChoose, false);
  }
});

// ---- administrator --------------------------------------------------------------

test("an administrator may select any existing society", () => {
  for (const id of ["alpha", "beta", "gamma"]) {
    const context = resolveTaskSociety({ user: admin(), activeSocietyId: id, societies });

    assert.deepEqual(context, { status: "ready", societyId: id, canChoose: true });
  }
});

test("an administrator with no selection is not silently given the first society", () => {
  for (const activeSocietyId of [null, undefined, ""]) {
    const context = resolveTaskSociety({ user: admin(), activeSocietyId, societies });

    assert.deepEqual(context, { status: "missing", reason: "none-selected" });
  }
});

test("an administrator's selection must be a society that exists in the list", () => {
  const context = resolveTaskSociety({ user: admin(), activeSocietyId: "deleted-society", societies });

  assert.deepEqual(context, { status: "missing", reason: "none-selected" });
});

test("an administrator is told to wait while the society list is empty or loading", () => {
  const context = resolveTaskSociety({ user: admin(), activeSocietyId: "alpha", societies: [] });

  assert.deepEqual(context, { status: "loading" });
});

test("an administrator's own society, if any, is not used in place of a selection", () => {
  const context = resolveTaskSociety({ user: admin("gamma"), activeSocietyId: "beta", societies });

  assert.equal(context.societyId, "beta");
  const none = resolveTaskSociety({ user: admin("gamma"), activeSocietyId: null, societies });
  assert.equal(none.status, "missing");
});

// ---- signed out -----------------------------------------------------------------

test("no user means no society", () => {
  for (const user of [null, undefined]) {
    const context = resolveTaskSociety({ user, activeSocietyId: "alpha", societies });

    assert.deepEqual(context, { status: "missing", reason: "signed-out" });
  }
});

// ---- notices --------------------------------------------------------------------

test("notices explain every blocked state and the non-admin override, and are silent otherwise", () => {
  const ready = resolveTaskSociety({ user: nonAdmin("gamma"), activeSocietyId: "gamma", societies });
  const overridden = resolveTaskSociety({ user: nonAdmin("gamma"), activeSocietyId: "alpha", societies });
  const adminReady = resolveTaskSociety({ user: admin(), activeSocietyId: "alpha", societies });
  const loading = resolveTaskSociety({ user: admin(), activeSocietyId: null, societies: [] });
  const noSociety = resolveTaskSociety({ user: nonAdmin(null), activeSocietyId: "alpha", societies });
  const noneSelected = resolveTaskSociety({ user: admin(), activeSocietyId: null, societies });
  const signedOut = resolveTaskSociety({ user: null, activeSocietyId: null, societies });

  assert.equal(taskSocietyNotice(ready, "gamma"), null);
  assert.equal(taskSocietyNotice(ready, null), null);
  assert.equal(taskSocietyNotice(overridden, "alpha"), "Tasks are always created in your own society.");
  assert.equal(taskSocietyNotice(adminReady, "alpha"), null);
  assert.equal(taskSocietyNotice(loading, null), null);
  assert.match(taskSocietyNotice(noSociety, "alpha"), /not linked to a society/);
  assert.match(taskSocietyNotice(noneSelected, null), /Select a society/);
  assert.match(taskSocietyNotice(signedOut, null), /Sign in/);
});

test("only the ready state exposes a society id", () => {
  const blocked = [
    resolveTaskSociety({ user: null, activeSocietyId: "alpha", societies }),
    resolveTaskSociety({ user: nonAdmin(null), activeSocietyId: "alpha", societies }),
    resolveTaskSociety({ user: admin(), activeSocietyId: null, societies }),
    resolveTaskSociety({ user: admin(), activeSocietyId: "alpha", societies: [] }),
  ];
  for (const context of blocked) {
    assert.notEqual(context.status, "ready");
    assert.equal("societyId" in context, false);
  }
});
