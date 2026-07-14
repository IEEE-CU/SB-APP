import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.message || 'Login failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-heading-2 font-bold text-ink mb-6">Sign in</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Email
          </label>
          <input
            type="email"
            {...register("email")}
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
            {...register("password")}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="Min 8 characters"
          />
          {errors.password && (
            <p className="text-caption text-red-500 mt-1">
              {errors.password.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-primary text-on-primary text-button font-medium rounded-full hover:bg-primary-active transition-colors disabled:opacity-50"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="text-body-sm text-ink-muted text-center mt-6">
        Don't have an account?{" "}
        <Link to="/register" className="text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
