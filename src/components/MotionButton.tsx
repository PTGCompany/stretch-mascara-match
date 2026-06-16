import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import * as React from "react";

// ── Shared motion presets ──────────────────────────────────────────
export const motionSpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 26,
  mass: 0.7,
};

export const motionSpringHover = {
  type: "spring" as const,
  stiffness: 520,
  damping: 26,
  mass: 0.6,
};

export const motionSpringTap = {
  type: "spring" as const,
  stiffness: 600,
  damping: 26,
};

export const motionEase = [0.22, 1, 0.36, 1] as const;

// ── CVA variants ───────────────────────────────────────────────────
const motionButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      intent: {
        primary:
          "rounded-full bg-[var(--sephora-pink)] text-white shadow-sm",
        secondary:
          "rounded-full border border-foreground/20 bg-transparent",
        ghost:
          "rounded-full border border-border bg-transparent",
        danger:
          "rounded-full border border-destructive text-destructive",
        link: "text-primary underline-offset-4 hover:underline",
        token: "group relative aspect-square w-full rounded-full",
      },
      size: {
        default: "px-6 py-2.5 text-sm",
        sm: "px-4 py-2 text-xs",
        lg: "px-10 py-3.5 text-base",
        icon: "h-9 w-9 rounded-full",
        full: "w-full",
      },
    },
    defaultVariants: {
      intent: "primary",
      size: "default",
    },
  }
);

export interface MotionButtonProps
  extends HTMLMotionProps<"button">,
    VariantProps<typeof motionButtonVariants> {}

export const MotionButton = React.forwardRef<
  HTMLButtonElement,
  MotionButtonProps
>(
  (
    { className, intent, size, whileHover, whileTap, transition, ...props },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        className={cn(motionButtonVariants({ intent, size, className }))}
        whileHover={
          whileHover !== undefined
            ? whileHover
            : { scale: 1.06, y: -1, transition: motionSpringHover }
        }
        whileTap={
          whileTap !== undefined
            ? whileTap
            : { scale: 0.94, transition: motionSpringTap }
        }
        transition={transition ?? motionSpring}
        {...props}
      />
    );
  }
);
MotionButton.displayName = "MotionButton";
