import { LogOut, User, Sun, Moon, Menu } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const { darkMode, toggleDarkMode } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="h-16 bg-surface/70 backdrop-blur-md border-b border-hairline/60 flex items-center justify-between px-4 sm:px-6 shadow-sm z-50">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-md hover:bg-canvas-soft text-ink-secondary transition-colors lg:hidden"
          aria-label="Open Menu"
        >
          <Menu size={20} />
        </button>
        {/* IEEE SB Brand Mark */}
        <div className="w-8 h-8 rounded-md bg-primary hidden sm:flex items-center justify-center text-white font-bold text-title shadow-soft-1">
          F
        </div>
        <span className="text-title font-semibold text-ink tracking-tight">
          IEEE Student Branch, ____
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-md hover:bg-canvas-soft text-ink-secondary transition-colors"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-body-sm text-ink-secondary hover:text-ink transition-colors px-2 py-1.5 rounded-md hover:bg-canvas-soft"
        >
          <User size={16} />
          <span className="font-medium">{user?.name || "Profile"}</span>
        </button>
        <div className="w-px h-5 bg-hairline"></div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors px-2 py-1.5 rounded-md hover:bg-canvas-soft"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
