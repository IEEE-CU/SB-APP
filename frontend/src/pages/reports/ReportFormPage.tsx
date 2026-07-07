import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { reportService } from '@/services/reports';
import { Button, LoadingSpinner } from '@/components/ui';
import toast from 'react-hot-toast';

const reportSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
  type: z.enum(['financial', 'activity', 'general']).optional(),
});

type ReportForm = z.infer<typeof reportSchema>;

export default function ReportFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReportForm>({ resolver: zodResolver(reportSchema) });

  useEffect(() => {
    if (!id) return;
    reportService.getReport(id).then((res) => { const r = res.data.data; reset({ title: r.title, content: r.content || '', type: r.type }); }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: ReportForm) => {
    setSubmitting(true);
    try {
      if (isEdit && id) { await reportService.updateReport(id, data); toast.success('Updated'); } else { await reportService.createReport(data); toast.success('Created'); }
      navigate('/reports');
    } catch { toast.error('Failed to save'); } finally { setSubmitting(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-lg">
      <h1 className="text-heading-1 font-bold text-ink mb-6">{isEdit ? 'Edit Report' : 'New Report'}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-surface rounded-lg border border-hairline p-6 space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Title</label>
          <input {...register('title')} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          {errors.title && <p className="text-caption text-red-500 mt-1">{errors.title.message}</p>}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Type</label>
          <select {...register('type')} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
            <option value="">Select type</option><option value="financial">Financial</option><option value="activity">Activity</option><option value="general">General</option>
          </select>
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Content</label>
          <textarea {...register('content')} rows={8} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting}>{isEdit ? 'Update' : 'Create'}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/reports')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
