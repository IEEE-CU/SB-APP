import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth';
import { Button } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type Form = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    setSubmitting(true);
    try {
      await authService.changePassword(data.currentPassword, data.newPassword);
      toast.success('Password changed successfully');
      navigate('/profile');
    } catch {
      toast.error('Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink mb-4">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-heading-1 font-bold text-ink mb-6">Change Password</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-surface rounded-lg border border-hairline p-6 space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Current Password</label>
          <input type="password" {...register('currentPassword')} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          {errors.currentPassword && <p className="text-caption text-red-500 mt-1">{errors.currentPassword.message}</p>}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">New Password</label>
          <input type="password" {...register('newPassword')} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Min 8 characters" />
          {errors.newPassword && <p className="text-caption text-red-500 mt-1">{errors.newPassword.message}</p>}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">Confirm New Password</label>
          <input type="password" {...register('confirmPassword')} className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Repeat new password" />
          {errors.confirmPassword && <p className="text-caption text-red-500 mt-1">{errors.confirmPassword.message}</p>}
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting}>Change Password</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/profile')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
