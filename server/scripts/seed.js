require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');

// Import Models
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const Society = require('../models/Society');
const Membership = require('../models/Membership');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting Database Seeding...');
    
    // Connect to database
    await connectDB();

    // 1. Seed Roles (Idempotent)
    const rolesData = [
      { name: 'super_admin', description: 'System-wide administrator with full access' },
      { name: 'society_chair', description: 'Chair of a specific IEEE society' },
      { name: 'society_treasurer', description: 'Treasurer of a specific IEEE society' },
      { name: 'member', description: 'General member of a society' }
    ];

    const roles = {};
    for (const r of rolesData) {
      const role = await Role.findOneAndUpdate(
        { name: r.name },
        r,
        { new: true, upsert: true }
      );
      roles[r.name] = role;
      console.log(`✓ Role: ${r.name}`);
    }

    // 2. Seed Permissions (Idempotent)
    const modules = ['finance', 'events', 'projects', 'reports', 'announcements', 'users'];
    const actions = ['create', 'view', 'update', 'delete', 'approve'];
    
    const permissions = [];
    for (const mod of modules) {
      for (const act of actions) {
        // Skip irrelevant combinations
        if (mod !== 'finance' && mod !== 'reports' && act === 'approve') continue;
        
        const permData = {
          module: mod,
          action: act,
          description: `${act.toUpperCase()} action on ${mod.toUpperCase()} module`
        };
        
        const permission = await Permission.findOneAndUpdate(
          { module: mod, action: act },
          permData,
          { new: true, upsert: true }
        );
        permissions.push(permission);
      }
    }
    console.log(`✓ Permissions seeded: ${permissions.length} items`);

    // 3. Seed RolePermission Mappings (Idempotent)
    console.log('Setting up Role-Permission mappings...');
    
    // Helper to map permissions
    const mapRolePermissions = async (roleName, rules) => {
      const role = roles[roleName];
      for (const perm of permissions) {
        let accessLevel = 'none';
        
        if (roleName === 'super_admin') {
          accessLevel = 'all';
        } else if (rules[perm.module]) {
          const rule = rules[perm.module];
          if (typeof rule === 'string') {
            accessLevel = rule;
          } else if (rule[perm.action]) {
            accessLevel = rule[perm.action];
          }
        }

        await RolePermission.findOneAndUpdate(
          { roleId: role.id, permissionId: perm.id },
          { roleId: role.id, permissionId: perm.id, accessLevel },
          { new: true, upsert: true }
        );
      }
      console.log(`✓ Mapped permissions for ${roleName}`);
    };

    // Define rules for society_chair
    const chairRules = {
      finance: { create: 'society', view: 'society', update: 'society', delete: 'own', approve: 'society' },
      events: 'society',
      projects: 'society',
      reports: 'society',
      announcements: 'society',
      users: { view: 'society' }
    };

    // Define rules for society_treasurer
    const treasurerRules = {
      finance: 'society', // can approve, create, update, delete within society
      events: { view: 'society', create: 'society', update: 'society' },
      projects: { view: 'society' },
      reports: 'society',
      announcements: { view: 'society', create: 'society' },
      users: { view: 'society' }
    };

    // Define rules for member
    const memberRules = {
      finance: { create: 'own', view: 'own' },
      events: { view: 'society' },
      projects: { view: 'society' },
      reports: { view: 'society', create: 'own' },
      announcements: { view: 'society' },
      users: { view: 'society' }
    };

    await mapRolePermissions('super_admin', {});
    await mapRolePermissions('society_chair', chairRules);
    await mapRolePermissions('society_treasurer', treasurerRules);
    await mapRolePermissions('member', memberRules);

    // 4. Seed Societies (Idempotent)
    const societiesData = [
      { name: 'IEEE Computer Society', code: 'IEEE-CS', description: 'Advancing technology for computing' },
      { name: 'IEEE Power & Energy Society', code: 'IEEE-PES', description: 'Powering the future responsibly' },
      { name: 'IEEE Women in Engineering', code: 'IEEE-WIE', description: 'Promoting women engineers and scientists' }
    ];

    const societies = {};
    for (const s of societiesData) {
      const soc = await Society.findOneAndUpdate(
        { code: s.code },
        s,
        { new: true, upsert: true }
      );
      societies[s.code] = soc;
      console.log(`✓ Society: ${s.name} (${s.code})`);
    }

    // 5. Seed Users (Idempotent)
    const passwordHash = await bcrypt.hash('password123', 12);
    const usersData = [
      { email: 'admin@ieee.org', name: 'Super Admin', passwordHash, role: 'super_admin' },
      { email: 'cs.chair@ieee.org', name: 'CS Chair User', passwordHash, role: 'society_chair', society: 'IEEE-CS' },
      { email: 'cs.treasurer@ieee.org', name: 'CS Treasurer User', passwordHash, role: 'society_treasurer', society: 'IEEE-CS' },
      { email: 'pes.chair@ieee.org', name: 'PES Chair User', passwordHash, role: 'society_chair', society: 'IEEE-PES' },
      { email: 'member1@ieee.org', name: 'CS Member Alice', passwordHash, role: 'member', society: 'IEEE-CS' },
      { email: 'member2@ieee.org', name: 'PES Member Bob', passwordHash, role: 'member', society: 'IEEE-PES' }
    ];

    for (const u of usersData) {
      const user = await User.findOneAndUpdate(
        { email: u.email },
        { name: u.name, email: u.email, passwordHash, isActive: true },
        { new: true, upsert: true }
      );
      console.log(`✓ User: ${u.name} (${u.email})`);

      // Seed membership if user is assigned to a role and a society
      if (u.role && u.society) {
        const role = roles[u.role];
        const society = societies[u.society];
        
        await Membership.findOneAndUpdate(
          { userId: user.id, societyId: society.id },
          { userId: user.id, societyId: society.id, roleId: role.id, status: 'active' },
          { new: true, upsert: true }
        );
        console.log(`   └─ Membership: ${u.role} in ${u.society}`);
      }
    }

    console.log('✅ Database Seeding Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error Seeding Database:', error);
    process.exit(1);
  }
};

seedDatabase();
