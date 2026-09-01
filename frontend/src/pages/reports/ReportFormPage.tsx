import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DOMPurify from 'dompurify';
import { reportService } from '@/services/reports';
import { societyService } from '@/services/societies';
import { Button, LoadingSpinner } from '@/components/ui';
import { PageTransition, AnimatedCard } from '@/components/ui/WatermelonMotion';
import type { Society } from '@/types/models';
import { slugify } from '@/utils/slug';
import toast from 'react-hot-toast';

const reportSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
  type: z.enum(['financial', 'activity', 'general']).optional(),
  societyId: z.string().optional(),
});

type ReportForm = z.infer<typeof reportSchema>;

export default function ReportFormPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const targetIdentifier = slug || id;
  const isEdit = !!targetIdentifier;

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const navigate = useNavigate();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ReportForm>({
    resolver: zodResolver(reportSchema),
  });

  const contentValue = watch('content');

  useEffect(() => {
    societyService.getSocieties(1, 100).then((res) => setSocieties(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!targetIdentifier) return;
    setLoading(true);
    reportService
      .getReports(1, 100)
      .then((res) => {
        const found = res.data.data.find(
          (r) => r.id === targetIdentifier || slugify(r.title) === targetIdentifier || r.slug === targetIdentifier,
        );
        const resolvedId = found ? found.id : targetIdentifier;
        setReportId(resolvedId);

        return reportService.getReport(resolvedId).then((resp) => {
          const r = resp.data.data;
          reset({
            title: r.title,
            content: r.content || '',
            type: r.type,
            societyId: r.societyId || '',
          });
        });
      })
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false));
  }, [targetIdentifier, reset]);

  const onSubmit = async (data: ReportForm) => {
    setSubmitting(true);
    try {
      if (isEdit && reportId) {
        await reportService.updateReport(reportId, data as any);
        toast.success('Report updated');
      } else {
        await reportService.createReport(data as any);
        toast.success('Report created');
      }
      navigate('/reports');
    } catch {
      toast.error('Failed to save report');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <PageTransition>
      <div className="max-w-2xl">
        <h1 className="text-heading-1 font-bold text-ink mb-6">
          {isEdit ? 'Edit Report' : 'Create New Official Report'}
        </h1>
        <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Report Title *</label>
              <input
                {...register('title')}
                placeholder="e.g. Q3 IEEE Financial Audit & Expenditure Log"
                className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              {errors.title && <p className="text-caption text-red-500 mt-1">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Report Category</label>
                <select
                  {...register('type')}
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Select type</option>
                  <option value="financial">Financial Report</option>
                  <option value="activity">Activity / Event Report</option>
                  <option value="general">General Administrative Report</option>
                </select>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Society</label>
                <select
                  {...register('societyId')}
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">IEEE Student Branch (Central)</option>
                  {societies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.shortName || s.name.substring(0, 4)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-body-sm font-medium text-ink-secondary">Report Document Body (HTML / Text)</label>
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className="text-body-xs font-semibold text-primary hover:underline"
                >
                  {previewMode ? 'Edit Mode' : 'Preview Document'}
                </button>
              </div>

              {previewMode ? (
                <div
                  className="p-4 bg-canvas-soft border border-hairline rounded-md text-body-sm text-ink min-h-[200px] prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contentValue || '<i>No preview content available</i>') }}
                />
              ) : (
                <textarea
                  {...register('content')}
                  rows={10}
                  placeholder="Provide report details, financial line items, or executive summary..."
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono text-xs"
                />
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={submitting}>{isEdit ? 'Update Report' : 'Submit Report'}</Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/reports')}>Cancel</Button>
            </div>
          </form>
        </AnimatedCard>
      </div>
    </PageTransition>
  );
}
