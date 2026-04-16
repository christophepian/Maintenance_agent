/**
 * useTablePreferences — localStorage persistence for table column config.
 *
 * Stores per-table: visible columns, column order, density mode.
 * Handles schema versioning: new columns auto-appear at end with their
 * defaultVisible value; removed columns are silently dropped.
 *
 * Usage:
 *   const prefs = useTablePreferences("manager-requests", COLUMNS);
 *   prefs.visibleColumns   // ordered column IDs that are currently visible
 *   prefs.orderedColumns   // full ordered column defs (including hidden)
 *   prefs.toggleColumn(id) // show/hide
 *   prefs.reorderColumns(fromIndex, toIndex)
 *   prefs.density          // "comfortable" | "compact"
 *   prefs.setDensity(d)
 *   prefs.reset()          // revert to defaults
 */

import { useState, useCallback, useMemo } from "react";

const STORAGE_PREFIX = "table-prefs:";
const SCHEMA_VERSION = 1;

function loadFromStorage(tableId) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(tableId, data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${tableId}`,
      JSON.stringify({ ...data, version: SCHEMA_VERSION }),
    );
  } catch {
    // quota exceeded — silently ignore
  }
}

function removeFromStorage(tableId) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${tableId}`);
  } catch {
    // ignore
  }
}

/**
 * Merge saved prefs with current column definitions.
 * - Saved columns that no longer exist are dropped.
 * - New columns not in saved prefs are appended at end with defaultVisible.
 */
function mergePrefs(columns, saved) {
  const columnIds = new Set(columns.map((c) => c.id));
  const colMap = Object.fromEntries(columns.map((c) => [c.id, c]));

  // Start with saved order, filtering out removed columns
  const orderedIds = (saved.columnOrder || []).filter((id) => columnIds.has(id));
  const orderedSet = new Set(orderedIds);

  // Append any new columns not in saved order
  for (const col of columns) {
    if (!orderedSet.has(col.id)) {
      orderedIds.push(col.id);
    }
  }

  // Build visibility map — saved visibility wins, new columns use defaultVisible
  const savedVis = saved.visibility || {};
  const visibility = {};
  for (const id of orderedIds) {
    const col = colMap[id];
    if (col.alwaysVisible) {
      visibility[id] = true;
    } else if (id in savedVis) {
      visibility[id] = savedVis[id];
    } else {
      visibility[id] = col.defaultVisible !== false;
    }
  }

  return { columnOrder: orderedIds, visibility, density: saved.density || "comfortable" };
}

function buildDefaults(columns) {
  return {
    columnOrder: columns.map((c) => c.id),
    visibility: Object.fromEntries(
      columns.map((c) => [c.id, c.alwaysVisible || c.defaultVisible !== false]),
    ),
    density: "comfortable",
  };
}

export default function useTablePreferences(tableId, columns) {
  const [state, setState] = useState(() => {
    const saved = loadFromStorage(tableId);
    if (saved) {
      return mergePrefs(columns, saved);
    }
    return buildDefaults(columns);
  });

  const persist = useCallback(
    (next) => {
      setState(next);
      saveToStorage(tableId, next);
    },
    [tableId],
  );

  const toggleColumn = useCallback(
    (columnId) => {
      setState((prev) => {
        const col = columns.find((c) => c.id === columnId);
        if (col?.alwaysVisible) return prev;
        const next = {
          ...prev,
          visibility: { ...prev.visibility, [columnId]: !prev.visibility[columnId] },
        };
        saveToStorage(tableId, next);
        return next;
      });
    },
    [columns, tableId],
  );

  const reorderColumns = useCallback(
    (fromIndex, toIndex) => {
      setState((prev) => {
        const order = [...prev.columnOrder];
        const [moved] = order.splice(fromIndex, 1);
        order.splice(toIndex, 0, moved);
        const next = { ...prev, columnOrder: order };
        saveToStorage(tableId, next);
        return next;
      });
    },
    [tableId],
  );

  const setDensity = useCallback(
    (density) => {
      persist({ ...state, density });
    },
    [state, persist],
  );

  const reset = useCallback(() => {
    removeFromStorage(tableId);
    setState(buildDefaults(columns));
  }, [tableId, columns]);

  // Derive ordered column defs and visible columns
  const colMap = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.id, c])),
    [columns],
  );

  const orderedColumns = useMemo(
    () => state.columnOrder.map((id) => colMap[id]).filter(Boolean),
    [state.columnOrder, colMap],
  );

  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => state.visibility[c.id]),
    [orderedColumns, state],
  );

  return {
    orderedColumns,
    visibleColumns,
    visibility: state.visibility,
    density: state.density,
    toggleColumn,
    reorderColumns,
    setDensity,
    reset,
  };
}
