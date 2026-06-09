import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Link from "next/link";
import { authHeaders } from "../../lib/api";
import Badge from "../../components/ui/Badge";
import { legalVariant } from "../../lib/statusVariants";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/format";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
import DepreciationStandards from "../../components/DepreciationStandards";
import CategoryMappings from "../../components/CategoryMappings";
import SortableHeader from "../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../lib/tableUtils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";
import NotificationPreferencesTab from "../../components/NotificationPreferencesTab";
import AppearanceTab from "../../components/AppearanceTab";

const SETTINGS_TABS = [
  { key: "ORG" },
  { key: "NOTIFICATIONS" },
  { key: "INTEGRATIONS" },
  { key: "LEGAL" },
  { key: "DEPRECIATION" },
  { key: "CATEGORYMAPPINGS" },
  { key: "APPEARANCE" },
];

const TAB_KEYS = ['organisation', 'notifications', 'integrations', 'legal', 'depreciation', 'categorymappings', 'appearance'];

const MANAGER_EVENT_GROUPS = [
  { groupKey: "requests", events: ["REQUEST_PENDING_REVIEW", "REQUEST_PENDING_OWNER_APPROVAL", "CONTRACTOR_REJECTED", "REJECTED"] },
  { groupKey: "jobs", events: ["JOB_CREATED", "JOB_COMPLETED", "RATING_SUBMITTED"] },
  { groupKey: "invoices", events: ["INVOICE_CREATED", "INVOICE_DISPUTED", "INVOICE_OVERDUE"] },
  { groupKey: "leases", events: ["LEASE_SIGNED"] },
  { groupKey: "applications", events: ["APPLICATION_SUBMITTED", "TENANT_SELECTED"] },
  { groupKey: "quotes", events: ["QUOTE_SUBMITTED"] },
];

