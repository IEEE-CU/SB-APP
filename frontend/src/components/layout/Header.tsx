import {
  LogOut,
  User,
  Sun,
  Moon,
  Menu,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  onMenuClick?: () => void;
  /** Desktop sidebar state — shown as a subtle toggle icon */
  isDesktopSidebarOpen?: boolean;
  onDesktopSidebarToggle?: () => void;
}

export default function Header({
  onMenuClick,
  isDesktopSidebarOpen = true,
  onDesktopSidebarToggle,
}: HeaderProps) {
  const { user, logout } = useAuthStore();
  const { darkMode, toggleDarkMode, uiOpacity } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      className="h-16 backdrop-blur-2xl border-b border-white/10 dark:border-white/8 flex items-center justify-between px-4 sm:px-6 z-50"
      style={{
        backgroundColor: `color-mix(in srgb, var(--color-surface) ${uiOpacity}%, transparent)`,
      }}
    >
      <div className="flex items-center gap-2">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="p-2 -ml-1 rounded-md hover:bg-white/5 text-ink-secondary transition-colors lg:hidden"
          aria-label="Open Menu"
        >
          <Menu size={20} />
        </button>

        {/* Desktop sidebar toggle — subtle, doesn't stand out */}
        <button
          onClick={onDesktopSidebarToggle}
          className="hidden lg:flex p-2 -ml-1 rounded-md hover:bg-white/5 text-ink-faint hover:text-ink-secondary transition-colors"
          aria-label={
            isDesktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"
          }
          title={isDesktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isDesktopSidebarOpen ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeft size={18} />
          )}
        </button>

        {/* IEEE SB Brand Mark */}
        <div className="w-8 h-8 rounded-md bg-primary hidden sm:flex items-center justify-center text-white font-bold text-title shadow-soft-1">
          F
        </div>
        <span className="text-title font-semibold text-ink tracking-tight">
          IEEE Finance Pro
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-md hover:bg-white/5 text-ink-secondary transition-colors"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-body-sm text-ink-secondary hover:text-ink transition-colors px-2 py-1.5 rounded-md hover:bg-white/5"
        >
          <User size={16} />
          <span className="font-medium hidden sm:inline">
            {user?.name || "Profile"}
          </span>
        </button>
        <div className="w-px h-5 bg-white/10" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors px-2 py-1.5 rounded-md hover:bg-white/5"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
