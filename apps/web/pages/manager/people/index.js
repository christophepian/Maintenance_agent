import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Link from "next/link";
import { authHeaders } from "../../../lib/api";
const PEOPLE_TABS = [
  { key: "TENANTS", label: "Tenants" },
  { key: "VENDORS", label: "Vendors" },
  { key: "OWNERS", label: "Owners" },
];

const TAB_KEYS = ['tenants', 'vendors', 'owners'];

export default function ManagerPeoplePage() {
  const router = useRouter();
  const activeTab = router.isReady ? (Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true }
    );
  }, [router]);
  const [tenants, setTenants] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [tenantsTotal, setTenantsTotal] = useState(0);
  const [contractorsTotal, setContractorsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tenantRes, vendorRes] = await Promise.all([
        fetch("/api/people/tenants?limit=200", { headers: authHeaders() }),
        fetch("/api/people/vendors?limit=200", { headers: authHeaders() }),
      ]);
      const tenantData = await tenantRes.json();
      const vendorData = await vendorRes.json();
      if (!tenantRes.ok) throw new Error(tenantData?.error?.message || "Failed to load tenants");
      setTenants(tenantData?.data || []);
      setTenantsTotal(tenantData?.total ?? tenantData?.data?.length ?? 0);
      setContractors(vendorData?.data || []);
      setContractorsTotal(vendorData?.total ?? vendorData?.data?.length ?? 0);
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
        <PageHeader title="People" subtitle="Contacts across tenants, vendors and owners." />
        <PageContent>
          {error && <div className="error-banner">{error}</div>}

          {/* Tab strip */}
          <div className="tab-strip">
            {PEOPLE_TABS.map((tab, i) => (
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
            {activeTab === 0 ? `${tenantsTotal} tenant${tenantsTotal !== 1 ? "s" : ""}` : null}
            {activeTab === 1 ? `${contractorsTotal} contractor${contractorsTotal !== 1 ? "s" : ""}` : null}
            {activeTab === 2 ? "Owners" : null}
          </span>
          {activeTab === 2 && <Link href="/manager/people/owners" className="full-page-link">Open full page →</Link>}

          <Panel bodyClassName="p-0">
          {/* Tenants tab */}
          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading tenants…</p>
            ) : tenants.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No tenants found.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Unit</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.slice(0, 200).map((t) => (
                      <tr key={t.id}>
                        <td className="cell-bold">{t.name || "—"}</td>
                        <td>{t.phone || "—"}</td>
                        <td>{t.email || "—"}</td>
                        <td>
                          {t.unit ? `${t.unit.unitNumber}${t.unit.floor ? ` (Floor ${t.unit.floor})` : ""}` : "—"}
                        </td>
                        <td>
                          <Link href={`/manager/people/tenants/${t.id}`} className="full-page-link">View →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Vendors tab */}
          <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading contractors…</p>
            ) : contractors.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No contractors found.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Rate</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractors.slice(0, 200).map((c) => (
                      <tr key={c.id}>
                        <td className="cell-bold">{c.name || "—"}</td>
                        <td>{c.phone || "—"}</td>
                        <td>{c.email || "—"}</td>
                        <td>{c.hourlyRate != null ? `CHF ${c.hourlyRate}/h` : "—"}</td>
                        <td>
                          <Link href={`/manager/people/vendors/${c.id}`} className="full-page-link">View →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Owners tab — stub (no API endpoint yet) */}
          <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
            <div className="px-4 py-4">
            <div className="coming-soon">
              <span className="coming-soon-badge">Coming Soon</span>
              <p className="coming-soon-title">Owner Management</p>
              <p className="coming-soon-text">
                Owner profiles, ownership stakes, and communication preferences will appear here.
              </p>
            </div>
            </div>
          </div>
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
