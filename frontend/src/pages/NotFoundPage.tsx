import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <h1 className="text-heading-1 font-bold text-ink">Page not found</h1>
      <p className="text-body-sm text-ink-muted mt-2 max-w-sm">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 text-body-sm font-semibold text-primary hover:underline"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
