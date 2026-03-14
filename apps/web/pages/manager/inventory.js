import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import DepreciationStandards from "../../components/DepreciationStandards";
import VacanciesPanel from "../../components/VacanciesPanel";
import Link from "next/link";
import { authHeaders } from "../../lib/api";

const INVENTORY_TABS = [
  { key: "BUILDINGS", label: "Buildings" },
  { key: "UNITS", label: "Units" },
  { key: "VACANCIES", label: "Vacancies" },
  { key: "ASSETS", label: "Assets" },
  { key: "DEPRECIATION", label: "Depreciation" },
];

const TAB_KEYS = ['buildings', 'units', 'vacancies', 'assets', 'depreciation'];

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

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Inventory" subtitle="Buildings, units, assets and depreciation schedules." />
        <PageContent>
          {error && <div className="error-banner">{error}</div>}

          {/* Tab strip */}
          <div className="tab-strip">
            {INVENTORY_TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Count + full-view link — outside the Panel card */}
          <span className="tab-panel-count">
            {activeTab === 0 ? `${buildings.length} building${buildings.length !== 1 ? "s" : ""}` : null}
            {activeTab === 1 ? `Units across ${buildings.length} building${buildings.length !== 1 ? "s" : ""}` : null}
            {activeTab === 2 ? "Vacancies" : null}
            {activeTab === 3 ? `${assetModels.length} asset model${assetModels.length !== 1 ? "s" : ""}` : null}
            {activeTab === 4 ? "Depreciation standards" : null}
          </span>
          {activeTab === 0 && <Link href="/admin-inventory/buildings" className="full-page-link">Full view →</Link>}
          {activeTab === 3 && <Link href="/admin-inventory/asset-models" className="full-page-link">Full view →</Link>}

          {/* Tabs 0,1,3 in Panel; tabs 2 (Vacancies) and 4 (Depreciation) render their own Panels */}
          {activeTab !== 2 && activeTab !== 4 && (
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
                      <th>Name</th>
                      <th>Address</th>
                      <th>Canton</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildings.map((b) => (
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
                      <th>Building</th>
                      <th>Address</th>
                      <th>Units</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildings.map((b) => (
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
          <div className={activeTab === 3 ? "tab-panel-active" : "tab-panel"}>
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
                      <th>Name</th>
                      <th>Category</th>
                      <th>Manufacturer</th>
                      <th>Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetModels.map((m) => (
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

          {/* Vacancies tab — rendered outside Panel, uses shared component */}
          {activeTab === 2 && <VacanciesPanel role="MANAGER" />}

          {/* Depreciation tab — rendered outside Panel, uses shared component */}
          {activeTab === 4 && <DepreciationStandards />}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
