import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import ConfigurableTable from "../../components/ConfigurableTable";
import { useLocalSort, clientSort } from "../../lib/tableUtils";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SortToggle, SortPanelBody, SortRow } from "../../components/ui/FilterPanel";
import SortableHeader from "../../components/SortableHeader";
import AssetCatalogue from "../../components/AssetCatalogue";
import Link from "next/link";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { authHeaders } from "../../lib/api";

import { cn } from "../../lib/utils";
import { formatChfCents, formatPercent } from "../../lib/format";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";
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

function buildBuildingColumns(t) {
  return [
  {
    id: "name",
    label: t("manager:inventory.col.name"),
    sortable: true,
    alwaysVisible: true,
    render: (b) => <span className="font-medium text-foreground">{b.name || "Unnamed"}</span>,
  },
  {
    id: "address",
    label: t("manager:inventory.col.address"),
    sortable: true,
    defaultVisible: true,
    render: (b) => <span className="text-muted-text">{b.address || "\u2014"}</span>,
  },
  {
    id: "canton",
    label: t("manager:inventory.col.canton"),
    sortable: true,
    defaultVisible: true,
    render: (b) => <span className="text-muted-text">{b.canton || "\u2014"}</span>,
  },
  {
    id: "id",
    label: t("manager:inventory.col.buildingId"),
    defaultVisible: true,
    render: (b) => <code className="code-small">{b.id}</code>,
  },
  {
    id: "unitCount",
    label: t("manager:inventory.col.units"),
    sortable: true,
    defaultVisible: false,
    render: (b) => <span className="text-muted-text">{b._count?.units ?? b.unitCount ?? "\u2014"}</span>,
  },
  {
    id: "health",
    label: t("manager:inventory.col.health"),
    defaultVisible: true,
    render: (b) => {
      const h = b._financial?.health;
      if (!h) return <span className="text-foreground-dim">\u2014</span>;
      const dot = { green: "bg-green-500 ring-green-200", amber: "bg-amber-500 ring-amber-200", red: "bg-red-500 ring-red-200" }[h] ?? "bg-slate-400 ring-slate-200";
      return (
        <span className={cn("inline-block h-2.5 w-2.5 rounded-full ring-2", dot)}>
          <span className="sr-only">{h}</span>
        </span>
      );
    },
  },
  {
    id: "netIncome",
    label: t("manager:inventory.col.noiYtd"),
    defaultVisible: true,
    render: (b) => {
      const n = b._financial?.netIncomeCents;
      if (n == null) return <span className="text-foreground-dim">\u2014</span>;
      return <span className={cn("text-sm font-medium tabular-nums", n >= 0 ? "text-green-700" : "text-red-600")}>{formatChfCents(n)}</span>;
    },
  },
  {
    id: "collectionRate",
    label: t("manager:inventory.col.collection"),
    defaultVisible: true,
    render: (b) => {
      const r = b._financial?.collectionRate;
      if (r == null) return <span className="text-foreground-dim">\u2014</span>;
      return <span className={cn("text-sm tabular-nums", r >= 0.95 ? "text-green-700" : r >= 0.8 ? "text-amber-700" : "text-red-600")}>{formatPercent(r)}</span>;
    },
  },
];
}

function buildAssetModelColumns(t) {
  return [
  {
    id: "name",
    label: t("manager:inventory.col.name"),
    sortable: true,
    alwaysVisible: true,
    render: (m) => <span className="font-medium text-foreground">{m.name}</span>,
  },
  {
    id: "category",
    label: t("manager:inventory.col.category"),
    sortable: true,
    defaultVisible: true,
    render: (m) => <span className="text-muted-text">{m.category || "\u2014"}</span>,
  },
  {
    id: "manufacturer",
    label: t("manager:inventory.col.manufacturer"),
    sortable: true,
    defaultVisible: true,
    render: (m) => <span className="text-muted-text">{m.manufacturer || "\u2014"}</span>,
  },
  {
    id: "scope",
    label: t("manager:inventory.col.scope"),
    sortable: true,
    defaultVisible: true,
    render: (m) => <span className="text-muted-text">{m.orgId ? "Org" : "Global"}</span>,
  },
  {
    id: "usefulLifeMonths",
    label: t("manager:inventory.col.usefulLife"),
    defaultVisible: false,
    render: (m) => <span className="text-muted-text">{m.usefulLifeMonths ? `${Math.round(m.usefulLifeMonths / 12)}y` : "\u2014"}</span>,
  },
  {
    id: "replacementCostChf",
    label: t("manager:inventory.col.replaceCost"),
    defaultVisible: false,
    render: (m) => <span className="text-muted-text">{typeof m.replacementCostChf === "number" ? `CHF ${m.replacementCostChf.toLocaleString()}` : "\u2014"}</span>,
  },
];
}

