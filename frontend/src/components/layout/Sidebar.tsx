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
  CheckSquare,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { ACCESS_LEVELS } from "@/lib/permissionLevels";
import CollapsibleChannelMenu from "./CollapsibleChannelMenu";
import { motion } from "framer-motion";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", module: null },
  { to: "/societies", icon: Building2, label: "Societies", module: null },
  { to: "/events", icon: Calendar, label: "Events", module: "events" },
  { to: "/projects", icon: FolderKanban, label: "Projects", module: "projects" },
  { to: "/reports", icon: FileText, label: "Reports", module: "reports" },
  { to: "/announcements", icon: Megaphone, label: "Announcements", module: "announcements" },
  { to: "/community", icon: MessageCircle, label: "Community Hub", module: "community_hub" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks", module: null },
  { to: "/calendar", icon: Calendar, label: "Unified Calendar", module: null },
];

const adminItems = [
  { to: "/admin/users", icon: Users, label: "Users", module: "users" },
];

export default function Sidebar({
  isOpen = false,
  onClose: _onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const { user, permissions, userRole } = useAuthStore();

  const canAccess = (module: string | null) => {
    if (!module) return true;
    const perm = permissions.find((p) => p.module === module);
    return (ACCESS_LEVELS[perm?.accessLevel || "none"] || 0) >= 1;
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 outline-none select-none ${
      isActive
        ? "bg-primary text-white shadow-md shadow-primary/20"
        : "text-ink-secondary hover:bg-black/5 dark:hover:bg-white/10 hover:text-ink"
    }`;

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 w-[260px] bg-surface/90 lg:bg-surface/50 backdrop-blur-2xl border-r border-white/20 dark:border-white/5 flex flex-col py-6 z-50 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <nav className="flex flex-col gap-1 px-4 flex-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) =>
          canAccess(item.module) ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={linkClass}
            >
              {({ isActive }) => (
                <motion.div whileTap={{ scale: 0.96 }} className="flex items-center gap-3 w-full">
                  <item.icon
                    size={18}
                    className={
                      isActive ? "text-white" : "text-ink-muted transition-colors"
                    }
                  />
                  <span>{item.label}</span>
                </motion.div>
              )}
            </NavLink>
          ) : null,
        )}

        {adminItems.some((item) => canAccess(item.module)) && (
          <div className="mt-6 pt-4 border-t border-hairline/60">
            <p className="text-xs font-bold tracking-widest text-ink-faint uppercase px-4 mb-3">
              Workspace
            </p>
            <CollapsibleChannelMenu />
          </div>
        )}

        {adminItems.some((item) => canAccess(item.module)) && (
          <div className="mt-4 pt-4 border-t border-hairline/60">
            <p className="text-xs font-bold tracking-widest text-ink-faint uppercase px-4 mb-3">
              Admin
            </p>
            {adminItems.map((item) =>
              canAccess(item.module) ? (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {({ isActive }) => (
                    <motion.div whileTap={{ scale: 0.96 }} className="flex items-center gap-3 w-full">
                      <item.icon
                        size={18}
                        className={
                          isActive ? "text-white" : "text-ink-muted transition-colors"
                        }
                      />
                      <span>{item.label}</span>
                    </motion.div>
                  )}
                </NavLink>
              ) : null,
            )}
          </div>
        )}
      </nav>

      {/* User Info Badge at the bottom */}
      <div className="px-4 mt-6">
        <motion.div 
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="p-3 bg-white/50 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl flex items-center gap-3 shadow-sm cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-500 text-white flex items-center justify-center font-bold shadow-sm shadow-primary/20 flex-shrink-0">
            {user?.name?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink truncate">
              {user?.name || "User"}
            </p>
            <p className="text-xs font-medium text-ink-muted truncate capitalize">
              {userRole ? userRole.replace(/_/g, " ") : "Member"}
            </p>
          </div>
        </motion.div>
      </div>
    </aside>
  );
}
