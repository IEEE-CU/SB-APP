import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { register: registerUser } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      await registerUser(data.name, data.email, data.password);
      toast.success('Account created!');
      navigate('/');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-heading-2 font-bold text-ink mb-6">
        Create account
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Name
          </label>
          <input
            type="text"
            {...register('name')}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="Your name"
          />
          {errors.name && (
            <p className="text-caption text-red-500 mt-1">
              {errors.name.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Email
          </label>
          <input
            type="email"
            {...register('email')}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="text-caption text-red-500 mt-1">
              {errors.email.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Password
          </label>
          <input
            type="password"
            {...register('password')}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="Min 8 characters"
          />
          {errors.password && (
            <p className="text-caption text-red-500 mt-1">
              {errors.password.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Confirm Password
          </label>
          <input
            type="password"
            {...register('confirmPassword')}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="Repeat password"
          />
          {errors.confirmPassword && (
            <p className="text-caption text-red-500 mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-primary text-on-primary text-button font-medium rounded-full hover:bg-primary-active transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <p className="text-body-sm text-ink-muted text-center mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
