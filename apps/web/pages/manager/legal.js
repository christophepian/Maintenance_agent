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
          <Panel title="Legal Sources">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : sources.length === 0 ? (
              <p className="text-sm text-slate-500">No legal sources configured yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Last Synced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s) => (
                      <tr key={s.id} className="border-b border-slate-50">
                        <td className="py-2 pr-4 font-medium">
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.name}</a>
                          ) : s.name}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">{formatFetcherType(s.fetcherType)}</td>
                        <td className="py-2 pr-4">
                          <StatusPill status={s.status} />
                        </td>
                        <td className="py-2 pr-4">{s.lastSuccessAt ? formatDate(s.lastSuccessAt) : "Never"}</td>
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
