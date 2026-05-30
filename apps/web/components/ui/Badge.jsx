import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badge = cva("inline-flex items-center rounded-full font-semibold", {
  variants: {
    variant: {
      default:
        "bg-surface-hover text-muted-dark border border-surface-border",
      brand:
        "bg-brand-light text-brand-dark border border-brand-ring",
      success:
        "bg-success-light text-success-dark border border-success-ring",
      destructive:
        "bg-destructive-light text-destructive-dark border border-destructive-ring",
      warning:
        "bg-warning-light text-warning-dark border border-warning-ring",
      info:
        "bg-info-light text-info-dark border border-info-ring",
      muted:
        "bg-surface-raised text-muted border border-muted-ring",
    },
    size: {
      sm: "px-2 py-0.5 text-xs",
      md: "px-2.5 py-0.5 text-xs",
      lg: "px-3 py-1 text-sm",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export default function Badge({ variant, size, className, children }) {
  return (
    <span className={cn(badge({ variant, size }), className)}>
      {children}
    </span>
  );
}
