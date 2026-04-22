/**
 * RenovationTaxPlanning — Renovation & Tax Planning tab
 *
 * Contains:
 *   - CapExSummaryBridge: compact portfolio CapEx snapshot + link to
 *     Planning tab where full cashflow plans live.
 *   - Swiss renovation classification catalog (51 jobs) with filters.
 *
 * The former "CapEx Forecast" and "Timing Advisor" sub-tabs have been
 * removed. Full CapEx detail and actionable timing recommendations now
 * live inside cashflow plan detail pages (/manager/cashflow/[id]).
 */
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Panel from "./layout/Panel";
import Section from "./layout/Section";
import { authHeaders } from "../lib/api";
import Badge from "./ui/Badge";
import { taxVariant } from "../lib/statusVariants";
import { cn } from "../lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const TAX_CATEGORY_STYLES = {
  WERTERHALTEND:      { label: "Value preserving" },
  WERTVERMEHREND:     { label: "Value enhancing" },
  MIXED:              { label: "Mixed" },
  ENERGY_ENVIRONMENT: { label: "Energy / environment" },
};

const ACCOUNTING_LABELS = {
  IMMEDIATE_DEDUCTION: "Usually expensed in current year",
  CAPITALIZED: "Usually capitalized over useful life",
  SPLIT: "Usually split between maintenance and improvement",
  ENERGY_DEDUCTION: "Usually deductible as energy/environment measure",
};

const TIMING_LABELS = {
  HIGH: "Timing likely matters a lot",
  MODERATE: "Timing likely matters moderately",
  LOW: "Timing likely matters little",
};

const TIMING_GUIDANCE = {
  FACADE: "Facade",
  WINDOWS: "Windows",
  ROOF: "Roof / Terrace",
  INTERIOR: "Interior",
  COMMON_AREAS: "Common Areas",
  BATHROOM: "Bathroom",
  KITCHEN: "Kitchen",
  APPLIANCES: "Appliances",
  MEP: "MEP / Utilities",
  EXTERIOR: "Exterior / Grounds",
  LAUNDRY: "Laundry",
};

