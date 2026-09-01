import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { usePermissions } from "@/hooks/usePermissions";

interface ProtectedRouteProps {
  requiredModule?: string;
  requiredAction?: string;
}

export default function ProtectedRoute({
  requiredModule,
  requiredAction = "read",
}: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore();
  const { hasAccess } = usePermissions();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (requiredModule) {
    const allowed = hasAccess(requiredModule, requiredAction);
    if (!allowed) return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

