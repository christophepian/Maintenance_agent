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
  ACTIVE: "bg-emerald-100 text-emerald-800",
  TERMINATED: "bg-slate-100 text-slate-700",
  CANCELLED: "bg-red-100 text-red-800",
};

// Tabs: Active (ACTIVE+SIGNED), Draft (DRAFT), Submitted (READY_TO_SIGN), Archive (CANCELLED+TERMINATED)
const LEASE_TABS = [
  { key: "ACTIVE",     label: "Active",    statuses: ["ACTIVE", "SIGNED"] },
  { key: "DRAFTS",     label: "Draft",     statuses: ["DRAFT"] },
  { key: "SUBMITTED",  label: "Submitted", statuses: ["READY_TO_SIGN"] },
  { key: "TEMPLATES",  label: "Templates", statuses: null },
  { key: "ARCHIVE",    label: "Archive",   statuses: ["CANCELLED", "TERMINATED"] },
];

const TAB_KEYS = ["active", "drafts", "submitted", "templates", "archive"];

// ─── Business-day countdown helpers ────────────────────────────────────────

/** Add N business days (Mon–Fri) to a Date. */
function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

/** Count business days remaining from today until expiryDate (negative = past). */
function businessDaysUntil(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expiryDate);
  target.setHours(0, 0, 0, 0);

  if (target < today) {
    // Already expired — count how many business days ago
    let count = 0;
    const cursor = new Date(target);
    while (cursor < today) {
      cursor.setDate(cursor.getDate() + 1);
      const d = cursor.getDay();
      if (d !== 0 && d !== 6) count++;
    }
    return -count;
  }

  let count = 0;
  const cursor = new Date(today);
  while (cursor < target) {
    cursor.setDate(cursor.getDate() + 1);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

function CountdownBadge({ sentForSignatureAt }) {
  if (!sentForSignatureAt) {
    return <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-500">Sent date unavailable</span>;
  }
  const expiry = addBusinessDays(new Date(sentForSignatureAt), 5);
  const remaining = businessDaysUntil(expiry);

  if (remaining < 0) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
        Expired {Math.abs(remaining)} business day{Math.abs(remaining) !== 1 ? "s" : ""} ago
      </span>
    );
  }
  if (remaining === 0) {
    return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">Due today</span>;
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${remaining <= 1 ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-700"}`}>
      {remaining} business day{remaining !== 1 ? "s" : ""} left
    </span>
  );
}

