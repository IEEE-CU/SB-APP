const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const RolePermission = require('../models/RolePermission');
const Permission = require('../models/Permission');

// In-memory cache
const cache = new Map();
const CACHE_TTL_MS = 10000; // 10 seconds

/**
 * Maps access level strings to numerical priority for calculating the highest level.
 */
const ACCESS_LEVEL_PRIORITY = {
  'full': 4,
  'limited_own_scope': 3,
  'approval': 2,
  'none': 1
};

/**
 * Resolves the effective permission set for a user.
 * 
 * @param {string} userId - The user ID to resolve permissions for.
 * @param {boolean} bypassCache - If true, bypasses the in-memory cache.
 * @returns {Promise<Object>} The resolved permissions object.
 */
async function resolvePermissions(userId, bypassCache = false) {
  if (!userId) {
    return getGuestPermissions();
  }

  const cacheKey = userId.toString();
  if (!bypassCache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 1. Look up user's assigned role
  const userRole = await UserRole.findOne({ user: userId })
    .populate('role')
    .populate('society');

  if (!userRole || !userRole.role) {
    const guestPerms = getGuestPermissions();
    setCache(cacheKey, guestPerms);
    return guestPerms;
  }

  const role = userRole.role;
  const scopeType = role.scope;
  const societyId = userRole.society ? userRole.society._id.toString() : null;

  const resolved = {
    role: role.name,
    scope: {
      type: scopeType,
      societyId: societyId
    },
    permissions: {}
  };

  // 2. SB Faculty Advisor bypass (super_admin)
  if (role.name === 'sb_faculty_advisor' || role.level === 'super_admin') {
    const allPermissions = await Permission.find({});
    
    // Super admin gets 'full' access for every permission
    allPermissions.forEach(perm => {
      resolved.permissions[perm.key] = 'full';
    });

    // Also populate module-level shortcuts as 'full'
    const modules = [...new Set(allPermissions.map(p => p.module))];
    modules.forEach(mod => {
      resolved.permissions[mod] = 'full';
    });

    setCache(cacheKey, resolved);
    return resolved;
  }

  // 3. Otherwise, fetch all RolePermission entries for that role
  const rolePermissions = await RolePermission.find({ role: role._id })
    .populate('permission');

  // Group by module to calculate highest level per module
  const moduleHighest = {};

  // Initialize all permissions with 'none'
  const allPermissions = await Permission.find({});
  allPermissions.forEach(perm => {
    resolved.permissions[perm.key] = 'none';
  });

  rolePermissions.forEach(rp => {
    if (rp.permission) {
      const key = rp.permission.key || `${rp.permission.module}:${rp.permission.action}`;
      const level = rp.accessLevel;
      
      resolved.permissions[key] = level;

      // Track highest level per module
      const mod = rp.permission.module;
      const currentPriority = ACCESS_LEVEL_PRIORITY[level] || 0;
      const existingHighest = moduleHighest[mod];
      const existingPriority = ACCESS_LEVEL_PRIORITY[existingHighest] || 0;

      if (currentPriority > existingPriority) {
        moduleHighest[mod] = level;
      }
    }
  });

  // Populate module level keys
  Object.keys(moduleHighest).forEach(mod => {
    resolved.permissions[mod] = moduleHighest[mod];
  });

  // Ensure every module has a default value (like 'none') if not set
  const allModules = [...new Set(allPermissions.map(p => p.module))];
  allModules.forEach(mod => {
    if (!resolved.permissions[mod]) {
      resolved.permissions[mod] = 'none';
    }
  });

  setCache(cacheKey, resolved);
  return resolved;
}

/**
 * Set cache entry
 */
function setCache(key, data) {
  cache.set(key, {
    timestamp: Date.now(),
    data: data
  });
}

/**
 * Clear the permissions cache for a specific user, or clear everything.
 * Call this when user roles or role permissions are updated.
 */
function invalidateCache(userId) {
  if (userId) {
    cache.delete(userId.toString());
  } else {
    cache.clear();
  }
}

/**
 * Returns default guest permissions.
 */
function getGuestPermissions() {
  return {
    role: 'guest',
    scope: {
      type: 'none',
      societyId: null
    },
    permissions: {}
  };
}

module.exports = {
  resolvePermissions,
  invalidateCache
};
