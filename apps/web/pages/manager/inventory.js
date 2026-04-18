import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import ConfigurableTable from "../../components/ConfigurableTable";
import { useTableSort, clientSort } from "../../lib/tableUtils";
import AssetCatalogue from "../../components/AssetCatalogue";
import Link from "next/link";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { authHeaders } from "../../lib/api";

import { cn } from "../../lib/utils";
const INVENTORY_SORT_FIELDS = ["name", "address", "canton", "unitCount", "category", "manufacturer", "scope"];

function inventoryFieldExtractor(row, field) {
  switch (field) {
    case "name": return (row.name || "").toLowerCase();
    case "address": return (row.address || "").toLowerCase();
    case "canton": return (row.canton || "").toLowerCase();
    case "unitCount": return row._count?.units ?? row.unitCount ?? 0;
    case "category": return (row.category || "").toLowerCase();
    case "manufacturer": return (row.manufacturer || "").toLowerCase();
    case "scope": return row.orgId ? "org" : "global";
    default: return "";
  }
}

const BUILDING_COLUMNS = [
  {
    id: "name",
    label: "Name",
    sortable: true,
    alwaysVisible: true,
    render: (b) => <span className="font-medium text-slate-900">{b.name || "Unnamed"}</span>,
  },
  {
    id: "address",
    label: "Address",
    sortable: true,
    defaultVisible: true,
    render: (b) => <span className="text-slate-600">{b.address || "\u2014"}</span>,
  },
  {
    id: "canton",
    label: "Canton",
    sortable: true,
    defaultVisible: true,
    render: (b) => <span className="text-slate-600">{b.canton || "\u2014"}</span>,
  },
  {
    id: "id",
    label: "Building ID",
    defaultVisible: true,
    render: (b) => <code className="code-small">{b.id}</code>,
  },
  {
    id: "unitCount",
    label: "Units",
    sortable: true,
    defaultVisible: false,
    render: (b) => <span className="text-slate-600">{b._count?.units ?? b.unitCount ?? "\u2014"}</span>,
  },
];

const ASSET_MODEL_COLUMNS = [
  {
    id: "name",
    label: "Name",
    sortable: true,
    alwaysVisible: true,
    render: (m) => <span className="font-medium text-slate-900">{m.name}</span>,
  },
  {
    id: "category",
    label: "Category",
    sortable: true,
    defaultVisible: true,
    render: (m) => <span className="text-slate-600">{m.category || "\u2014"}</span>,
  },
  {
    id: "manufacturer",
    label: "Manufacturer",
    sortable: true,
    defaultVisible: true,
    render: (m) => <span className="text-slate-600">{m.manufacturer || "\u2014"}</span>,
  },
  {
    id: "scope",
    label: "Scope",
    sortable: true,
    defaultVisible: true,
    render: (m) => <span className="text-slate-600">{m.orgId ? "Org" : "Global"}</span>,
  },
  {
    id: "usefulLifeMonths",
    label: "Useful Life",
    defaultVisible: false,
    render: (m) => <span className="text-slate-600">{m.usefulLifeMonths ? `${Math.round(m.usefulLifeMonths / 12)}y` : "\u2014"}</span>,
  },
  {
    id: "replacementCostChf",
    label: "Replace Cost",
    defaultVisible: false,
    render: (m) => <span className="text-slate-600">{typeof m.replacementCostChf === "number" ? `CHF ${m.replacementCostChf.toLocaleString()}` : "\u2014"}</span>,
  },
];

const INVENTORY_TABS = [
  { key: "BUILDINGS", label: "Buildings" },
  { key: "VACANCIES", label: "Vacancies", href: "/manager/vacancies" },
  { key: "ASSETS", label: "Assets" },
  { key: "DECISIONS", label: "Maintenance Decisions" },
];

const TAB_KEYS = ['buildings', 'assets', 'decisions'];

const RECOMMENDATION_STYLES = {
  REPAIR: { badge: "bg-green-100 text-green-700", label: "Repair" },
  MONITOR: { badge: "bg-amber-100 text-amber-700", label: "Monitor" },
  PLAN_REPLACEMENT: { badge: "bg-orange-100 text-orange-700", label: "Plan Replacement" },
  REPLACE: { badge: "bg-red-100 text-red-700", label: "Replace" },
};

