/**
 * ConfigurableTable — shared table component with column visibility,
 * drag-to-reorder, sortable headers, density toggle, and localStorage
 * persistence.
 *
 * Spec:
 *   - Column definitions drive headers + cells
 *   - ⚙️ popover above table (top-right) for column toggles, reorder, density
 *   - Sorting via SortableHeader (URL-driven, parent-managed)
 *   - Accordion/expanded rows are parent-managed via props
 *   - Persistence via useTablePreferences hook
 */

import { useState, useRef, Fragment } from "react";
import SortableHeader from "./SortableHeader";
import useTablePreferences from "../lib/useTablePreferences";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/Popover";

import { cn } from "../lib/utils";
// ---------------------------------------------------------------------------
// Density CSS mappings
// ---------------------------------------------------------------------------
const DENSITY = {
  comfortable: { th: "px-3 py-2.5", td: "px-3 py-2.5", text: "" },
  compact:     { th: "px-2 py-1.5", td: "px-2 py-1.5", text: "text-xs" },
};

// ---------------------------------------------------------------------------
// Gear Popover
// ---------------------------------------------------------------------------
function ColumnConfigPopover({ orderedColumns, visibility, density, onToggle, onReorder, onDensityChange, onReset }) {
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  // Filter to only configurable columns (not alwaysVisible)
  const configurable = orderedColumns.filter((c) => !c.alwaysVisible);

  function handleDragStart(index) {
    dragItem.current = index;
  }

  function handleDragEnter(index) {
    dragOver.current = index;
  }

  function handleDragEnd() {
    if (dragItem.current !== null && dragOver.current !== null && dragItem.current !== dragOver.current) {
      // Convert configurable indices to full orderedColumns indices
      const fromCol = configurable[dragItem.current];
      const toCol = configurable[dragOver.current];
      const fromFull = orderedColumns.findIndex((c) => c.id === fromCol.id);
      const toFull = orderedColumns.findIndex((c) => c.id === toCol.id);
      if (fromFull >= 0 && toFull >= 0) {
        onReorder(fromFull, toFull);
      }
    }
    dragItem.current = null;
    dragOver.current = null;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Columns</span>
      </div>

      {/* Column list — draggable */}
      <div className="max-h-64 overflow-y-auto py-1">
        {configurable.map((col, i) => (
          <div
            key={col.id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragEnter={() => handleDragEnter(i)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-grab active:cursor-grabbing select-none"
          >
            {/* Drag handle */}
            <span className="text-slate-300 text-xs leading-none" title="Drag to reorder">⠿</span>
            {/* Checkbox */}
            <label className="flex items-center gap-2 flex-1 cursor-pointer">
              <input
                type="checkbox"
                checked={!!visibility[col.id]}
                onChange={() => onToggle(col.id)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-700">{col.label}</span>
            </label>
          </div>
        ))}
      </div>

      {/* Density toggle */}
      <div className="border-t border-slate-100 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Density</p>
        <div className="flex gap-1">
          {["comfortable", "compact"].map((d) => (
            <button
              key={d}
              onClick={() => onDensityChange(d)}
              className={cn("flex-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors", density === d
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50")}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <div className="border-t border-slate-100 px-3 py-2">
        <button
          onClick={onReset}
          className="text-[11px] text-slate-400 hover:text-red-500 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfigurableTable
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ColumnDef
 * @property {string} id           — unique key, used for persistence + sort
 * @property {string} label        — header display text
 * @property {boolean} [sortable]  — enables SortableHeader
 * @property {boolean} [defaultVisible=true]
 * @property {boolean} [alwaysVisible=false] — can't be hidden
 * @property {string} [className]  — extra th/td classes
 * @property {string} [headerClassName] — extra th-only classes
 * @property {(row: any, density: string) => JSX.Element} render — cell renderer
 */

/**
 * Props:
 *   tableId            — persistence key for localStorage
 *   columns            — ColumnDef[]
 *   data               — row array
 *   rowKey             — (row) => string|number — unique key extractor
 *   sortField          — current sort field (from useTableSort)
 *   sortDir            — current sort direction
 *   onSort             — handleSort callback
 *   rowClassName       — (row) => string — optional per-row class
 *   onRowClick         — (row) => void — optional row click handler
 *   renderExpandedRow  — (row) => JSX.Element — optional accordion content
 *   isRowExpanded      — (row) => boolean
 *   emptyState         — JSX shown when data is empty
 *   renderBeforeRow    — (row) => JSX.Element | null — extra content before cells
 *   leadingCells       — (row) => JSX.Element | null — cells before column cells
 *   leadingHeader      — JSX.Element | null — header cell(s) before column headers
 */
export default function ConfigurableTable({
  tableId,
  columns,
  data,
  rowKey,
  sortField,
  sortDir,
  onSort,
  rowClassName,
  rowId,
  onRowClick,
  renderExpandedRow,
  isRowExpanded,
  emptyState,
  leadingCells,
  leadingHeader,
  trailingCells,
  trailingHeader,
}) {
  const prefs = useTablePreferences(tableId, columns);
  const { visibleColumns, orderedColumns, visibility, density, toggleColumn, reorderColumns, setDensity, reset } = prefs;
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Normalise rowKey: accept a string (property name) or function
  const getRowKey = typeof rowKey === "function" ? rowKey : (row) => row[rowKey];

  const ds = DENSITY[density] || DENSITY.comfortable;
  const colSpan = visibleColumns.length + (leadingHeader ? 1 : 0) + (trailingHeader ? 1 : 0);


  return (
    <>
      {/* Toolbar row — gear button (outside table, right-aligned) */}
      <div className="flex items-center justify-end pb-3">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors", popoverOpen
                  ? "text-blue-700 bg-blue-50"
                  : "text-slate-900 hover:text-blue-600 hover:bg-blue-50/50")}
              title="Configure columns"
              aria-label="Configure columns"
              aria-expanded={popoverOpen}
              aria-haspopup="dialog"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Columns
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <ColumnConfigPopover
              orderedColumns={orderedColumns}
              visibility={visibility}
              density={density}
              onToggle={toggleColumn}
              onReorder={reorderColumns}
              onDensityChange={setDensity}
              onReset={reset}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className={cn("w-full text-sm", ds.text)}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-left text-[11px] font-medium uppercase tracking-wider text-slate-900">
              {leadingHeader}
              {visibleColumns.map((col) =>
                col.sortable ? (
                  <SortableHeader
                    key={col.id}
                    label={col.label}
                    field={col.sortField || col.id}
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={onSort}
                    className={cn(ds.th, col.headerClassName || "", col.className || "")}
                  />
                ) : (
                  <th key={col.id} className={cn(ds.th, col.headerClassName || "", col.className || "")}>
                    {col.label}
                  </th>
                ),
              )}
              {trailingHeader}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.length === 0 && emptyState ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-8 text-center">
                  {emptyState}
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const key = getRowKey(row);
                const expanded = isRowExpanded?.(row);
                return (
                  <Fragment key={key}>
                    <tr
                      id={rowId?.(row)}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={[
                        "transition-colors",
                        onRowClick ? "cursor-pointer hover:bg-slate-50/80" : "",
                        expanded ? "bg-slate-50" : "",
                        rowClassName?.(row) || "",
                      ].join(" ")}
                    >
                      {leadingCells?.(row)}
                      {visibleColumns.map((col) => (
                        <td key={col.id} className={cn(ds.td, col.className || "")}>
                          {col.render(row, density)}
                        </td>
                      ))}
                      {trailingCells?.(row)}
                    </tr>
                    {expanded && renderExpandedRow && (
                      <tr>
                        <td colSpan={colSpan} className="p-0">
                          {renderExpandedRow(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
