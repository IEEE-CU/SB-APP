import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService } from '@/services/projects';
import { Button, LoadingSpinner } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { ArrowLeft } from 'lucide-react';
import type { Project } from '@/types/models';
import toast from 'react-hot-toast';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    projectService.getProject(id).then((res) => setProject(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    try { await projectService.deleteProject(id); toast.success('Project deleted'); navigate('/projects'); } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <LoadingSpinner />;
  if (!project) return <div className="text-body-sm text-ink-muted">Project not found</div>;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink mb-4"><ArrowLeft size={16} /> Back</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">{project.title}</h1>
        <div className="flex gap-2">
          <PermissionGate module="projects" action="write"><Button variant="secondary" onClick={() => navigate(`/projects/${id}/edit`)}>Edit</Button></PermissionGate>
          <PermissionGate module="projects" action="delete"><Button variant="danger" onClick={handleDelete}>Delete</Button></PermissionGate>
        </div>
      </div>
      <div className="bg-surface rounded-lg border border-hairline p-6 max-w-2xl space-y-4">
        <div><label className="text-eyebrow text-ink-muted uppercase">Status</label><p className="text-body-md text-ink mt-1 capitalize">{project.status.replace('_', ' ')}</p></div>
        <div><label className="text-eyebrow text-ink-muted uppercase">Description</label><p className="text-body-md text-ink mt-1">{project.description || 'No description'}</p></div>
        <div><label className="text-eyebrow text-ink-muted uppercase">Members</label><p className="text-body-md text-ink mt-1">{project.memberIds?.length || 0} members</p></div>
      </div>
    </div>
  );
}
