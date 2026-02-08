import { cn } from "../../lib/utils";

export default function Panel({ title, actions, children, className, bodyClassName }) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) ? (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {title ? <h2 className="text-sm font-semibold text-slate-900">{title}</h2> : <span />}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("px-4 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}
