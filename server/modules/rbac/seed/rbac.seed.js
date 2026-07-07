require('dotenv').config();
const mongoose = require('mongoose');

const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');

// System Roles definition
const systemRoles = [
  {
    name: 'sb_faculty_advisor',
    displayName: 'SB Faculty Advisor',
    level: 'super_admin',
    scope: 'global',
    description: 'All access across every society and the entire student branch - full data, full settings'
  },
  {
    name: 'society_faculty_advisor',
    displayName: 'Society Faculty Advisor',
    level: 'faculty_advisor',
    scope: 'society',
    description: 'Full access scoped to their assigned society'
  },
  {
    name: 'society_chair',
    displayName: 'Society Chair',
    level: 'office_bearer',
    scope: 'society',
    description: 'Admin of their society: manage members/OBs, reports, finance and settings'
  },
  {
    name: 'society_vice_chair',
    displayName: 'Society Vice Chair',
    level: 'office_bearer',
    scope: 'society',
    description: 'Society vice chair with access per role and clearance level'
  },
  {
    name: 'society_secretary',
    displayName: 'Society Secretary',
    level: 'office_bearer',
    scope: 'society',
    description: 'Society secretary with access per role and clearance level'
  },
  {
    name: 'society_treasurer',
    displayName: 'Society Treasurer',
    level: 'office_bearer',
    scope: 'society',
    description: 'Society treasurer with finance-heavy administrative access'
  },
  {
    name: 'society_webmaster',
    displayName: 'Society Webmaster',
    level: 'office_bearer',
    scope: 'society',
    description: 'Society webmaster with community and tech-heavy administrative access'
  },
  {
    name: 'society_member',
    displayName: 'Society Member',
    level: 'member',
    scope: 'society',
    description: 'Society member with view and participate access within their society'
  },
  {
    name: 'sb_chair',
    displayName: 'SB Chair',
    level: 'office_bearer',
    scope: 'student_branch',
    description: 'Branch-wide chair with administrative access across the entire student branch'
  },
  {
    name: 'sb_vice_chair',
    displayName: 'SB Vice Chair',
    level: 'office_bearer',
    scope: 'student_branch',
    description: 'Branch-wide vice chair with administrative access across the student branch'
  },
  {
    name: 'sb_secretary',
    displayName: 'SB Secretary',
    level: 'office_bearer',
    scope: 'student_branch',
    description: 'Branch-wide secretary with administrative access across the student branch'
  },
  {
    name: 'sb_treasurer',
    displayName: 'SB Treasurer',
    level: 'office_bearer',
    scope: 'student_branch',
    description: 'Branch-wide treasurer with finance-heavy administrative access'
  },
  {
    name: 'sb_webmaster',
    displayName: 'SB Webmaster',
    level: 'office_bearer',
    scope: 'student_branch',
    description: 'Branch-wide webmaster with community and tech-heavy administrative access'
  },
  {
    name: 'ieee_member',
    displayName: 'IEEE Member',
    level: 'member',
    scope: 'student_branch',
    description: 'General IEEE Member with branch-wide view and participation access'
  }
];

const modules = [
  'finance',
  'events',
  'projects',
  'reports',
  'community_hub',
  'members',
  'announcements',
  'dashboard',
  'settings',
  'roles_access'
];

const actions = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'export',
  'manage_settings'
];

