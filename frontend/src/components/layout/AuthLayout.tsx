import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-canvas-soft flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-heading-1 font-bold text-ink">
            IEEE Finance Pro
          </h1>
          <p className="text-body-md text-ink-muted mt-2">
            Financial management for IEEE societies
          </p>
        </div>
        <div className="bg-surface rounded-xl shadow-soft-1 p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
