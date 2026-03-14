import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import CategoryMappings from "../../components/CategoryMappings";
import Link from "next/link";
import { authHeaders } from "../../lib/api";
const LEGAL_TABS = [
  { key: "RULES", label: "Rules" },
  { key: "EVALUATIONS", label: "Evaluations" },
  { key: "MAPPINGS", label: "Category mappings" },
  { key: "SOURCES", label: "Sources" },
];

const TAB_KEYS = ['rules', 'evaluations', 'category_mappings', 'sources'];

export default function ManagerLegalPage() {
  const [sources, setSources] = useState([]);
  const [variables, setVariables] = useState([]);
  const [rules, setRules] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [evalTotal, setEvalTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // ── Source CRUD state ──────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const router = useRouter();
  const activeTab = router.isReady ? (Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true }
    );
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [srcRes, varRes, rulesRes, evalRes] = await Promise.all([
        fetch("/api/legal/sources", { headers: authHeaders() }),
        fetch("/api/legal/variables", { headers: authHeaders() }),
        fetch("/api/legal/rules", { headers: authHeaders() }),
        fetch("/api/legal/evaluations?limit=200", { headers: authHeaders() }),
      ]);
      const srcData = await srcRes.json();
      const varData = await varRes.json();
      const rulesData = await rulesRes.json();
      const evalData = await evalRes.json();
      if (!srcRes.ok) throw new Error(srcData?.error?.message || "Failed to load sources");
      setSources(srcData?.data || []);
      setVariables(varData?.data || []);
      setRules(rulesData?.data || []);
      setEvaluations(evalData?.data || []);
      setEvalTotal(evalData?.total ?? 0);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setIngesting(false);
    }
  }

  // ── Source CRUD helpers ────────────────────────────────────

  function openCreateForm() {
    setEditingSource(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEditForm(source) {
    setEditingSource(source);
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingSource(null);
    setFormError("");
  }

  async function handleFormSubmit(formData) {
    setSaving(true);
    setFormError("");
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
      closeForm();
      await loadData();
    } catch (e) {
      setFormError(String(e?.message || e));
    } finally {
      setSaving(false);
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
      await loadData();
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
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Legal Engine"
          subtitle="Swiss tenancy law decision engine — rules, variables, and evaluation logs"
          actions={
            <div className="flex items-center gap-2">
              {syncResult && !error && (
                <span className="text-xs text-slate-500">
                  ✓ {syncResult.filter((r) => r.status === "success").length} synced
                  {syncResult.reduce((sum, r) => sum + r.variablesUpdated, 0) > 0 && (
                    <> — {syncResult.reduce((sum, r) => sum + r.variablesUpdated, 0)} var(s) updated</>
                  )}
                </span>
              )}
              <button
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={syncSources}
                disabled={ingesting}
              >
                {ingesting ? "Syncing\u2026" : "Sync Sources"}
              </button>
            </div>
          }
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Tab strip */}
          <div className="tab-strip">
            {LEGAL_TABS.map((tab, i) => (
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
            {activeTab === 0 ? `${rules.length} rule${rules.length !== 1 ? "s" : ""}` : null}
            {activeTab === 1 ? `${evalTotal} evaluation${evalTotal !== 1 ? "s" : ""}` : null}
            {activeTab === 2 ? "Category mappings" : null}
            {activeTab === 3 ? `${sources.length} source${sources.length !== 1 ? "s" : ""} · ${variables.length} variable${variables.length !== 1 ? "s" : ""}` : null}
          </span>
          {activeTab === 0 && <Link href="/manager/legal/rules" className="full-page-link">Full view →</Link>}
          {activeTab === 1 && <Link href="/manager/legal/evaluations" className="full-page-link">Full view →</Link>}
          {activeTab === 2 && <Link href="/manager/legal/mappings" className="full-page-link">Full view →</Link>}

          {/* Rules tab */}
          {activeTab !== 2 && (
          <Panel bodyClassName="p-0">
          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading rules…</p>
            ) : rules.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No legal rules configured yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Jurisdiction</th>
                      <th>Versions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="cell-bold">{rule.name}</td>
                        <td>{rule.ruleType}</td>
                        <td>{rule.jurisdiction || "CH"}{rule.canton ? ` / ${rule.canton}` : ""}</td>
                        <td>{rule.versions?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Evaluations tab */}
          <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading evaluations…</p>
            ) : evaluations.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No evaluations yet. Trigger a legal decision on a maintenance request to generate one.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Obligation</th>
                      <th>Confidence</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map((ev) => (
                      <tr key={ev.id}>
                        <td className="cell-bold">{ev.category || "—"}</td>
                        <td>{ev.obligation || "—"}</td>
                        <td>{ev.confidence != null ? `${(ev.confidence * 100).toFixed(0)}%` : "—"}</td>
                        <td>{ev.recommendedActions?.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sources tab — inline content */}
          <div className={activeTab === 3 ? "tab-panel-active" : "tab-panel"}>
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Legal Sources</h3>
              <button
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                onClick={openCreateForm}
              >
                Add Source
              </button>
            </div>

            {/* Inline create / edit form */}
            {formOpen && (
              <SourceForm
                source={editingSource}
                saving={saving}
                formError={formError}
                onSubmit={handleFormSubmit}
                onCancel={closeForm}
              />
            )}

            {/* Scope filter */}
            {!loading && sources.length > 0 && (
              <ScopeFilterBar
                sources={sources}
                activeFilter={scopeFilter}
                onFilter={setScopeFilter}
              />
            )}

            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : sources.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500">
                  No legal sources configured yet.
                  <br />
                  Add a source to start tracking Swiss tenancy law updates automatically.
                </p>
                {!formOpen && (
                  <button
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    onClick={openCreateForm}
                  >
                    Add your first source
                  </button>
                )}
              </div>
            ) : null}
          </div>
            {!loading && sources.length > 0 && (
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
                    {sources
                      .filter((s) => scopeFilter === "ALL" || s.scope === scopeFilter)
                      .map((s) => (
                      <tr key={s.id}>
                        <td className="cell-bold">
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.name}</a>
                          ) : s.name}
                        </td>
                        <td className="font-mono text-xs">{formatFetcherType(s.fetcherType)}</td>
                        <td><ScopeBadge scope={s.scope} /></td>
                        <td>{s.updateFrequency || "—"}</td>
                        <td>
                          <StatusPill status={s.status} />
                        </td>
                        <td>{s.lastSuccessAt ? formatDate(s.lastSuccessAt) : "Never"}</td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              className="text-xs text-blue-600 hover:underline"
                              onClick={() => openEditForm(s)}
                            >
                              Edit
                            </button>
                            {s.status === "ACTIVE" ? (
                              <button
                                className="text-xs text-amber-600 hover:underline"
                                onClick={() => toggleSourceStatus(s)}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                className="text-xs text-green-600 hover:underline"
                                onClick={() => toggleSourceStatus(s)}
                              >
                                Activate
                              </button>
                            )}
                            {s.status === "INACTIVE" && (
                              <button
                                className="text-xs text-red-600 hover:underline"
                                onClick={() => deleteSource(s)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}

          <div className="px-4 py-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Legal Variables</h3>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : variables.length === 0 ? (
              <p className="text-sm text-slate-500">No legal variables configured yet.</p>
            ) : null}
          </div>
            {!loading && variables.length > 0 && (
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Description</th>
                      <th>Versions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((v) => (
                      <tr key={v.id}>
                        <td className="font-mono text-xs">{v.key}</td>
                        <td>{v.description || "—"}</td>
                        <td>{v.versions?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </div>{/* end Sources tab panel */}
          </Panel>
          )}

          {/* Category mappings tab — rendered outside Panel, uses shared component */}
          {activeTab === 2 && <CategoryMappings />}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

function formatFetcherType(type) {
  const labels = {
    REFERENCE_RATE: "Reference Rate",
    CPI: "Consumer Price Index",
  };
  return labels[type] || type || "\u2014";
}

function StatusPill({ status }) {
  const colors = {
    ACTIVE: "bg-green-50 text-green-700 border-green-200",
    ERROR: "bg-red-50 text-red-700 border-red-200",
    INACTIVE: "bg-slate-50 text-slate-500 border-slate-200",
    DRAFT: "bg-yellow-50 text-yellow-700 border-yellow-200",
    SUPERSEDED: "bg-slate-50 text-slate-500 border-slate-200",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${colors[status] || colors.DRAFT}`}>
      {status}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH");
}

function SourceForm({ source, saving, formError, onSubmit, onCancel }) {
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
    const data = {
      name: name.trim(),
      url: url.trim() || null,
      jurisdiction: jurisdiction.trim() || "CH",
      scope,
      fetcherType: fetcherType.trim() || null,
      parserType: parserType.trim() || null,
      updateFrequency: updateFrequency.trim() || null,
      status,
    };
    onSubmit(data);
  }

  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">
        {isEdit ? "Edit Source" : "Add Source"}
      </h3>

      {formError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
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
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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

// ── Canton codes (all 26 Swiss cantons, sorted) ────────────

const CANTON_CODES = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR",
  "JU", "LU", "NE", "NW", "OW", "SG", "SH", "SO", "SZ", "TG",
  "TI", "UR", "VD", "VS", "ZG", "ZH",
];

// ── Scope badge component ──────────────────────────────────

function ScopeBadge({ scope }) {
  if (scope === "FEDERAL") {
    return (
      <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        Federal
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
      {scope}
    </span>
  );
}

// ── Scope filter bar ───────────────────────────────────────

function ScopeFilterBar({ sources, activeFilter, onFilter }) {
  // Build list of active scope values present in sources
  const scopeSet = new Set(sources.map((s) => s.scope));
  const cantonScopes = [...scopeSet].filter((s) => s !== "FEDERAL").sort();

  const tabs = [
    { label: "All", value: "ALL" },
    ...(scopeSet.has("FEDERAL") ? [{ label: "Federal", value: "FEDERAL" }] : []),
    ...cantonScopes.map((c) => ({ label: c, value: c })),
  ];

  // Don't show filter bar if only one scope exists
  if (tabs.length <= 2) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onFilter(tab.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeFilter === tab.value
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