export default function ManagerSettingsPage() {
  const { t } = useTranslation("manager");
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

  const { sortField: lsSF, sortDir: lsSD, handleSort: handleLsSort } = useLocalSort("name", "asc");
  const { sortField: lvSF, sortDir: lvSD, handleSort: handleLvSort } = useLocalSort("key", "asc");

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
    if (activeTab === 3) loadLegalData();
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
        <PageHeader title={t("manager:settings.title.settings")} subtitle={t("manager:settings.prop.configureGovernanceModeAndDefaultAutoapprovalSettings")} />
        <PageContent>
          {error ? (
            <div className="notice notice-err mt-3">
              <strong className="text-red-700">{t("manager:settings.text.error")}</strong> {error}
            </div>
          ) : null}
          {notice ? (
            <div className="notice notice-ok mt-3">
              <strong className="text-green-700">{t("manager:settings.text.oK")}</strong> {notice}
            </div>
          ) : null}

          {/* Tab strip */}
          <ScrollableTabs activeIndex={activeTab}>
            {SETTINGS_TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {t(`manager:settings.tabs.${tab.key.toLowerCase()}`)}
              </button>
            ))}
          </ScrollableTabs>

          {/* Count + full-view link — outside the Panel card */}
          <span className="tab-panel-count">
            {activeTab === 3 ? `${legalSources.length} source${legalSources.length !== 1 ? "s" : ""} · ${legalVariables.length} variable${legalVariables.length !== 1 ? "s" : ""}` : null}
          </span>

          {activeTab !== 4 && (
          <>

          {/* Organisation tab */}
          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            <div className="px-4 py-4">
            <div className="card grid gap-3">
              <div className="font-bold">{t("manager:settings.text.orgMode")}</div>
              <div className="flex gap-2 flex-wrap">
                <select
                  className="input"
                  className="max-w-[240px]"
                  value={orgMode}
                  onChange={(e) => setOrgMode(e.target.value)}
                  disabled={loading}
                >
                  <option value="MANAGED">{t("manager:settings.text.managed")}</option>
                  <option value="OWNER_DIRECT">{t("manager:settings.text.ownerdirect")}</option>
                </select>
                <button
                  className="button-primary"
                  onClick={saveOrgMode}
                  disabled={savingMode || loading}
                >
                  {savingMode ? "Saving…" : "Save mode"}
                </button>
                <span className="help">{t("manager:settings.text.ownerdirectRestrictsGovernanceToOwnersOnly")}</span>
              </div>
            </div>

            <div className="card grid gap-3 mt-4">
              <div className="font-bold">{t("manager:settings.text.autoapprovalThreshold")}</div>
              <div className="subtle">
                Current: <strong>{autoApproveLimit == null ? "(unavailable)" : `${autoApproveLimit} CHF`}</strong>
              </div>
              <div className="flex gap-2 flex-wrap">
                <label className="flex gap-2 items-center">
                  <span className="text-muted-text">{t("manager:settings.text.setTo")}</span>
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
                  <span className="text-muted-text">CHF</span>
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
                  <span className="help">{t("manager:settings.text.requestsWithEstimatedCostThisValueAutoapprove")}</span>
                )}
              </div>
            </div>

            <div className="card grid gap-3 mt-4">
              <div className="font-bold">{t("manager:settings.text.invoiceLeadTime")}</div>
              <div className="subtle">
                Current: <strong>{invoiceLeadTimeDays} days</strong> before period start
              </div>
              <div className="flex gap-2 flex-wrap">
                <label className="flex gap-2 items-center">
                  <span className="text-muted-text">{t("manager:settings.text.generate")}</span>
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
                  <span className="text-muted-text">{t("manager:settings.text.daysBeforeBillingPeriod")}</span>
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
                  <span className="help">{t("manager:settings.text.recurringInvoicesAreGeneratedThisManyDaysBeforeTheBillingPeriodStarts")}</span>
                )}
              </div>
            </div>
            </div>
          </div>

          {/* Notifications tab */}
          <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
            <NotificationPreferencesTab
              authHeaders={authHeaders}
              eventGroups={MANAGER_EVENT_GROUPS}
              t={t}
              ns="manager"
            />
          </div>

          {/* Integrations tab */}
          <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
            <div className="px-4 py-4">
            <div className="coming-soon">
              <span className="coming-soon-badge">{t("manager:settings.text.comingSoon")}</span>
              <p className="coming-soon-title">{t("manager:settings.text.integrations")}</p>
              <p className="coming-soon-text">
                Connect third-party services — accounting, calendars, and more.
              </p>
            </div>
            </div>
          </div>

          {/* Legal Sources tab */}
          <div className={activeTab === 3 ? "tab-panel-active" : "tab-panel"}>
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t("manager:settings.heading.legalSources")}</h3>
                  <p className="text-xs text-muted mt-0.5">
                    Swiss tenancy law data sources — reference rates, CPI, ASLOCA depreciation, and legislation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {syncResult && !error && (
                    <span className="text-xs text-muted">
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
              <p className="loading-text">{t("manager:settings.text.loadingSources")}</p>
            ) : legalSources.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">{t("manager:settings.text.noLegalSourcesConfiguredSourcesAreAutocreatedOnServerStartup")}</p>
              </div>
            ) : (
              <>
                {/* Mobile card list — sm:hidden */}
                <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                  {legalSources
                    .filter((s) => scopeFilter === "ALL" || s.scope === scopeFilter)
                    .map((s) => (
                    <div key={s.id} className="table-card">
                      <div className="flex items-start justify-between gap-2">
                        <span className="table-card-head">
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.name}</a>
                          ) : s.name}
                        </span>
                        <LegalStatusPill status={s.status} />
                      </div>
                      <div className="table-card-footer">
                        <LegalScopeBadge scope={s.scope} />
                        <span>{formatFetcherType(s.fetcherType)}</span>
                        <span>{s.lastSuccessAt ? formatLegalDate(s.lastSuccessAt) : "Never synced"}</span>
                      </div>
                      <div className="mt-2 flex gap-3">
                        <button className="text-xs text-blue-600 hover:underline" onClick={() => openLegalEditForm(s)}>{t("manager:settings.text.edit")}</button>
                        {s.status === "ACTIVE" ? (
                          <button className="text-xs text-amber-600 hover:underline" onClick={() => toggleSourceStatus(s)}>{t("manager:settings.text.deactivate")}</button>
                        ) : (
                          <button className="text-xs text-green-600 hover:underline" onClick={() => toggleSourceStatus(s)}>{t("manager:settings.text.activate")}</button>
                        )}
                        {s.status === "INACTIVE" && (
                          <button className="text-xs text-red-600 hover:underline" onClick={() => deleteSource(s)}>{t("manager:settings.text.delete")}</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Wide table — hidden sm:block */}
                <div className="hidden sm:block data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <SortableHeader label={t("manager:settings.prop.name")} field="name" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                        <SortableHeader label={t("manager:settings.prop.type")} field="type" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                        <SortableHeader label={t("manager:settings.prop.scope")} field="scope" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                        <SortableHeader label={t("manager:settings.prop.frequency")} field="frequency" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                        <SortableHeader label={t("manager:settings.prop.status")} field="status" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                        <SortableHeader label={t("manager:settings.prop.lastSynced")} field="lastSynced" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                        <th>{t("manager:settings.col.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...legalSources]
                        .filter((s) => scopeFilter === "ALL" || s.scope === scopeFilter)
                        .sort((a, b) => {
                          let va = "", vb = "";
                          if (lsSF === "status") { va = a.status || ""; vb = b.status || ""; }
                          else if (lsSF === "scope") { va = a.scope || ""; vb = b.scope || ""; }
                          else if (lsSF === "type") { va = a.fetcherType || ""; vb = b.fetcherType || ""; }
                          else if (lsSF === "frequency") { va = a.updateFrequency || ""; vb = b.updateFrequency || ""; }
                          else if (lsSF === "lastSynced") { va = a.lastSuccessAt || ""; vb = b.lastSuccessAt || ""; }
                          else { va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); }
                          return lsSD === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
                        })
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
                              <button className="text-xs text-blue-600 hover:underline" onClick={() => openLegalEditForm(s)}>{t("manager:settings.text.edit")}</button>
                              {s.status === "ACTIVE" ? (
                                <button className="text-xs text-amber-600 hover:underline" onClick={() => toggleSourceStatus(s)}>{t("manager:settings.text.deactivate")}</button>
                              ) : (
                                <button className="text-xs text-green-600 hover:underline" onClick={() => toggleSourceStatus(s)}>{t("manager:settings.text.activate")}</button>
                              )}
                              {s.status === "INACTIVE" && (
                                <button className="text-xs text-red-600 hover:underline" onClick={() => deleteSource(s)}>{t("manager:settings.text.delete")}</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!legalLoading && legalVariables.length > 0 && (
              <>
                <div className="px-4 py-3 border-t border-surface-divider">
                  <h3 className="text-sm font-semibold text-foreground">{t("manager:settings.heading.legalVariables")}</h3>
                  <p className="text-xs text-muted mt-0.5">{legalVariables.length} variable{legalVariables.length !== 1 ? "s" : ""} tracked</p>
                </div>
                <>
                  {/* Mobile card list — sm:hidden */}
                  <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                    {legalVariables.map((v) => (
                      <div key={v.id} className="table-card">
                        <span className="font-mono text-xs text-muted-dark">{v.key}</span>
                        <p className="table-card-head mt-0.5">{v.description || "—"}</p>
                        <div className="table-card-footer">
                          <span>{v.versions?.length || 0} version{(v.versions?.length || 0) !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Wide table — hidden sm:block */}
                  <div className="hidden sm:block data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <SortableHeader label={t("manager:settings.prop.key")} field="key" sortField={lvSF} sortDir={lvSD} onSort={handleLvSort} />
                          <SortableHeader label={t("manager:settings.prop.description")} field="description" sortField={lvSF} sortDir={lvSD} onSort={handleLvSort} />
                          <th>{t("manager:settings.col.versions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...legalVariables].sort((a, b) => {
                          let va = "", vb = "";
                          if (lvSF === "description") { va = (a.description || "").toLowerCase(); vb = (b.description || "").toLowerCase(); }
                          else { va = (a.key || "").toLowerCase(); vb = (b.key || "").toLowerCase(); }
                          return lvSD === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
                        }).map((v) => (
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
              </>
            )}
          </div>

          </>
          )}

          {/* Depreciation tab — renders its own Panels internally */}
          {activeTab === 4 && <DepreciationStandards />}

          {/* Category Mappings tab — maps expense categories to legal topics */}
          {activeTab === 5 && <CategoryMappings />}

          {/* Appearance tab — dark / light mode toggle */}
          {activeTab === 6 && <AppearanceTab t={t} ns="manager" />}

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
  return formatDate(iso);
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
              : "bg-surface-hover text-muted-text hover:bg-surface-border")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function LegalSourceForm({ source, saving, formError, onSubmit, onCancel }) {
  const { t } = useTranslation("manager");
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

  const inputClass = "w-full rounded-lg border border-muted-ring px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-muted-text mb-1";

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-lg border border-surface-border bg-surface-subtle p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        {isEdit ? "Edit Source" : "Add Source"}
      </h3>
      {formError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {formError}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass}>{t("manager:settings.text.name")}</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder={t("manager:settings.placeholder.swissReferenceRate")} />
        </div>
        <div>
          <label className={labelClass}>URL</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} placeholder="https://..." />
        </div>
        <div>
          <label className={labelClass}>{t("manager:settings.text.jurisdiction")}</label>
          <input type="text" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={inputClass} placeholder="CH" />
        </div>
        <div>
          <label className={labelClass}>{t("manager:settings.text.scope")}</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={inputClass}>
            <option value="FEDERAL">{t("manager:settings.text.federal")}</option>
            {CANTON_CODES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("manager:settings.text.fetcherType")}</label>
          <select value={fetcherType} onChange={(e) => setFetcherType(e.target.value)} className={inputClass}>
            <option value="">— Manual / no auto-fetch —</option>
            <option value="REFERENCE_RATE">REFERENCE_RATE</option>
            <option value="CPI">CPI</option>
            <option value="ASLOCA_DEPRECIATION">ASLOCA_DEPRECIATION</option>
            <option value="ASLOCA_RENT_REDUCTION">ASLOCA_RENT_REDUCTION</option>
            <option value="FEDLEX">FEDLEX</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("manager:settings.text.parserType")}</label>
          <input type="text" value={parserType} onChange={(e) => setParserType(e.target.value)} className={inputClass} placeholder={t("manager:settings.placeholder.optional")} />
        </div>
        <div>
          <label className={labelClass}>{t("manager:settings.text.updateFrequency")}</label>
          <input type="text" value={updateFrequency} onChange={(e) => setUpdateFrequency(e.target.value)} className={inputClass} placeholder={t("manager:settings.placeholder.eGDailyMonthly")} />
        </div>
        <div>
          <label className={labelClass}>{t("manager:settings.text.status")}</label>
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
          className="rounded-lg border border-muted-ring px-4 py-1.5 text-sm font-medium text-muted-dark hover:bg-surface-subtle"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
