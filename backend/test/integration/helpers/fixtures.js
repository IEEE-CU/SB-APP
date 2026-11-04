"use strict";

/**
 * Constants and disposable fixtures for the isolated integration harness.
 *
 * Everything here is test-only. The credentials are fixed, well-known test
 * values that only ever exist inside the harness's in-memory database; they
 * are never printed and never written to the readiness file.
 *
 * This module has no top-level dependency on mongoose or the application, so
 * the launcher process can load the constants without touching either.
 */

const HARNESS_HOST = "127.0.0.1";
const HARNESS_PORT = 5057;
const HARNESS_DB_NAME = "sbapp_integration";
const MONGOD_VERSION = "7.0.24";

// Test-only values (not used by any other configuration).
const TEST_JWT_SECRET = "sbapp-integration-harness-secret-not-for-any-other-use";
const TEST_PASSWORD = "Integration-Test-Pw-2026!"; // >= 15 chars (registration rule)

// Users created for later integration tests. `society` refers to SOCIETIES.
const USERS = {
  admin: {
    email: "admin@integration.test",
    name: "Integration Admin",
    role: "ADMIN",
    society: null,
    roleName: "sb_faculty_advisor",
  },
  chairA: {
    email: "chair.a@integration.test",
    name: "Integration Chair A",
    role: "OFFICE_BEARER",
    society: "A",
    roleName: "society_chair",
  },
  chairB: {
    email: "chair.b@integration.test",
    name: "Integration Chair B",
    role: "OFFICE_BEARER",
    society: "B",
    roleName: "society_chair",
  },
  memberA: {
    email: "member.a@integration.test",
    name: "Integration Member A",
    role: "OFFICE_BEARER",
    society: "A",
    roleName: "ieee_member",
  },
  loner: {
    email: "loner@integration.test",
    name: "Integration Loner",
    role: "OFFICE_BEARER",
    society: null,
    roleName: null, // no society and no RBAC role
  },
};

const SOCIETIES = {
  A: { name: "Integration Society A", shortName: "ITA" },
  B: { name: "Integration Society B", shortName: "ITB" },
};

// Mirrors the semantics of the roles used by the application's seed matrix:
// the advisor is global and gets every permission from the resolver; society
// chairs hold limited_own_scope on the hub/report/event/project/announcement
// modules; members get hub view/create only.
const ROLES = [
  {
    name: "sb_faculty_advisor",
    displayName: "SB Faculty Advisor",
    level: "super_admin",
    scope: "global",
  },
  {
    name: "society_chair",
    displayName: "Society Chair",
    level: "office_bearer",
    scope: "society",
  },
  {
    name: "ieee_member",
    displayName: "IEEE Member",
    level: "member",
    scope: "society",
  },
];

const PERMISSION_MODULES = [
  "community_hub",
  "reports",
  "events",
  "projects",
  "announcements",
];
const PERMISSION_ACTIONS = ["view", "create", "edit", "delete"];

const chairGrants = () =>
  PERMISSION_MODULES.flatMap((module) =>
    PERMISSION_ACTIONS.map((action) => `${module}:${action}`),
  );
const MEMBER_GRANTS = ["community_hub:view", "community_hub:create"];

const officeBearers = (label) => [
  {
    name: `${label} Chair`,
    position: "Chair",
    email: `chair@${label.toLowerCase()}.integration.test`,
    phone: `+1-555-0100-${label}`,
    termYear: 2026,
  },
  {
    name: `${label} Secretary`,
    position: "Secretary",
    email: `secretary@${label.toLowerCase()}.integration.test`,
    phone: `+1-555-0200-${label}`,
    termYear: 2026,
  },
];

const members = (label) => [
  {
    ieeeId: `IT-${label}-0001`,
    name: `${label} Member One`,
    email: `member1@${label.toLowerCase()}.integration.test`,
    contactNumber: `+1-555-0300-${label}`,
    grade: "Student",
  },
  {
    ieeeId: `IT-${label}-0002`,
    name: `${label} Member Two`,
    email: `member2@${label.toLowerCase()}.integration.test`,
    contactNumber: `+1-555-0400-${label}`,
    grade: "Graduate Student",
  },
];

