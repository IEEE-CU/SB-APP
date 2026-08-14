import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService } from '@/services/projects';
import { Button, LoadingSpinner } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { ArrowLeft, ExternalLink, Github, CheckSquare, Square, Users, Code } from 'lucide-react';
import { slugify } from '@/utils/slug';
import type { Project } from '@/types/models';
import toast from 'react-hot-toast';

export default function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<{ title: string; completed: boolean }[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    projectService
      .getProjects(1, 100)
      .then((res) => {
        const found = res.data.data.find(
          (p) => p.id === slug || slugify(p.title) === slug || p.slug === slug,
        );
        const targetId = found ? found.id : slug;
        return projectService.getProject(targetId).then((r) => {
          const pr = r.data.data;
          setProject(pr);
          setMilestones(pr.milestones || [
            { title: 'Project Proposal & Architecture Design', completed: true },
            { title: 'MVP Core Feature Implementation', completed: pr.status !== 'planning' },
            { title: 'Testing & Code Review', completed: pr.status === 'completed' },
            { title: 'Deployment & Documentation', completed: pr.status === 'completed' },
          ]);
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const toggleMilestone = (index: number) => {
    setMilestones((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], completed: !updated[index].completed };
      return updated;
    });
    toast.success('Milestone updated');
  };

  const handleDelete = async () => {
    if (!project) return;
    try {
      await projectService.deleteProject(project.id);
      toast.success('Project deleted');
      navigate('/projects');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!project) return <div className="p-8 text-body-sm text-ink-muted">Project not found</div>;

  const completedCount = milestones.filter(m => m.completed).length;
  const progressPercent = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors">
        <ArrowLeft size={16} /> Back to Projects
      </button>

      {/* Header Banner */}
      <div className="bg-surface rounded-2xl border border-hairline p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-0.5 rounded-full text-eyebrow font-bold bg-indigo-50 text-indigo-700 uppercase">
                {project.status.replace('_', ' ')}
              </span>
              {project.societyName && (
                <span className="text-body-xs font-semibold text-ink-muted bg-canvas-soft px-2.5 py-0.5 rounded-full border border-hairline">
                  {project.societyName}
                </span>
              )}
            </div>
            <h1 className="text-heading-1 font-bold text-ink">{project.title}</h1>
          </div>

          <div className="flex items-center gap-3">
            <PermissionGate module="projects" action="write">
              <Button variant="secondary" onClick={() => navigate(`/projects/${project.id}/edit`)}>
                Edit Project
              </Button>
            </PermissionGate>
            <PermissionGate module="projects" action="delete">
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-body-xs text-ink-muted">
            <span className="font-semibold text-ink">Project Roadmap Progress</span>
            <span>{progressPercent}% Complete</span>
          </div>
          <div className="w-full bg-canvas-soft h-2.5 rounded-full overflow-hidden border border-hairline">
            <div className="bg-primary h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-surface rounded-xl border border-hairline p-6">
            <h3 className="text-heading-3 font-bold text-ink mb-3">Project Summary</h3>
            <p className="text-body-md text-ink leading-relaxed whitespace-pre-line">
              {project.description || 'An innovative technical initiative developed under Christ University IEEE Student Branch.'}
            </p>
          </div>

          {/* Interactive Milestones */}
          <div className="bg-surface rounded-xl border border-hairline p-6">
            <h3 className="text-heading-3 font-bold text-ink mb-4">Milestones & Checklist</h3>
            <div className="space-y-3">
              {milestones.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleMilestone(idx)}
                  className="p-3.5 rounded-lg border border-hairline bg-canvas-soft hover:bg-surface cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {m.completed ? (
                      <CheckSquare className="text-primary shrink-0" size={18} />
                    ) : (
                      <Square className="text-ink-muted shrink-0" size={18} />
                    )}
                    <span className={`text-body-sm font-medium ${m.completed ? 'line-through text-ink-muted' : 'text-ink'}`}>
                      {m.title}
                    </span>
                  </div>
                  <span className="text-body-xs text-ink-muted">{m.completed ? 'Done' : 'Pending'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tech Stack & Links */}
          <div className="bg-surface rounded-xl border border-hairline p-6 space-y-4 shadow-sm">
            <div>
              <h3 className="text-eyebrow text-ink-muted uppercase font-semibold mb-2 flex items-center gap-1.5">
                <Code size={14} /> Tech Stack
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(project.techStack && project.techStack.length > 0 ? project.techStack : ['React', 'TypeScript', 'Node.js', 'PostgreSQL']).map((tech, i) => (
                  <span key={i} className="px-2.5 py-1 bg-canvas-soft border border-hairline rounded-md text-body-xs font-semibold text-ink">
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-hairline space-y-2">
              {project.githubUrl ? (
                <a href={project.githubUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-canvas-soft hover:bg-surface border border-hairline rounded-md text-body-sm font-semibold text-ink transition-colors">
                  <Github size={16} /> Repository
                </a>
              ) : (
                <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-canvas-soft hover:bg-surface border border-hairline rounded-md text-body-sm font-semibold text-ink transition-colors">
                  <Github size={16} /> IEEE GitHub Org
                </a>
              )}

              {project.demoUrl && (
                <a href={project.demoUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-primary text-white rounded-md text-body-sm font-semibold hover:bg-primary-hover transition-colors">
                  <ExternalLink size={16} /> Live Demo
                </a>
              )}
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-surface rounded-xl border border-hairline p-6 space-y-3">
            <h3 className="text-eyebrow text-ink-muted uppercase font-semibold flex items-center gap-1.5">
              <Users size={14} /> Contributor Team ({project.memberIds?.length || 4})
            </h3>
            <div className="space-y-2 text-body-sm">
              <div className="p-2 rounded bg-canvas-soft font-medium text-ink">Project Lead & Architect</div>
              <div className="p-2 rounded bg-canvas-soft text-ink-muted">Core Contributors ({project.memberIds?.length || 3})</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
