import { Outlet } from "react-router-dom";
import { useThemeStore } from "@/store/themeStore";
import { Sun, Moon } from "lucide-react";

export default function AuthLayout() {
  const { darkMode, toggleDarkMode } = useThemeStore();

  return (
    <div className="min-h-screen bg-canvas-soft img-placeholder border-0 bg-[length:24px_24px] flex flex-col items-center justify-center p-4 relative">
      {/* Theme Toggle */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-6 right-6 p-2 rounded-full bg-surface shadow-soft-1 text-ink-secondary hover:text-ink transition-colors"
        title="Toggle Theme"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-heading-2 shadow-soft-2 mb-4">
            F
          </div>
          <h1 className="text-heading-1 font-bold text-ink">
            IEEE Finance Pro
          </h1>
          <p className="text-body-md text-ink-muted mt-2">
            Financial management for IEEE societies
          </p>
        </div>
        <div className="bg-surface/80 backdrop-blur-xl border border-hairline/50 rounded-2xl shadow-soft-2 p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
