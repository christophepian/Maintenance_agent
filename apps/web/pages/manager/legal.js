import { useEffect, useState, useCallback } from "react";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Link from "next/link";
import { authHeaders } from "../../lib/api";

export default function ManagerLegalPage() {
  const [sources, setSources] = useState([]);
  const [variables, setVariables] = useState([]);
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [srcRes, varRes] = await Promise.all([
        fetch("/api/legal/sources", { headers: authHeaders() }),
        fetch("/api/legal/variables", { headers: authHeaders() }),
      ]);
      const srcData = await srcRes.json();
      const varData = await varRes.json();
      if (!srcRes.ok) throw new Error(srcData?.error?.message || "Failed to load sources");
      setSources(srcData?.data || []);
      setVariables(varData?.data || []);
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
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={syncSources}
              disabled={ingesting}
            >
              {ingesting ? "Syncing\u2026" : "Sync Sources"}
            </button>
          }
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {syncResult && !error && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <strong>Sync complete:</strong>{" "}
              {syncResult.filter((r) => r.status === "success").length} source(s) synced
              {syncResult.some((r) => r.status === "error") && (
                <span className="text-red-600">
                  , {syncResult.filter((r) => r.status === "error").length} failed
                </span>
              )}
              {syncResult.reduce((sum, r) => sum + r.variablesUpdated, 0) > 0 && (
                <span>
                  {" \u2014 "}{syncResult.reduce((sum, r) => sum + r.variablesUpdated, 0)} variable(s) updated
                </span>
              )}
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Rules", href: "/manager/legal/rules", desc: "Statutory & custom rules" },
              { label: "Category Mappings", href: "/manager/legal/mappings", desc: "Category → legal topic" },
              { label: "Depreciation", href: "/manager/legal/depreciation", desc: "Swiss depreciation standards" },
              { label: "Evaluations", href: "/manager/legal/evaluations", desc: "Decision audit log" },
              { label: "RFPs", href: "/manager/rfps", desc: "Request for proposals" },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
              >
                <span className="text-sm font-semibold text-slate-900">{card.label}</span>
                <span className="mt-1 text-xs text-slate-500">{card.desc}</span>
              </Link>
            ))}
          </div>

          {/* Sources */}
          <Panel
            title="Legal Sources"
            actions={
              <button
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                onClick={openCreateForm}
              >
                Add Source
              </button>
            }
          >
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
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Scope</th>
                      <th className="py-2 pr-4">Frequency</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Last Synced</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources
                      .filter((s) => scopeFilter === "ALL" || s.scope === scopeFilter)
                      .map((s) => (
                      <tr key={s.id} className="border-b border-slate-50">
                        <td className="py-2 pr-4 font-medium">
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.name}</a>
                          ) : s.name}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">{formatFetcherType(s.fetcherType)}</td>
                        <td className="py-2 pr-4"><ScopeBadge scope={s.scope} /></td>
                        <td className="py-2 pr-4 text-xs">{s.updateFrequency || "—"}</td>
                        <td className="py-2 pr-4">
                          <StatusPill status={s.status} />
                        </td>
                        <td className="py-2 pr-4">{s.lastSuccessAt ? formatDate(s.lastSuccessAt) : "Never"}</td>
                        <td className="py-2 pr-4">
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
              </div>
            )}
          </Panel>

          {/* Variables */}
          <Panel title="Legal Variables">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : variables.length === 0 ? (
              <p className="text-sm text-slate-500">No legal variables configured yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                      <th className="py-2 pr-4">Key</th>
                      <th className="py-2 pr-4">Description</th>
                      <th className="py-2 pr-4">Versions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((v) => (
                      <tr key={v.id} className="border-b border-slate-50">
                        <td className="py-2 pr-4 font-mono text-xs">{v.key}</td>
                        <td className="py-2 pr-4">{v.description || "—"}</td>
                        <td className="py-2 pr-4">{v.versions?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
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
