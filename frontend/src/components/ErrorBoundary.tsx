import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Global Error Boundary
 *
 * Catches unexpected rendering errors in the subtree and shows a
 * frosted-glass fallback card instead of a blank white screen.
 * Only class components can be error boundaries (React constraint).
 */
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production you'd send this to Sentry / Datadog etc.
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <div
            className="relative max-w-md w-full rounded-2xl border border-white/10 p-8 text-center"
            style={{
              background:
                "color-mix(in srgb, var(--color-surface) 60%, transparent)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle size={26} className="text-amber-400" />
              </div>
            </div>

            {/* Heading */}
            <h2 className="text-title font-bold text-ink mb-2">
              Something went wrong
            </h2>
            <p className="text-body-sm text-ink-muted mb-6">
              An unexpected error occurred while rendering this page. This is
              not your fault — try reloading, or return to the dashboard.
            </p>

            {/* Error detail (collapsed in prod) */}
            {this.state.error && (
              <pre className="text-left text-caption text-ink-faint bg-canvas rounded-lg p-3 mb-6 overflow-auto max-h-28 font-mono">
                {this.state.error.message}
              </pre>
            )}

            {/* Reload button */}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-medium text-body-sm hover:bg-primary-active transition-colors"
            >
              <RefreshCw size={15} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
