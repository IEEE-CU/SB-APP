import { ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';

interface PermissionGateProps {
  module: string;
  action?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

const levels: Record<string, number> = {
  none: 0,
  read: 1,
  write: 2,
  create: 2,
  delete: 3,
  admin: 3,
  superadmin: 4,
};

export default function PermissionGate({
  module,
  action = 'read',
  children,
  fallback = null,
}: PermissionGateProps) {
  const { permissions } = useAuthStore();
  const perm = permissions.find((p) => p.module === module);
  const userLevel = levels[perm?.accessLevel || 'none'] || 0;
  const requiredLevel = levels[action] || 1;

  return userLevel >= requiredLevel ? <>{children}</> : <>{fallback}</>;
}
