import { Link } from "react-router-dom";
import { PageTransition, AnimatedCard } from "@/components/ui/WatermelonMotion";

export default function NotFoundPage() {
  return (
    <PageTransition>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center py-24 p-6">
        <AnimatedCard className="max-w-md w-full p-8 bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl flex flex-col items-center">
          <h1 className="text-display-2 font-bold text-ink mb-4">404</h1>
          <h2 className="text-heading-3 font-bold text-ink mb-2">Page not found</h2>
          <p className="text-body-sm text-ink-muted mb-8 text-center">
            The page you're looking for doesn't exist or may have been moved.
          </p>
          <Link
            to="/dashboard"
            className="px-6 py-2.5 bg-primary text-white font-medium rounded-full hover:bg-primary-active transition-colors shadow-soft-1"
          >
            Back to Dashboard
          </Link>
        </AnimatedCard>
      </div>
    </PageTransition>
  );
}