/**
 * Creates the minimum records later integration tests need: two societies,
 * users with society-scoped RBAC roles, the permission matrix they depend on,
 * one project report and one channel per society, and one conversation.
 *
 * @param {object} models - { User, Society, Role, Permission, RolePermission,
 *   UserRole, Channel, Conversation, ProjectReport }
 * @returns {Promise<object>} Identifiers only (no credentials).
 */
async function createFixtures(models) {
  const {
    User,
    Society,
    Role,
    Permission,
    RolePermission,
    UserRole,
    Channel,
    Conversation,
    ProjectReport,
  } = models;

  // Societies
  const societies = {};
  for (const [key, def] of Object.entries(SOCIETIES)) {
    societies[key] = await Society.create({
      name: def.name,
      shortName: def.shortName,
      description: `${def.name} (integration fixture)`,
      type: "SOCIETY",
      budget: 1000,
      officeBearers: officeBearers(def.shortName),
      members: members(def.shortName),
    });
  }

  // RBAC: roles, permissions, role-permissions
  const roles = {};
  for (const def of ROLES) {
    roles[def.name] = await Role.create({
      ...def,
      description: "Integration harness fixture role",
      isSystemRole: false,
    });
  }

  const permissions = {};
  for (const module of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      const doc = await Permission.create({ module, action });
      permissions[`${module}:${action}`] = doc;
    }
  }

  const grant = async (roleName, keys) => {
    for (const key of keys) {
      await RolePermission.create({
        role: roles[roleName]._id,
        permission: permissions[key]._id,
        accessLevel: "limited_own_scope",
      });
    }
  };
  await grant("society_chair", chairGrants());
  await grant("ieee_member", MEMBER_GRANTS);

  // Users + their RBAC assignment
  const users = {};
  for (const [key, def] of Object.entries(USERS)) {
    users[key] = await User.create({
      email: def.email,
      password: TEST_PASSWORD,
      name: def.name,
      role: def.role,
      societyId: def.society ? societies[def.society]._id : null,
    });
  }
  for (const [key, def] of Object.entries(USERS)) {
    if (!def.roleName) continue;
    await UserRole.create({
      user: users[key]._id,
      role: roles[def.roleName]._id,
      society: def.society ? societies[def.society]._id : null,
      assignedBy: users.admin._id,
    });
  }

  // One channel and one project report per society
  const channels = {};
  const reports = {};
  for (const key of Object.keys(SOCIETIES)) {
    channels[key] = await Channel.create({
      name: "general",
      societyId: societies[key]._id,
      type: "chat",
    });
    reports[key] = await ProjectReport.create({
      societyId: societies[key]._id,
      title: `Society ${key} integration report`,
      description: "Fixture report used by authorization tests",
      type: "general",
      status: "SUBMITTED",
    });
  }

  // A direct conversation between chair A and member A (same society)
  const [first, second] = [users.chairA._id, users.memberA._id].sort((a, b) =>
    String(a) < String(b) ? -1 : 1,
  );
  const conversation = await Conversation.create({
    societyId: societies.A._id,
    userOneId: first,
    userTwoId: second,
  });

  const id = (doc) => String(doc._id);
  return {
    societies: Object.fromEntries(
      Object.entries(societies).map(([k, v]) => [k, { id: id(v), name: v.name }]),
    ),
    users: Object.fromEntries(
      Object.entries(users).map(([k, v]) => [
        k,
        { id: id(v), email: USERS[k].email, role: USERS[k].role },
      ]),
    ),
    channels: Object.fromEntries(
      Object.entries(channels).map(([k, v]) => [k, { id: id(v), name: v.name }]),
    ),
    reports: Object.fromEntries(
      Object.entries(reports).map(([k, v]) => [k, { id: id(v) }]),
    ),
    conversation: { id: id(conversation) },
  };
}

module.exports = {
  HARNESS_HOST,
  HARNESS_PORT,
  HARNESS_DB_NAME,
  MONGOD_VERSION,
  TEST_JWT_SECRET,
  TEST_PASSWORD,
  USERS,
  SOCIETIES,
  createFixtures,
};
