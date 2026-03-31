import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import SortableHeader from "../../components/SortableHeader";
import { useTableSort, clientSort } from "../../lib/tableUtils";
import DepreciationStandards from "../../components/DepreciationStandards";
import Link from "next/link";
import { authHeaders } from "../../lib/api";

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

const INVENTORY_TABS = [
  { key: "BUILDINGS", label: "Buildings" },
  { key: "VACANCIES", label: "Vacancies", href: "/manager/vacancies" },
  { key: "ASSETS", label: "Assets" },
  { key: "DECISIONS", label: "Maintenance Decisions" },
  { key: "DEPRECIATION", label: "Depreciation" },
];

const TAB_KEYS = ['buildings', 'assets', 'decisions', 'depreciation'];

const RECOMMENDATION_STYLES = {
  REPAIR: { badge: "bg-green-100 text-green-700", label: "Repair" },
  MONITOR: { badge: "bg-amber-100 text-amber-700", label: "Monitor" },
  REPLACE: { badge: "bg-red-100 text-red-700", label: "Replace" },
};

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

  const { sortField, sortDir, handleSort } = useTableSort(router, INVENTORY_SORT_FIELDS, { defaultField: "name", defaultDir: "asc" });
  const sortedBuildings = useMemo(() => clientSort(buildings, sortField, sortDir, inventoryFieldExtractor), [buildings, sortField, sortDir]);
  const sortedAssets = useMemo(() => clientSort(assetModels, sortField, sortDir, inventoryFieldExtractor), [assetModels, sortField, sortDir]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Inventory" subtitle="Buildings, units, assets and depreciation schedules." />
        <PageContent>
          {error && <div className="error-banner">{error}</div>}

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
            {activeTab === 0 ? `${buildings.length} building${buildings.length !== 1 ? "s" : ""}` : null}
            {activeTab === 1 ? `${assetModels.length} asset model${assetModels.length !== 1 ? "s" : ""}` : null}
            {activeTab === 2 ? "Maintenance decisions — select a unit to see repair vs replace analysis" : null}
            {activeTab === 3 ? "Depreciation standards" : null}
          </span>
          {activeTab === 0 && <Link href="/admin-inventory/buildings" className="full-page-link">Full view →</Link>}
          {activeTab === 1 && <Link href="/admin-inventory/asset-models" className="full-page-link">Full view →</Link>}

          {/* Tabs 0,1,2 in Panel; tab 3 (Depreciation) renders its own Panels */}
          {activeTab !== 3 && (
          <Panel bodyClassName="p-0">
          {/* Buildings tab */}
          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading buildings…</p>
            ) : buildings.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No buildings found.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <SortableHeader label="Name" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Address" field="address" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Canton" field="canton" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBuildings.map((b) => (
                      <tr
                        key={b.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => router.push(`/admin-inventory/buildings/${b.id}?from=/manager/inventory`)}
                      >
                        <td className="cell-bold">{b.name || "Unnamed"}</td>
                        <td>{b.address || "—"}</td>
                        <td>{b.canton || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assets tab */}
          <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading asset models…</p>
            ) : assetModels.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No asset models configured yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <SortableHeader label="Name" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Category" field="category" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Manufacturer" field="manufacturer" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Scope" field="scope" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssets.map((m) => (
                      <tr key={m.id}>
                        <td className="cell-bold">{m.name}</td>
                        <td>{m.category || "—"}</td>
                        <td>{m.manufacturer || "—"}</td>
                        <td>{m.orgId ? "Org" : "Global"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Decisions tab */}
          <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
            <div className="p-4 border-b border-slate-100">
              <label className="text-xs font-medium text-slate-600 mr-2">Unit</label>
              <select
                value={decisionsUnitId}
                onChange={(e) => setDecisionsUnitId(e.target.value)}
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
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Type</th>
                      <th>Age</th>
                      <th>Depreciation</th>
                      <th>Repair Cost (CHF)</th>
                      <th>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisionsData.map((item) => {
                      const style = RECOMMENDATION_STYLES[item.recommendation] || RECOMMENDATION_STYLES.REPAIR;
                      const ageYears = item.ageMonths != null ? (item.ageMonths / 12).toFixed(1) : "—";
                      const lifeYears = item.usefulLifeMonths != null ? (item.usefulLifeMonths / 12).toFixed(0) : null;
                      return (
                        <tr key={item.assetId}>
                          <td className="cell-bold">{item.assetName}</td>
                          <td>{item.assetType}</td>
                          <td>
                            {item.ageMonths != null ? `${ageYears} yr${lifeYears ? ` / ${lifeYears} yr` : ""}` : "—"}
                          </td>
                          <td>
                            {item.depreciationPct != null ? (
                              <span className={item.depreciationPct >= 100 ? "text-red-600 font-semibold" : item.depreciationPct >= 75 ? "text-amber-600 font-semibold" : "text-slate-700"}>
                                {item.depreciationPct}%
                              </span>
                            ) : "—"}
                          </td>
                          <td>
                            {item.cumulativeRepairCostChf > 0
                              ? item.cumulativeRepairCostChf.toLocaleString("de-CH", { minimumFractionDigits: 0 })
                              : "—"}
                          </td>
                          <td>
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
                              {style.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          </Panel>
          )}

          {/* Depreciation tab — rendered outside Panel, uses shared component */}
          {activeTab === 3 && <DepreciationStandards />}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
