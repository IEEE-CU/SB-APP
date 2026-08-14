import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Lenis from "lenis";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/ui/WatermelonMotion";

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Close sidebar on route change for mobile and reset scroll position
  useEffect(() => {
    setSidebarOpen(false);
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    } else if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  // Initialize Lenis smooth scrolling on main content container
  useEffect(() => {
    if (!mainRef.current) return;

    const lenis = new Lenis({
      wrapper: mainRef.current,
      content: (mainRef.current.firstElementChild as HTMLElement) || mainRef.current,
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

    lenisRef.current = lenis;

    let animationFrameId: number;
    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }

    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

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

        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 relative">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname} className="h-full max-w-[100vw]">
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
