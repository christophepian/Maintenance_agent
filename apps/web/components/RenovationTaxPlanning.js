/**
 * RenovationTaxPlanning — unified Renovation & Tax Planning tab
 *
 * Combines:
 *   - Swiss renovation classification catalog (51 jobs)
 *   - CapEx projection with timing recommendations
 *   - Qualitative timing guidance
 *
 * Lives inside the Finance hub as a tab.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import Panel from "./layout/Panel";
import Section from "./layout/Section";
import SortableHeader from "./SortableHeader";
import { authHeaders } from "../lib/api";

// ─── Constants ──────────────────────────────────────────────────

const TAX_CATEGORY_STYLES = {
  WERTERHALTEND:      { badge: "bg-green-100 text-green-700",  label: "Value preserving" },
  WERTVERMEHREND:     { badge: "bg-red-100 text-red-700",      label: "Value enhancing" },
  MIXED:              { badge: "bg-amber-100 text-amber-700",  label: "Mixed" },
  ENERGY_ENVIRONMENT: { badge: "bg-blue-100 text-blue-700",    label: "Energy / environment" },
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
  HIGH: "Usually more relevant to schedule in a higher-income year — the full amount is typically deductible immediately.",
  MODERATE: "Timing may matter for the deductible portion — consider income levels when scheduling.",
  LOW: "Timing is often less tax-sensitive because the work is usually capitalized or the deductible portion is small.",
};

const TIMING_BADGE = {
  HIGH: "bg-violet-100 text-violet-700",
  MODERATE: "bg-slate-100 text-slate-600",
  LOW: "bg-gray-50 text-gray-400",
};

const SYSTEM_LABELS = {
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

const SUB_TABS = [
  { key: "catalog", label: "Classification Guide" },
  { key: "capex", label: "CapEx Forecast" },
  { key: "timing", label: "Timing Advisor" },
];

// ─── Helpers ────────────────────────────────────────────────────

function TaxBadge({ category }) {
  const style = TAX_CATEGORY_STYLES[category] || TAX_CATEGORY_STYLES.MIXED;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
      {style.label}
    </span>
  );
}

function TimingBadge({ sensitivity }) {
  const cls = TIMING_BADGE[sensitivity] || TIMING_BADGE.LOW;
  const label = TIMING_LABELS[sensitivity] || sensitivity;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  const cls = accent === "green" ? "text-emerald-700"
    : accent === "red" ? "text-red-600"
    : accent === "blue" ? "text-blue-700"
    : accent === "amber" ? "text-amber-700"
    : "text-gray-900";
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xl font-bold ${cls}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

function fmtChf(v) {
  if (typeof v !== "number") return "—";
  return `CHF ${v.toLocaleString("de-CH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Main Component ─────────────────────────────────────────────

export default function RenovationTaxPlanning() {
  const [subTab, setSubTab] = useState(0);

  // Catalog state
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogFilter, setCatalogFilter] = useState({ system: "", taxCategory: "", search: "" });

  // CapEx state
  const [capex, setCapex] = useState(null);
  const [capexLoading, setCapexLoading] = useState(false);

  // ── Fetch catalog ──
  useEffect(() => {
    setCatalogLoading(true);
    fetch("/api/forecasting/renovation-catalog", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setCatalog(d?.data || []))
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, []);

  // ── Fetch capex projection when tab switches ──
  useEffect(() => {
    if (subTab >= 1 && !capex && !capexLoading) {
      setCapexLoading(true);
      fetch("/api/forecasting/capex-projection", { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => setCapex(d?.data || null))
        .catch(() => {})
        .finally(() => setCapexLoading(false));
    }
  }, [subTab, capex, capexLoading]);

  // ── Filtered catalog ──
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

  // ── Group catalog by building system ──
  const groupedCatalog = useMemo(() => {
    const groups = {};
    for (const entry of filteredCatalog) {
      const sys = entry.buildingSystem;
      if (!groups[sys]) groups[sys] = [];
      groups[sys].push(entry);
    }
    return groups;
  }, [filteredCatalog]);

  // ── Count by category ──
  const categoryCounts = useMemo(() => {
    const counts = { WERTERHALTEND: 0, WERTVERMEHREND: 0, MIXED: 0, ENERGY_ENVIRONMENT: 0 };
    for (const e of catalog) counts[e.taxCategory] = (counts[e.taxCategory] || 0) + 1;
    return counts;
  }, [catalog]);

  return (
    <div className="space-y-3">
      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-700">
          <strong>Decision-support guidance only</strong> — classifications show usual Swiss tax treatment for privately owned rental buildings.
          This is not legal or tax advice. Consult a qualified advisor for your specific situation.
        </p>
      </div>

      {/* Sub-tab strip */}
      <div className="flex gap-1">
        {SUB_TABS.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setSubTab(i)}
            className={subTab === i ? "tab-btn-active" : "tab-btn"}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Sub-tab 0 — Classification Guide ═══ */}
      {subTab === 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Value Preserving" value={categoryCounts.WERTERHALTEND} accent="green" sub="Usually immediately deductible" />
            <StatCard label="Value Enhancing" value={categoryCounts.WERTVERMEHREND} accent="red" sub="Usually capitalized" />
            <StatCard label="Mixed" value={categoryCounts.MIXED} accent="amber" sub="Usually split" />
            <StatCard label="Energy / Environment" value={categoryCounts.ENERGY_ENVIRONMENT} accent="blue" sub="Usually deductible" />
          </div>

          {/* Filters */}
          <Panel>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Building System</label>
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
                <label className="text-xs font-medium text-gray-600">Tax Category</label>
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
                <label className="text-xs font-medium text-gray-600">Search</label>
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
                  className="text-xs text-blue-600 hover:underline pb-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          </Panel>

          <span className="tab-panel-count mt-2">
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
        </>
      )}

      {/* ═══ Sub-tab 1 — CapEx Forecast ═══ */}
      {subTab === 1 && (
        <CapExForecastPanel capex={capex} loading={capexLoading} />
      )}

      {/* ═══ Sub-tab 2 — Timing Advisor ═══ */}
      {subTab === 2 && (
        <TimingAdvisorPanel capex={capex} loading={capexLoading} />
      )}
    </div>
  );
}