function buildInventoryTabs(t) {
  return [
    { key: "BUILDINGS", label: t("manager:inventory.tabs.buildings") },
    { key: "VACANCIES", label: t("manager:inventory.tabs.vacancies"), href: "/manager/vacancies" },
    { key: "ASSETS", label: t("manager:inventory.tabs.assets") },
    { key: "DECISIONS", label: t("manager:inventory.tabs.decisions") },
  ];
}

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
  const { t } = useTranslation("manager");
  const assetModelColumns = useMemo(() => buildAssetModelColumns(t), [t]);
  const buildingColumns = useMemo(() => buildBuildingColumns(t), [t]);
  const INVENTORY_TABS = useMemo(() => buildInventoryTabs(t), [t]);
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

  const { sortField: decSF, sortDir: decSD, handleSort: handleDecSort } = useLocalSort("assetName", "asc");
  const sortedDecisions = useMemo(() => {
    if (!decisionsData) return [];
    return clientSort(decisionsData, decSF, decSD, (item, f) => {
      if (f === "assetName") return (item.assetName || "").toLowerCase();
      if (f === "type") return (item.topic || "").toLowerCase();
      if (f === "depreciation") return item.depreciationPct ?? 0;
      if (f === "repairs") return item.cumulativeRepairCostChf ?? 0;
      if (f === "replace") return item.estimatedReplacementCostChf ?? 0;
      if (f === "ratio") return item.repairToReplacementRatio ?? 0;
      if (f === "recommendation") return item.recommendation || "";
      if (f === "ageMonths") return item.ageMonths ?? 0;
      if (f === "breakEvenMonths") return item.breakEvenMonths ?? 9999;
      return "";
    });
  }, [decisionsData, decSF, decSD]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const from = `${now.getFullYear()}-01-01`;
      const to = now.toISOString().slice(0, 10);
      const [bldRes, assetRes, pfRes] = await Promise.all([
        fetch("/api/buildings", { headers: authHeaders() }),
        fetch("/api/asset-models", { headers: authHeaders() }),
        fetch(`/api/financials/portfolio-summary?from=${from}&to=${to}`, { headers: authHeaders() }).catch(() => null),
      ]);
      const bldData = await bldRes.json();
      const assetData = await assetRes.json();
      if (!bldRes.ok) throw new Error(bldData?.error?.message || "Failed to load buildings");

      // Build financial lookup map: buildingId → { health, netIncomeCents, collectionRate }
      const pfMap = new Map();
      if (pfRes?.ok) {
        const pfData = await pfRes.json();
        (pfData?.data?.buildings || []).forEach((pf) => {
          pfMap.set(pf.buildingId, {
            health: pf.health,
            netIncomeCents: pf.netIncomeCents,
            collectionRate: pf.collectionRate,
          });
        });
      }

      const rawBuildings = bldData?.data || [];
      setBuildings(rawBuildings.map((b) => ({ ...b, _financial: pfMap.get(b.id) ?? null })));
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
  const [buildingCantonFilter, setBuildingCantonFilter] = useState("");
  const [buildingFilterOpen, setBuildingFilterOpen] = useState(false);
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

  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [sortOpen, setSortOpen] = useState(false);
  const handleSort = useCallback((field, dir) => {
    setSortField(field);
    setSortDir(dir !== undefined ? dir : (field === sortField ? (sortDir === "asc" ? "desc" : "asc") : "asc"));
  }, [sortField, sortDir]);
  const sortActive = sortField !== "name";
  const sortedBuildings = useMemo(() => {
    const sorted = clientSort(buildings, sortField, sortDir, inventoryFieldExtractor);
    let filtered = sorted;
    if (buildingCantonFilter) filtered = filtered.filter((b) => (b.canton || "") === buildingCantonFilter);
    if (!buildingSearch.trim()) return filtered;
    const q = buildingSearch.trim().toLowerCase();
    return sorted.filter((b) =>
      (b.name || "").toLowerCase().includes(q) ||
      (b.address || "").toLowerCase().includes(q) ||
      (b.canton || "").toLowerCase().includes(q)
    );
  }, [buildings, sortField, sortDir, buildingSearch, buildingCantonFilter]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title={t("manager:inventory.title.properties")} subtitle={t("manager:inventory.prop.buildingsUnitsAssetsAndDepreciationSchedules")} />
        <PageContent>
          <ErrorBanner error={error} />

          {/* Tab strip + count label — wrapped in a div so space-y-6 from
              PageContent doesn't insert a 24px gap between the two. */}
          <div>
          <ScrollableTabs activeIndex={[0, 2, 3][activeTab] ?? 0}>
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
          </ScrollableTabs>

          {/* Count + full-view link */}
          <span className="tab-panel-count">
            {activeTab === 0 ? `${sortedBuildings.length} building${sortedBuildings.length !== 1 ? "s" : ""}${buildingCantonFilter ? ` in ${buildingCantonFilter}` : ""}${buildingSearch.trim() ? ` matching "${buildingSearch.trim()}"` : ""}` : null}
            {activeTab === 1 ? `${assetModels.length} asset model${assetModels.length !== 1 ? "s" : ""}` : null}
            {activeTab === 2 ? "Maintenance decisions — select a unit to see repair vs replace analysis" : null}
          </span>
          </div>

          {/* Buildings tab */}
          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            <div className="pt-1 pb-2 flex flex-col gap-4">
              {buildingFormVisible && (
                <form onSubmit={onCreateBuilding} className="rounded-xl border border-brand bg-brand-light/30 p-4 grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-full">
                    <label className="filter-label">{t("manager:inventory.text.address")}</label>
                    <input className="filter-input w-full" value={buildingAddress} onChange={(e) => setBuildingAddress(e.target.value)} placeholder={t("manager:inventory.placeholder.eGBahnhofstrasse12")} />
                  </div>
                  <div>
                    <label className="filter-label">{t("manager:inventory.text.cityCode")}</label>
                    <input className="filter-input w-full" value={buildingCityCode} onChange={(e) => setBuildingCityCode(e.target.value)} placeholder={t("manager:inventory.placeholder.eG8001")} />
                  </div>
                  <div>
                    <label className="filter-label">{t("manager:inventory.text.city")}</label>
                    <input className="filter-input w-full" value={buildingCity} onChange={(e) => setBuildingCity(e.target.value)} placeholder={t("manager:inventory.placeholder.eGZRich")} />
                  </div>
                  <div className="col-span-full">
                    <label className="filter-label">{t("manager:inventory.text.country")}</label>
                    <input className="filter-input w-full" value={buildingCountry} onChange={(e) => setBuildingCountry(e.target.value)} placeholder={t("manager:inventory.placeholder.eGSwitzerland")} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="button-secondary" onClick={() => setBuildingFormVisible(false)}>{t("manager:inventory.text.cancel")}</button>
                  <button type="submit" className="button-primary" disabled={loading}>{t("manager:inventory.text.saveBuilding")}</button>
                </div>
              </form>
              )}
              <div className="flex items-center justify-end">
                {/* Add building button */}
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
                  onClick={() => setBuildingFormVisible((v) => !v)}
                >
                  {buildingFormVisible ? "Cancel" : "+ Add"}
                </button>
              </div>
            </div>
            {loading ? (
              <p className="loading-text">{t("manager:inventory.text.loadingBuildings")}</p>
            ) : buildings.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">{t("manager:inventory.text.noBuildingsFound")}</p>
              </div>
            ) : (
              <ConfigurableTable
                tableId="inventory-buildings"
                columns={buildingColumns}
                data={sortedBuildings}
                rowKey={(b) => b.id}
                toolbarSlot={
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="search"
                      placeholder={t("manager:inventory.placeholder.searchBuildings")}
                      value={buildingSearch}
                      onChange={(e) => setBuildingSearch(e.target.value)}
                      className="filter-input flex-1 min-w-0 mb-0"
                    />
                    <FilterToggle open={buildingFilterOpen} onToggle={() => setBuildingFilterOpen((v) => !v)} activeCount={buildingCantonFilter ? 1 : 0} />
                    <SortToggle open={sortOpen} onToggle={() => setSortOpen((v) => !v)} active={sortActive} />
                  </div>
                }
                toolbarPanel={
                  <>
                    {buildingFilterOpen && (
                      <FilterPanelBody>
                        <FilterSection title={t("manager:inventory.text.canton")} first>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <select
                              className="filter-input w-full"
                              value={buildingCantonFilter}
                              onChange={(e) => setBuildingCantonFilter(e.target.value)}
                              aria-label={t("manager:inventory.ariaLabel.filterByCanton")}
                            >
                              <option value="">{t("manager:inventory.text.allCantons")}</option>
                              {[...new Set(buildings.map((b) => b.canton).filter(Boolean))].sort().map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        </FilterSection>
                        <FilterSectionClear hasFilter={!!buildingCantonFilter} onClear={() => { setBuildingCantonFilter(""); setBuildingFilterOpen(false); }} />
                      </FilterPanelBody>
                    )}
                    {sortOpen && (
                      <SortPanelBody>
                        <SortRow active={sortField === "name"} dir={sortField === "name" ? sortDir : "asc"} label="Name" ascLabel="A → Z" descLabel="Z → A" onSelect={(dir) => handleSort("name", dir)} />
                        <SortRow active={sortField === "unitCount"} dir={sortField === "unitCount" ? sortDir : "desc"} label="Units" descLabel="Most first" ascLabel="Fewest first" onSelect={(dir) => handleSort("unitCount", dir)} />
                        <SortRow active={sortField === "canton"} dir={sortField === "canton" ? sortDir : "asc"} label="Canton" ascLabel="A → Z" descLabel="Z → A" onSelect={(dir) => handleSort("canton", dir)} />
                      </SortPanelBody>
                    )}
                  </>
                }
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(b) => router.push(`/admin-inventory/buildings/${b.id}?from=/manager/inventory`)}
                emptyState={<p className="text-sm text-muted">{t("manager:inventory.text.noBuildingsFound")}</p>}
                mobileCard={(b) => {
                  const h = b._financial?.health;
                  const dot = h ? ({ green: "bg-green-500 ring-green-200", amber: "bg-amber-500 ring-amber-200", red: "bg-red-500 ring-red-200" }[h] ?? "bg-slate-400 ring-slate-200") : null;
                  const n = b._financial?.netIncomeCents;
                  const r = b._financial?.collectionRate;
                  return (
                    <div className="table-card">
                      <div className="flex items-center gap-2">
                        {dot && <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2", dot)}><span className="sr-only">{h}</span></span>}
                        <p className="table-card-head">{b.name || "Unnamed"}</p>
                      </div>
                      <p className="table-card-sub">{b.address || "—"}</p>
                      <div className="table-card-footer">
                        {b.canton && <span>{b.canton}</span>}
                        {(b._count?.units ?? b.unitCount) != null && (
                          <span>{b._count?.units ?? b.unitCount} unit{(b._count?.units ?? b.unitCount) !== 1 ? "s" : ""}</span>
                        )}
                        {n != null && (
                          <span className={n >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium"}>{formatChfCents(n)}</span>
                        )}
                        {r != null && (
                          <span className={r >= 0.95 ? "text-green-700" : r >= 0.8 ? "text-amber-700" : "text-red-600"}>{formatPercent(r)}</span>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </div>

          {/* Assets tab */}
          <div className={activeTab === 1 ? "tab-panel-active p-4" : "tab-panel"}>
            <AssetCatalogue models={assetModels} loading={loading} onRefresh={loadData} />
          </div>
          {/* Decisions tab */}
          <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
            <div className="p-4 border-b border-surface-divider">
              <label className="text-xs font-medium text-muted-text mr-2">{t("manager:inventory.text.unit")}</label>
              <select
                value={decisionsUnitId}
                onChange={(e) => { setDecisionsUnitId(e.target.value); setSensitivityInputs({}); }}
                className="rounded-lg border border-surface-border px-3 py-2 text-sm"
              >
                <option value="">{t("manager:inventory.text.selectAUnit")}</option>
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
              <p className="loading-text">{t("manager:inventory.text.analysingAssets")}</p>
            ) : !decisionsUnitId ? (
              <div className="empty-state">
                <p className="empty-state-text">{t("manager:inventory.text.selectAUnitToSeeItsRepairVsReplaceAnalysis")}</p>
              </div>
            ) : decisionsData && decisionsData.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">{t("manager:inventory.text.noAssetsRecordedForThisUnitYet")}</p>
              </div>
            ) : decisionsData ? (
              <>
              {/* Mobile card list — md:hidden (9-column analysis table needs more width) */}
              <div className="md:hidden p-4 space-y-3">
                {decisionsData.map((item) => {
                  const dep = item.depreciationPct;
                  const depColor = dep >= 100 ? "text-red-600 font-semibold" : dep >= 85 ? "text-orange-600 font-semibold" : dep >= 65 ? "text-amber-600 font-semibold" : "text-muted-dark";
                  const rawInput = sensitivityInputs[item.assetId];
                  const hyp = rawInput != null && rawInput !== "" ? Number(rawInput) : null;
                  const projected = hyp != null && hyp > 0 ? clientSideVerdict(item, hyp) : null;
                  const effectiveRec = projected || item.recommendation;
                  const recStyle = RECOMMENDATION_STYLES[effectiveRec] || RECOMMENDATION_STYLES.REPAIR;
                  return (
                    <div key={item.assetId} className="rounded-xl border border-surface-border p-3.5 bg-surface" title={item.recommendationReason}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-[0.8125rem] truncate">{item.assetName}</p>
                          <p className="text-xs text-muted mt-0.5">{item.topic}</p>
                        </div>
                        <span className={cn("inline-block shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", recStyle.badge)}>
                          {recStyle.label}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-text">
                        {dep != null && <span className={depColor}>Depr. {dep}%</span>}
                        {item.repairToReplacementRatio != null && (
                          <span>Ratio {Math.round(item.repairToReplacementRatio * 100)}%</span>
                        )}
                        {item.breakEvenMonths != null && (
                          <span>
                            Break-even: {item.breakEvenMonths === 0 ? "Exceeded" : item.breakEvenMonths < 12 ? `${item.breakEvenMonths} mo` : `${(item.breakEvenMonths / 12).toFixed(1)} yr`}
                          </span>
                        )}
                      </div>
                      {item.estimatedReplacementCostChf != null && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <input
                            type="number" min="0" step="100"
                            placeholder="0"
                            aria-label={t("manager:inventory.ariaLabel.hypotheticalNextRepairCostInChf")}
                            value={sensitivityInputs[item.assetId] ?? ""}
                            onChange={(e) => setSensitivityInputs((prev) => ({ ...prev, [item.assetId]: e.target.value }))}
                            className="w-28 rounded border border-surface-border px-2 py-1 text-xs text-right focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <span className="text-xs text-foreground-dim">{t("manager:inventory.text.ifNextRepairChf")}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Wide table — hidden md:block */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortableHeader label={t("manager:inventory.prop.asset")} field="assetName" sortField={decSF} sortDir={decSD} onSort={handleDecSort} />
                      <SortableHeader label={t("manager:inventory.prop.type")} field="type" sortField={decSF} sortDir={decSD} onSort={handleDecSort} />
                      <SortableHeader label={t("manager:inventory.prop.ageLife")} field="ageMonths" sortField={decSF} sortDir={decSD} onSort={handleDecSort} />
                      <SortableHeader label={t("manager:inventory.prop.depreciation")} field="depreciation" sortField={decSF} sortDir={decSD} onSort={handleDecSort} />
                      <SortableHeader label="Repairs (CHF)" field="repairs" sortField={decSF} sortDir={decSD} onSort={handleDecSort} className="text-right" />
                      <SortableHeader label="Replace est. (CHF)" field="replace" sortField={decSF} sortDir={decSD} onSort={handleDecSort} className="text-right" />
                      <SortableHeader label={t("manager:inventory.prop.ratio")} field="ratio" sortField={decSF} sortDir={decSD} onSort={handleDecSort} className="text-right" />
                      <SortableHeader label={t("manager:inventory.prop.breakeven")} field="breakEvenMonths" sortField={decSF} sortDir={decSD} onSort={handleDecSort} className="text-right" />
                      <SortableHeader label={t("manager:inventory.prop.recommendation")} field="recommendation" sortField={decSF} sortDir={decSD} onSort={handleDecSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDecisions.map((item) => {
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
                          <td className="text-xs text-muted">{item.topic}</td>
                          <td>
                            {item.ageMonths != null ? (
                              <span>
                                {ageYears} yr{lifeYears ? ` / ${lifeYears} yr` : ""}
                                {remainYears && <span className="block text-xs text-foreground-dim">{remainYears} yr left</span>}
                              </span>
                            ) : "—"}
                          </td>
                          <td>
                            {item.depreciationPct != null ? (
                              <span className={item.depreciationPct >= 100 ? "text-red-600 font-semibold" : item.depreciationPct >= 85 ? "text-orange-600 font-semibold" : item.depreciationPct >= 65 ? "text-amber-600 font-semibold" : "text-muted-dark"}>
                                {item.depreciationPct}%
                              </span>
                            ) : "—"}
                          </td>
                          <td className="text-right">
                            {item.cumulativeRepairCostChf > 0
                              ? item.cumulativeRepairCostChf.toLocaleString("de-CH", { minimumFractionDigits: 0 })
                              : "—"}
                            {item.annualRepairRate != null && item.annualRepairRate > 0 && (
                              <span className="block text-xs text-foreground-dim">
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
                                  aria-label={t("manager:inventory.ariaLabel.hypotheticalNextRepairCostInChf")}
                                  value={sensitivityInputs[item.assetId] ?? ""}
                                  onChange={(e) => setSensitivityInputs((prev) => ({ ...prev, [item.assetId]: e.target.value }))}
                                  className="w-24 rounded border border-surface-border px-2 py-1 text-xs text-right focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                />
                                <span className="block text-xs text-foreground-dim mt-0.5">{t("manager:inventory.text.ifNextRepairChf")}</span>
                              </div>
                            ) : (
                              <span className="block text-xs text-foreground-dim mt-1">{t("manager:inventory.text.sensitivityUnavailable")}</span>
                            )}
                          </td>
                          <td className="text-right">
                            {item.estimatedReplacementCostChf != null
                              ? item.estimatedReplacementCostChf.toLocaleString("de-CH", { minimumFractionDigits: 0 })
                              : "—"}
                            {item.replacementCostConfidence != null && (
                              <span className="block text-xs text-foreground-dim">
                                {Math.round(item.replacementCostConfidence * 100)}% conf.
                              </span>
                            )}
                          </td>
                          <td className={cn("text-right font-medium", item.repairToReplacementRatio != null
                              ? item.repairToReplacementRatio >= 0.6 ? "text-red-600" : item.repairToReplacementRatio >= 0.4 ? "text-orange-600" : item.repairToReplacementRatio >= 0.25 ? "text-amber-600" : "text-muted-dark"
                              : "text-foreground-dim")}>
                            {ratioDisplay}
                          </td>
                          <td className={cn("text-right", item.breakEvenMonths != null && item.breakEvenMonths <= 12 ? "text-red-600 font-semibold" : item.breakEvenMonths != null && item.breakEvenMonths <= 36 ? "text-amber-600" : "text-muted-dark")}>
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
                                    <span className="block text-xs text-foreground-dim mt-0.5">
                                      was: {(RECOMMENDATION_STYLES[item.recommendation] || RECOMMENDATION_STYLES.REPAIR).label}
                                    </span>
                                  )}
                                  {/* Transparent analysis: show why */}
                                  <div className="mt-1 text-xs text-foreground-dim leading-snug max-w-[160px]">
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
                <div className="px-4 py-3 border-t border-surface-divider text-xs text-muted space-y-1">
                  <p><strong>{t("manager:inventory.text.ratio")}</strong> {t("manager:inventory.text.cumulativeRepairCostEstimatedReplacementCostAbove60Replace")}</p>
                  <p><strong>{t("manager:inventory.text.breakeven")}</strong> {t("manager:inventory.text.atCurrentRepairRateWhenTotalRepairsWillExceedReplacementCost")}</p>
                  <p><strong>{t("manager:inventory.text.warrantyOffset")}</strong>: new appliances typically carry {decisionsData[0]?.warrantyOffsetMonths || 24} months warranty coverage.</p>
                  <p className="italic">{t("manager:inventory.text.hoverARowForTheRecommendationReason")}</p>
                </div>
              </div>
              </>
            ) : null}
          </div>

        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
