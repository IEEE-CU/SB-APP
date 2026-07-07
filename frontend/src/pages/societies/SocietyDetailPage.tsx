import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { societyService } from '@/services/societies';
import { LoadingSpinner } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import type { Society } from '@/types/models';

export default function SocietyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [society, setSociety] = useState<Society | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    societyService.getSociety(id).then((res) => {
      setSociety(res.data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!society) return <div className="text-body-sm text-ink-muted">Society not found</div>;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink mb-4">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-heading-1 font-bold text-ink mb-6">{society.name}</h1>
      <div className="bg-surface rounded-lg border border-hairline p-6 max-w-2xl space-y-4">
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Description</label>
          <p className="text-body-md text-ink mt-1">{society.description || 'No description'}</p>
        </div>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Members</label>
          <p className="text-body-md text-ink mt-1">{society.memberIds?.length || 0} members</p>
        </div>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Created</label>
          <p className="text-body-md text-ink mt-1">{new Date(society.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
