import { cn } from "../../lib/utils";

export default function PageShell({ children, className, variant = "default" }) {
  const base = "w-full";
  const variants = {
    default: "min-h-screen bg-white text-slate-900 px-4 sm:px-6 py-6",
    embedded: "bg-transparent text-slate-900 px-0 py-0",
  };

  return <div className={cn(base, variants[variant] || variants.default, className)}>{children}</div>;
}
