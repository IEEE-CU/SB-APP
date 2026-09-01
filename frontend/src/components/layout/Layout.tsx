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
    <div className="h-screen w-full sm:p-4 md:p-6 lg:p-8 flex items-center justify-center relative overflow-hidden bg-transparent text-ink font-sans transition-colors duration-200">
      
      {/* Window Container */}
      <div className="flex w-full h-full max-w-[1600px] overflow-hidden rounded-none sm:rounded-3xl border-0 sm:border border-white/20 dark:border-white/5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.2)] bg-surface backdrop-blur-2xl transition-all duration-300 relative">
        
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar now sits on the left natively inside the flex window */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area (Right Side) */}
        <div className="flex flex-1 flex-col overflow-hidden relative w-full bg-canvas/40">
          <div className="relative z-50 border-b border-hairline bg-surface/50 backdrop-blur-md">
            <Header onMenuClick={() => setSidebarOpen(true)} />
          </div>

          <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 relative">
            <AnimatePresence mode="wait">
              <PageTransition key={location.pathname} className="h-full max-w-[100vw]">
                <Outlet />
              </PageTransition>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
