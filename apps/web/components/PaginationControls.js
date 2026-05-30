import { useTranslation } from "next-i18next";

export default function PaginationControls({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  const { t } = useTranslation("common");
  if (totalItems <= pageSize) return null;
  const from = currentPage * pageSize + 1;
  const to = Math.min((currentPage + 1) * pageSize, totalItems);
  return (
    <div className="flex items-center justify-between border-t border-surface-divider px-4 py-3">
      <p className="text-xs text-muted">
        {t("pagination.showing", { from, to, total: totalItems })}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-text hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("pagination.previous")}
        </button>
        <span className="text-xs text-muted">
          {t("pagination.page", { current: currentPage + 1, total: totalPages })}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-text hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("pagination.next")}
        </button>
      </div>
    </div>
  );
}
