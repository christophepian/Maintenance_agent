/**
 * FilterPanel — shared collapsible filter UI pattern
 *
 * Usage:
 *   const [filterOpen, setFilterOpen] = useState(false);
 *   const activeCount = [val1, val2, ...].filter(Boolean).length;
 *
 *   <FilterToggle open={filterOpen} onToggle={() => setFilterOpen(v => !v)} activeCount={activeCount} />
 *   {filterOpen && (
 *     <FilterPanelBody>
 *       <FilterSection title="Date range">…</FilterSection>
 *       <FilterSection title="Scope">…</FilterSection>
 *       <FilterSectionClear hasFilter={activeCount > 0} onClear={clearAll} />
 *     </FilterPanelBody>
 *   )}
 *
 * Rules (from design guidelines):
 * - Toggle button sits top-right, styled like ConfigurableTable "Columns" button
 * - Panel is a white card with divider-separated sections (border-t border-slate-100)
 * - Each <select> must be wrapped in <SelectField> to show the chevron arrow
 * - "Clear all filters" appears as a text link at the bottom footer only when filters are active
 * - Sections use grid layout: grid-cols-2 gap-3, responsive to sm:grid-cols-4
 */
import { cn } from "../../lib/utils";

/** Right-aligned toggle button — matches ConfigurableTable "Columns" button styling */
export function FilterToggle({ open, onToggle, activeCount }) {
  return (
    <div className="flex items-center justify-end">
      <button
        onClick={onToggle}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
          open
            ? "text-blue-700 bg-blue-50"
            : "text-slate-400 hover:text-blue-600 hover:bg-blue-50/50"
        )}
        aria-label="Toggle filters"
        aria-expanded={open}
      >
        {/* Funnel icon */}
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>
    </div>
  );
}

/** Outer white card that wraps all filter sections */
export function FilterPanelBody({ children }) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {children}
    </div>
  );
}

/** A titled section inside FilterPanelBody. First section has no top border; subsequent ones use border-t */
export function FilterSection({ title, first = false, children }) {
  return (
    <div className={cn(!first && "mt-4 border-t border-slate-100 pt-4")}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  );
}

/** "Clear all filters" footer link — only rendered when hasFilter is true */
export function FilterSectionClear({ hasFilter, onClear }) {
  if (!hasFilter) return null;
  return (
    <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
      <button
        onClick={onClear}
        className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
      >
        Clear all filters
      </button>
    </div>
  );
}

/** Wraps a <select> to add a visible chevron arrow on the right */
export function SelectField({ label, value, onChange, children, className }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full min-h-[36px] appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </span>
      </div>
    </div>
  );
}

/** Wraps a date <input> with a consistent label */
export function DateField({ label, value, onChange, className }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input
        type="date"
        value={value}
        onChange={onChange}
        className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );
}
