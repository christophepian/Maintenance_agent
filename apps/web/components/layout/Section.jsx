import { cn } from "../../lib/utils";

export default function Section({ title, subtitle, children, className }) {
  return (
    <section className={cn("space-y-5", className)}>
      {(title || subtitle) ? (
        <div>
          {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
