import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Link from "next/link";
import { authHeaders } from "../../lib/api";
const SETTINGS_TABS = [
  { key: "ORG", label: "Organisation" },
  { key: "BUILDINGS", label: "Buildings" },
  { key: "NOTIFICATIONS", label: "Notifications" },
  { key: "INTEGRATIONS", label: "Integrations" },
];

const TAB_KEYS = ['organisation', 'buildings', 'notifications', 'integrations'];

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
              <strong className="text-err-text">Error:</strong> {error}
            </div>
          ) : null}
          {notice ? (
            <div className="notice notice-ok mt-3">
              <strong className="text-ok-text">OK:</strong> {notice}
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
          </span>
          {activeTab === 1 && <Link href="/admin-inventory/buildings" className="full-page-link">Manage buildings →</Link>}

          <Panel bodyClassName="p-0">

          {/* Organisation tab */}
          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            <div className="px-4 py-4">
            <div className="card grid gap-3">
              <div className="font-bold">Org mode</div>
              <div className="flex gap-2 flex-wrap">
                <select
                  className="input"
                  style={{ maxWidth: 240 }}
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
                  <span className="text-subtle">Set to</span>
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
                  <span className="text-subtle">CHF</span>
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
                  <span className="text-subtle">Generate</span>
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
                  <span className="text-subtle">days before billing period</span>
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

          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
