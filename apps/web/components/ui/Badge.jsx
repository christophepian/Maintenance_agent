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
        "bg-amber-50 text-amber-800 border border-amber-300",
      info:
        "bg-sky-50 text-sky-700 border border-sky-300",
      muted:
        "bg-surface-raised text-muted border border-muted-ring",
    },
    size: {
      sm: "px-2 py-0.5 text-[11px]",
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
