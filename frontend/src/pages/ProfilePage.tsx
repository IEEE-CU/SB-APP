import { useAuthStore } from '@/store/authStore';

export default function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-ink mb-6">Profile</h1>
      <div className="bg-surface rounded-lg border border-hairline p-6 max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="text-eyebrow text-ink-muted uppercase">Name</label>
            <p className="text-body-md text-ink mt-1">{user?.name || '—'}</p>
          </div>
          <div>
            <label className="text-eyebrow text-ink-muted uppercase">Email</label>
            <p className="text-body-md text-ink mt-1">{user?.email || '—'}</p>
          </div>
          <div>
            <label className="text-eyebrow text-ink-muted uppercase">Status</label>
            <p className="text-body-md text-ink mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-eyebrow bg-accent-green/10 text-accent-green">
                Active
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
