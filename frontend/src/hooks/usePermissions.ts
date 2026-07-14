import { useAuthStore } from "@/store/authStore";
import type { AccessLevel } from "@/types/models";
import { ACCESS_LEVELS } from "@/lib/permissionLevels";

export function usePermissions() {
  const { permissions, fetchPermissions } = useAuthStore();

  const getAccessLevel = (module: string): AccessLevel => {
    const perm = permissions.find((p) => p.module === module);
    return perm?.accessLevel || "none";
  };

  const hasAccess = (module: string, action: string = "read"): boolean => {
    const userLevel = ACCESS_LEVELS[getAccessLevel(module)] || 0;
    const requiredLevel = ACCESS_LEVELS[action] || 1;
    return userLevel >= requiredLevel;
  };

  return { permissions, getAccessLevel, hasAccess, fetchPermissions };
}
