import { useNavigate } from "react-router-dom";
import { FileQuestion, ArrowLeft } from "lucide-react";

/**
 * NotFoundPage — 404 fallback
 *
 * Rendered for any route that doesn't match.
 * Uses the same glassmorphism design language as the rest of the app.
 */
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-canvas p-6">
      {/* Ambient glow behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 70% 30%, var(--color-primary), transparent 65%)",
          opacity: 0.1,
          filter: "blur(80px)",
        }}
      />

      <div
        className="relative max-w-sm w-full rounded-2xl border border-white/10 p-10 text-center"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 60%, transparent)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <FileQuestion size={30} className="text-primary" />
          </div>
        </div>

        {/* Large 404 */}
        <p
          className="font-extrabold leading-none mb-1"
          style={{
            fontSize: "clamp(3.5rem, 10vw, 5.5rem)",
            background:
              "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          404
        </p>

        <h1 className="text-heading font-bold text-ink mb-2">Page not found</h1>
        <p className="text-body-sm text-ink-muted mb-8">
          The page you're looking for doesn't exist, was moved, or the link is
          broken.
        </p>

        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-medium text-body-sm hover:bg-primary-active transition-colors"
        >
          <ArrowLeft size={15} />
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
