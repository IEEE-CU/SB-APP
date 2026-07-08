import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change for mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-canvas-soft text-ink font-sans transition-colors duration-200">
      {/* Decorative background gradients for the organic aesthetic */}
      <div
        className="absolute top-0 right-0 w-[500px] max-w-full h-[500px] rounded-full pointer-events-none opacity-[0.04] dark:opacity-[0.02] blur-[100px] -z-10"
        style={{
          background:
            "radial-gradient(circle, var(--color-primary), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 w-[600px] max-w-full h-[600px] rounded-full pointer-events-none opacity-[0.03] dark:opacity-[0.02] blur-[120px] -z-10"
        style={{
          background:
            "radial-gradient(circle, var(--color-secondary), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Header with frosted glass effect */}
      <div className="relative z-50">
        <Header onMenuClick={() => setSidebarOpen(true)} />
      </div>

      <div className="flex flex-1 overflow-hidden relative z-10 w-full">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 relative">
          <div
            key={location.pathname}
            className="animate-in fade-in duration-500 fill-mode-forwards h-full max-w-[100vw]"
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
