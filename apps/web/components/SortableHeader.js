/**
 * SortableHeader — shared clickable column header with ▲/▼ indicators.
 *
 * Works with both `inline-table` (globals.css) and custom `w-full text-sm` tables.
 * Active sort direction is highlighted in indigo.
 *
 * Props:
 *   label      — column display text
 *   field      — sort field key (must match a validFields entry)
 *   sortField  — currently active sort field (from useTableSort)
 *   sortDir    — currently active direction (from useTableSort)
 *   onSort     — handleSort callback (from useTableSort)
 *   className  — extra classes (e.g. "hidden lg:table-cell")
 */
export default function SortableHeader({ label, field, sortField, sortDir, onSort, className = "" }) {
  const active = sortField === field;
  return (
    <th
      className={`cursor-pointer select-none hover:text-slate-600 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col leading-none -space-y-0.5">
          <span className={`text-[8px] ${active && sortDir === "asc" ? "text-indigo-600" : "text-slate-300"}`}>▲</span>
          <span className={`text-[8px] ${active && sortDir === "desc" ? "text-indigo-600" : "text-slate-300"}`}>▼</span>
        </span>
      </span>
    </th>
  );
}
