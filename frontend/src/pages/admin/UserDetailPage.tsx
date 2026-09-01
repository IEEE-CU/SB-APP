import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { userService } from "@/services/users";
import { LoadingSpinner } from "@/components/ui";
import { PageTransition, AnimatedCard, AnimatedBadge } from "@/components/ui/WatermelonMotion";
import type { User } from "@/types/models";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    userService
      .getUser(id)
      .then((res) => {
        if (!cancelled) setUser(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!user)
    return <div className="text-body-sm text-ink-muted">User not found</div>;

  return (
    <PageTransition>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-heading-1 font-bold text-ink mb-6">{user.name}</h1>
      <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-6 max-w-2xl space-y-4 shadow-xl">
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Email</label>
          <p className="text-body-md text-ink mt-1">{user.email}</p>
        </div>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">
            Status
          </label>
          <div className="mt-1">
            <AnimatedBadge variant={user.isActive ? "success" : "danger"}>
              {user.isActive ? "Active" : "Inactive"}
            </AnimatedBadge>
          </div>
        </div>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">
            Joined
          </label>
          <p className="text-body-md text-ink mt-1">
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
      </AnimatedCard>
    </PageTransition>
  );
}
