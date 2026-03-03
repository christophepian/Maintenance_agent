import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import { formatNumber } from "../../../../lib/format";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function scoreColor(score) {
  if (score >= 700) return "text-green-700 bg-green-50";
  if (score >= 400) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

function confidenceBadge(confidence) {
  if (confidence >= 80) return { label: "High", cls: "bg-green-100 text-green-700" };
  if (confidence >= 50) return { label: "Medium", cls: "bg-amber-100 text-amber-700" };
  return { label: "Low", cls: "bg-red-100 text-red-700" };
}

export default function UnitApplicationsPage() {
  const router = useRouter();
  const { unitId } = router.query;

  const [applications, setApplications] = useState([]);
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("summary");

  // Adjust score modal
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [scoreDelta, setScoreDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  useEffect(() => {
    if (!router.isReady || !unitId) return;
    loadData();
  }, [router.isReady, unitId]);

  async function fetchJson(path) {
    const res = await fetch(path, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || "Request failed");
    return data;
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [appsRes, unitRes] = await Promise.all([
        fetchJson(`/api/manager/rental-applications?unitId=${unitId}&view=${view}`),
        fetchJson(`/api/units/${unitId}`),
      ]);
      setApplications(appsRes.data || []);
      setUnit(unitRes.data || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdjustScore() {
    if (!adjustTarget) return;
    setAdjustLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/manager/rental-application-units/${adjustTarget}/adjust-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ scoreDelta: Number(scoreDelta), reason: adjustReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to adjust score");
      setAdjustTarget(null);
      setScoreDelta(0);
      setAdjustReason("");
      loadData(); // refresh
    } catch (e) {
      setError(e.message);
    } finally {
      setAdjustLoading(false);
    }
  }

  const unitLabel = unit ? `${unit.building?.name || "Building"} — Unit ${unit.unitNumber}` : "Loading…";

  // For summary view, applications are RentalApplicationSummaryDTO
  // For full view, applications are RentalApplicationDTO with nested applicationUnits
  const rows = useMemo(() => {
    if (view === "summary") {
      // Summary DTOs nest scores inside unitApplications[] per unit
      return (applications || []).map((app) => {
        const au = (app.unitApplications || []).find((u) => u.unitId === unitId);
        return {
          id: app.id,
          applicationUnitId: au?.id,
          name: app.primaryApplicantName || "—",
          income: app.totalMonthlyIncome,
          score: au?.scoreTotal,
          confidence: au?.confidenceScore,
          disqualified: au?.disqualified ?? false,
          disqualifiedReasons: au?.disqualifiedReasons,
          status: au?.status || app.status,
          submittedAt: app.submittedAt,
        };
      });
    }
    // Full view
    return (applications || []).map((app) => {
      const au = app.applicationUnits?.find((au) => au.unitId === unitId);
      return {
        id: app.id,
        applicationUnitId: au?.id,
        name: app.applicants?.[0] ? `${app.applicants[0].firstName} ${app.applicants[0].lastName}` : "—",
        income: app.applicants?.reduce((sum, a) => sum + (a.netMonthlyIncome || 0), 0),
        score: au?.scoreTotal,
        confidence: au?.confidenceScore,
        disqualified: au?.disqualified,
        disqualifiedReasons: au?.disqualifiedReasons,
        status: au?.status || app.status,
        submittedAt: app.submittedAt,
      };
    });
  }, [applications, view, unitId]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      // Non-disqualified first
      if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1;
      // Then by score descending
      return (b.score || 0) - (a.score || 0);
    });
  }, [rows]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Rental Applications"
          subtitle={unitLabel}
          actions={
            <div className="flex items-center gap-2">
              <select
                value={view}
                onChange={(e) => { setView(e.target.value); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="summary">Summary</option>
                <option value="full">Full Detail</option>
              </select>
              <button
                onClick={loadData}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          }
        />

        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <Panel title={`${sorted.length} Application${sorted.length !== 1 ? "s" : ""}`}>
            {loading && <p className="text-sm text-slate-500">Loading…</p>}

            {!loading && sorted.length === 0 && (
              <p className="text-sm text-slate-500">No applications for this unit yet.</p>
            )}

            {!loading && sorted.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Applicant</th>
                      <th className="px-4 py-3">Income (CHF)</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {sorted.map((row, idx) => {
                      const conf = confidenceBadge(row.confidence || 0);
                      return (
                        <tr key={row.id} className={row.disqualified ? "bg-red-50/50" : ""}>
                          <td className="px-4 py-3 text-slate-600 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-900">{row.name}</span>
                            {row.disqualified && (
                              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                                Disqualified
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {row.income != null ? formatNumber(row.income) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(row.score || 0)}`}>
                              {row.score ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${conf.cls}`}>
                              {row.confidence ?? 0}% {conf.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {(row.status || "").replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={() => router.push(`/manager/rental-applications/${row.id}`)}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              View
                            </button>
                            {row.applicationUnitId && (
                              <button
                                onClick={() => setAdjustTarget(row.applicationUnitId)}
                                className="text-xs text-amber-600 hover:underline"
                              >
                                Adjust
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Disqualification reasons panel */}
          {sorted.some((r) => r.disqualified && r.disqualifiedReasons?.length) && (
            <Panel title="Disqualification Details">
              {sorted.filter((r) => r.disqualified).map((row) => (
                <div key={row.id} className="py-2">
                  <span className="text-sm font-medium text-slate-900">{row.name}:</span>
                  <ul className="ml-4 mt-1 list-disc text-xs text-red-700">
                    {(row.disqualifiedReasons || []).map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </Panel>
          )}
        </PageContent>

        {/* Adjust Score Modal */}
        {adjustTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Adjust Score</h3>
              <p className="text-sm text-slate-600 mt-1">Add or subtract points with a reason.</p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Score adjustment</label>
                  <input
                    type="number"
                    value={scoreDelta}
                    onChange={(e) => setScoreDelta(e.target.value)}
                    min={-100} max={100}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Reason *</label>
                  <textarea
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Reason for adjustment (min 3 chars)"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => { setAdjustTarget(null); setScoreDelta(0); setAdjustReason(""); }}
                  className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustScore}
                  disabled={adjustLoading || !adjustReason.trim() || adjustReason.trim().length < 3}
                  className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                >
                  {adjustLoading ? "Saving…" : "Apply"}
                </button>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </AppShell>
  );
}
