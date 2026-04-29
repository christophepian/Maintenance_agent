import { cn } from "../../lib/utils";

export default function PageShell({ children, className, variant = "default" }) {
  const base = "w-full";
  const variants = {
    default: "min-h-screen bg-white text-slate-900 px-2 sm:px-4 py-6 text-[15px] sm:text-base",
    embedded: "bg-transparent text-slate-900 px-0 py-0",
  };

  return <div className={cn(base, variants[variant] || variants.default, className)}>{children}</div>;
}
