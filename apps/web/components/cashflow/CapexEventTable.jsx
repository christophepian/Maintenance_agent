/**
 * CapexEventTable — the scheduled-capex table for a cashflow plan, with per-asset
 * year-shift overrides (editable while DRAFT). Shared by the plan detail page and
 * the planning workspace's Decision panel ("Plan details" expander).
 */
import { useState, useMemo } from "react";
import { useTranslation } from "next-i18next";
import { authHeaders } from "../../lib/api";
import { formatChf, formatChfCents } from "../../lib/format";
import { cn } from "../../lib/utils";
import Badge from "../ui/Badge";
import SortableHeader from "../SortableHeader";
import { useLocalSort, clientSort } from "../../lib/tableUtils";

const ALIGNMENT_TAG_VARIANT = { aligned: "success", review: "warning", low_priority: "secondary" };
const ALIGNMENT_TAG_LABEL = { aligned: "Aligned", review: "Review", low_priority: "Low priority" };

function fmtMonth(year, month) {
  if (month == null) return String(year);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function CapexEventTable({ buckets, overrides, timingRecommendations, planId, isDraft, onRefresh, alignmentMap }) {
  const { t } = useTranslation("manager");
  // Build override lookup: assetId → override record
  const overrideByAsset = {};
  for (const ov of (overrides || [])) {
    overrideByAsset[ov.assetId] = ov;
  }
  // Build recommendation lookup: assetId → recommendation
  const recByAsset = {};
  for (const r of (timingRecommendations || [])) {
    recByAsset[r.assetId] = r;
  }

  // Collect upcoming events from projected buckets
  const events = [];
  if (buckets) {
    for (const b of buckets) {
      if (!b.isActual && b.capexItems?.length > 0) {
        for (const ci of b.capexItems) {
          events.push({ ...ci, year: b.year, month: b.month });
        }
      }
    }
  }

  const { sortField: evSF, sortDir: evSD, handleSort: handleEvSort } = useLocalSort("scheduled", "asc");
  const sortedEvents = useMemo(() => clientSort(events, evSF, evSD, (ev, f) => {
    if (f === "asset") return (ev.assetName || "").toLowerCase();
    if (f === "scheduled") return ev.year * 100 + (ev.month ?? 0);
    if (f === "estimatedCost") return ev.estimatedCostCents ?? 0;
    if (f === "tradeGroup") return (ev.tradeGroup || "").toLowerCase();
    if (f === "bundle") return (ev.bundle || "").toLowerCase();
    return "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [events, evSF, evSD]);

  if (sortedEvents.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-text">{t("manager:cashflowId.text.noScheduledCapexEventsInTheProjectionHorizon")}</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-surface-divider">
        {sortedEvents.map((ev, i) => {
          const ov = overrideByAsset[ev.assetId];
          const rec = recByAsset[ev.assetId];
          return (
            <CapexMobileCard
              key={i}
              ev={ev}
              ov={ov}
              rec={rec}
              planId={planId}
              isDraft={isDraft}
              onRefresh={onRefresh}
              alignmentMap={alignmentMap}
            />
          );
        })}
      </div>
      {/* Desktop table */}
      <div className="hidden sm:block data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <SortableHeader label={t("manager:cashflowId.prop.asset")} field="asset" sortField={evSF} sortDir={evSD} onSort={handleEvSort} />
              <SortableHeader label={t("manager:cashflowId.prop.scheduled")} field="scheduled" sortField={evSF} sortDir={evSD} onSort={handleEvSort} />
              <SortableHeader label={t("manager:cashflowId.prop.estimatedCost")} field="estimatedCost" sortField={evSF} sortDir={evSD} onSort={handleEvSort} className="text-right" />
              <SortableHeader label={t("manager:cashflowId.prop.tradeGroup")} field="tradeGroup" sortField={evSF} sortDir={evSD} onSort={handleEvSort} />
              <SortableHeader label={t("manager:cashflowId.prop.bundle")} field="bundle" sortField={evSF} sortDir={evSD} onSort={handleEvSort} />
              {isDraft && <th>{t("manager:cashflowId.col.override")}</th>}
            </tr>
          </thead>
          <tbody>
            {sortedEvents.map((ev, i) => {
              const ov = overrideByAsset[ev.assetId];
              const rec = recByAsset[ev.assetId];
              return (
                <CapexEventRow
                  key={i}
                  ev={ev}
                  ov={ov}
                  rec={rec}
                  planId={planId}
                  isDraft={isDraft}
                  onRefresh={onRefresh}
                  alignmentMap={alignmentMap}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CapexMobileCard({ ev, ov, rec, planId, isDraft, onRefresh, alignmentMap }) {
  const { t } = useTranslation("manager");
  const currentYear = new Date().getFullYear();
  const [shifting, setShifting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  async function handleShiftYear(newYear) {
    setShifting(true);
    setError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          assetId: ev.assetId,
          originalYear: ev.isOverridden && ov ? ov.originalYear : ev.year,
          overriddenYear: newYear,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to add override");
      onRefresh();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setShifting(false);
    }
  }

  async function handleRemoveOverride() {
    if (!ov) return;
    setRemoving(true);
    setError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}/overrides/${ov.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to remove override");
      onRefresh();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setRemoving(false);
    }
  }

  const baseYear = ov ? ov.originalYear : ev.year;
  const minYear = Math.max(currentYear + 1, baseYear - 3);
  const maxYear = baseYear + 3;
  const yearOptions = [];
  for (let y = minYear; y <= maxYear; y++) {
    if (!ov || y !== ov.overriddenYear) yearOptions.push(y);
  }
  const isOverridden = ev.isOverridden || !!ov;

  return (
    <div className="py-3 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-sm font-medium text-foreground", isOverridden && "italic text-muted")}>
          {isOverridden && <span className="mr-1 text-warning-text text-xs">⟳</span>}
          {ev.assetName}
        </span>
        <span className="text-sm font-mono text-muted-dark shrink-0">{formatChfCents(ev.costCents)}</span>
      </div>
      <div className="text-xs text-muted">
        {fmtMonth(ev.year, ev.month)}
        {isOverridden && ov && <span className="ml-1">(was {ov.originalYear})</span>}
        {ev.tradeGroup && <span className="ml-2">· {ev.tradeGroup}</span>}
      </div>
      {isDraft && (
        <div className="flex items-center gap-1 mt-1">
          <select
            onChange={(e) => e.target.value && handleShiftYear(Number(e.target.value))}
            value=""
            disabled={shifting}
            className="border border-surface-border rounded px-1.5 py-0.5 text-xs text-muted-text disabled:opacity-50"
          >
            <option value="">{t("manager:cashflowId.text.shiftYear")}</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {isOverridden && (
            <button
              onClick={handleRemoveOverride}
              disabled={removing}
              className="text-xs text-foreground-dim hover:text-destructive-text disabled:opacity-50"
            >
              {removing ? "…" : "Reset"}
            </button>
          )}
        </div>
      )}
      {error && <span className="text-xs text-destructive-text">{error}</span>}
    </div>
  );
}

function CapexEventRow({ ev, ov, rec, planId, isDraft, onRefresh, alignmentMap }) {
  const { t } = useTranslation("manager");
  const currentYear = new Date().getFullYear();
  const [shifting, setShifting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  async function handleShiftYear(newYear) {
    setShifting(true);
    setError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          assetId: ev.assetId,
          originalYear: ev.isOverridden && ov ? ov.originalYear : ev.year,
          overriddenYear: newYear,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to add override");
      onRefresh();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setShifting(false);
    }
  }

  async function handleRemoveOverride() {
    if (!ov) return;
    setRemoving(true);
    setError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}/overrides/${ov.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to remove override");
      onRefresh();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setRemoving(false);
    }
  }

  // Year options: scheduled year ± 3 years, clamped to current+1 min
  const baseYear = ov ? ov.originalYear : ev.year;
  const minYear = Math.max(currentYear + 1, baseYear - 3);
  const maxYear = baseYear + 3;
  const yearOptions = [];
  for (let y = minYear; y <= maxYear; y++) {
    if (!ov || y !== ov.overriddenYear) yearOptions.push(y);
  }

  const isOverridden = ev.isOverridden || !!ov;
  const rowClass = isOverridden ? "italic text-muted" : "";

  return (
    <tr className={rowClass}>
      <td className="cell-bold">
        {isOverridden && (
          <span className="mr-1 text-warning-text text-xs" title={t("manager:cashflowId.title.yearOverridden")}>⟳</span>
        )}
        {ev.assetName}
        {alignmentMap?.[ev.assetId] && (
          <span title={alignmentMap[ev.assetId].explanation} className="cursor-help">
            <Badge variant={ALIGNMENT_TAG_VARIANT[alignmentMap[ev.assetId].tag]} className="ml-1 text-xs px-1 py-0">
              {ALIGNMENT_TAG_LABEL[alignmentMap[ev.assetId].tag]}
            </Badge>
          </span>
        )}
      </td>
      <td>
        {fmtMonth(ev.year, ev.month)}
        {isOverridden && ov && (
          <span className="ml-1 text-xs text-foreground-dim">(was {ov.originalYear})</span>
        )}
      </td>
      <td className="text-right font-mono">{formatChfCents(ev.costCents)}</td>
      <td>{ev.tradeGroup || "—"}</td>
      <td>{ev.bundleId ? <span className="status-pill bg-info-light text-info-text">{t("manager:cashflowId.text.bundled")}</span> : <span className="text-foreground-dim text-xs">—</span>}</td>
      {isDraft && (
        <td>
          <div className="flex flex-col gap-1 min-w-48">
            {/* Advisor recommendation chip */}
            {rec && rec.recommendedYear !== (ov?.overriddenYear ?? ev.year) && (
              <button
                onClick={() => handleShiftYear(rec.recommendedYear)}
                disabled={shifting}
                className="text-left text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-2 py-0.5 hover:bg-violet-100 disabled:opacity-50 w-fit"
                title={rec.rationale}
              >
                Advisor: {rec.direction} to {rec.recommendedYear}
                {rec.estimatedTaxSavingChf > 0 && (
                  <span className="ml-1 text-violet-500">→ save {formatChf(rec.estimatedTaxSavingChf)} tax</span>
                )}
              </button>
            )}
            {/* Shift year control */}
            <div className="flex items-center gap-1">
              <select
                onChange={(e) => e.target.value && handleShiftYear(Number(e.target.value))}
                value=""
                disabled={shifting}
                className="border border-surface-border rounded px-1.5 py-0.5 text-xs text-muted-text disabled:opacity-50"
              >
                <option value="">{t("manager:cashflowId.text.shiftYear")}</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {isOverridden && (
                <button
                  onClick={handleRemoveOverride}
                  disabled={removing}
                  className="text-xs text-foreground-dim hover:text-destructive-text disabled:opacity-50"
                  title={t("manager:cashflowId.title.resetToBaselineYear")}
                >
                  {removing ? "…" : "Reset"}
                </button>
              )}
            </div>
            {error && <span className="text-xs text-destructive-text">{error}</span>}
          </div>
        </td>
      )}
    </tr>
  );
}
