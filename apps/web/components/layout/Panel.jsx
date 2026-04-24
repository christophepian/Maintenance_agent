import { useState } from "react";
import { cn } from "../../lib/utils";

export default function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
  /** When true the panel header becomes a toggle on mobile (< sm). Collapsed by default. */
  collapsibleOnMobile = false,
  /** Only meaningful when collapsibleOnMobile=true. Default open state on mobile. */
  defaultOpenOnMobile = false,
}) {
  const [mobileOpen, setMobileOpen] = useState(defaultOpenOnMobile);

  if (collapsibleOnMobile && title) {
    return (
      <section className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
        {/* Mobile: tappable toggle header */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          className="sm:hidden w-full flex items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-t-2xl"
        >
          <h2 className="text-base font-semibold text-slate-900 m-0">{title}</h2>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200", mobileOpen && "rotate-180")}
          >
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>
        {/* Desktop: always-visible header */}
        <div className="hidden sm:flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
        {/* Mobile body: toggle */}
        <div className={cn("sm:hidden border-t border-slate-100", !mobileOpen && "hidden")}>
          <div className={cn("px-4 py-4", bodyClassName)}>{children}</div>
        </div>
        {/* Desktop body: always shown */}
        <div className={cn("hidden sm:block", bodyClassName ? "" : "")}>
          <div className={cn("px-4 py-4", bodyClassName)}>{children}</div>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) ? (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : <span />}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("px-4 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}
