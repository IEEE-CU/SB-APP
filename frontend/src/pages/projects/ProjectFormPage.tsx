import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { projectService } from '@/services/projects';
import { societyService } from '@/services/societies';
import { Button, LoadingSpinner } from '@/components/ui';
import { PageTransition, AnimatedCard } from '@/components/ui/WatermelonMotion';
import type { Society } from '@/types/models';
import { slugify } from '@/utils/slug';
import toast from 'react-hot-toast';

const projectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  societyId: z.string().optional(),
  status: z.enum(['planning', 'active', 'completed', 'on_hold']),
  techStackRaw: z.string().optional(),
  githubUrl: z.union([z.string().url('Invalid URL'), z.literal('')]).optional(),
  demoUrl: z.union([z.string().url('Invalid URL'), z.literal('')]).optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

export default function ProjectFormPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const targetIdentifier = slug || id;
  const isEdit = !!targetIdentifier;

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [societies, setSocieties] = useState<Society[]>([]);
  const navigate = useNavigate();
  
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess('projects', 'write');
  const canCreate = hasAccess('projects', 'create');
  const isAuthorized = isEdit ? canEdit : canCreate;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { status: 'planning' },
  });

  useEffect(() => {
    societyService.getSocieties(1, 100).then((res) => setSocieties(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!targetIdentifier) return;
    setLoading(true);
    projectService
      .getProjects(1, 100)
      .then((res) => {
        const found = res.data.data.find(
          (p) => p.id === targetIdentifier || slugify(p.title) === targetIdentifier || p.slug === targetIdentifier,
        );
        const resolvedId = found ? found.id : targetIdentifier;
        setProjectId(resolvedId);

        return projectService.getProject(resolvedId).then((r) => {
          const p = r.data.data;
          reset({
            title: p.title,
            description: p.description || '',
            societyId: p.societyId || '',
            status: p.status,
            techStackRaw: p.techStack ? p.techStack.join(', ') : '',
            githubUrl: p.githubUrl || '',
            demoUrl: p.demoUrl || '',
          });
        });
      })
      .catch(() => toast.error('Failed to load project'))
      .finally(() => setLoading(false));
  }, [targetIdentifier, reset]);

  const onSubmit = async (data: ProjectForm) => {
    setSubmitting(true);
    const formattedData = {
      title: data.title,
      description: data.description,
      societyId: data.societyId === '' ? undefined : data.societyId,
      status: data.status,
      techStack: data.techStackRaw ? data.techStackRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
      githubUrl: data.githubUrl === '' ? undefined : data.githubUrl,
      demoUrl: data.demoUrl === '' ? undefined : data.demoUrl,
    };

    try {
      if (isEdit && projectId) {
        await projectService.updateProject(projectId, formattedData as any);
        toast.success('Project updated');
      } else {
        await projectService.createProject(formattedData as any);
        toast.success('Project created');
      }
      navigate('/projects');
    } catch {
      toast.error('Failed to save project');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthorized) return <Navigate to="/projects" replace />;
  if (loading) return <LoadingSpinner />;

  return (
    <PageTransition>
      <div className="max-w-xl">
        <h1 className="text-heading-1 font-bold text-ink mb-6">
          {isEdit ? 'Edit Project' : 'Create New Project'}
        </h1>
        <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-xl p-6 space-y-4 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Project Title *</label>
              <input
                {...register('title')}
                placeholder="e.g. AI-Powered Smart Campus Portal"
                className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              {errors.title && <p className="text-caption text-red-500 mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Society</label>
              <select
                {...register('societyId')}
                className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">IEEE Student Branch (General)</option>
                {societies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.shortName || s.name.substring(0, 4)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Description</label>
              <textarea
                {...register('description')}
                rows={4}
                placeholder="Overview of project goals, features, and target outcomes..."
                className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Status</label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Tech Stack (comma separated)</label>
                <input
                  {...register('techStackRaw')}
                  placeholder="e.g. React, TypeScript, Python"
                  className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">GitHub Repository URL</label>
                <input
                  {...register('githubUrl')}
                  placeholder="https://github.com/ieee/..."
                  className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {errors.githubUrl && <p className="text-caption text-red-500 mt-1">{errors.githubUrl.message}</p>}
              </div>

              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Live Demo URL</label>
                <input
                  {...register('demoUrl')}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {errors.demoUrl && <p className="text-caption text-red-500 mt-1">{errors.demoUrl.message}</p>}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={submitting}>{isEdit ? 'Update Project' : 'Save Project'}</Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/projects')}>Cancel</Button>
            </div>
          </form>
        </AnimatedCard>
      </div>
    </PageTransition>
  );
}
