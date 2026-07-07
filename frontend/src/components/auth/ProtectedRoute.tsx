import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  requiredModule?: string;
  requiredAction?: string;
}

export default function ProtectedRoute({
  requiredModule,
  requiredAction,
}: ProtectedRouteProps) {
  const { isAuthenticated, permissions } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (requiredModule && requiredAction) {
    const perm = permissions.find((p) => p.module === requiredModule);
    const levels: Record<string, number> = {
      none: 0,
      read: 1,
      write: 2,
      admin: 3,
      superadmin: 4,
    };
    const required: Record<string, number> = {
      read: 1,
      write: 2,
      create: 2,
      delete: 3,
      admin: 3,
    };
    const userLevel = levels[perm?.accessLevel || 'none'] || 0;
    const needLevel = levels[requiredAction] || required[requiredAction] || 1;
    if (userLevel < needLevel) return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
