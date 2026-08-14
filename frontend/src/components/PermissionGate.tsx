import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionGateProps {
  module: string;
  action?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function PermissionGate({
  module,
  action = "read",
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasAccess } = usePermissions();
  const allowed = hasAccess(module, action);

  return allowed ? <>{children}</> : <>{fallback}</>;
}

