import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const button = cva(
  "inline-flex items-center justify-center rounded-lg font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-white border border-brand hover:bg-brand-dark focus:ring-brand-ring",
        secondary:
          "bg-surface text-muted-dark border border-surface-border hover:bg-surface-hover focus:ring-muted-ring",
        destructive:
          "bg-destructive text-white border border-destructive hover:bg-destructive-dark focus:ring-destructive-ring",
        success:
          "bg-success-dark text-white border-0 hover:bg-success focus:ring-success-ring",
        ghost:
          "bg-transparent text-muted-dark border-0 hover:bg-surface-hover focus:ring-muted-ring",
        link:
          "bg-transparent text-brand border-0 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        xs: "px-2 py-1 text-xs gap-1",
        sm: "px-2.5 py-1.5 text-sm gap-1.5",
        md: "px-3.5 py-2.5 text-sm gap-2",
        lg: "px-5 py-3 text-base gap-2.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export default function Button({
  variant,
  size,
  className,
  children,
  ...props
}) {
  return (
    <button className={cn(button({ variant, size }), className)} {...props}>
      {children}
    </button>
  );
}
