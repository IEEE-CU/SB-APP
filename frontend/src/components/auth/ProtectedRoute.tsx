import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { usePermissions } from "@/hooks/usePermissions";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
  requiredModule?: string;
  requiredAction?: string;
}

export default function ProtectedRoute({
  requiredModule,
  requiredAction = "read",
}: ProtectedRouteProps) {
  const { isAuthenticated, fetchPermissions } = useAuthStore();
  const { hasAccess } = usePermissions();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (isAuthenticated) {
      fetchPermissions().finally(() => {
        if (mounted) setIsVerifying(false);
      });
    } else {
      setIsVerifying(false);
    }
    return () => { mounted = false; };
  }, [isAuthenticated, fetchPermissions]);

  if (isVerifying) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-canvas">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (requiredModule) {
    const allowed = hasAccess(requiredModule, requiredAction);
    if (!allowed) return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

