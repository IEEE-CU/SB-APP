import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop sidebar collapsed/expanded — persisted in localStorage
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    return localStorage.getItem("sidebarCollapsed") !== "true";
  });

  // Persist preference
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(!desktopSidebarOpen));
  }, [desktopSidebarOpen]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    /**
     * Root shell: fixed full-viewport, overflow-hidden.
     * The scrollable area is ONLY <main>. Header and Sidebar are
     * position:fixed so page content literally slides under them —
     * this is what makes backdrop-blur visible.
     */
    <div className="fixed inset-0 bg-canvas text-ink font-sans transition-colors duration-200 overflow-hidden">
      {/* ── Rich background that the glass layers blur against ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-[-10%] right-[-5%] w-[55vw] h-[55vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 70% 30%, var(--color-primary), transparent 65%)",
          opacity: 0.13,
          filter: "blur(80px)",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-[-10%] left-[200px] w-[50vw] h-[50vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 70%, var(--color-secondary), transparent 65%)",
          opacity: 0.09,
          filter: "blur(100px)",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-[40%] left-[40%] w-[30vw] h-[30vw] rounded-full"
        style={{
          background: "radial-gradient(circle, #7c3aed, transparent 70%)",
          opacity: 0.04,
          filter: "blur(120px)",
          zIndex: 0,
        }}
      />

      {/* ── Fixed Header — content scrolls beneath it ── */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          isDesktopSidebarOpen={desktopSidebarOpen}
          onDesktopSidebarToggle={() => setDesktopSidebarOpen((v) => !v)}
        />
      </header>

      {/* ── Below-header row: Sidebar + Main ── */}
      <div className="absolute inset-0 flex" style={{ top: 64 }}>
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            style={{ top: 64 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Fixed Sidebar ── */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isDesktopOpen={desktopSidebarOpen}
        />

        {/* ── Scrollable main content — offsets when sidebar is open ── */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden relative transition-[padding] duration-300 ease-in-out"
          style={{
            paddingLeft: desktopSidebarOpen ? undefined : undefined,
            zIndex: 1,
          }}
        >
          <div
            className={`transition-[padding] duration-300 ease-in-out ${
              desktopSidebarOpen ? "lg:pl-[240px]" : "lg:pl-0"
            }`}
          >
            <div
              key={location.pathname}
              className="animate-in fade-in duration-400 fill-mode-forwards min-h-full p-4 sm:p-6"
            >
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
