import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";
import { PageTransition, AnimatedCard } from "@/components/ui/WatermelonMotion";

const loginSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
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
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        (err instanceof Error ? err.message : "Login failed");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <AnimatedCard className="w-full max-w-md p-8 bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl shadow-xl">
          <h2 className="text-heading-2 font-bold text-ink mb-6 text-center">Sign in</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
                Email
              </label>
              <input
                type="email"
                {...register("email")}
                className="w-full px-4 py-2.5 bg-surface/50 border border-white/10 dark:border-white/5 rounded-xl text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
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
                className="w-full px-4 py-2.5 bg-surface/50 border border-white/10 dark:border-white/5 rounded-xl text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
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
              className="w-full mt-6 py-2.5 bg-primary text-on-primary text-button font-medium rounded-xl hover:bg-primary-active transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="text-body-sm text-ink-muted text-center mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </AnimatedCard>
      </div>
    </PageTransition>
  );
}
