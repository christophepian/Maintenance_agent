/**
 * PaginationControls — shared Previous/Next bar with page info.
 *
 * Renders below a table when totalItems > pageSize.
 * Matches Tailwind style conventions from F-UI4.
 *
 * Props:
 *   currentPage  — 0-based safe page index
 *   totalPages   — total page count
 *   totalItems   — total row count (for "Showing X–Y of Z" label)
 *   pageSize     — items per page
 *   onPageChange — (newPage: number) => void
 */
export default function PaginationControls({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalItems <= pageSize) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">
        Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalItems)} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        <span className="text-xs text-slate-500">
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
