import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { societyService } from '@/services/societies';
import { Button, LoadingSpinner } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { slugify } from '@/utils/slug';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Society name is required'),
  shortName: z.string().optional(),
  category: z.string().optional(),
  budget: z.coerce.number().min(0, 'Budget must be a positive number'),
  balance: z.coerce.number().min(0, 'Balance must be a positive number'),
  memberCount: z.coerce.number().min(0, 'Member count must be a positive number'),
  websiteUrl: z.string().optional(),
  description: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function SocietyFormPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const targetIdentifier = slug || id;
  const isEdit = !!targetIdentifier;

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [societyId, setSocietyId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { hasAccess } = usePermissions();
  const canEdit = hasAccess('societies', 'write');
  const canCreate = hasAccess('societies', 'create');
  const isAuthorized = isEdit ? canEdit : canCreate;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      budget: 50000,
      balance: 35000,
      memberCount: 15,
      category: 'Technical Chapter',
    },
  });

  useEffect(() => {
    if (!targetIdentifier) return;
    setLoading(true);
    societyService
      .getSocieties(1, 100)
      .then((res) => {
        const found = res.data.data.find(
          (s) =>
            s.id === targetIdentifier ||
            slugify(s.shortName || s.name) === targetIdentifier ||
            slugify(s.name) === targetIdentifier,
        );
        const resolvedId = found ? found.id : targetIdentifier;
        setSocietyId(resolvedId);

        return societyService.getSociety(resolvedId).then((r) => {
          const s = r.data.data;
          reset({
            name: s.name,
            shortName: s.shortName || '',
            category: s.category || 'Technical Chapter',
            budget: s.budget ?? 50000,
            balance: s.balance ?? (s.budget ?? 35000),
            memberCount: s.memberIds?.length || 15,
            websiteUrl: s.websiteUrl || '',
            description: s.description || '',
          });
        });
      })
      .catch(() => toast.error('Failed to load society parameters'))
      .finally(() => setLoading(false));
  }, [targetIdentifier, reset]);

  if (!isAuthorized) return <Navigate to="/societies" replace />;

  const onSubmit = async (data: Form) => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        memberIds: Array.from({ length: data.memberCount }, (_, i) => `m-${i + 1}`),
      };

      if (isEdit && societyId) {
        await societyService.updateSociety(societyId, payload as any);
        toast.success('Society parameters updated successfully!');
      } else {
        await societyService.createSociety(payload as any);
        toast.success('New IEEE Society registered!');
      }
      navigate('/societies');
    } catch {
      toast.error('Failed to save society details');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl">
      <h1 className="text-heading-1 font-bold text-ink mb-6">
        {isEdit ? 'Edit Society Configuration' : 'Register New IEEE Society / Chapter'}
      </h1>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-surface rounded-2xl border border-hairline p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Society Name *</label>
            <input
              {...register('name')}
              placeholder="e.g. IEEE Computer Society"
              className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium"
            />
            {errors.name && <p className="text-caption text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Short Code / Abbr</label>
            <input
              {...register('shortName')}
              placeholder="e.g. CS"
              className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 font-bold uppercase"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Chapter Category</label>
            <select
              {...register('category')}
              className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="Technical Chapter">Technical Chapter</option>
              <option value="Affinity Group">Affinity Group</option>
              <option value="Student Branch">Student Branch Main</option>
              <option value="Special Interest Group">Special Interest Group</option>
            </select>
          </div>

          <div>
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Active Members Count (Headcount)</label>
            <input
              type="number"
              {...register('memberCount')}
              placeholder="15"
              className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.memberCount && <p className="text-caption text-red-500 mt-1">{errors.memberCount.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Allocated Annual Budget (₹)</label>
            <input
              type="number"
              {...register('budget')}
              placeholder="50000"
              className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 font-semibold"
            />
            {errors.budget && <p className="text-caption text-red-500 mt-1">{errors.budget.message}</p>}
          </div>

          <div>
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Current Operating Balance (₹)</label>
            <input
              type="number"
              {...register('balance')}
              placeholder="35000"
              className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-emerald-600"
            />
            {errors.balance && <p className="text-caption text-red-500 mt-1">{errors.balance.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Official Website / Portal URL</label>
          <input
            {...register('websiteUrl')}
            placeholder="https://cs.ieee.org"
            className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Society Overview & Mission</label>
          <textarea
            {...register('description')}
            rows={5}
            placeholder="Describe the goals, flagship activities, domain focus, and benefits of joining this chapter..."
            className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting}>{isEdit ? 'Save Changes' : 'Create Society'}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/societies')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