// Helper to define default matrix mapping
// Role Name -> Permission Key -> Access Level
const defaultMatrixMapping = {
  // Super admin gets full on all (redundant with bypass but good for completeness)
  'sb_faculty_advisor': {
    '*': 'full'
  },
  
  // Society Faculty Advisor gets limited_own_scope for most actions within their society
  'society_faculty_advisor': {
    'finance:*': 'limited_own_scope',
    'events:*': 'limited_own_scope',
    'projects:*': 'limited_own_scope',
    'reports:*': 'limited_own_scope',
    'community_hub:*': 'limited_own_scope',
    'members:*': 'limited_own_scope',
    'announcements:*': 'limited_own_scope',
    'dashboard:*': 'limited_own_scope',
    'settings:*': 'limited_own_scope',
    'roles_access:view': 'limited_own_scope'
  },

  // Society Chair is the admin of the society
  'society_chair': {
    'finance:*': 'limited_own_scope',
    'events:*': 'limited_own_scope',
    'projects:*': 'limited_own_scope',
    'reports:*': 'limited_own_scope',
    'community_hub:*': 'limited_own_scope',
    'members:*': 'limited_own_scope',
    'announcements:*': 'limited_own_scope',
    'dashboard:*': 'limited_own_scope',
    'settings:*': 'limited_own_scope',
    'roles_access:view': 'limited_own_scope'
  },

  // Society Treasurer - finance-heavy
  'society_treasurer': {
    'finance:*': 'limited_own_scope',
    'finance:approve': 'approval',
    'events:view': 'limited_own_scope',
    'events:create': 'limited_own_scope',
    'projects:view': 'limited_own_scope',
    'projects:create': 'limited_own_scope',
    'reports:view': 'limited_own_scope',
    'reports:create': 'limited_own_scope',
    'reports:approve': 'approval',
    'community_hub:view': 'limited_own_scope',
    'community_hub:create': 'limited_own_scope',
    'dashboard:view': 'limited_own_scope',
    'announcements:view': 'limited_own_scope'
  },

  // Society Webmaster - tech/community heavy
  'society_webmaster': {
    'finance:view': 'limited_own_scope',
    'events:*': 'limited_own_scope',
    'projects:*': 'limited_own_scope',
    'community_hub:*': 'limited_own_scope',
    'announcements:*': 'limited_own_scope',
    'members:view': 'limited_own_scope',
    'dashboard:view': 'limited_own_scope'
  },

  // Society Member
  'society_member': {
    'events:view': 'limited_own_scope',
    'projects:view': 'limited_own_scope',
    'community_hub:view': 'limited_own_scope',
    'community_hub:create': 'limited_own_scope',
    'announcements:view': 'limited_own_scope',
    'dashboard:view': 'limited_own_scope'
  },

  // SB Chair - full branch admin
  'sb_chair': {
    'finance:*': 'limited_own_scope',
    'events:*': 'limited_own_scope',
    'projects:*': 'limited_own_scope',
    'reports:*': 'limited_own_scope',
    'community_hub:*': 'limited_own_scope',
    'members:*': 'limited_own_scope',
    'announcements:*': 'limited_own_scope',
    'dashboard:*': 'limited_own_scope',
    'settings:*': 'limited_own_scope',
    'roles_access:view': 'limited_own_scope'
  },

  // IEEE General Member
  'ieee_member': {
    'events:view': 'limited_own_scope',
    'projects:view': 'limited_own_scope',
    'community_hub:view': 'limited_own_scope',
    'community_hub:create': 'limited_own_scope',
    'announcements:view': 'limited_own_scope',
    'dashboard:view': 'limited_own_scope'
  }
};

async function seed() {
  console.log('Connecting to database for seeding...');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ieee_finance_pro';
  
  try {
    await mongoose.connect(mongoUri);
    console.log('Database connected successfully.');

    // 1. Seed Roles
    console.log('Seeding Roles...');
    const dbRoles = {};
    for (const r of systemRoles) {
      let roleDoc = await Role.findOne({ name: r.name });
      if (!roleDoc) {
        roleDoc = new Role({
          ...r,
          isSystemRole: true
        });
        await roleDoc.save();
        console.log(`+ Created role: ${r.displayName}`);
      } else {
        // Update details if description/displayName has changed but keep isSystemRole true
        roleDoc.displayName = r.displayName;
        roleDoc.level = r.level;
        roleDoc.scope = r.scope;
        roleDoc.description = r.description;
        roleDoc.isSystemRole = true;
        await roleDoc.save();
        console.log(`* Updated role: ${r.displayName}`);
      }
      dbRoles[r.name] = roleDoc;
    }

    // 2. Seed Permissions
    console.log('Seeding Permissions...');
    const dbPermissions = {};
    for (const mod of modules) {
      for (const act of actions) {
        const key = `${mod}:${act}`;
        let permDoc = await Permission.findOne({ key });
        if (!permDoc) {
          permDoc = new Permission({
            module: mod,
            action: act,
            description: `Allows ${act} actions in ${mod} module`
          });
          await permDoc.save();
          console.log(`+ Created permission: ${key}`);
        }
        dbPermissions[key] = permDoc;
      }
    }

    // 3. Seed Role-Permissions (Matrix)
    console.log('Seeding Role-Permission Matrix...');
    let matrixCount = 0;
    for (const [roleName, mapping] of Object.entries(defaultMatrixMapping)) {
      const roleDoc = dbRoles[roleName];
      if (!roleDoc) continue;

      for (const [permPattern, level] of Object.entries(mapping)) {
        let matchingKeys = [];

        if (permPattern === '*') {
          matchingKeys = Object.keys(dbPermissions);
        } else if (permPattern.endsWith(':*')) {
          const modPrefix = permPattern.split(':')[0];
          matchingKeys = Object.keys(dbPermissions).filter(k => k.startsWith(`${modPrefix}:`));
        } else {
          matchingKeys = [permPattern];
        }

        for (const key of matchingKeys) {
          const permDoc = dbPermissions[key];
          if (!permDoc) continue;

          // Upsert role permission mapping
          await RolePermission.findOneAndUpdate(
            { role: roleDoc._id, permission: permDoc._id },
            { accessLevel: level },
            { upsert: true, new: true }
          );
          matrixCount++;
        }
      }
      console.log(`Configured matrix for role: ${roleName}`);
    }

    console.log(`Seeding completed. Total ${matrixCount} matrix mappings ensured.`);
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

// Support running the script directly from node command
if (require.main === module) {
  seed();
}

module.exports = seed;
