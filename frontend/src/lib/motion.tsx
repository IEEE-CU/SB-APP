/**
 * Animation-free stand-in for framer-motion: `motion.*` renders the plain element and
 * AnimatePresence renders its children, so pages appear immediately and never wait on an
 * exit animation (which left pages blank when the browser stalled animation frames).
 */
import React from "react";

const MOTION_PROPS = new Set([
  "initial",
  "animate",
  "exit",
  "transition",
  "variants",
  "custom",
  "layout",
  "layoutId",
  "whileHover",
  "whileTap",
  "whileFocus",
  "whileInView",
  "whileDrag",
  "drag",
  "dragConstraints",
  "onAnimationComplete",
  "onAnimationStart",
  "viewport",
]);

const components = new Map<string, React.ElementType>();

function plain(tag: string) {
  return React.forwardRef<any, any>(function MotionPlain(
    { children, ...props },
    ref,
  ) {
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (!MOTION_PROPS.has(key)) clean[key] = props[key];
    }
    return React.createElement(tag, { ...clean, ref }, children);
  });
}

export const motion: any = new Proxy(
  {},
  {
    get(_target, tag: string) {
      if (!components.has(tag)) components.set(tag, plain(tag));
      return components.get(tag);
    },
  },
);

export function AnimatePresence({
  children,
}: {
  children?: React.ReactNode;
  mode?: string;
  initial?: boolean;
}) {
  return <>{children}</>;
}

export type Variants = Record<string, any>;
export type HTMLMotionProps<T extends keyof React.JSX.IntrinsicElements> =
  React.ComponentPropsWithoutRef<T> & {
    initial?: any;
    animate?: any;
    exit?: any;
    transition?: any;
    variants?: any;
    custom?: any;
    layout?: any;
    layoutId?: any;
    whileHover?: any;
    whileTap?: any;
    whileFocus?: any;
  };
