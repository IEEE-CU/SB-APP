import { useAuthStore } from '@/store/authStore';
import type { AccessLevel } from '@/types/models';

export function usePermissions() {
  const { permissions, fetchPermissions } = useAuthStore();

  const getAccessLevel = (module: string): AccessLevel => {
    const perm = permissions.find((p) => p.module === module);
    return perm?.accessLevel || 'none';
  };

  const hasAccess = (module: string, action: string = 'read'): boolean => {
    const levels: Record<string, number> = {
      none: 0,
      read: 1,
      write: 2,
      create: 2,
      delete: 3,
      admin: 3,
      superadmin: 4,
    };
    const userLevel = levels[getAccessLevel(module)] || 0;
    const requiredLevel = levels[action] || 1;
    return userLevel >= requiredLevel;
  };

  return { permissions, getAccessLevel, hasAccess, fetchPermissions };
}
