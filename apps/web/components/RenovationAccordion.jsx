/**
 * RenovationAccordion
 *
 * Accordion view of renovation opportunities across one or more buildings.
 * Hierarchy: Building → Unit → Asset
 *
 * Each asset row shows: depreciation bar, recommendation badge, condition badge,
 * estimated due year, and a "Simulate →" button.
 * Checkboxes propagate up (asset → unit → building).
 * Bulk "Simulate N →" CTA appears when any assets are selected.
 *
 * Replaces the flat RenovationOpportunitiesSection + CapexSchedulePanel combination.
 * The CapEx timeline is implicit: assets are sorted by remainingLifeMonths asc.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "next-i18next";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { authHeaders } from "../lib/api";
import RenovationSimulatorDrawer from "./RenovationSimulatorDrawer";
import HoverTip from "./HoverTip";

// Human-readable date for tooltip provenance ("23 May 2026")
function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d) ? null : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Provenance line for the condition tag's hover tooltip
function conditionTip(item) {
  if (!item.lastConditionStatus) return null;
  const date = fmtDate(item.lastConditionAt);
  const kind = item.lastConditionReportType === "MOVE_OUT" ? "move-out"
    : item.lastConditionReportType === "MOVE_IN" ? "move-in" : null;
  const suffix = kind ? ` (${kind} inspection)` : "";
  if (!date) return `Last condition report: ${item.lastConditionStatus}`;
  return item.lastConditionValidated
    ? `Condition report validated on ${date}${suffix}`
    : `Condition reported on ${date}${suffix} · awaiting validation`;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const REC_STYLE = {
  REPLACE:          { badge: "bg-destructive-light text-destructive-text", label: "Replace" },
  PLAN_REPLACEMENT: { badge: "bg-orange-light text-orange-text",           label: "Plan" },
  MONITOR:          { badge: "bg-warning-light text-warning-text",         label: "Monitor" },
  REPAIR:           { badge: "bg-success-light text-success-text",         label: "Repair" },
};

const COND_STYLE = {
  GOOD:    "bg-success-light text-success-text",
  FAIR:    "bg-warning-light text-warning-text",
  POOR:    "bg-orange-light text-orange-text",
  DAMAGED: "bg-destructive-light text-destructive-text",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function DepBar({ pct }) {
  const capped = Math.min(100, pct ?? 0);
  const color = capped >= 100 ? "bg-destructive" : capped >= 85 ? "bg-orange" : capped >= 65 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-surface-hover overflow-hidden min-w-[40px]">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${capped}%` }} />
      </div>
      <span className="text-xs tabular-nums text-foreground-dim shrink-0">{Math.round(capped)}%</span>
    </div>
  );
}

function dueYear(item) {
  if (item.remainingLifeMonths == null) return null;
  return new Date().getFullYear() + Math.ceil(item.remainingLifeMonths / 12);
}

// ─── Asset row ────────────────────────────────────────────────────────────────

function AssetRow({ item, checked, onToggle, onSimulate }) {
  const { t } = useTranslation("manager");
  const rec  = REC_STYLE[item.recommendation] ?? REC_STYLE.REPAIR;
  const cond = item.lastConditionStatus ? COND_STYLE[item.lastConditionStatus] : null;
  const due  = dueYear(item);

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2.5 border-b border-surface-divider last:border-0 transition-colors",
      checked ? "bg-brand-light" : "hover:bg-surface-subtle/60",
    )}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-3.5 w-3.5 shrink-0 rounded border-surface-border accent-brand cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      />
      {/* Name + topic */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{item.assetName}</p>
        <p className="text-xs text-foreground-dim">{item.topic}</p>
      </div>
      {/* Depreciation */}
      <div className="w-20 shrink-0 hidden sm:block">
        <DepBar pct={item.depreciationPct} />
      </div>
      {/* Badges */}
      <div className="flex items-center gap-1 shrink-0">
        <HoverTip content={item.recommendationReason}>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", rec.badge)}>
            {t(`renovationAccordion.rec.${item.recommendation}`, { defaultValue: rec.label })}
          </span>
        </HoverTip>
        {cond && (
          <HoverTip content={conditionTip(item)} className="hidden sm:inline-flex">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", cond)}>
              {item.lastConditionStatus.charAt(0) + item.lastConditionStatus.slice(1).toLowerCase()}
            </span>
          </HoverTip>
        )}
      </div>
      {/* Due year */}
      {due && (
        <span className="text-xs tabular-nums text-foreground-dim shrink-0 hidden md:block">{due}</span>
      )}
      {/* Simulate */}
      <button
        onClick={(e) => { e.stopPropagation(); onSimulate([item]); }}
        className="shrink-0 rounded-lg border border-surface-border px-2 py-0.5 text-xs font-medium text-foreground-dim hover:bg-surface-hover hover:text-foreground transition-colors"
      >
        {t("renovationAccordion.simulate", { defaultValue: "Simulate →" })}
      </button>
    </div>
  );
}

