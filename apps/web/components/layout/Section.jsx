import { cn } from "../../lib/utils";

export default function Section({ title, subtitle, children, className }) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || subtitle) ? (
        <div>
          {title ? <h3 className="text-sm font-semibold text-slate-900">{title}</h3> : null}
          {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
