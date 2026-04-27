/**
 * Shared table utilities — sorting + pagination with URL state.
 *
 * Canonical helpers for all table-based pages. Pages import these
 * instead of defining ad-hoc sort/pagination logic inline.
 *
 * Usage:
 *   const { sortField, sortDir, handleSort } = useTableSort(router, SORT_FIELDS);
 *   const pager = useTablePagination(router, totalItems, 25);
 *   const sorted = clientSort(items, sortField, sortDir, myExtractor);
 *   const page = pager.pageSlice(sorted);
 */

import { useMemo, useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// useTableSort — URL-driven sort state (pages)
// ---------------------------------------------------------------------------

/**
 * @param {import('next/router').NextRouter} router
 * @param {string[]} validFields  — module-level constant to avoid re-renders
 * @param {{ defaultField?: string, defaultDir?: "asc"|"desc" }} [opts]
 */
export function useTableSort(router, validFields, opts = {}) {
  const { defaultField = "createdAt", defaultDir = "desc" } = opts;

  const sortField = useMemo(() => {
    if (!router.isReady) return defaultField;
    const f = String(router.query.sort || defaultField);
    return validFields.includes(f) ? f : defaultField;
  }, [router.isReady, router.query.sort, validFields, defaultField]);

  const sortDir = useMemo(() => {
    if (!router.isReady) return defaultDir;
    const d = String(router.query.dir || defaultDir);
    return d === "asc" ? "asc" : "desc";
  }, [router.isReady, router.query.dir, defaultDir]);

  const handleSort = useCallback(
    (field) => {
      const newDir = sortField === field && sortDir === "desc" ? "asc" : "desc";
      router.push(
        { pathname: router.pathname, query: { ...router.query, sort: field, dir: newDir, page: "0" } },
        undefined,
        { shallow: true },
      );
    },
    [router, sortField, sortDir],
  );

  return { sortField, sortDir, handleSort };
}

// ---------------------------------------------------------------------------
// useTablePagination — URL-driven page state
// ---------------------------------------------------------------------------

/**
 * @param {import('next/router').NextRouter} router
 * @param {number} totalItems
 * @param {number} [pageSize=25]
 */
export function useTablePagination(router, totalItems, pageSize = 25) {
  const currentPage = useMemo(() => {
    if (!router.isReady) return 0;
    const p = parseInt(router.query.page, 10);
    return isNaN(p) || p < 0 ? 0 : p;
  }, [router.isReady, router.query.page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize],
  );

  const safePage = useMemo(
    () => Math.min(currentPage, totalPages - 1),
    [currentPage, totalPages],
  );

  const setPage = useCallback(
    (p) => {
      router.push(
        { pathname: router.pathname, query: { ...router.query, page: String(p) } },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  /** Slice an already-sorted array down to the current page. */
  const pageSlice = useCallback(
    (items) => {
      const start = safePage * pageSize;
      return items.slice(start, start + pageSize);
    },
    [safePage, pageSize],
  );

  return { currentPage: safePage, totalPages, setPage, pageSlice, pageSize };
}

// ---------------------------------------------------------------------------
// clientSort — generic comparator-based sort
// ---------------------------------------------------------------------------

/**
 * Sort an array client-side using a field extractor.
 *
 * @param {any[]} items
 * @param {string} sortField
 * @param {"asc"|"desc"} sortDir
 * @param {(item: any, field: string) => any} fieldExtractor
 *   Maps (row, fieldName) → comparable primitive (string | number).
 *   Strings are compared case-insensitively.
 */
export function clientSort(items, sortField, sortDir, fieldExtractor) {
  return [...items].sort((a, b) => {
    const va = fieldExtractor(a, sortField);
    const vb = fieldExtractor(b, sortField);
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

// ---------------------------------------------------------------------------
// useLocalSort — component-level sort state (shared components, no router)
// ---------------------------------------------------------------------------

/**
 * Same API as useTableSort but uses useState instead of URL query params.
 * Use this in shared components (panels, modals) that can't rely on a router.
 *
 * @param {string} [defaultField="createdAt"]
 * @param {"asc"|"desc"} [defaultDir="desc"]
 */
export function useLocalSort(defaultField = "createdAt", defaultDir = "desc") {
  const [sortField, setSortField] = useState(defaultField);
  const [sortDir, setSortDir] = useState(defaultDir);

  const handleSort = useCallback((field) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return field;
    });
  }, []);

  return { sortField, sortDir, handleSort };
}