// ─── Catalog System Group ───────────────────────────────────────

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
              className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            {expanded ? "Show less" : `Show all ${entries.length} jobs`}
          </div>
        )}
      </Panel>
    </Section>
  );
}

// ─── Catalog Entry Row ──────────────────────────────────────────

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
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
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
                <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-indigo-50 text-indigo-600">
                  Can be linked to inventory assets
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CapEx Forecast Panel ───────────────────────────────────────

function CapExForecastPanel({ capex, loading }) {
  const [expandedBuilding, setExpandedBuilding] = useState(null);

  if (loading) return <p className="loading-text">Loading CapEx projection…</p>;
  if (!capex) return <Panel><div className="empty-state"><p className="empty-state-text">No CapEx projection data available.</p></div></Panel>;

  const { buildings, yearlyTotals, totalProjectedChf, totalDeductibleChf, totalCapitalizedChf, timingRecommendations } = capex;
  const bundlingCount = buildings.reduce((s, b) => s + (b.bundlingAdvice?.length || 0), 0);

  return (
    <>
      {/* Portfolio summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Projected CapEx" value={fmtChf(totalProjectedChf)} />
        <StatCard label="Deductible Portion" value={fmtChf(totalDeductibleChf)} accent="green" sub={`${totalProjectedChf > 0 ? Math.round(totalDeductibleChf / totalProjectedChf * 100) : 0}% of total`} />
        <StatCard label="Capitalized Portion" value={fmtChf(totalCapitalizedChf)} accent="amber" />
        <StatCard label="Timing Opportunities" value={timingRecommendations?.length || 0} accent="blue" sub={bundlingCount > 0 ? `${bundlingCount} bundling suggestion${bundlingCount !== 1 ? "s" : ""}` : undefined} />
      </div>

      {/* Yearly forecast bar chart */}
      {yearlyTotals && yearlyTotals.length > 0 && (() => {
        const BAR_HEIGHT = 140;
        const maxChf = Math.max(...yearlyTotals.map((y) => y.totalChf), 1);
        return (
          <Section title="Yearly CapEx Forecast">
            <Panel>
              <div className="flex items-end gap-2" style={{ height: BAR_HEIGHT + 48 }}>
                {yearlyTotals.map((yt) => {
                  const totalPx = Math.round((yt.totalChf / maxChf) * BAR_HEIGHT);
                  const dedPx = yt.totalChf > 0 ? Math.round((yt.deductibleChf / yt.totalChf) * totalPx) : 0;
                  const capPx = totalPx - dedPx;
                  return (
                    <div key={yt.year} className="flex-1 flex flex-col items-center justify-end">
                      {/* Stacked bar — capitalized on top, deductible on bottom */}
                      <div className="w-full flex flex-col rounded-t-md overflow-hidden" style={{ height: Math.max(totalPx, yt.totalChf > 0 ? 4 : 1) }}>
                        <div className="bg-amber-300 w-full" style={{ height: capPx }} title={`Capitalized: ${fmtChf(yt.capitalizedChf)}`} />
                        <div className="bg-green-400 w-full" style={{ height: dedPx }} title={`Deductible: ${fmtChf(yt.deductibleChf)}`} />
                      </div>
                      <span className="text-xs font-medium text-slate-600 mt-1">{yt.year}</span>
                      <span className="text-xs text-slate-400 leading-tight">{fmtChf(yt.totalChf)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Deductible</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300" /> Capitalized</span>
              </div>
            </Panel>
          </Section>
        );
      })()}

      {/* Per-building breakdown */}
      {buildings.length > 0 && (
        <BuildingBreakdownTable
          buildings={buildings}
          expandedBuilding={expandedBuilding}
          setExpandedBuilding={setExpandedBuilding}
        />
      )}

      {/* Bundling recommendations */}
      {bundlingCount > 0 && (
        <Section title="Bundling Recommendations">
          {buildings.filter((b) => b.bundlingAdvice?.length > 0).map((b) => (
            <div key={b.buildingId} className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700">{b.buildingName}</h4>
              {b.bundlingAdvice.map((adv, i) => (
                <Panel key={i}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-slate-800">{adv.yearRange}</span>
                        <span className="text-xs text-slate-400">{adv.assetCount} asset{adv.assetCount !== 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-xs text-slate-600">{adv.rationale}</p>
                      {adv.savingsBreakdown?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {adv.savingsBreakdown.map((s, j) => (
                            <span key={j} className="inline-block rounded-full px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700">
                              {s.category} ~{s.estimatedPct}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-emerald-700">~{fmtChf(adv.estimatedSavingsChf)}</div>
                      <div className="text-xs text-slate-400">~{adv.savingsEstimatePct}% savings</div>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          ))}
        </Section>
      )}
    </>
  );
}

// ─── Building Breakdown Table (sortable, paginated) ─────────────

const BUILDING_SORT_EXTRACTORS = {
  buildingName: (b) => (b.buildingName || "").toLowerCase(),
  canton: (b) => (b.canton || "").toLowerCase(),
  totalCapEx: (b) => b.totalProjectedChf ?? 0,
  deductible: (b) => b.totalDeductibleChf ?? 0,
  assets: (b) => b.projectedAssetCount ?? 0,
  bundling: (b) => b.bundlingAdvice?.length ?? 0,
};

function BuildingBreakdownTable({ buildings, expandedBuilding, setExpandedBuilding }) {
  const [sortField, setSortField] = useState("totalCapEx");
  const [sortDir, setSortDir] = useState("desc");
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 10;

  const handleSort = useCallback((field) => {
    setSortDir((d) => (sortField === field ? (d === "asc" ? "desc" : "asc") : "desc"));
    setSortField(field);
  }, [sortField]);

  const sorted = useMemo(() => {
    const extract = BUILDING_SORT_EXTRACTORS[sortField] || (() => 0);
    const arr = [...buildings].sort((a, b) => {
      const va = extract(a);
      const vb = extract(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [buildings, sortField, sortDir]);

  const visible = showAll ? sorted : sorted.slice(0, LIMIT);
  const hasMore = sorted.length > LIMIT;

  return (
    <Section title="Per-Building Breakdown">
      <Panel bodyClassName="p-0">
        <div style={{ overflowX: "auto" }}>
          <table className="inline-table">
            <thead>
              <tr>
                <SortableHeader label="Building" field="buildingName" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Canton" field="canton" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Total CapEx" field="totalCapEx" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortableHeader label="Deductible" field="deductible" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortableHeader label="Assets" field="assets" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortableHeader label="Bundling" field="bundling" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <BuildingCapexRow
                  key={b.buildingId}
                  building={b}
                  expanded={expandedBuilding === b.buildingId}
                  onToggle={() => setExpandedBuilding(expandedBuilding === b.buildingId ? null : b.buildingId)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors text-sm text-slate-500 select-none"
            onClick={() => setShowAll((s) => !s)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className={`w-4 h-4 transition-transform duration-200 ${showAll ? "rotate-180" : ""}`}>
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            {showAll ? "Show less" : `Show all ${sorted.length} buildings`}
          </div>
        )}
      </Panel>
    </Section>
  );
}

// ─── Building CapEx Row ─────────────────────────────────────────

function BuildingCapexRow({ building, expanded, onToggle }) {
  const b = building;
  return (
    <>
      <tr className="cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        <td className="cell-bold">{b.buildingName || "Unnamed"}</td>
        <td>{b.canton || "—"}</td>
        <td className="text-right font-mono">{fmtChf(b.totalProjectedChf)}</td>
        <td className="text-right font-mono text-emerald-700">{fmtChf(b.totalDeductibleChf)}</td>
        <td className="text-right">{b.projectedAssetCount}</td>
        <td className="text-right">{b.bundlingAdvice?.length || 0}</td>
        <td className="text-right">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 inline ${expanded ? "rotate-180" : ""}`}>
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </td>
      </tr>
      {expanded && b.yearlyBuckets?.map((bucket) => (
        bucket.items.length > 0 && (
          <tr key={bucket.year} className="bg-slate-50/50">
            <td colSpan={7} className="px-6 py-2">
              <div className="text-xs font-medium text-slate-600 mb-1">{bucket.year} — {bucket.assetCount} asset{bucket.assetCount !== 1 ? "s" : ""} · {fmtChf(bucket.totalChf)}</div>
              <div className="flex flex-wrap gap-1.5">
                {bucket.items.map((item) => (
                  <span key={item.assetId} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-white border border-slate-200">
                    <span className="text-slate-700">{item.assetName}</span>
                    <span className="text-slate-400">{fmtChf(item.estimatedCostChf)}</span>
                    <TaxBadge category={item.taxClassification || "MIXED"} />
                  </span>
                ))}
              </div>
            </td>
          </tr>
        )
      ))}
    </>
  );
}

// ─── Timing Advisor Panel ───────────────────────────────────────

function TimingAdvisorPanel({ capex, loading }) {
  const [expandedRec, setExpandedRec] = useState(null);

  if (loading) return <p className="loading-text">Loading timing analysis…</p>;
  if (!capex) return <Panel><div className="empty-state"><p className="empty-state-text">No projection data available.</p></div></Panel>;

  const recs = capex.timingRecommendations || [];

  if (recs.length === 0) {
    return (
      <Panel>
        <div className="empty-state">
          <p className="empty-state-text">No timing opportunities identified in the current projection horizon.</p>
          <p className="text-xs text-slate-400 mt-1">Timing recommendations appear when deductible assets have scheduling flexibility and income varies across years.</p>
        </div>
      </Panel>
    );
  }

  // Group by building
  const byBuilding = {};
  for (const r of recs) {
    const key = r.buildingId || "unknown";
    if (!byBuilding[key]) byBuilding[key] = { name: r.buildingName || "Unknown", recs: [] };
    byBuilding[key].recs.push(r);
  }

  const totalSaving = recs.reduce((s, r) => s + (r.estimatedTaxSavingChf || 0), 0);

  return (
    <>
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Timing Opportunities" value={recs.length} accent="blue" />
        <StatCard label="Potential Tax Savings" value={fmtChf(totalSaving)} accent="green" sub="If all recommendations are followed" />
        <StatCard
          label="Buildings Affected"
          value={Object.keys(byBuilding).length}
          sub={`of ${capex.buildings?.length || 0} total`}
        />
      </div>

      {/* Qualitative guidance */}
      <Panel>
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-slate-700">How timing affects tax deductions</h4>
          <p className="text-xs text-slate-500">
            For value-preserving maintenance (Werterhaltend), the full cost is typically deductible in the year the work is done.
            Scheduling these in a higher-income year maximizes the tax benefit. For capitalized improvements,
            timing is less relevant since costs are spread over multiple years. The recommendations below
            identify assets where shifting the replacement date could materially change your tax position.
          </p>
        </div>
      </Panel>

      {/* Per-building recommendations */}
      {Object.entries(byBuilding).map(([buildingId, { name, recs: buildingRecs }]) => (
        <Section key={buildingId} title={name}>
          <Panel bodyClassName="p-0">
            <div className="divide-y divide-slate-100">
              {buildingRecs.map((rec) => (
                <TimingRecRow
                  key={`${rec.assetId}-${rec.scheduledYear}`}
                  rec={rec}
                  expanded={expandedRec === `${rec.assetId}-${rec.scheduledYear}`}
                  onToggle={() => setExpandedRec(
                    expandedRec === `${rec.assetId}-${rec.scheduledYear}` ? null : `${rec.assetId}-${rec.scheduledYear}`
                  )}
                />
              ))}
            </div>
          </Panel>
        </Section>
      ))}
    </>
  );
}

// ─── Timing Recommendation Row ──────────────────────────────────

function TimingRecRow({ rec, expanded, onToggle }) {
  const direction = rec.direction === "advance" ? "Advance" : "Defer";
  const yearDiff = Math.abs(rec.recommendedYear - rec.scheduledYear);
  const saving = rec.estimatedTaxSavingChf || 0;
  const additional = rec.additionalSavingChf || 0;

  // Qualitative sensitivity based on deductible percentage + tax saving
  const sensitivity = rec.deductiblePct >= 80 ? "HIGH"
    : rec.deductiblePct >= 40 ? "MODERATE"
    : "LOW";

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800">{rec.assetName}</span>
            {rec.unitNumber && <span className="text-xs text-slate-400">Unit {rec.unitNumber}</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {direction} from {rec.scheduledYear} → {rec.recommendedYear}
            {yearDiff > 0 && <span className="text-slate-400"> ({yearDiff} year{yearDiff !== 1 ? "s" : ""})</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TimingBadge sensitivity={sensitivity} />
          {saving > 0 && (
            <span className="text-sm font-bold text-emerald-700">+{fmtChf(saving)}</span>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-50 bg-slate-50/50">
          {/* Two-column comparison */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <h5 className="text-xs font-semibold text-slate-500 mb-2">
                Scheduled Year ({rec.scheduledYear})
              </h5>
              <div className="space-y-1 text-xs">
                {rec.scheduledYearIncomeChf != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Projected income</span>
                    <span className="font-mono text-slate-700">{fmtChf(rec.scheduledYearIncomeChf)}</span>
                  </div>
                )}
                {rec.scheduledYearMarginalPct != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Marginal rate</span>
                    <span className="font-mono text-slate-700">{rec.scheduledYearMarginalPct.toFixed(1)}%</span>
                  </div>
                )}
                {rec.taxSavingScheduledChf != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax saving</span>
                    <span className="font-mono text-slate-700">{fmtChf(rec.taxSavingScheduledChf)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3">
              <h5 className="text-xs font-semibold text-emerald-600 mb-2">
                Recommended Year ({rec.recommendedYear}) ✓
              </h5>
              <div className="space-y-1 text-xs">
                {rec.recommendedYearIncomeChf != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Projected income</span>
                    <span className="font-mono text-emerald-700">{fmtChf(rec.recommendedYearIncomeChf)}</span>
                  </div>
                )}
                {rec.recommendedYearMarginalPct != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Marginal rate</span>
                    <span className="font-mono text-emerald-700">{rec.recommendedYearMarginalPct.toFixed(1)}%</span>
                  </div>
                )}
                {rec.taxSavingRecommendedChf != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax saving</span>
                    <span className="font-mono font-bold text-emerald-700">{fmtChf(rec.taxSavingRecommendedChf)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detail rows */}
          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
            <div>
              <span className="font-medium text-slate-600">Replacement cost</span>
              <p className="text-slate-500 mt-0.5">{fmtChf(rec.estimatedCostChf)}</p>
            </div>
            <div>
              <span className="font-medium text-slate-600">Deductible portion</span>
              <p className="text-slate-500 mt-0.5">{rec.deductiblePct != null ? `${rec.deductiblePct}%` : "—"}</p>
            </div>
            {rec.bracketSource && (
              <div className="col-span-2">
                <span className="font-medium text-slate-600">Rate source</span>
                <p className="text-slate-500 mt-0.5">{rec.bracketSource}</p>
              </div>
            )}
          </div>

          {/* Rationale */}
          {additional > 0 && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
              <p className="text-xs text-emerald-700">
                <strong>Why this saves money:</strong> {rec.rationale}
              </p>
            </div>
          )}

          {/* Qualitative guidance when no bracket data */}
          {rec.scheduledYearIncomeChf == null && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 mt-2">
              <p className="text-xs text-blue-700">
                <strong>{TIMING_LABELS[sensitivity]}.</strong>{" "}
                {TIMING_GUIDANCE[sensitivity]}
                {sensitivity === "HIGH" && (
                  <> Operational risk may justify proceeding even if timing is not ideal.</>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
