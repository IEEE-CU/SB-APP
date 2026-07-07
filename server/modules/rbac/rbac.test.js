const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../app');
const User = require('../../models/User');
const Society = require('../../models/Society');
const Role = require('./models/Role');
const Permission = require('./models/Permission');
const RolePermission = require('./models/RolePermission');
const UserRole = require('./models/UserRole');
const AuditLog = require('./models/AuditLog');

const { generateToken } = require('../../middleware/auth');
const { resolvePermissions } = require('./services/resolvePermissions');

let mongoServer;

// Shared test data
let superAdminUser, treasurerUser, memberUser;
let superAdminToken, treasurerToken, memberToken;
let societyA, societyB;
let viewRolesPerm, createRolesPerm, viewFinancePerm, createFinancePerm;

beforeAll(async () => {
  // Start Mongo Memory Server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // 1. Seed Roles
  const sbFacultyAdvisorRole = await Role.create({
    name: 'sb_faculty_advisor',
    displayName: 'SB Faculty Advisor',
    level: 'super_admin',
    scope: 'global',
    isSystemRole: true
  });

  const treasurerRole = await Role.create({
    name: 'society_treasurer',
    displayName: 'Society Treasurer',
    level: 'office_bearer',
    scope: 'society',
    isSystemRole: true
  });

  const ieeeMemberRole = await Role.create({
    name: 'ieee_member',
    displayName: 'IEEE Member',
    level: 'member',
    scope: 'student_branch',
    isSystemRole: true
  });

  // 2. Seed Permissions
  viewRolesPerm = await Permission.create({
    module: 'roles_access',
    action: 'view',
    description: 'View roles'
  });
  
  createRolesPerm = await Permission.create({
    module: 'roles_access',
    action: 'create',
    description: 'Create roles'
  });

  viewFinancePerm = await Permission.create({
    module: 'finance',
    action: 'view',
    description: 'View finance'
  });

  createFinancePerm = await Permission.create({
    module: 'finance',
    action: 'create',
    description: 'Create finance transaction'
  });

  // 3. Seed Role-Permissions Matrix
  await RolePermission.create({
    role: treasurerRole._id,
    permission: viewFinancePerm._id,
    accessLevel: 'limited_own_scope'
  });

  await RolePermission.create({
    role: treasurerRole._id,
    permission: createFinancePerm._id,
    accessLevel: 'limited_own_scope'
  });

  // 4. Seed Societies
  societyA = await Society.create({ name: 'Computer Society', code: 'CS', description: 'IEEE CS' });
  societyB = await Society.create({ name: 'Robotics & Automation Society', code: 'RAS', description: 'IEEE RAS' });

  // 5. Seed Users
  superAdminUser = await User.create({ name: 'Admin Advisor', email: 'advisor@ieee.org', password: 'password123' });
  treasurerUser = await User.create({ name: 'Treasurer Bob', email: 'bob@ieee.org', password: 'password123' });
  memberUser = await User.create({ name: 'Member Charlie', email: 'charlie@ieee.org', password: 'password123' });

  // 6. Assign User Roles
  await UserRole.create({
    user: superAdminUser._id,
    role: sbFacultyAdvisorRole._id,
    assignedBy: superAdminUser._id
  });

  await UserRole.create({
    user: treasurerUser._id,
    role: treasurerRole._id,
    society: societyA._id,
    assignedBy: superAdminUser._id
  });

  await UserRole.create({
    user: memberUser._id,
    role: ieeeMemberRole._id,
    assignedBy: superAdminUser._id
  });

  // 7. Generate Tokens
  superAdminToken = generateToken(superAdminUser);
  treasurerToken = generateToken(treasurerUser);
  memberToken = generateToken(memberUser);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('RBAC System Test Suite', () => {
  
  describe('Security & Route Protection', () => {
    
    it('should block requests without a token (401)', async () => {
      const res = await request(app)
        .get('/api/v1/roles');
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should block requests with an invalid token (401)', async () => {
      const res = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', 'Bearer invalid_token_here');
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should block access for roles without specific permissions (403)', async () => {
      // General member Charlie tries to view roles
      const res = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${memberToken}`);
      
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('Super Admin (Advisor) Bypass', () => {
    it('should allow super admin to view roles even without role permission in matrix', async () => {
      const res = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should resolve full permissions for Super Admin for all module actions', async () => {
      const res = await request(app)
        .get('/api/v1/user/permissions')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('sb_faculty_advisor');
      expect(res.body.data.scope.type).toBe('global');
      expect(res.body.data.permissions['finance:create']).toBe('full');
      expect(res.body.data.permissions['roles_access:create']).toBe('full');
    });
  });

  describe('Role & Permission Mapping (Treasurer)', () => {
    it('should allow Society Treasurer to access finance endpoints', async () => {
      const res = await request(app)
        .post('/api/v1/access/check')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          userId: treasurerUser._id,
          module: 'finance',
          action: 'create'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.allowed).toBe(true);
      expect(res.body.data.accessLevel).toBe('limited_own_scope');
    });

    it('should block Treasurer from settings module (which is none by default)', async () => {
      const res = await request(app)
        .post('/api/v1/access/check')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          userId: treasurerUser._id,
          module: 'settings',
          action: 'manage_settings'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.allowed).toBe(false);
      expect(res.body.data.accessLevel).toBe('none');
    });
  });

  describe('Scope Isolation between Societies', () => {
    it('should return society scope metadata for Treasurer User in permissions response', async () => {
      const res = await request(app)
        .get('/api/v1/user/permissions')
        .set('Authorization', `Bearer ${treasurerToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('society_treasurer');
      expect(res.body.data.scope.type).toBe('society');
      expect(res.body.data.scope.societyId).toBe(societyA._id.toString());
      expect(res.body.data.permissions.finance).toBe('limited_own_scope');
    });
  });

  describe('Audit Logging Verification', () => {
    it('should log audit entries on successful access check', async () => {
      await AuditLog.deleteMany({});

      await request(app)
        .post('/api/v1/access/check')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .send({
          userId: treasurerUser._id,
          module: 'finance',
          action: 'view'
        });

      const audit = await AuditLog.findOne({ user: treasurerUser._id, module: 'finance' });
      expect(audit).toBeDefined();
      expect(audit.result).toBe('allowed');
      expect(audit.reason).toContain('granted');
    });

    it('should log audit entries on denied access attempts', async () => {
      await request(app)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${memberToken}`);

      const audit = await AuditLog.findOne({ user: memberUser._id, module: 'roles_access', result: 'denied' });
      expect(audit).toBeDefined();
      expect(audit.reason).toContain('Insufficient permission');
    });
  });

  describe('Permission Matrix Upsert', () => {
    it('should update access levels in the matrix dynamically without redeployment', async () => {
      let chResBefore = await resolvePermissions(memberUser._id, true);
      expect(chResBefore.permissions['finance:create']).toBe('none');

      const matrixRes = await request(app)
        .post('/api/v1/role-permissions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          role: 'ieee_member',
          permission: 'finance:create',
          accessLevel: 'full'
        });

      expect(matrixRes.status).toBe(200);
      expect(matrixRes.body.success).toBe(true);
      expect(matrixRes.body.data.accessLevel).toBe('full');

      let chResAfter = await resolvePermissions(memberUser._id, true);
      expect(chResAfter.permissions['finance:create']).toBe('full');
    });
  });

  describe('Role Deletion Protection', () => {
    it('should block deletion of a system role', async () => {
      const systemRole = await Role.findOne({ name: 'sb_faculty_advisor' });
      expect(systemRole).toBeDefined();

      let err = null;
      try {
        await Role.deleteOne({ _id: systemRole._id });
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.message).toContain('Cannot delete a system role');
    });

    it('should allow deletion of a custom non-system role', async () => {
      const customRole = await Role.create({
        name: 'custom_guest_role',
        displayName: 'Custom Guest',
        level: 'member',
        scope: 'none',
        isSystemRole: false
      });

      let err = null;
      try {
        await Role.deleteOne({ _id: customRole._id });
      } catch (e) {
        err = e;
      }

      expect(err).toBeNull();
      
      const checkDoc = await Role.findById(customRole._id);
      expect(checkDoc).toBeNull();
    });
  });

  describe('Serialization Layers', () => {
    it('should serialize _id to id in responses and remove __v', async () => {
      const res = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      
      const role = res.body.data[0];
      expect(role.id).toBeDefined();
      expect(role._id).toBeUndefined();
      expect(role.__v).toBeUndefined();
    });
  });
});
