import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { ACCESS_LEVELS } from "@/lib/permissionLevels";

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
    const userLevel = ACCESS_LEVELS[perm?.accessLevel || "none"] || 0;
    const needLevel = ACCESS_LEVELS[requiredAction] || 1;
    if (userLevel < needLevel) return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
