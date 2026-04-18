import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Link from "next/link";
import { authHeaders } from "../../lib/api";
import Badge from "../../components/ui/Badge";
import { legalVariant } from "../../lib/statusVariants";
import { cn } from "../../lib/utils";
import DepreciationStandards from "../../components/DepreciationStandards";

const SETTINGS_TABS = [
  { key: "ORG", label: "Organisation" },
  { key: "BUILDINGS", label: "Buildings" },
  { key: "NOTIFICATIONS", label: "Notifications" },
  { key: "INTEGRATIONS", label: "Integrations" },
  { key: "LEGAL", label: "Legal Sources" },
  { key: "DEPRECIATION", label: "Depreciation" },
];

const TAB_KEYS = ['organisation', 'buildings', 'notifications', 'integrations', 'legal', 'depreciation'];

export default function ManagerSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [savingLimit, setSavingLimit] = useState(false);
  const [savingLeadTime, setSavingLeadTime] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [orgMode, setOrgMode] = useState("MANAGED");
  const [autoApproveLimit, setAutoApproveLimit] = useState(null);
  const [limitDraft, setLimitDraft] = useState("");
  const [invoiceLeadTimeDays, setInvoiceLeadTimeDays] = useState(20);
  const [leadTimeDraft, setLeadTimeDraft] = useState("20");
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
  const [buildingsLoading, setBuildingsLoading] = useState(false);

  // ── Legal Sources state ────────────────────────────────────
  const [legalSources, setLegalSources] = useState([]);
  const [legalVariables, setLegalVariables] = useState([]);
  const [legalLoading, setLegalLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [legalFormOpen, setLegalFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [legalSaving, setLegalSaving] = useState(false);
  const [legalFormError, setLegalFormError] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL");

  // Load buildings for the Buildings tab (lazy — on first tab switch)
  const loadBuildings = useCallback(async () => {
    if (buildings.length > 0) return; // already loaded
    setBuildingsLoading(true);
    try {
      const r = await fetch("/api/buildings", { headers: authHeaders() });
      const j = await r.json();
      setBuildings(j?.data || []);
    } catch (_) { /* silent */ }
    finally { setBuildingsLoading(false); }
  }, [buildings.length]);

  // Trigger building load when buildings tab is active
  useEffect(() => {
    if (activeTab === 1) loadBuildings();
  }, [activeTab, loadBuildings]);

  // ── Legal Sources data loading ─────────────────────────────
  const loadLegalData = useCallback(async () => {
    if (legalSources.length > 0) return; // already loaded
    setLegalLoading(true);
    try {
      const [srcRes, varRes] = await Promise.all([
        fetch("/api/legal/sources", { headers: authHeaders() }),
        fetch("/api/legal/variables", { headers: authHeaders() }),
      ]);
      const srcData = await srcRes.json();
      const varData = await varRes.json();
      setLegalSources(srcData?.data || []);
      setLegalVariables(varData?.data || []);
    } catch (_) { /* silent */ }
    finally { setLegalLoading(false); }
  }, [legalSources.length]);

  const reloadLegalData = useCallback(async () => {
    setLegalLoading(true);
    try {
      const [srcRes, varRes] = await Promise.all([
        fetch("/api/legal/sources", { headers: authHeaders() }),
        fetch("/api/legal/variables", { headers: authHeaders() }),
      ]);
      const srcData = await srcRes.json();
      const varData = await varRes.json();
      setLegalSources(srcData?.data || []);
      setLegalVariables(varData?.data || []);
    } catch (_) { /* silent */ }
    finally { setLegalLoading(false); }
  }, []);

  // Trigger legal data load when legal tab is active
  useEffect(() => {
    if (activeTab === 4) loadLegalData();
  }, [activeTab, loadLegalData]);

  async function syncSources() {
    setIngesting(true);
    setSyncResult(null);
    setError("");
    try {
      const res = await fetch("/api/legal/ingestion/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Sync failed");
      setSyncResult(data.data);
      await reloadLegalData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setIngesting(false);
    }
  }

  function openLegalCreateForm() {
    setEditingSource(null);
    setLegalFormError("");
    setLegalFormOpen(true);
  }
  function openLegalEditForm(source) {
    setEditingSource(source);
    setLegalFormError("");
    setLegalFormOpen(true);
  }
  function closeLegalForm() {
    setLegalFormOpen(false);
    setEditingSource(null);
    setLegalFormError("");
  }

  async function handleLegalFormSubmit(formData) {
    setLegalSaving(true);
    setLegalFormError("");
    try {
      const isEdit = !!editingSource;
      const url = isEdit
        ? `/api/legal/sources/${editingSource.id}`
        : "/api/legal/sources";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Save failed");
      closeLegalForm();
      await reloadLegalData();
    } catch (e) {
      setLegalFormError(String(e?.message || e));
    } finally {
      setLegalSaving(false);
    }
  }

  async function toggleSourceStatus(source) {
    const newStatus = source.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/legal/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to update status");
      }
      await reloadLegalData();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  async function deleteSource(source) {
    if (!confirm(`Delete ${source.name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/legal/sources/${source.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.status === 409) {
        const data = await res.json();
        setError(data?.error?.message || "This source has linked data. Deactivate it instead.");
        return;
      }
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Delete failed");
      }
      await reloadLegalData();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }
  async function loadOrgConfig() {
    const r = await fetch("/api/org-config", { headers: authHeaders() });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to load org config");
    return j?.data;
  }

  useEffect(() => {
    let mounted = true;
    loadOrgConfig()
      .then((cfg) => {
        if (!mounted) return;
        setOrgMode(cfg?.mode || "MANAGED");
        setAutoApproveLimit(cfg?.autoApproveLimit ?? null);
        setLimitDraft(cfg?.autoApproveLimit != null ? String(cfg.autoApproveLimit) : "");
        const lt = cfg?.invoiceLeadTimeDays ?? 20;
        setInvoiceLeadTimeDays(lt);
        setLeadTimeDraft(String(lt));
      })
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function parseLimitDraft(s) {
    const raw = String(s ?? "").trim();
    if (!raw) return { ok: false, value: null, error: "Threshold is required." };
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, value: null, error: "Threshold must be a whole number." };
    }
    if (n < 0) return { ok: false, value: null, error: "Threshold must be >= 0." };
    if (n > 100000) return { ok: false, value: null, error: "Threshold must be <= 100000." };
    return { ok: true, value: n, error: "" };
  }

  const limitValidation = useMemo(() => parseLimitDraft(limitDraft), [limitDraft]);

  function parseLeadTimeDraft(s) {
    const raw = String(s ?? "").trim();
    if (!raw) return { ok: false, value: null, error: "Lead time is required." };
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, value: null, error: "Lead time must be a whole number." };
    }
    if (n < 1) return { ok: false, value: null, error: "Lead time must be ≥ 1 day." };
    if (n > 60) return { ok: false, value: null, error: "Lead time must be ≤ 60 days." };
    return { ok: true, value: n, error: "" };
  }

  const leadTimeValidation = useMemo(() => parseLeadTimeDraft(leadTimeDraft), [leadTimeDraft]);

  async function saveOrgMode() {
    setError("");
    setNotice("");
    setSavingMode(true);
    try {
      const r = await fetch("/api/org-config", {
        method: "PUT",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ mode: orgMode }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to update org mode");
      setOrgMode(j?.data?.mode || orgMode);
      setNotice("Org mode updated.");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingMode(false);
    }
  }

  async function saveThreshold() {
    setError("");
    setNotice("");

    const v = parseLimitDraft(limitDraft);
    if (!v.ok) {
      setError(v.error);
      return;
    }

    setSavingLimit(true);
    try {
      const r = await fetch("/api/org-config", {
        method: "PUT",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ autoApproveLimit: v.value }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to update threshold");
      setAutoApproveLimit(j?.data?.autoApproveLimit ?? autoApproveLimit);
      setLimitDraft(String(j?.data?.autoApproveLimit ?? v.value));
      setNotice("Threshold updated.");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingLimit(false);
    }
  }

  async function saveLeadTime() {
    setError("");
    setNotice("");

    const v = parseLeadTimeDraft(leadTimeDraft);
    if (!v.ok) {
      setError(v.error);
      return;
    }

    setSavingLeadTime(true);
    try {
      const r = await fetch("/api/org-config", {
        method: "PUT",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ invoiceLeadTimeDays: v.value }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to update lead time");
      const newVal = j?.data?.invoiceLeadTimeDays ?? v.value;
      setInvoiceLeadTimeDays(newVal);
      setLeadTimeDraft(String(newVal));
      setNotice("Invoice lead time updated.");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingLeadTime(false);
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Settings" subtitle="Configure governance mode and default auto-approval settings." />
        <PageContent>
          {error ? (
            <div className="notice notice-err mt-3">
              <strong className="text-red-700">Error:</strong> {error}
            </div>
          ) : null}
          {notice ? (
            <div className="notice notice-ok mt-3">
              <strong className="text-green-700">OK:</strong> {notice}
            </div>
          ) : null}

          {/* Tab strip */}
          <div className="tab-strip">
            {SETTINGS_TABS.map((tab, i) => (
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
            {activeTab === 1 ? `${buildings.length} building${buildings.length !== 1 ? "s" : ""}` : null}
            {activeTab === 4 ? `${legalSources.length} source${legalSources.length !== 1 ? "s" : ""} · ${legalVariables.length} variable${legalVariables.length !== 1 ? "s" : ""}` : null}
          </span>
          {activeTab === 1 && <Link href="/admin-inventory/buildings" className="full-page-link">Manage buildings →</Link>}

          {activeTab !== 5 && (
          <Panel bodyClassName="p-0">

          {/* Organisation tab */}
          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            <div className="px-4 py-4">
            <div className="card grid gap-3">
              <div className="font-bold">Org mode</div>
              <div className="flex gap-2 flex-wrap">
                <select
                  className="input"
                  className="max-w-[240px]"
                  value={orgMode}
                  onChange={(e) => setOrgMode(e.target.value)}
                  disabled={loading}
                >
                  <option value="MANAGED">Managed</option>
                  <option value="OWNER_DIRECT">Owner-direct</option>
                </select>
                <button
                  className="button-primary"
                  onClick={saveOrgMode}
                  disabled={savingMode || loading}
                >
                  {savingMode ? "Saving…" : "Save mode"}
                </button>
                <span className="help">Owner-direct restricts governance to owners only.</span>
              </div>
            </div>

            <div className="card grid gap-3 mt-4">
              <div className="font-bold">Auto-approval threshold</div>
              <div className="subtle">
                Current: <strong>{autoApproveLimit == null ? "(unavailable)" : `${autoApproveLimit} CHF`}</strong>
              </div>
              <div className="flex gap-2 flex-wrap">
                <label className="flex gap-2 items-center">
                  <span className="text-slate-600">Set to</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100000"
                    value={limitDraft}
                    onChange={(e) => setLimitDraft(e.target.value)}
                    className="input w-[140px] mb-0"
                    disabled={loading}
                  />
                  <span className="text-slate-600">CHF</span>
                </label>
                <button
                  className="button-primary"
                  onClick={saveThreshold}
                  disabled={savingLimit || loading || !limitValidation.ok}
                >
                  {savingLimit ? "Saving…" : "Save threshold"}
                </button>
                {!limitValidation.ok ? (
                  <span className="notice notice-err p-1.5 mb-0">
                    {limitValidation.error}
                  </span>
                ) : (
                  <span className="help">Requests with estimated cost ≤ this value auto-approve.</span>
                )}
              </div>
            </div>

            <div className="card grid gap-3 mt-4">
              <div className="font-bold">Invoice lead time</div>
              <div className="subtle">
                Current: <strong>{invoiceLeadTimeDays} days</strong> before period start
              </div>
              <div className="flex gap-2 flex-wrap">
                <label className="flex gap-2 items-center">
                  <span className="text-slate-600">Generate</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="60"
                    value={leadTimeDraft}
                    onChange={(e) => setLeadTimeDraft(e.target.value)}
                    className="input w-[100px] mb-0"
                    disabled={loading}
                  />
                  <span className="text-slate-600">days before billing period</span>
                </label>
                <button
                  className="button-primary"
                  onClick={saveLeadTime}
                  disabled={savingLeadTime || loading || !leadTimeValidation.ok}
                >
                  {savingLeadTime ? "Saving…" : "Save lead time"}
                </button>
                {!leadTimeValidation.ok ? (
                  <span className="notice notice-err p-1.5 mb-0">
                    {leadTimeValidation.error}
                  </span>
                ) : (
                  <span className="help">Recurring invoices are generated this many days before the billing period starts.</span>
                )}
              </div>
            </div>
            </div>
          </div>

          {/* Buildings tab */}
          <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
            {buildingsLoading ? (
              <p className="loading-text">Loading buildings…</p>
            ) : buildings.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No buildings configured yet. Per-building settings will appear once buildings are added.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                          <Link href={`/admin-inventory/buildings/${b.id}`} className="full-page-link">Configure →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notifications tab */}
          <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
            <div className="px-4 py-4">
            <div className="coming-soon">
              <span className="coming-soon-badge">Coming soon</span>
              <p className="coming-soon-title">Notification Preferences</p>
              <p className="coming-soon-text">
                Configure email and in-app notification rules per event type.
              </p>
            </div>
            </div>
          </div>

          {/* Integrations tab */}
          <div className={activeTab === 3 ? "tab-panel-active" : "tab-panel"}>
            <div className="px-4 py-4">
            <div className="coming-soon">
              <span className="coming-soon-badge">Coming soon</span>
              <p className="coming-soon-title">Integrations</p>
              <p className="coming-soon-text">
                Connect third-party services — accounting, calendars, and more.
              </p>
            </div>
            </div>
          </div>

          {/* Legal Sources tab */}
          <div className={activeTab === 4 ? "tab-panel-active" : "tab-panel"}>
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Legal Sources</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Swiss tenancy law data sources — reference rates, CPI, ASLOCA depreciation, and legislation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {syncResult && !error && (
                    <span className="text-xs text-slate-500">
                      ✓ {syncResult.filter((r) => r.status === "success").length} synced
                    </span>
                  )}
                  <button
                    className="button-primary text-xs"
                    onClick={syncSources}
                    disabled={ingesting}
                  >
                    {ingesting ? "Syncing…" : "Sync Sources"}
                  </button>
                  <button
                    className="button-primary text-xs"
                    onClick={openLegalCreateForm}
                  >
                    Add Source
                  </button>
                </div>
              </div>

              {legalFormOpen && (
                <LegalSourceForm
                  source={editingSource}
                  saving={legalSaving}
                  formError={legalFormError}
                  onSubmit={handleLegalFormSubmit}
                  onCancel={closeLegalForm}
                />
              )}

              {!legalLoading && legalSources.length > 1 && (
                <LegalScopeFilterBar
                  sources={legalSources}
                  activeFilter={scopeFilter}
                  onFilter={setScopeFilter}
                />
              )}
            </div>

            {legalLoading ? (
              <p className="loading-text">Loading sources…</p>
            ) : legalSources.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No legal sources configured. Sources are auto-created on server startup.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Scope</th>
                      <th>Frequency</th>
                      <th>Status</th>
                      <th>Last Synced</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legalSources
                      .filter((s) => scopeFilter === "ALL" || s.scope === scopeFilter)
                      .map((s) => (
                      <tr key={s.id}>
                        <td className="cell-bold">
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.name}</a>
                          ) : s.name}
                        </td>
                        <td className="font-mono text-xs">{formatFetcherType(s.fetcherType)}</td>
                        <td><LegalScopeBadge scope={s.scope} /></td>
                        <td>{s.updateFrequency || "—"}</td>
                        <td><LegalStatusPill status={s.status} /></td>
                        <td>{s.lastSuccessAt ? formatLegalDate(s.lastSuccessAt) : "Never"}</td>
                        <td>
                          <div className="flex gap-2">
                            <button className="text-xs text-blue-600 hover:underline" onClick={() => openLegalEditForm(s)}>Edit</button>
                            {s.status === "ACTIVE" ? (
                              <button className="text-xs text-amber-600 hover:underline" onClick={() => toggleSourceStatus(s)}>Deactivate</button>
                            ) : (
                              <button className="text-xs text-green-600 hover:underline" onClick={() => toggleSourceStatus(s)}>Activate</button>
                            )}
                            {s.status === "INACTIVE" && (
                              <button className="text-xs text-red-600 hover:underline" onClick={() => deleteSource(s)}>Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!legalLoading && legalVariables.length > 0 && (
              <>
                <div className="px-4 py-3 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-800">Legal Variables</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{legalVariables.length} variable{legalVariables.length !== 1 ? "s" : ""} tracked</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Description</th>
                        <th>Versions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legalVariables.map((v) => (
                        <tr key={v.id}>
                          <td className="font-mono text-xs">{v.key}</td>
                          <td>{v.description || "—"}</td>
                          <td>{v.versions?.length || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          </Panel>
          )}

          {/* Depreciation tab — renders its own Panels internally */}
          {activeTab === 5 && <DepreciationStandards />}

        </PageContent>
      </PageShell>
    </AppShell>
  );
}

// ══════════════════════════════════════════════════════════════
// Legal Sources Helper Components
// ══════════════════════════════════════════════════════════════

const CANTON_CODES = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR",
  "JU", "LU", "NE", "NW", "OW", "SG", "SH", "SO", "SZ", "TG",
  "TI", "UR", "VD", "VS", "ZG", "ZH",
];

function formatFetcherType(type) {
  const labels = {
    REFERENCE_RATE: "Reference Rate",
    CPI: "Consumer Price Index",
    ASLOCA_DEPRECIATION: "ASLOCA Depreciation",
    ASLOCA_RENT_REDUCTION: "ASLOCA Rent Reduction",
    FEDLEX: "Fedlex (CO/OR)",
  };
  return labels[type] || type || "—";
}

function formatLegalDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH");
}

function LegalStatusPill({ status }) {
  return (
    <Badge variant={legalVariant(status)} size="sm">
      {status}
    </Badge>
  );
}

function LegalScopeBadge({ scope }) {
  return (
    <Badge variant={scope === "FEDERAL" ? "info" : "default"} size="sm">
      {scope === "FEDERAL" ? "Federal" : scope}
    </Badge>
  );
}

function LegalScopeFilterBar({ sources, activeFilter, onFilter }) {
  const scopeSet = new Set(sources.map((s) => s.scope));
  const cantonScopes = [...scopeSet].filter((s) => s !== "FEDERAL").sort();
  const tabs = [
    { label: "All", value: "ALL" },
    ...(scopeSet.has("FEDERAL") ? [{ label: "Federal", value: "FEDERAL" }] : []),
    ...cantonScopes.map((c) => ({ label: c, value: c })),
  ];
  if (tabs.length <= 2) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onFilter(tab.value)}
          className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", activeFilter === tab.value
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function LegalSourceForm({ source, saving, formError, onSubmit, onCancel }) {
  const isEdit = !!source;
  const [name, setName] = useState(source?.name || "");
  const [url, setUrl] = useState(source?.url || "");
  const [jurisdiction, setJurisdiction] = useState(source?.jurisdiction || "CH");
  const [scope, setScope] = useState(source?.scope || "FEDERAL");
  const [fetcherType, setFetcherType] = useState(source?.fetcherType || "");
  const [parserType, setParserType] = useState(source?.parserType || "");
  const [updateFrequency, setUpdateFrequency] = useState(source?.updateFrequency || "");
  const [status, setStatus] = useState(source?.status || "ACTIVE");

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      url: url.trim() || null,
      jurisdiction: jurisdiction.trim() || "CH",
      scope,
      fetcherType: fetcherType.trim() || null,
      parserType: parserType.trim() || null,
      updateFrequency: updateFrequency.trim() || null,
      status,
    });
  }

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">
        {isEdit ? "Edit Source" : "Add Source"}
      </h3>
      {formError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {formError}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass}>Name *</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Swiss Reference Rate" />
        </div>
        <div>
          <label className={labelClass}>URL</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} placeholder="https://..." />
        </div>
        <div>
          <label className={labelClass}>Jurisdiction</label>
          <input type="text" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={inputClass} placeholder="CH" />
        </div>
        <div>
          <label className={labelClass}>Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={inputClass}>
            <option value="FEDERAL">Federal</option>
            {CANTON_CODES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Fetcher type</label>
          <input type="text" value={fetcherType} onChange={(e) => setFetcherType(e.target.value)} className={inputClass} placeholder="e.g. REFERENCE_RATE, CPI" />
        </div>
        <div>
          <label className={labelClass}>Parser type</label>
          <input type="text" value={parserType} onChange={(e) => setParserType(e.target.value)} className={inputClass} placeholder="Optional" />
        </div>
        <div>
          <label className={labelClass}>Update frequency</label>
          <input type="text" value={updateFrequency} onChange={(e) => setUpdateFrequency(e.target.value)} className={inputClass} placeholder="e.g. daily, monthly" />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="button-primary text-sm"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add Source"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