function isExpired(sentForSignatureAt) {
  if (!sentForSignatureAt) return false;
  const expiry = addBusinessDays(new Date(sentForSignatureAt), 5);
  return new Date() > expiry;
}

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
  const [expiryLoading, setExpiryLoading] = useState({});
  const [expiryResult, setExpiryResult] = useState({});

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
    fetch("/api/buildings", { headers: authHeaders() })
      .then(r => r.json())
      .then(json => setBuildings(json.data || []))
      .catch(() => {});
  }, [showCreate]);

  // Load units when building selected
  useEffect(() => {
    if (!selectedBuildingId) { setUnits([]); return; }
    fetch(`/api/buildings/${selectedBuildingId}/units`, { headers: authHeaders() })
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
        headers: { "Content-Type": "application/json", ...authHeaders() },
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

  async function handleExpiry(lease) {
    if (!window.confirm(`Handle expired lease for ${lease.tenantName}?\n\nThis will cancel the lease and either create a new draft for the backup candidate or relist the unit.`)) return;
    setExpiryLoading(l => ({ ...l, [lease.id]: true }));
    setExpiryResult(r => ({ ...r, [lease.id]: null }));
    try {
      const res = await fetch(`/api/leases/${lease.id}/handle-expiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const json = await res.json();
      if (!res.ok) {
        setExpiryResult(r => ({ ...r, [lease.id]: { error: json.error?.message || "Failed" } }));
      } else {
        setExpiryResult(r => ({ ...r, [lease.id]: { ok: json.data } }));
        fetchLeases();
      }
    } catch (err) {
      setExpiryResult(r => ({ ...r, [lease.id]: { error: err.message } }));
    } finally {
      setExpiryLoading(l => ({ ...l, [lease.id]: false }));
    }
  }

  // Derive filtered lease lists
  const activeLease  = leases.filter(l => ["ACTIVE", "SIGNED"].includes(l.status));
  const draftLeases  = leases.filter(l => l.status === "DRAFT");
  const submitted    = leases.filter(l => l.status === "READY_TO_SIGN");
  const archived     = leases.filter(l => ["CANCELLED", "TERMINATED"].includes(l.status));

  const tabCounts = [activeLease.length, draftLeases.length, submitted.length, templates.length, archived.length];

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
            {activeTab === 0 && `${activeLease.length} active lease${activeLease.length !== 1 ? "s" : ""}`}
            {activeTab === 1 && `${draftLeases.length} draft${draftLeases.length !== 1 ? "s" : ""}`}
            {activeTab === 2 && `${submitted.length} awaiting signature`}
            {activeTab === 3 && `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
            {activeTab === 4 && `${archived.length} archived`}
          </span>
          {activeTab === 3 && <Link href="/manager/leases/templates" className="full-page-link">Full view →</Link>}

          <Panel bodyClassName="p-0">
            {/* Templates tab (index 3) */}
            <div className={activeTab === 3 ? "tab-panel-active" : "tab-panel"}>
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
                        <tr key={t.id} onClick={() => router.push(`/manager/leases/${t.id}`)} className="cursor-pointer hover:bg-slate-50">
                          <td className="cell-bold">{t.templateName || "Unnamed"}</td>
                          <td>{t.unit?.building?.name || t.unit?.building?.address || "—"}</td>
                          <td>{formatDate(t.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Submitted tab (index 2) */}
            <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
              <div className="px-4 py-4">
                {loading ? (
                  <p className="loading-text">Loading…</p>
                ) : error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : submitted.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-text text-lg mb-2">No submitted leases</p>
                    <p className="empty-state-text">Leases sent to candidates for signature appear here.</p>
                  </div>
                ) : (
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Unit</th>
                        <th>Building</th>
                        <th>Rent</th>
                        <th>Sent</th>
                        <th>Deadline</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submitted.map(lease => {
                        const expired = isExpired(lease.sentForSignatureAt);
                        const result = expiryResult[lease.id];
                        return (
                          <tr key={lease.id} className={expired ? "bg-red-50" : undefined}>
                            <td className="cell-bold">{lease.tenantName}</td>
                            <td>{lease.unit?.unitNumber || "—"}</td>
                            <td>{lease.unit?.building?.name || "—"}</td>
                            <td>CHF {lease.rentTotalChf ?? lease.netRentChf}.-</td>
                            <td>{lease.sentForSignatureAt ? formatDate(lease.sentForSignatureAt) : "—"}</td>
                            <td><CountdownBadge sentForSignatureAt={lease.sentForSignatureAt} /></td>
                            <td>
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={() => router.push(`/manager/leases/${lease.id}`)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  View →
                                </button>
                                {expired && (
                                  <button
                                    onClick={() => handleExpiry(lease)}
                                    disabled={expiryLoading[lease.id]}
                                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 font-medium"
                                  >
                                    {expiryLoading[lease.id] ? "Processing…" : "Handle expired"}
                                  </button>
                                )}
                              </div>
                              {result?.ok && (
                                <p className="text-xs text-green-700 mt-1">{result.ok.message}</p>
                              )}
                              {result?.error && (
                                <p className="text-xs text-red-600 mt-1">{result.error}</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* List tabs: Active (0), Draft (1), Archive (4) */}
            {[0, 1, 4].map((tabIndex) => {
              const tab = LEASE_TABS[tabIndex];
              const filtered = [activeLease, draftLeases, null, null, archived][tabIndex];
              return (
                <div key={tabIndex} className={activeTab === tabIndex ? "tab-panel-active" : "tab-panel"}>
                  {loading ? (
                    <p className="loading-text">Loading leases...</p>
                  ) : error ? (
                    <p className="text-sm text-red-600">{error}</p>
                  ) : filtered.length === 0 ? (
                    <div className="empty-state">
                      <p className="empty-state-text text-lg mb-2">No leases found</p>
                      <p className="empty-state-text">Click &quot;+ New Lease&quot; to create your first rental contract.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="inline-table">
                        <thead>
                          <tr>
                            <th>Tenant</th>
                            <th>Unit</th>
                            <th>Building</th>
                            <th>Net Rent</th>
                            {tabIndex === 0 && <th>Charges</th>}
                            {tabIndex === 0 && <th>Total/mo</th>}
                            <th>Start</th>
                            <th>Status</th>
                            {tabIndex === 1 && <th>Tag</th>}
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.slice(0, 200).map(lease => {
                            const netRent = lease.netRentChf ?? 0;
                            const charges = lease.chargesTotalChf ?? 0;
                            const totalMo = netRent + charges;
                            return (
                            <tr key={lease.id}>
                              <td className="cell-bold">{lease.tenantName}</td>
                              <td>{lease.unit?.unitNumber || "—"}</td>
                              <td>{lease.unit?.building?.name || "—"}</td>
                              <td>CHF {netRent}.-</td>
                              {tabIndex === 0 && <td>{charges ? `CHF ${charges}.-` : "—"}</td>}
                              {tabIndex === 0 && <td className="font-semibold">CHF {totalMo}.-</td>}
                              <td>{formatDate(lease.startDate)}</td>
                              <td>
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[lease.status] || "bg-slate-100 text-slate-700"}`}>
                                  {lease.status.replace(/_/g, " ")}
                                </span>
                              </td>
                              {tabIndex === 1 && (
                                <td>
                                  {/* "Ready for review" tag for backup-candidate redrafts */}
                                  {lease.applicationId ? (
                                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                      Ready for review
                                    </span>
                                  ) : null}
                                </td>
                              )}
                              <td>
                                <button
                                  onClick={() => router.push(`/manager/leases/${lease.id}`)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  Edit →
                                </button>
                              </td>
                            </tr>
                            );
                          })}
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
