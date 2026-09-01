import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

export interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, className = "" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.99 }}
      transition={{ type: "spring", stiffness: 350, damping: 35 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = "",
  delay = 0,
  ...props
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -2, scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.97, transition: { type: "spring", stiffness: 400, damping: 25 } }}
      transition={{ type: "spring", stiffness: 300, damping: 25, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export interface AnimatedBadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "emerald" | "amber" | "purple" | "success" | "danger" | "info" | "warning" | "default";
}

export const AnimatedBadge: React.FC<AnimatedBadgeProps> = ({ children, className = "" }) => {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.06 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      className={`inline-flex items-center gap-1.5 transition-shadow ${className}`}
    >
      {children}
    </motion.span>
  );
};

export interface AnimatedTabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export const AnimatedTab: React.FC<AnimatedTabProps> = ({ active, onClick, children, className = "" }) => {
  return (
    <button onClick={onClick} className={`relative px-4 py-2 text-body-sm font-semibold transition-colors ${className}`}>
      {children}
      {active && (
        <motion.div
          layoutId="activeTabUnderline"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
    </button>
  );
};
