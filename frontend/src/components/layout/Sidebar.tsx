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
  Settings,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";

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
  isDesktopOpen = true,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  isDesktopOpen?: boolean;
}) {
  const { user, permissions } = useAuthStore();
  const { uiOpacity } = useThemeStore();

  const canAccess = (module: string | null) => {
    if (!module) return true;
    const perm = permissions.find((p) => p.module === module);
    return (levels[perm?.accessLevel || "none"] || 0) >= 1;
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-body-sm transition-all duration-200 group ${
      isActive
        ? "bg-primary/10 text-primary font-semibold"
        : "text-ink-secondary hover:bg-white/5 hover:text-ink"
    }`;

  const navLink = (
    item: { to: string; icon: React.ElementType; label: string },
    endMatch = false,
  ) => (
    <NavLink key={item.to} to={item.to} end={endMatch} className={linkClass}>
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
          )}
          <item.icon
            size={17}
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
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 top-16 w-[240px] backdrop-blur-2xl border-r border-white/10 dark:border-white/8 flex flex-col py-5 z-40 transition-transform duration-300 ease-in-out ${
        // Mobile: slides in/out based on isOpen
        // Desktop: slides out if isDesktopOpen is false
        isOpen
          ? "translate-x-0"
          : !isDesktopOpen
            ? "-translate-x-full"
            : "-translate-x-full lg:translate-x-0"
      }`}
      style={{
        backgroundColor: `color-mix(in srgb, var(--color-surface) ${uiOpacity}%, transparent)`,
      }}
    >
      <nav className="flex flex-col gap-1 px-3 flex-1 overflow-y-auto">
        {navItems.map((item) =>
          canAccess(item.module)
            ? navLink(item, item.to === "/dashboard")
            : null,
        )}

        {/* Settings always visible */}
        <div className="mt-auto pt-2">
          {navLink({ to: "/settings", icon: Settings, label: "Settings" })}
        </div>

        {adminItems.some((item) => canAccess(item.module)) && (
          <div className="pt-4 border-t border-white/10 dark:border-white/8">
            <p className="text-eyebrow font-bold tracking-wider text-ink-faint uppercase px-4 mb-2">
              Admin
            </p>
            {adminItems.map((item) =>
              canAccess(item.module) ? navLink(item) : null,
            )}
          </div>
        )}
      </nav>

      {/* User Info Badge at the bottom */}
      <div className="px-3 mt-6">
        <div className="p-3 bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/8 rounded-xl flex items-center gap-3 backdrop-blur-sm">
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