// ─── Unit row ─────────────────────────────────────────────────────────────────

function UnitRow({ unitNumber, items, selectedIds, onToggleAsset, onSimulate, buildingId }) {
  const { t } = useTranslation("manager");
  const [open, setOpen] = useState(false);
  const unitSelected = items.filter((i) => selectedIds.has(i.assetId));
  const allChecked   = items.length > 0 && unitSelected.length === items.length;
  const someChecked  = unitSelected.length > 0 && !allChecked;

  function toggleUnit(e) {
    e.stopPropagation();
    items.forEach((i) => onToggleAsset(i.assetId, !allChecked));
  }

  // Sort assets by remainingLifeMonths asc (soonest replacement first)
  const sorted = [...items].sort((a, b) => (a.remainingLifeMonths ?? 9999) - (b.remainingLifeMonths ?? 9999));

  return (
    <div className="border-b border-surface-divider last:border-0">
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-subtle/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => { if (el) el.indeterminate = someChecked; }}
          onChange={toggleUnit}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 shrink-0 rounded border-surface-border accent-brand cursor-pointer"
        />
        {open ? <ChevronDown className="h-3.5 w-3.5 text-foreground-dim shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-foreground-dim shrink-0" />}
        <span className="text-xs font-medium text-foreground">{t("renovationAccordion.unit", { number: unitNumber, defaultValue: "Unit {{number}}" })}</span>
        <span className="text-xs text-foreground-dim">{t("renovationAccordion.assetCount", { count: items.length, defaultValue: `${items.length} asset${items.length !== 1 ? "s" : ""}` })}</span>
        {unitSelected.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onSimulate(unitSelected); }}
            className="ml-auto text-xs font-medium text-muted hover:text-foreground transition-colors"
          >
            {t("renovationAccordion.simulateN", { count: unitSelected.length, defaultValue: `Simulate ${unitSelected.length} →` })}
          </button>
        )}
      </div>
      {open && (
        <div className="ml-6">
          {sorted.map((item) => (
            <AssetRow
              key={item.assetId}
              item={item}
              checked={selectedIds.has(item.assetId)}
              onToggle={() => onToggleAsset(item.assetId, !selectedIds.has(item.assetId))}
              onSimulate={onSimulate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Building section ─────────────────────────────────────────────────────────

function BuildingSection({ buildingId, buildingName, selectedIds, onToggleAsset, onSimulate, autoExpand }) {
  const { t } = useTranslation("manager");
  // Inject this section's buildingId into every simulate call (opportunity items
  // don't carry buildingId, and the workspace needs it to schedule into a plan).
  const handleSim = useCallback((items) => onSimulate(items, buildingId), [onSimulate, buildingId]);
  const [open,    setOpen]    = useState(autoExpand);
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);
  const [err,     setErr]     = useState("");

  // Lazy-load on first expand (CR-005): fetching every building's opportunities
  // on mount fans out one request per selected building at once. Only the
  // auto-expanded section fetches initially; the rest load when opened, once,
  // with an AbortController so a fast collapse/unmount cancels the request.
  useEffect(() => {
    if (!open || loaded) return;
    const ctrl = new AbortController();
    setLoading(true); setErr("");
    fetch(`/api/buildings/${buildingId}/renovation-opportunities`, { headers: authHeaders(), signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { if (d?.data) { setItems(d.data); setLoaded(true); } else throw new Error(d?.error?.message || "Failed"); })
      .catch((e) => { if (e.name !== "AbortError") setErr(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [open, loaded, buildingId]);

  // Group items by unit
  const byUnit = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      if (!map.has(item.unitId)) map.set(item.unitId, { unitNumber: item.unitNumber, items: [] });
      map.get(item.unitId).items.push(item);
    }
    return [...map.entries()].sort((a, b) => a[1].unitNumber.localeCompare(b[1].unitNumber));
  }, [items]);

  const allAssetIds    = items.map((i) => i.assetId);
  const selectedInBldg = allAssetIds.filter((id) => selectedIds.has(id));
  const allChecked     = allAssetIds.length > 0 && selectedInBldg.length === allAssetIds.length;
  const someChecked    = selectedInBldg.length > 0 && !allChecked;

  function toggleBuilding(e) {
    e.stopPropagation();
    allAssetIds.forEach((id) => onToggleAsset(id, !allChecked));
  }

  // Summary stats for collapsed header
  const totalAtRiskChf = items.reduce((s, i) => s + (i.estimatedReplacementCostChf ?? 0), 0);
  const nextDue = items.reduce((min, i) => {
    const y = dueYear(i);
    return (y != null && y < min) ? y : min;
  }, 9999);

  return (
    <div className="rounded-2xl border border-surface-border bg-surface overflow-hidden">
      {/* Building header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-subtle transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => { if (el) el.indeterminate = someChecked; }}
          onChange={toggleBuilding}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 shrink-0 rounded border-surface-border accent-brand cursor-pointer"
        />
        {open ? <ChevronDown className="h-4 w-4 text-foreground-dim shrink-0" /> : <ChevronRight className="h-4 w-4 text-foreground-dim shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{buildingName}</p>
          <p className="text-xs text-foreground-dim">
            {loading
              ? t("renovationAccordion.loading", { defaultValue: "Loading…" })
              : err
                ? t("renovationAccordion.error", { defaultValue: "Error" })
                : !loaded
                  ? t("renovationAccordion.expandToLoad", { defaultValue: "Expand to load" })
                  : `${t("renovationAccordion.atRiskCount", { count: items.length, defaultValue: `${items.length} at-risk asset${items.length !== 1 ? "s" : ""}` })}${nextDue < 9999 ? ` · ${t("renovationAccordion.nextDue", { year: nextDue, defaultValue: "next due {{year}}" })}` : ""}`}
          </p>
        </div>
        {totalAtRiskChf > 0 && (
          <span className="text-xs font-semibold tabular-nums text-warning-text shrink-0">
            CHF {Math.round(totalAtRiskChf).toLocaleString("de-CH")}
          </span>
        )}
        {selectedInBldg.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); handleSim(items.filter((i) => selectedIds.has(i.assetId))); }}
            className="text-xs font-semibold bg-brand text-white rounded-lg px-3 py-1 hover:opacity-90 transition-colors shrink-0"
          >
            {t("renovationAccordion.simulateN", { count: selectedInBldg.length, defaultValue: `Simulate ${selectedInBldg.length} →` })}
          </button>
        )}
      </div>

      {/* Expanded: unit rows */}
      {open && !loading && !err && (
        <div className="border-t border-surface-divider">
          {byUnit.length === 0 ? (
            <p className="px-4 py-3 text-xs text-foreground-dim">{t("renovationAccordion.noAtRisk", { defaultValue: "No at-risk assets for this building." })}</p>
          ) : byUnit.map(([unitId, { unitNumber, items: unitItems }]) => (
            <UnitRow
              key={unitId}
              unitNumber={unitNumber}
              items={unitItems}
              selectedIds={selectedIds}
              onToggleAsset={onToggleAsset}
              onSimulate={handleSim}
              buildingId={buildingId}
            />
          ))}
        </div>
      )}
      {open && err && (
        <p className="px-4 py-3 text-xs text-destructive-text border-t border-surface-divider">{err}</p>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function RenovationAccordion({ buildings, onSimulate: externalOnSimulate }) {
  const { t } = useTranslation("manager");
  // buildings: [{ id, name }]
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [simItems,    setSimItems]    = useState(null);
  const [simBuildingId, setSimBuildingId] = useState(null);

  const onToggleAsset = useCallback((assetId, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(assetId) : next.delete(assetId);
      return next;
    });
  }, []);

  // When a parent supplies onSimulate (workspace mode), delegate so it can render
  // the simulation inline; otherwise fall back to the self-contained full-screen drawer.
  const onSimulate = useCallback((items, buildingId) => {
    if (externalOnSimulate) externalOnSimulate(items, buildingId);
    else { setSimItems(items); setSimBuildingId(buildingId ?? null); }
  }, [externalOnSimulate]);

  if (!buildings || buildings.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface p-6 text-center">
        <p className="text-sm text-foreground-dim">{t("renovationAccordion.selectBuildings", { defaultValue: "Select one or more buildings above to see renovation opportunities." })}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {buildings.map((b, i) => (
          <BuildingSection
            key={b.id}
            buildingId={b.id}
            buildingName={b.name}
            selectedIds={selectedIds}
            onToggleAsset={onToggleAsset}
            onSimulate={onSimulate}
            autoExpand={buildings.length === 1 || i === 0}
          />
        ))}
      </div>

      {!externalOnSimulate && simItems && (
        <RenovationSimulatorDrawer
          items={simItems}
          onClose={() => { setSimItems(null); setSimBuildingId(null); }}
          buildingId={simBuildingId ?? buildings[0]?.id ?? null}
        />
      )}
    </>
  );
}
