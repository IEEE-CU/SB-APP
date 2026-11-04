"use strict";

/**
 * AUD-021 over HTTP (reads and creation): GET /project-reports (alias /reports),
 * GET /project-reports/project/:projectId, GET /project-reports/:id and
 * POST /project-reports. PATCH/DELETE protections are covered by
 * project-report-scope.integration.test.js and must keep passing.
 *
 * Policy (routes/projectReports.js):
 *   list       administrators: any society; others: forced to their own stored
 *              society (a society in the query is ignored); no society -> 403.
 *   by-project non-admins: the project's STORED society must be theirs, else 404
 *              (same as an unknown project); no society -> 403.
 *   detail     out-of-scope or society-less -> 404 (same as nonexistent).
 *   create     the project must exist and its stored society must equal the
 *              report's society, for every caller including administrators.
 *
 * Fixtures: one report per society (no project), chairA/memberA in A, chairB in
 * B, loner has no society, admin is the administrator. Projects and the extra
 * reports are inserted here, including one deliberately inconsistent "legacy"
 * report (society B pointing at society A's project).
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { societies, reports: fixtureReports } = target.ready.fixtures;

const RUN = Date.now();
const MISSING = "64b7f8f2a1b2c3d4e5f6ffff";
const REPORT_PATHS = ["/project-reports", "/reports"]; // the same router mounted twice

let projects; // { A, B }
let seeded; // { aProject, bProject, legacy } report ids

const get = (userKey, route) => session.request(userKey, "GET", route);
const post = (userKey, body) => session.request(userKey, "POST", "/project-reports", { body });

const reportsCollection = (filter = {}) =>
  withDatabase(target, (db) => db.collection("projectreports").find(filter).toArray());
const totalReports = () =>
  withDatabase(target, (db) => db.collection("projectreports").countDocuments({}));
const reportsOf = (societyId) =>
  withDatabase(target, (db, ObjectId) =>
    db.collection("projectreports").countDocuments({ societyId: new ObjectId(societyId) }),
  );
const byTitle = (title) => reportsCollection({ title });

const idsOf = (res) => res.body.data.map((r) => r.id);
const societyOfEntry = (entry) => String(entry.societyId?.id ?? entry.societyId?._id ?? entry.societyId);

const newReport = (title, extra = {}) => ({
  title,
  description: "Created by an integration test",
  type: "general",
  ...extra,
});

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    const project = (societyId, title) => ({
      societyId: new ObjectId(societyId),
      title,
      category: "TECHNICAL_PROJECT",
      sanctioningBody: "Integration",
      amountSanctioned: 0,
      startDate: now,
      status: "ONGOING",
      description: "Integration project",
      createdAt: now,
      updatedAt: now,
    });
    const a = await db.collection("projects").insertOne(project(societies.A.id, `Project A ${RUN}`));
    const b = await db.collection("projects").insertOne(project(societies.B.id, `Project B ${RUN}`));
    projects = { A: String(a.insertedId), B: String(b.insertedId) };

    const report = (societyId, projectId, title) => ({
      societyId: new ObjectId(societyId),
      projectId: new ObjectId(projectId),
      title,
      description: "Seeded report",
      type: "general",
      status: "SUBMITTED",
      createdAt: now,
      updatedAt: now,
    });
    const aProject = await db
      .collection("projectreports")
      .insertOne(report(societies.A.id, projects.A, `A report on project A ${RUN}`));
    const bProject = await db
      .collection("projectreports")
      .insertOne(report(societies.B.id, projects.B, `B report on project B ${RUN}`));
    // Legacy inconsistent data: society B's report attached to society A's project.
    const legacy = await db
      .collection("projectreports")
      .insertOne(report(societies.B.id, projects.A, `LEGACY B report on project A ${RUN}`));
    seeded = {
      aProject: String(aProject.insertedId),
      bProject: String(bProject.insertedId),
      legacy: String(legacy.insertedId),
    };
  });
});

describe("list", () => {
  test("a non-admin sees only their own society's reports, with matching totals", async () => {
    const res = await get("chairA", "/project-reports?limit=100");

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.success, true);
    assert.deepEqual(Object.keys(res.body).sort(), ["count", "data", "meta", "success"]);
    assert.ok(res.body.data.length >= 2);
    assert.ok(res.body.data.every((r) => societyOfEntry(r) === societies.A.id), "a foreign report was listed");
    assert.ok(idsOf(res).includes(fixtureReports.A.id));
    assert.ok(!idsOf(res).includes(fixtureReports.B.id));
    const expected = await reportsOf(societies.A.id);
    assert.equal(res.body.meta.totalItems, expected);
    assert.equal(res.body.count, expected);
    assert.equal(res.body.meta.totalPages, 1);
  });

  test("the other society sees only its own", async () => {
    const res = await get("chairB", "/project-reports?limit=100");

    assert.ok(res.body.data.every((r) => societyOfEntry(r) === societies.B.id));
    assert.equal(res.body.meta.totalItems, await reportsOf(societies.B.id));
  });

  test("a society named in the query cannot broaden or redirect the list", async () => {
    const own = await get("chairA", "/project-reports?limit=100");

    for (const query of [
      `societyId=${societies.B.id}`,
      `societyId=${societies.A.id}`,
      `societyId=${societies.B.id}&societyId=${societies.A.id}`,
      "societyId=not-an-object-id",
    ]) {
      const res = await get("chairA", `/project-reports?limit=100&${query}`);

      assert.equal(res.status, 200, query);
      assert.deepEqual(idsOf(res).sort(), idsOf(own).sort(), query);
      assert.equal(res.body.meta.totalItems, own.body.meta.totalItems, query);
    }
  });

  test("a project filter cannot reach another society's reports", async () => {
    const res = await get("chairA", `/project-reports?projectId=${projects.B}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
    assert.equal(res.body.meta.totalItems, 0);
  });

  test("pagination metadata and slices follow the scoped query", async () => {
    const total = await reportsOf(societies.A.id);
    const first = await get("chairA", "/project-reports?limit=1&page=1");
    const last = await get("chairA", `/project-reports?limit=1&page=${total}`);
    const beyond = await get("chairA", `/project-reports?limit=1&page=${total + 1}`);

    assert.equal(first.body.count, 1);
    assert.deepEqual(first.body.meta, { page: 1, limit: 1, totalItems: total, totalPages: total });
    assert.equal(last.body.count, 1);
    assert.notEqual(idsOf(first)[0], idsOf(last)[0]);
    assert.ok([first, last].every((r) => societyOfEntry(r.body.data[0]) === societies.A.id));
    assert.deepEqual(beyond.body.data, []);
    assert.equal(beyond.body.meta.totalItems, total);
  });

  test("reports are newest first", async () => {
    const res = await get("chairA", "/project-reports?limit=100");

    const times = res.body.data.map((r) => new Date(r.createdAt).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
  });

  test("a caller without a society is 403, whatever the query says", async () => {
    for (const query of ["", `?societyId=${societies.A.id}`, `?projectId=${projects.A}`]) {
      const res = await get("loner", `/project-reports${query}`);

      assert.equal(res.status, 403, query);
      assert.equal(res.body.data, undefined);
      assert.doesNotMatch(res.text, /integration report|Project A|Project B/);
    }
  });

  test("an administrator sees every society and can filter by one", async () => {
    const all = await get("admin", "/project-reports?limit=100");
    const onlyB = await get("admin", `/project-reports?limit=100&societyId=${societies.B.id}`);

    assert.equal(all.status, 200, all.text.slice(0, 200));
    assert.equal(all.body.meta.totalItems, await totalReports());
    assert.ok(idsOf(all).includes(fixtureReports.A.id) && idsOf(all).includes(fixtureReports.B.id));
    assert.ok(onlyB.body.data.every((r) => societyOfEntry(r) === societies.B.id));
    assert.equal(onlyB.body.meta.totalItems, await reportsOf(societies.B.id));
  });

  test("anonymous and invalid-token requests are 401", async () => {
    const anonymous = await session.request(null, "GET", "/project-reports");
    const badToken = await session.request(null, "GET", "/project-reports", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });

    assert.equal(anonymous.status, 401);
    assert.equal(badToken.status, 401);
  });

  test("the /reports alias is scoped identically", async () => {
    const res = await get("chairA", "/reports?limit=100");

    assert.equal(res.status, 200);
    assert.ok(res.body.data.every((r) => societyOfEntry(r) === societies.A.id));
  });
});

describe("detail", () => {
  test("an own-society report is returned with its envelope", async () => {
    for (const base of REPORT_PATHS) {
      const res = await get("chairA", `${base}/${fixtureReports.A.id}`);

      assert.equal(res.status, 200, res.text.slice(0, 200));
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, fixtureReports.A.id);
      assert.equal(res.body.data.title, "Society A integration report");
    }
  });

  test("a report with a project returns the populated project", async () => {
    const res = await get("chairA", `/project-reports/${seeded.aProject}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.projectId.title, `Project A ${RUN}`);
  });

  test("a foreign report is 404, identical to a nonexistent one, and leaks nothing", async () => {
    for (const base of REPORT_PATHS) {
      const foreign = await get("chairA", `${base}/${fixtureReports.B.id}`);
      const foreignWithProject = await get("chairA", `${base}/${seeded.bProject}`);
      const missing = await get("chairA", `${base}/${MISSING}`);

      assert.equal(foreign.status, 404);
      assert.equal(foreign.body.message, "Report not found");
      assert.deepEqual(foreign.body, missing.body);
      assert.deepEqual(foreignWithProject.body, missing.body);
      assert.doesNotMatch(foreign.text + foreignWithProject.text, /Society B integration report|Project B/);
    }
  });

  test("a malformed id is still a clean 400", async () => {
    const res = await get("chairA", "/project-reports/not-an-object-id");

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid ID format.");
  });

  test("a caller without a society gets 404 for every report", async () => {
    const own = await get("loner", `/project-reports/${fixtureReports.A.id}`);
    const other = await get("loner", `/project-reports/${fixtureReports.B.id}`);

    assert.equal(own.status, 404);
    assert.equal(other.status, 404);
  });

  test("an administrator reads reports of any society", async () => {
    const a = await get("admin", `/project-reports/${fixtureReports.A.id}`);
    const b = await get("admin", `/project-reports/${fixtureReports.B.id}`);
    const missing = await get("admin", `/project-reports/${MISSING}`);

    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(missing.status, 404);
  });

  test("anonymous is 401", async () => {
    const res = await session.request(null, "GET", `/project-reports/${fixtureReports.A.id}`);

    assert.equal(res.status, 401);
  });
});

describe("reports by project", () => {
  test("an own-society project returns only its own society's reports", async () => {
    const res = await get("chairA", `/project-reports/project/${projects.A}`);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.deepEqual(Object.keys(res.body).sort(), ["count", "data", "success"]);
    assert.deepEqual(idsOf(res), [seeded.aProject]);
    assert.ok(!idsOf(res).includes(seeded.legacy), "a legacy foreign report leaked through its project");
  });

  test("a foreign project is 404, identical to a nonexistent one", async () => {
    const foreign = await get("chairA", `/project-reports/project/${projects.B}`);
    const missing = await get("chairA", `/project-reports/project/${MISSING}`);

    assert.equal(foreign.status, 404);
    assert.equal(foreign.body.message, "Project not found");
    assert.deepEqual(foreign.body, missing.body);
    assert.equal(foreign.body.data, undefined);
    assert.doesNotMatch(foreign.text, /B report on project B/);
  });

  test("the other society's chair reads only their own project", async () => {
    const own = await get("chairB", `/project-reports/project/${projects.B}`);
    const foreign = await get("chairB", `/project-reports/project/${projects.A}`);

    assert.deepEqual(idsOf(own), [seeded.bProject]);
    assert.equal(foreign.status, 404);
  });

  test("a malformed project id is a clean 400 for a non-admin", async () => {
    const res = await get("chairA", "/project-reports/project/not-an-object-id");

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid ID format.");
  });

  test("a caller without a society cannot use project reads to bypass scope", async () => {
    for (const projectId of [projects.A, projects.B, MISSING]) {
      const res = await get("loner", `/project-reports/project/${projectId}`);

      assert.equal(res.status, 403, projectId);
      assert.equal(res.body.data, undefined);
    }
  });

  test("an administrator keeps cross-society access", async () => {
    const b = await get("admin", `/project-reports/project/${projects.B}`);
    const a = await get("admin", `/project-reports/project/${projects.A}`);

    assert.equal(b.status, 200);
    assert.deepEqual(idsOf(b), [seeded.bProject]);
    assert.equal(a.status, 200);
    assert.deepEqual(idsOf(a).sort(), [seeded.aProject, seeded.legacy].sort());
  });

  test("anonymous is 401", async () => {
    const res = await session.request(null, "GET", `/project-reports/project/${projects.A}`);

    assert.equal(res.status, 401);
  });
});

describe("create: project and society must agree", () => {
  const assertNoReport = async (title) => assert.equal((await byTitle(title)).length, 0, "a report was created");

  test("a valid own-society report for an own-society project is created", async () => {
    const title = `valid-create-${RUN}`;

    const res = await post("chairA", newReport(title, { societyId: societies.A.id, projectId: projects.A }));

    assert.equal(res.status, 201, res.text.slice(0, 300));
    assert.equal(res.body.success, true);
    const [stored] = await byTitle(title);
    assert.equal(String(stored.societyId), societies.A.id);
    assert.equal(String(stored.projectId), projects.A);
    assert.equal(stored.status, "SUBMITTED");
  });

  test("the society still defaults to the caller's, and a report without a project is unaffected", async () => {
    const withProject = `default-society-${RUN}`;
    const withoutProject = `no-project-${RUN}`;

    const a = await post("chairA", newReport(withProject, { projectId: projects.A }));
    const b = await post("chairA", newReport(withoutProject));

    assert.equal(a.status, 201, a.text.slice(0, 300));
    assert.equal(b.status, 201, b.text.slice(0, 300));
    assert.equal(String((await byTitle(withProject))[0].societyId), societies.A.id);
    assert.equal((await byTitle(withoutProject))[0].projectId, null);
  });

  test("a non-admin cannot attach a report to another society's project", async () => {
    const title = `foreign-project-${RUN}`;
    const before = await totalReports();

    const res = await post("chairA", newReport(title, { societyId: societies.A.id, projectId: projects.B }));

    assert.equal(res.status, 400, res.text.slice(0, 300));
    assert.match(res.body.message, /Project does not belong/);
    await assertNoReport(title);
    assert.equal(await totalReports(), before);
  });

  test("a mismatch is rejected for an administrator too, in both directions", async () => {
    const before = await totalReports();
    const aOnB = `admin-a-on-b-${RUN}`;
    const bOnA = `admin-b-on-a-${RUN}`;

    const first = await post("admin", newReport(aOnB, { societyId: societies.A.id, projectId: projects.B }));
    const second = await post("admin", newReport(bOnA, { societyId: societies.B.id, projectId: projects.A }));

    assert.equal(first.status, 400, first.text.slice(0, 300));
    assert.equal(second.status, 400, second.text.slice(0, 300));
    await assertNoReport(aOnB);
    await assertNoReport(bOnA);
    assert.equal(await totalReports(), before);
  });

  test("an administrator can still create a matching report in any society", async () => {
    const title = `admin-matching-${RUN}`;

    const res = await post("admin", newReport(title, { societyId: societies.B.id, projectId: projects.B }));

    assert.equal(res.status, 201, res.text.slice(0, 300));
    assert.equal(String((await byTitle(title))[0].societyId), societies.B.id);
  });

  test("a nonexistent project is 404 and a malformed project id is 400, with nothing created", async () => {
    const before = await totalReports();

    const missing = await post("chairA", newReport(`missing-project-${RUN}`, { societyId: societies.A.id, projectId: MISSING }));
    const malformed = await post("chairA", newReport(`malformed-project-${RUN}`, { societyId: societies.A.id, projectId: "not-an-object-id" }));

    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, "Project not found");
    assert.equal(malformed.status, 400);
    assert.equal(await totalReports(), before);
  });

  test("request-supplied society values cannot bypass the checks", async () => {
    const before = await totalReports();
    const spoof = `spoof-${RUN}`;
    const foreignSociety = `foreign-society-${RUN}`;

    const claimsOwnership = await post(
      "chairA",
      newReport(spoof, {
        societyId: societies.A.id,
        projectId: projects.B,
        project: { societyId: societies.A.id },
        projectSocietyId: societies.A.id,
      }),
    );
    const otherSociety = await post(
      "chairA",
      newReport(foreignSociety, { societyId: societies.B.id, projectId: projects.B }),
    );

    assert.equal(claimsOwnership.status, 400);
    assert.equal(otherSociety.status, 403, otherSociety.text.slice(0, 300));
    await assertNoReport(spoof);
    await assertNoReport(foreignSociety);
    assert.equal(await totalReports(), before);
  });

  test("the existing permission and authentication requirements are intact", async () => {
    const before = await totalReports();
    const title = `denied-create-${RUN}`;

    const noRole = await post("loner", newReport(title, { societyId: societies.A.id, projectId: projects.A }));
    const anonymous = await session.request(null, "POST", "/project-reports", {
      body: newReport(title, { societyId: societies.A.id, projectId: projects.A }),
    });

    assert.equal(noRole.status, 403);
    assert.equal(anonymous.status, 401);
    assert.equal(await totalReports(), before);
  });

  test("the server stays healthy after the rejected requests", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});
