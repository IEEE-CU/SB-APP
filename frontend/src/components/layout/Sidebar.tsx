import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Calendar,
  FolderKanban,
  FileText,
  Megaphone,
  MessageCircle,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", module: null },
  {
    to: "/societies",
    icon: Building2,
    label: "Societies",
    module: "societies",
  },
  { to: "/events", icon: Calendar, label: "Events", module: "events" },
  {
    to: "/projects",
    icon: FolderKanban,
    label: "Projects",
    module: "projects",
  },
  { to: "/reports", icon: FileText, label: "Reports", module: "reports" },
  {
    to: "/announcements",
    icon: Megaphone,
    label: "Announcements",
    module: "announcements",
  },
  {
    to: "/community",
    icon: MessageCircle,
    label: "Community Hub",
    module: "community",
  },
];

const adminItems = [
  { to: "/admin/users", icon: Users, label: "Users", module: "users" },
];

const levels: Record<string, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
  superadmin: 4,
};

export default function Sidebar({
  isOpen = false,
  onClose: _onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const { user, permissions } = useAuthStore();

  const canAccess = (module: string | null) => {
    if (!module) return true;
    const perm = permissions.find((p) => p.module === module);
    return (levels[perm?.accessLevel || "none"] || 0) >= 1;
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-body-sm transition-all duration-200 group ${
      isActive
        ? "bg-primary/10 text-primary font-semibold"
        : "text-ink-secondary hover:bg-canvas-soft hover:text-ink"
    }`;

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 w-[240px] bg-surface/95 lg:bg-surface/60 backdrop-blur-xl border-r border-hairline/50 flex flex-col py-6 shadow-xl lg:shadow-sm z-50 transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <nav className="flex flex-col gap-1.5 px-4 flex-1 overflow-y-auto">
        {navItems.map((item) =>
          canAccess(item.module) ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={linkClass}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-md"></span>
                  )}
                  <item.icon
                    size={18}
                    className={
                      isActive
                        ? "text-primary"
                        : "text-ink-muted group-hover:text-ink-secondary transition-colors"
                    }
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ) : null,
        )}

        {adminItems.some((item) => canAccess(item.module)) && (
          <div className="mt-6 pt-4 border-t border-hairline/60">
            <p className="text-eyebrow font-bold tracking-wider text-ink-faint uppercase px-4 mb-2">
              Admin
            </p>
            {adminItems.map((item) =>
              canAccess(item.module) ? (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-md"></span>
                      )}
                      <item.icon
                        size={18}
                        className={
                          isActive
                            ? "text-primary"
                            : "text-ink-muted group-hover:text-ink-secondary transition-colors"
                        }
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ) : null,
            )}
          </div>
        )}
      </nav>

      {/* User Info Badge at the bottom */}
      <div className="px-4 mt-auto">
        <div className="p-3 bg-canvas-soft/80 border border-hairline/60 rounded-xl flex items-center gap-3 shadow-soft-1">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-caption uppercase flex-shrink-0">
            {user?.name?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-semibold text-ink truncate">
              {user?.name || "User"}
            </p>
            <p className="text-[11px] text-ink-muted truncate capitalize">
              {user?.roleId || "Member"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
