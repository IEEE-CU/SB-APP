/**
 * Shared permission level hierarchy used across PermissionGate, ProtectedRoute, and usePermissions.
 * Maps access level names to numeric priority for comparison.
 */
export const ACCESS_LEVELS: Record<string, number> = {
  none: 0,
  read: 1,
  write: 2,
  create: 2,
  delete: 3,
  admin: 3,
  superadmin: 4,
};

export const ADMIN_ROLES = [
  "admin",
  "superadmin",
  "chair",
  "vice_chair",
  "president",
  "board_member",
];

export function meetsRequiredLevel(
  userAccessLevel: string,
  requiredAction: string,
  userRole?: string
): boolean {
  if (userRole && ADMIN_ROLES.includes(userRole.toLowerCase())) {
    return true;
  }
  const userLevel = ACCESS_LEVELS[userAccessLevel] || 0;
  const requiredLevel = ACCESS_LEVELS[requiredAction] || 1;
  return userLevel >= requiredLevel;
}