const SYSTEM_LABELS = TIMING_GUIDANCE;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtChf(v) {
  if (typeof v !== "number") return "—";
  return `CHF ${v.toLocaleString("de-CH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function TaxBadge({ category }) {
  const style = TAX_CATEGORY_STYLES[category] || TAX_CATEGORY_STYLES.MIXED;
  return (
    <Badge variant={taxVariant(category)} size="sm">
      {style.label}
    </Badge>
  );
}

const TIMING_VARIANT = {
  HIGH: "warning",
  MODERATE: "default",
  LOW: "muted",
};
function TimingBadge({ sensitivity }) {
  const label = TIMING_LABELS[sensitivity] || sensitivity;
  return (
    <Badge variant={TIMING_VARIANT[sensitivity] || "muted"} size="sm">
      {label}
    </Badge>
  );
}

// ─── CapEx Summary Bridge ─────────────────────────────────────────────────────

function CapExSummaryBridge() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/forecasting/capex-projection", { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) setData(json.data);
        else setError("No projection data available.");
      })
      .catch(() => setError("Could not load CapEx projection."))
      .finally(() => setLoading(false));
  }, []);

  const nearestYear = data?.yearlyTotals?.find((y) => y.totalChf > 0)?.year ?? null;
  const timingCount = data?.timingRecommendations?.length ?? 0;

  return (
    <Panel>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">CapEx Outlook</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Portfolio-level projection from asset depreciation standards.
              Full scenario planning and actionable timing recommendations are
              available in cashflow plans.
            </p>
          </div>
          <Link
            href="/manager/finance?tab=planning"
            className="shrink-0 button-secondary text-xs"
          >
            View cashflow plans →
          </Link>
        </div>

        {loading && (
          <p className="loading-text text-xs">Loading CapEx projection…</p>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">{error}</p>
            <Link href="/manager/finance?tab=planning" className="text-xs text-brand hover:underline">
              Open Planning tab →
            </Link>
          </div>
        )}

        {!loading && data && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card mb-0 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total projected CapEx</span>
              <span className="text-lg font-bold text-amber-700">{fmtChf(data.totalProjectedChf)}</span>
              <span className="text-xs text-slate-400">Across all buildings</span>
            </div>
            <div className="card mb-0 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Timing opportunities</span>
              <span className="text-lg font-bold text-brand">{timingCount}</span>
              <span className="text-xs text-slate-400">
                {timingCount > 0
                  ? "Scheduling shifts could save tax"
                  : "No opportunities identified"}
              </span>
            </div>
            <div className="card mb-0 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Nearest replacement year</span>
              <span className="text-lg font-bold text-slate-800">{nearestYear ?? "—"}</span>
              <span className="text-xs text-slate-400">First year with projected spend</span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RenovationTaxPlanning() {
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogFilter, setCatalogFilter] = useState({ system: "", taxCategory: "", search: "" });

  useEffect(() => {
    setCatalogLoading(true);
    fetch("/api/forecasting/renovation-catalog", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setCatalog(d?.data || []))
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, []);

  const filteredCatalog = useMemo(() => {
    let items = catalog;
    if (catalogFilter.system) {
      items = items.filter((e) => e.buildingSystem === catalogFilter.system);
    }
    if (catalogFilter.taxCategory) {
      items = items.filter((e) => e.taxCategory === catalogFilter.taxCategory);
    }
    if (catalogFilter.search) {
      const q = catalogFilter.search.toLowerCase();
      items = items.filter((e) =>
        e.label.toLowerCase().includes(q) ||
        (e.aliases || []).some((a) => a.toLowerCase().includes(q)) ||
        e.code.toLowerCase().includes(q)
      );
    }
    return items;
  }, [catalog, catalogFilter]);

  const groupedCatalog = useMemo(() => {
    const groups = {};
    for (const entry of filteredCatalog) {
      const sys = entry.buildingSystem;
      if (!groups[sys]) groups[sys] = [];
      groups[sys].push(entry);
    }
    return groups;
  }, [filteredCatalog]);

  const categoryCounts = useMemo(() => {
    const counts = { WERTERHALTEND: 0, WERTVERMEHREND: 0, MIXED: 0, ENERGY_ENVIRONMENT: 0 };
    for (const e of catalog) counts[e.taxCategory] = (counts[e.taxCategory] || 0) + 1;
    return counts;
  }, [catalog]);

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-700">
          <strong>Decision-support guidance only</strong> — classifications show usual Swiss tax treatment for privately owned rental buildings.
          This is not legal or tax advice. Consult a qualified advisor for your specific situation.
        </p>
      </div>

      {/* CapEx summary bridge — links to Planning tab for full detail */}
      <CapExSummaryBridge />

      {/* Classification Guide — category summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card mb-0 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Value Preserving</span>
          <span className="text-xl font-bold text-green-700">{categoryCounts.WERTERHALTEND}</span>
          <span className="text-xs text-slate-400">Usually immediately deductible</span>
        </div>
        <div className="card mb-0 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Value Enhancing</span>
          <span className="text-xl font-bold text-red-600">{categoryCounts.WERTVERMEHREND}</span>
          <span className="text-xs text-slate-400">Usually capitalized</span>
        </div>
        <div className="card mb-0 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Mixed</span>
          <span className="text-xl font-bold text-amber-700">{categoryCounts.MIXED}</span>
          <span className="text-xs text-slate-400">Usually split</span>
        </div>
        <div className="card mb-0 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Energy / Environment</span>
          <span className="text-xl font-bold text-blue-700">{categoryCounts.ENERGY_ENVIRONMENT}</span>
          <span className="text-xs text-slate-400">Usually deductible</span>
        </div>
      </div>

      {/* Catalog filters */}
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Building System</label>
            <select
              value={catalogFilter.system}
              onChange={(e) => setCatalogFilter((f) => ({ ...f, system: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All systems</option>
              {Object.entries(SYSTEM_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Tax Category</label>
            <select
              value={catalogFilter.taxCategory}
              onChange={(e) => setCatalogFilter((f) => ({ ...f, taxCategory: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              {Object.entries(TAX_CATEGORY_STYLES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Search</label>
            <input
              type="text"
              value={catalogFilter.search}
              onChange={(e) => setCatalogFilter((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search renovation jobs…"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-56"
            />
          </div>
          {(catalogFilter.system || catalogFilter.taxCategory || catalogFilter.search) && (
            <button
              onClick={() => setCatalogFilter({ system: "", taxCategory: "", search: "" })}
              className="text-xs text-brand hover:underline pb-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </Panel>

      <span className="tab-panel-count">
        {filteredCatalog.length} renovation job{filteredCatalog.length !== 1 ? "s" : ""}
        {filteredCatalog.length !== catalog.length ? ` (of ${catalog.length} total)` : ""}
      </span>

      {/* Grouped catalog */}
      {catalogLoading ? (
        <p className="loading-text">Loading classification catalog…</p>
      ) : Object.keys(groupedCatalog).length === 0 ? (
        <Panel>
          <div className="empty-state">
            <p className="empty-state-text">No renovation jobs match your filters.</p>
          </div>
        </Panel>
      ) : (
        Object.entries(groupedCatalog).map(([system, entries]) => (
          <CatalogSystemGroup key={system} system={system} entries={entries} />
        ))
      )}
    </div>
  );
}

// ─── Catalog System Group ─────────────────────────────────────────────────────

function CatalogSystemGroup({ system, entries }) {
  const [expanded, setExpanded] = useState(false);
  const label = SYSTEM_LABELS[system] || system;
  const preview = expanded ? entries : entries.slice(0, 3);
  const hasMore = entries.length > 3;

  return (
    <Section title={label}>
      <Panel bodyClassName="p-0">
        <div className="divide-y divide-slate-100">
          {preview.map((entry) => (
            <CatalogEntryRow key={entry.code} entry={entry} />
          ))}
        </div>
        {hasMore && (
          <div
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors text-sm text-slate-500 select-none"
            onClick={() => setExpanded((e) => !e)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className={cn("w-4 h-4 transition-transform duration-200", expanded ? "rotate-180" : "")}>
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            {expanded ? "Show less" : `Show all ${entries.length} jobs`}
          </div>
        )}
      </Panel>
    </Section>
  );
}

// ─── Catalog Entry Row ────────────────────────────────────────────────────────

function CatalogEntryRow({ entry }) {
  const [open, setOpen] = useState(false);
  const accounting = ACCOUNTING_LABELS[entry.accountingTreatment] || entry.accountingTreatment;

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800">{entry.label}</span>
            <span className="text-xs text-slate-400 font-mono">{entry.code}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{accounting}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TaxBadge category={entry.taxCategory} />
          <TimingBadge sensitivity={entry.timingSensitivity} />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", open ? "rotate-180" : "")}>
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-50 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-medium text-slate-600">Deductibility</span>
              <p className="text-slate-500 mt-0.5">{entry.typicalDeductibility}</p>
            </div>
            <div>
              <span className="font-medium text-slate-600">Deductible portion</span>
              <p className="text-slate-500 mt-0.5">{entry.deductiblePct}%</p>
            </div>
            <div>
              <span className="font-medium text-slate-600">Timing guidance</span>
              <p className="text-slate-500 mt-0.5">
                {TIMING_GUIDANCE[entry.timingSensitivity] || "—"}
              </p>
            </div>
            <div>
              <span className="font-medium text-slate-600">Notes</span>
              <p className="text-slate-500 mt-0.5">{entry.notes || "—"}</p>
            </div>
            {entry.assetLinkable && (
              <div className="col-span-full">
                <Badge variant="brand" size="sm">
                  Can be linked to inventory assets
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
