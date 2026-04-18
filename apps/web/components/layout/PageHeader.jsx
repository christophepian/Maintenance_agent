import { cn } from "../../lib/utils";

export default function PageHeader({ title, subtitle, actions, backButton, className }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        <div className="flex items-center gap-2">
          {backButton}
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        </div>
        {subtitle ? <p className="text-sm text-slate-600 mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
