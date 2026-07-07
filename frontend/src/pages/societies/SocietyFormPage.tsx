import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { societyService } from '@/services/societies';
import { Button, LoadingSpinner } from '@/components/ui';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function SocietyFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    societyService.getSociety(id).then((res) => {
      const s = res.data.data;
      reset({ name: s.name, description: s.description || '' });
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: Form) => {
    setSubmitting(true);
    try {
      if (isEdit && id) {
        await societyService.updateSociety(id, data);
        toast.success('Society updated');
      } else {
        await societyService.createSociety(data);
        toast.success('Society created');
      }
      navigate('/societies');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-lg">
      <h1 className="text-heading-1 font-bold text-ink mb-6">{isEdit ? 'Edit Society' : 'New Society'}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-surface rounded-lg border border-hairline p-6 space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Name</label>
          <input {...register('name')} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          {errors.name && <p className="text-caption text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Description</label>
          <textarea {...register('description')} rows={4} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting}>{isEdit ? 'Update' : 'Create'}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/societies')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
