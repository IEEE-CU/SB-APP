import { ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";
import { ACCESS_LEVELS } from "@/lib/permissionLevels";

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
  const { permissions } = useAuthStore();
  const perm = permissions.find((p) => p.module === module);
  const userLevel = ACCESS_LEVELS[perm?.accessLevel || "none"] || 0;
  const requiredLevel = ACCESS_LEVELS[action] || 1;

  return userLevel >= requiredLevel ? <>{children}</> : <>{fallback}</>;
}
