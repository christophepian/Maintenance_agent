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
  { key: "UNITS", label: "Units" },
  { key: "VACANCIES", label: "Vacancies", href: "/manager/vacancies" },
  { key: "ASSETS", label: "Assets" },
  { key: "DEPRECIATION", label: "Depreciation" },
];

const TAB_KEYS = ['buildings', 'units', 'assets', 'depreciation'];

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
            {INVENTORY_TABS.map((tab, i) => (
              tab.href ? (
                <Link key={tab.key} href={tab.href} className="tab-btn">
                  {tab.label}
                </Link>
              ) : (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(i > 2 ? i - 1 : i)}
                  className={activeTab === (i > 2 ? i - 1 : i) ? "tab-btn-active" : "tab-btn"}
                >
                  {tab.label}
                </button>
              )
            ))}
          </div>

          {/* Count + full-view link — outside the Panel card */}
          <span className="tab-panel-count">
            {activeTab === 0 ? `${buildings.length} building${buildings.length !== 1 ? "s" : ""}` : null}
            {activeTab === 1 ? `Units across ${buildings.length} building${buildings.length !== 1 ? "s" : ""}` : null}
            {activeTab === 2 ? `${assetModels.length} asset model${assetModels.length !== 1 ? "s" : ""}` : null}
            {activeTab === 3 ? "Depreciation standards" : null}
          </span>
          {activeTab === 0 && <Link href="/admin-inventory/buildings" className="full-page-link">Full view →</Link>}
          {activeTab === 2 && <Link href="/admin-inventory/asset-models" className="full-page-link">Full view →</Link>}

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
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBuildings.map((b) => (
                      <tr key={b.id}>
                        <td className="cell-bold">{b.name || "Unnamed"}</td>
                        <td>{b.address || "—"}</td>
                        <td>{b.canton || "—"}</td>
                        <td>
                          <Link href={`/admin-inventory/buildings/${b.id}`} className="full-page-link">View →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Units tab — summary from buildings (no top-level units API) */}
          <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading…</p>
            ) : buildings.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No buildings found — add a building first.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <SortableHeader label="Building" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Address" field="address" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Units" field="unitCount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBuildings.map((b) => (
                      <tr key={b.id}>
                        <td className="cell-bold">{b.name || "Unnamed"}</td>
                        <td>{b.address || "—"}</td>
                        <td>{b._count?.units ?? b.unitCount ?? "—"}</td>
                        <td>
                          <Link href={`/admin-inventory/buildings/${b.id}`} className="full-page-link">Manage →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assets tab */}
          <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
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
          </Panel>
          )}

          {/* Depreciation tab — rendered outside Panel, uses shared component */}
          {activeTab === 3 && <DepreciationStandards />}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
