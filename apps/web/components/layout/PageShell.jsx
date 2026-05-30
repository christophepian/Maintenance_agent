import { cn } from "../../lib/utils";

export default function PageShell({ children, className, variant = "default" }) {
  const base = "w-full";
  const variants = {
    default: "min-h-screen bg-surface text-foreground px-2 sm:px-4 py-6 text-[0.9375rem] sm:text-base",
    embedded: "bg-transparent text-foreground px-0 py-0",
  };

  return <div className={cn(base, variants[variant] || variants.default, className)}>{children}</div>;
}
