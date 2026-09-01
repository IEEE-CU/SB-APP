import { useAuthStore } from "@/store/authStore";
import type { AccessLevel } from "@/types/models";
import { meetsRequiredLevel } from "@/lib/permissionLevels";

export function usePermissions() {
  const { permissions, fetchPermissions, userRole, user } = useAuthStore();

  const effectiveRole = userRole || (user as any)?.role || "user";

  const getAccessLevel = (module: string): AccessLevel => {
    const perm = permissions.find((p) => p.module === module);
    if (perm?.accessLevel) return perm.accessLevel;
    // Removed insecure fallback
    return "read";
  };

  const hasAccess = (module: string, action: string = "read"): boolean => {
    const userAccessLevel = getAccessLevel(module);
    return meetsRequiredLevel(userAccessLevel, action, effectiveRole);
  };

  return { permissions, getAccessLevel, hasAccess, fetchPermissions, userRole: effectiveRole };
}

