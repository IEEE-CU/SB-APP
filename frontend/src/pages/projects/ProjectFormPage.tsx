import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { projectService } from '@/services/projects';
import { Button, LoadingSpinner } from '@/components/ui';
import toast from 'react-hot-toast';

const projectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['planning', 'active', 'completed', 'on_hold']),
});

type ProjectForm = z.infer<typeof projectSchema>;

export default function ProjectFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProjectForm>({ resolver: zodResolver(projectSchema), defaultValues: { status: 'planning' } });

  useEffect(() => {
    if (!id) return;
    projectService.getProject(id).then((res) => { const p = res.data.data; reset({ title: p.title, description: p.description || '', status: p.status }); }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: ProjectForm) => {
    setSubmitting(true);
    try {
      if (isEdit && id) { await projectService.updateProject(id, data); toast.success('Updated'); } else { await projectService.createProject(data); toast.success('Created'); }
      navigate('/projects');
    } catch { toast.error('Failed to save'); } finally { setSubmitting(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-lg">
      <h1 className="text-heading-1 font-bold text-ink mb-6">{isEdit ? 'Edit Project' : 'New Project'}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-surface rounded-lg border border-hairline p-6 space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Title</label>
          <input {...register('title')} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          {errors.title && <p className="text-caption text-red-500 mt-1">{errors.title.message}</p>}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Description</label>
          <textarea {...register('description')} rows={3} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Status</label>
          <select {...register('status')} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
            <option value="planning">Planning</option><option value="active">Active</option><option value="completed">Completed</option><option value="on_hold">On Hold</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting}>{isEdit ? 'Update' : 'Create'}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/projects')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
