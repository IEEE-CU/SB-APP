import type { AccessLevel } from '@/types/models';

const LEVEL_ORDER: Record<AccessLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
  superadmin: 4,
};

export function hasAccess(userLevel: AccessLevel, requiredLevel: AccessLevel): boolean {
  return LEVEL_ORDER[userLevel] >= LEVEL_ORDER[requiredLevel];
}