// Thresholds mirror apps/api/src/services/assetInventory.ts — keep in sync
const REPLACE_RATIO = 0.6;
const PLAN_REPLACEMENT_RATIO = 0.4;
const MONITOR_RATIO = 0.25;
const REPLACE_DEPRECIATION = 100;
const PLAN_DEPRECIATION = 85;
const MONITOR_DEPRECIATION = 65;

function clientSideVerdict(item, hypotheticalCostChf) {
  if (item.estimatedReplacementCostChf == null || item.estimatedReplacementCostChf === 0) return null;
  const projected = (item.cumulativeRepairCostChf || 0) + hypotheticalCostChf;
  const ratio = projected / item.estimatedReplacementCostChf;
  const dep = item.depreciationPct ?? 0;
  if (dep >= REPLACE_DEPRECIATION || ratio >= REPLACE_RATIO) return "REPLACE";
  if (dep >= PLAN_DEPRECIATION || ratio >= PLAN_REPLACEMENT_RATIO) return "PLAN_REPLACEMENT";
  if (dep >= MONITOR_DEPRECIATION || ratio >= MONITOR_RATIO) return "MONITOR";
  return "REPAIR";
}

export default function ManagerInventoryPage() {
  const router = useRouter();
  const activeTab = router.isReady ? (Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true }
    );
  }, [router]);
  const [buildings, setBuildings] = useState([]);
  const [assetModels, setAssetModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Maintenance Decisions tab state
  const [allUnits, setAllUnits] = useState([]);
  const [decisionsUnitId, setDecisionsUnitId] = useState("");
  const [decisionsData, setDecisionsData] = useState(null);
  const [decisionsLoading, setDecisionsLoading] = useState(false);
  const [decisionsError, setDecisionsError] = useState("");
  const [sensitivityInputs, setSensitivityInputs] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bldRes, assetRes] = await Promise.all([
        fetch("/api/buildings", { headers: authHeaders() }),
        fetch("/api/asset-models", { headers: authHeaders() }),
      ]);
      const bldData = await bldRes.json();
      const assetData = await assetRes.json();
      if (!bldRes.ok) throw new Error(bldData?.error?.message || "Failed to load buildings");
      setBuildings(bldData?.data || []);
      const models = Array.isArray(assetData) ? assetData : assetData?.data || [];
      setAssetModels(models);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch all units for the Decisions unit selector
  useEffect(() => {
    fetch("/api/units", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setAllUnits(d?.data || []))
      .catch(() => {});
  }, []);

  const loadDecisions = useCallback(async (unitId) => {
    if (!unitId) { setDecisionsData(null); return; }
    setDecisionsLoading(true);
    setDecisionsError("");
    try {
      const res = await fetch(`/api/units/${unitId}/repair-replace-analysis`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load analysis");
      setDecisionsData(json?.data || []);
    } catch (e) {
      setDecisionsError(String(e?.message || e));
      setDecisionsData(null);
    } finally {
      setDecisionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 2) loadDecisions(decisionsUnitId);
  }, [activeTab, decisionsUnitId, loadDecisions]);

  const [buildingSearch, setBuildingSearch] = useState("");
  const [buildingFormVisible, setBuildingFormVisible] = useState(false);
  const [buildingAddress, setBuildingAddress] = useState("");
  const [buildingCityCode, setBuildingCityCode] = useState("");
  const [buildingCity, setBuildingCity] = useState("");
  const [buildingCountry, setBuildingCountry] = useState("");

  async function onCreateBuilding(e) {
    e.preventDefault();
    const addressLine = buildingAddress.trim();
    const cityCode = buildingCityCode.trim();
    const city = buildingCity.trim();
    const country = buildingCountry.trim();
    if (!addressLine) return setError("Address is required.");
    if (!cityCode) return setError("City code is required.");
    if (!city) return setError("City is required.");
    if (!country) return setError("Country is required.");
    const name = addressLine;
    const address = `${addressLine}, ${cityCode} ${city}, ${country}`;
    try {
      setLoading(true);
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name, address }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to create building");
      setBuildingAddress("");
      setBuildingCityCode("");
      setBuildingCity("");
      setBuildingCountry("");
      setBuildingFormVisible(false);
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const { sortField, sortDir, handleSort } = useTableSort(router, INVENTORY_SORT_FIELDS, { defaultField: "name", defaultDir: "asc" });
  const sortedBuildings = useMemo(() => {
    const sorted = clientSort(buildings, sortField, sortDir, inventoryFieldExtractor);
    if (!buildingSearch.trim()) return sorted;
    const q = buildingSearch.trim().toLowerCase();
    return sorted.filter((b) =>
      (b.name || "").toLowerCase().includes(q) ||
      (b.address || "").toLowerCase().includes(q) ||
      (b.canton || "").toLowerCase().includes(q)
    );
  }, [buildings, sortField, sortDir, buildingSearch]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Inventory" subtitle="Buildings, units, assets and depreciation schedules." />
        <PageContent>
          <ErrorBanner error={error} />

          {/* Tab strip */}
          <div className="tab-strip">
            {(() => {
              let tabIndex = 0;
              return INVENTORY_TABS.map((tab) => {
                if (tab.href) {
                  return (
                    <Link key={tab.key} href={tab.href} className="tab-btn">
                      {tab.label}
                    </Link>
                  );
                }
                const idx = tabIndex++;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(idx)}
                    className={activeTab === idx ? "tab-btn-active" : "tab-btn"}
                  >
                    {tab.label}
                  </button>
                );
              });
            })()}
          </div>

          {/* Count + full-view link — outside the Panel card */}
          <span className="tab-panel-count">
            {activeTab === 0 ? `${sortedBuildings.length} building${sortedBuildings.length !== 1 ? "s" : ""}${buildingSearch.trim() ? ` matching "${buildingSearch.trim()}"` : ""}` : null}
            {activeTab === 1 ? `${assetModels.length} asset model${assetModels.length !== 1 ? "s" : ""}` : null}
            {activeTab === 2 ? "Maintenance decisions — select a unit to see repair vs replace analysis" : null}
          </span>

          <Panel bodyClassName="p-0">
          {/* Buildings tab */}
          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            <div className="px-4 pt-3 pb-2 flex items-center gap-3">
              <input
                type="search"
                placeholder="Search buildings…"
                value={buildingSearch}
                onChange={(e) => setBuildingSearch(e.target.value)}
                className="filter-input w-full max-w-sm mb-0"
              />
              <button
                type="button"
                className="button-primary shrink-0"
                onClick={() => setBuildingFormVisible((v) => !v)}
              >
                {buildingFormVisible ? "Cancel" : "Add"}
              </button>
            </div>
            {buildingFormVisible && (
              <form onSubmit={onCreateBuilding} className="mx-4 mb-3 rounded-xl border border-brand bg-brand-light/30 p-4 grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-full">
                    <label className="filter-label">Address</label>
                    <input className="filter-input w-full" value={buildingAddress} onChange={(e) => setBuildingAddress(e.target.value)} placeholder="e.g. Bahnhofstrasse 12" />
                  </div>
                  <div>
                    <label className="filter-label">City code</label>
                    <input className="filter-input w-full" value={buildingCityCode} onChange={(e) => setBuildingCityCode(e.target.value)} placeholder="e.g. 8001" />
                  </div>
                  <div>
                    <label className="filter-label">City</label>
                    <input className="filter-input w-full" value={buildingCity} onChange={(e) => setBuildingCity(e.target.value)} placeholder="e.g. Zürich" />
                  </div>
                  <div className="col-span-full">
                    <label className="filter-label">Country</label>
                    <input className="filter-input w-full" value={buildingCountry} onChange={(e) => setBuildingCountry(e.target.value)} placeholder="e.g. Switzerland" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="button-secondary" onClick={() => setBuildingFormVisible(false)}>Cancel</button>
                  <button type="submit" className="button-primary" disabled={loading}>Save building</button>
                </div>
              </form>
            )}
            {loading ? (
              <p className="loading-text">Loading buildings…</p>
            ) : buildings.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No buildings found.</p>
              </div>
            ) : (
              <ConfigurableTable
                tableId="inventory-buildings"
                columns={BUILDING_COLUMNS}
                data={sortedBuildings}
                rowKey={(b) => b.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(b) => router.push(`/admin-inventory/buildings/${b.id}?from=/manager/inventory`)}
                emptyState={<p className="text-sm text-slate-500">No buildings found.</p>}
              />
            )}
          </div>

          {/* Assets tab */}
          <div className={activeTab === 1 ? "tab-panel-active p-4" : "tab-panel"}>
            <AssetCatalogue models={assetModels} loading={loading} onRefresh={loadData} />
          </div>
          {/* Decisions tab */}
          <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
            <div className="p-4 border-b border-slate-100">
              <label className="text-xs font-medium text-slate-600 mr-2">Unit</label>
              <select
                value={decisionsUnitId}
                onChange={(e) => { setDecisionsUnitId(e.target.value); setSensitivityInputs({}); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">— Select a unit —</option>
                {allUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.building?.name ? `${u.building.name} · ` : ""}{u.unitNumber}
                  </option>
                ))}
              </select>
            </div>

            {decisionsError && (
              <div className="px-4 py-3 text-sm text-red-700">{decisionsError}</div>
            )}

            {decisionsLoading ? (
              <p className="loading-text">Analysing assets…</p>
            ) : !decisionsUnitId ? (
              <div className="empty-state">
                <p className="empty-state-text">Select a unit to see its repair vs replace analysis.</p>
              </div>
            ) : decisionsData && decisionsData.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No assets recorded for this unit yet.</p>
              </div>
            ) : decisionsData ? (
              <div className="overflow-x-auto">
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Type</th>
                      <th>Age / Life</th>
                      <th>Depreciation</th>
                      <th className="text-right">Repairs (CHF)</th>
                      <th className="text-right">Replace est. (CHF)</th>
                      <th className="text-right">Ratio</th>
                      <th className="text-right">Break-even</th>
                      <th>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisionsData.map((item) => {
                      const ageYears = item.ageMonths != null ? (item.ageMonths / 12).toFixed(1) : "—";
                      const lifeYears = item.usefulLifeMonths != null ? (item.usefulLifeMonths / 12).toFixed(0) : null;
                      const remainYears = item.remainingLifeMonths != null ? (item.remainingLifeMonths / 12).toFixed(1) : null;
                      const ratioDisplay = item.repairToReplacementRatio != null
                        ? `${Math.round(item.repairToReplacementRatio * 100)}%`
                        : "—";
                      const breakEvenDisplay = item.breakEvenMonths != null
                        ? item.breakEvenMonths === 0
                          ? "Exceeded"
                          : item.breakEvenMonths < 12
                            ? `${item.breakEvenMonths} mo`
                            : `${(item.breakEvenMonths / 12).toFixed(1)} yr`
                        : "—";
                      return (
                        <tr key={item.assetId} title={item.recommendationReason}>
                          <td className="cell-bold">{item.assetName}</td>
                          <td className="text-xs text-slate-500">{item.topic}</td>
                          <td>
                            {item.ageMonths != null ? (
                              <span>
                                {ageYears} yr{lifeYears ? ` / ${lifeYears} yr` : ""}
                                {remainYears && <span className="block text-xs text-slate-400">{remainYears} yr left</span>}
                              </span>
                            ) : "—"}
                          </td>
                          <td>
                            {item.depreciationPct != null ? (
                              <span className={item.depreciationPct >= 100 ? "text-red-600 font-semibold" : item.depreciationPct >= 85 ? "text-orange-600 font-semibold" : item.depreciationPct >= 65 ? "text-amber-600 font-semibold" : "text-slate-700"}>
                                {item.depreciationPct}%
                              </span>
                            ) : "—"}
                          </td>
                          <td className="text-right">
                            {item.cumulativeRepairCostChf > 0
                              ? item.cumulativeRepairCostChf.toLocaleString("de-CH", { minimumFractionDigits: 0 })
                              : "—"}
                            {item.annualRepairRate != null && item.annualRepairRate > 0 && (
                              <span className="block text-xs text-slate-400">
                                ~{item.annualRepairRate.toLocaleString("de-CH")}/yr
                              </span>
                            )}
                            {item.estimatedReplacementCostChf != null ? (
                              <div className="mt-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  placeholder="0"
                                  aria-label="Hypothetical next repair cost in CHF"
                                  value={sensitivityInputs[item.assetId] ?? ""}
                                  onChange={(e) => setSensitivityInputs((prev) => ({ ...prev, [item.assetId]: e.target.value }))}
                                  className="w-24 rounded border border-slate-200 px-2 py-1 text-xs text-right focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                />
                                <span className="block text-xs text-slate-400 mt-0.5">If next repair CHF</span>
                              </div>
                            ) : (
                              <span className="block text-xs text-slate-400 mt-1">Sensitivity unavailable</span>
                            )}
                          </td>
                          <td className="text-right">
                            {item.estimatedReplacementCostChf != null
                              ? item.estimatedReplacementCostChf.toLocaleString("de-CH", { minimumFractionDigits: 0 })
                              : "—"}
                            {item.replacementCostConfidence != null && (
                              <span className="block text-xs text-slate-400">
                                {Math.round(item.replacementCostConfidence * 100)}% conf.
                              </span>
                            )}
                          </td>
                          <td className={cn("text-right font-medium", item.repairToReplacementRatio != null
                              ? item.repairToReplacementRatio >= 0.6 ? "text-red-600" : item.repairToReplacementRatio >= 0.4 ? "text-orange-600" : item.repairToReplacementRatio >= 0.25 ? "text-amber-600" : "text-slate-700"
                              : "text-slate-400")}>
                            {ratioDisplay}
                          </td>
                          <td className={cn("text-right", item.breakEvenMonths != null && item.breakEvenMonths <= 12 ? "text-red-600 font-semibold" : item.breakEvenMonths != null && item.breakEvenMonths <= 36 ? "text-amber-600" : "text-slate-700")}>
                            {breakEvenDisplay}
                          </td>
                          <td>
                            {(() => {
                              // If user entered a sensitivity value, show only the projected verdict
                              const raw = sensitivityInputs[item.assetId];
                              const hyp = raw != null && raw !== "" ? Number(raw) : null;
                              const projected = hyp != null && hyp > 0 ? clientSideVerdict(item, hyp) : null;
                              const effectiveRec = projected || item.recommendation;
                              const effectiveStyle = RECOMMENDATION_STYLES[effectiveRec] || RECOMMENDATION_STYLES.REPAIR;
                              const changed = projected && projected !== item.recommendation;
                              return (
                                <div>
                                  <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", effectiveStyle.badge)}>
                                    {effectiveStyle.label}
                                  </span>
                                  {changed && (
                                    <span className="block text-[10px] text-slate-400 mt-0.5">
                                      was: {(RECOMMENDATION_STYLES[item.recommendation] || RECOMMENDATION_STYLES.REPAIR).label}
                                    </span>
                                  )}
                                  {/* Transparent analysis: show why */}
                                  <div className="mt-1 text-[10px] text-slate-400 leading-snug max-w-[160px]">
                                    {item.repairToReplacementRatio != null && (
                                      <span className="block">
                                        Ratio {Math.round((hyp != null && hyp > 0 ? ((item.cumulativeRepairCostChf || 0) + hyp) / item.estimatedReplacementCostChf : item.repairToReplacementRatio) * 100)}%
                                        {" "}(≥60%→Replace)
                                      </span>
                                    )}
                                    {item.depreciationPct != null && (
                                      <span className="block">
                                        Depr. {item.depreciationPct}% (≥100%→Replace)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Legend */}
                <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                  <p><strong>Ratio</strong> = cumulative repair cost ÷ estimated replacement cost. Above 60% → Replace.</p>
                  <p><strong>Break-even</strong> = at current repair rate, when total repairs will exceed replacement cost.</p>
                  <p><strong>Warranty offset</strong>: new appliances typically carry {decisionsData[0]?.warrantyOffsetMonths || 24} months warranty coverage.</p>
                  <p className="italic">Hover a row for the recommendation reason.</p>
                </div>
              </div>
            ) : null}
          </div>
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
