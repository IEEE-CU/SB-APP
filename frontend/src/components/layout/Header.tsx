import { LogOut, User, Sun, Moon, Menu } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useNavigate } from "react-router-dom";
import SocietySwitcher from "./SocietySwitcher";

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
    <header className="h-[60px] flex items-center justify-between px-4 sm:px-6 z-50 bg-transparent">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-ink-secondary transition-colors lg:hidden active:scale-95"
          aria-label="Open Menu"
        >
          <Menu size={20} />
        </button>
        {/* IEEE SB Brand Mark */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 hidden sm:flex items-center justify-center text-white font-bold text-[10px] shadow-sm shadow-primary/20">
          IEEE
        </div>
        <span className="text-base font-semibold tracking-tight text-ink hidden md:inline ml-1">
          Campus Hub
        </span>
        <div className="w-px h-5 bg-hairline hidden md:block mx-2"></div>
        <SocietySwitcher />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggleDarkMode}
          className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-ink-secondary transition-colors active:scale-90"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink transition-colors px-3 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 font-medium"
        >
          <User size={16} />
          <span className="hidden sm:inline">{user?.name || "Profile"}</span>
        </button>
        <div className="w-px h-5 bg-hairline mx-1"></div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-ink-muted hover:text-red-500 transition-colors p-2 sm:px-3 sm:py-2 rounded-full hover:bg-red-500/10 active:scale-95"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline font-medium">Logout</span>
        </button>
      </div>
    </header>
  );
}
