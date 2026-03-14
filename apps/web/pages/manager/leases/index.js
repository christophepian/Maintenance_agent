import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import { formatDate } from "../../../lib/format";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Section from "../../../components/layout/Section";
import Link from "next/link";
import { authHeaders } from "../../../lib/api";

const STATUS_COLORS = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  READY_TO_SIGN: "bg-blue-100 text-blue-800",
  SIGNED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const LEASE_TABS = [
  { key: "ACTIVE", label: "Active", statuses: ["SIGNED", "READY_TO_SIGN"] },
  { key: "DRAFTS", label: "Drafts", statuses: ["DRAFT"] },
  { key: "TEMPLATES", label: "Templates", statuses: null },
  { key: "ARCHIVE", label: "Archive", statuses: ["CANCELLED"] },
];

const TAB_KEYS = ['active', 'drafts', 'templates', 'archive'];

export default function LeasesPage() {
  const router = useRouter();
  const [leases, setLeases] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [leasesTotal, setLeasesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeTab = router.isReady ? (Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true }
    );
  }, [router]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [units, setUnits] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [createForm, setCreateForm] = useState({
    unitId: "",
    tenantName: "",
    tenantEmail: "",
    tenantPhone: "",
    tenantAddress: "",
    tenantZipCity: "",
    startDate: "",
    netRentChf: "",
    depositChf: "",
  });
  const [createError, setCreateError] = useState(null);

  const fetchLeases = useCallback(async () => {
    setLoading(true);
    try {
      const [leaseRes, tmplRes] = await Promise.all([
        fetch("/api/leases?limit=200", { headers: authHeaders() }),
        fetch("/api/lease-templates", { headers: authHeaders() }),
      ]);
      const leaseJson = await leaseRes.json();
      const tmplJson = await tmplRes.json();
      setLeases(leaseJson.data || []);
      setLeasesTotal(leaseJson.total ?? leaseJson.data?.length ?? 0);
      setTemplates(tmplJson.data || []);
      setError(null);
    } catch (err) {
      setError("Failed to load leases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeases(); }, [fetchLeases]);

  // Load buildings for create form
  useEffect(() => {
    if (!showCreate) return;
    fetch("/api/buildings")
      .then(r => r.json())
      .then(json => setBuildings(json.data || []))
      .catch(() => {});
  }, [showCreate]);

  // Load units when building selected
  useEffect(() => {
    if (!selectedBuildingId) { setUnits([]); return; }
    fetch(`/api/buildings/${selectedBuildingId}/units`)
      .then(r => r.json())
      .then(json => setUnits(json.data || []))
      .catch(() => {});
  }, [selectedBuildingId]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError(null);
    if (!createForm.unitId || !createForm.tenantName || !createForm.startDate || !createForm.netRentChf) {
      setCreateError("Unit, tenant name, start date and net rent are required.");
      return;
    }
    try {
      const res = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          netRentChf: parseInt(createForm.netRentChf, 10),
          depositChf: createForm.depositChf ? parseInt(createForm.depositChf, 10) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error?.message || "Failed to create lease");
        return;
      }
      setShowCreate(false);
      router.push(`/manager/leases/${json.data.id}`);
    } catch (err) {
      setCreateError(err.message);
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Leases"
          subtitle="Manage rental contracts"
          actions={
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {showCreate ? "Cancel" : "+ New Lease"}
            </button>
          }
        />
        <PageContent>
          {/* Create lease form */}
          {showCreate && (
            <Section title="Create New Lease">
              <form onSubmit={handleCreate} className="bg-white rounded-lg border p-6 space-y-4 max-w-2xl">
                {createError && <p className="text-sm text-red-600">{createError}</p>}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Building</label>
                    <select
                      value={selectedBuildingId}
                      onChange={e => { setSelectedBuildingId(e.target.value); setCreateForm(f => ({ ...f, unitId: "" })); }}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select building...</option>
                      {buildings.map(b => <option key={b.id} value={b.id}>{b.name} — {b.address}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
                    <select
                      value={createForm.unitId}
                      onChange={e => setCreateForm(f => ({ ...f, unitId: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      disabled={!selectedBuildingId}
                    >
                      <option value="">Select unit...</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.unitNumber} (Floor {u.floor || "—"})</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tenant Name *</label>
                    <input
                      type="text"
                      value={createForm.tenantName}
                      onChange={e => setCreateForm(f => ({ ...f, tenantName: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="Jean Dupont"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tenant Email</label>
                    <input
                      type="email"
                      value={createForm.tenantEmail}
                      onChange={e => setCreateForm(f => ({ ...f, tenantEmail: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="jean@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                    <input
                      type="date"
                      value={createForm.startDate}
                      onChange={e => setCreateForm(f => ({ ...f, startDate: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Net Rent (CHF/month) *</label>
                    <input
                      type="number"
                      value={createForm.netRentChf}
                      onChange={e => setCreateForm(f => ({ ...f, netRentChf: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="1500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deposit (CHF)</label>
                  <input
                    type="number"
                    value={createForm.depositChf}
                    onChange={e => setCreateForm(f => ({ ...f, depositChf: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm max-w-xs"
                    placeholder="4500"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Create Lease Draft
                </button>
              </form>
            </Section>
          )}

          {/* Tab strip */}
          <div className="tab-strip">
            {LEASE_TABS.map((tab, i) => (
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
            {activeTab === 0 ? `${leases.filter(l => ["SIGNED","READY_TO_SIGN"].includes(l.status)).length} active lease${leases.filter(l => ["SIGNED","READY_TO_SIGN"].includes(l.status)).length !== 1 ? "s" : ""}` : null}
            {activeTab === 1 ? `${leases.filter(l => l.status === "DRAFT").length} draft${leases.filter(l => l.status === "DRAFT").length !== 1 ? "s" : ""}` : null}
            {activeTab === 2 ? `${templates.length} template${templates.length !== 1 ? "s" : ""}` : null}
            {activeTab === 3 ? `${leases.filter(l => l.status === "CANCELLED").length} archived` : null}
          </span>
          {activeTab === 2 && <Link href="/manager/leases/templates" className="full-page-link">Full view →</Link>}

          <Panel bodyClassName="p-0">
          {/* Templates tab */}
          <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading templates…</p>
            ) : templates.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text text-lg mb-2">No templates yet</p>
                <p className="empty-state-text">
                  Create one on the{" "}
                  <Link href="/manager/leases/templates" className="text-blue-600 hover:underline">
                    templates page
                  </Link>.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Building</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id}>
                        <td className="cell-bold">{t.templateName || "Unnamed"}</td>
                        <td>{t.building?.name || t.building?.address || "—"}</td>
                        <td>{formatDate(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* List tabs (Active / Drafts / Archive) */}
          {[0, 1, 3].map((tabIndex) => {
            const tab = LEASE_TABS[tabIndex];
            const filtered = tab.statuses
              ? leases.filter((l) => tab.statuses.includes(l.status))
              : leases;
            return (
              <div key={tabIndex} className={activeTab === tabIndex ? "tab-panel-active" : "tab-panel"}>
                {loading ? (
                  <p className="text-sm text-slate-500">Loading leases...</p>
                ) : error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : filtered.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-text text-lg mb-2">No leases found</p>
                    <p className="empty-state-text">Click "+ New Lease" to create your first rental contract.</p>
                  </div>
                ) : (
                  <div>
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>Tenant</th>
                          <th>Unit</th>
                          <th>Building</th>
                          <th>Rent</th>
                          <th>Start</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 200).map(lease => (
                          <tr key={lease.id}>
                            <td className="cell-bold">{lease.tenantName}</td>
                            <td>{lease.unit?.unitNumber || "—"}</td>
                            <td>{lease.unit?.building?.name || "—"}</td>
                            <td>CHF {lease.rentTotalChf ?? lease.netRentChf}.-</td>
                            <td>{formatDate(lease.startDate)}</td>
                            <td>
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[lease.status] || "bg-slate-100 text-slate-700"}`}>
                                {lease.status.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => router.push(`/manager/leases/${lease.id}`)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Edit →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
