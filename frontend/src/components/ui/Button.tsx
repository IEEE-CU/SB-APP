import { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-active shadow-[0_4px_14px_0_rgba(0,122,255,0.39)] border border-primary/20',
  secondary: 'bg-surface/80 backdrop-blur-md text-ink border border-hairline hover:bg-surface shadow-sm',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-[0_4px_14px_0_rgba(239,68,68,0.39)]',
  ghost: 'bg-transparent text-ink-secondary hover:bg-black/5 dark:hover:bg-white/10',
  glass: 'bg-white/30 dark:bg-black/30 backdrop-blur-xl border border-white/40 dark:border-white/10 text-ink shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] hover:bg-white/40 dark:hover:bg-black/40',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg',
  md: 'px-4 py-2 text-sm font-semibold rounded-xl',
  lg: 'px-6 py-3 text-base font-semibold rounded-2xl',
  icon: 'p-2 rounded-xl flex items-center justify-center',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => (
    <motion.button
      ref={ref}
      disabled={disabled || loading}
      whileTap={{ scale: disabled || loading ? 1 : 0.95, transition: { type: "spring", stiffness: 400, damping: 25 } }}
      className={cn(
        "inline-flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      <>{children}</>
    </motion.button>
  ),
);
Button.displayName = 'Button';
export default Button;
