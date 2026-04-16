import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

/**
 * StatusPill — inline status indicator with predefined color variants.
 * Replaces the .status-pill CSS class with a variant-aware component.
 */
const pill = cva("inline-block rounded-full text-xs font-semibold", {
  variants: {
    variant: {
      default: "bg-surface-hover text-muted-dark border border-surface-border",
      brand: "bg-brand-light text-brand-dark border border-brand-ring",
      success: "bg-success-light text-success-dark border border-success-ring",
      destructive: "bg-destructive-light text-destructive-dark border border-destructive-ring",
      warning: "bg-amber-50 text-amber-800 border border-amber-300",
      info: "bg-sky-50 text-sky-700 border border-sky-300",
      muted: "bg-surface-raised text-muted border border-muted-ring",
      orange: "bg-orange-50 text-orange-700 border border-amber-300",
    },
    size: {
      sm: "px-2 py-px",
      md: "px-2.5 py-0.5",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export default function StatusPill({ variant, size, className, children }) {
  return (
    <span className={cn(pill({ variant, size }), className)}>
      {children}
    </span>
  );
}
