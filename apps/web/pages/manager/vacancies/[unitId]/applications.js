import { useEffect, useMemo, useState } from "react";
import React from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import { formatNumber } from "../../../../lib/format";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import DocumentsPanel from "../../../../components/DocumentsPanel";
import ErrorBanner from "../../../../components/ui/ErrorBanner";
import { formatDisqualificationReasons } from "../../../../lib/formatDisqualificationReasons";
import { authHeaders } from "../../../../lib/api";
import Badge from "../../../../components/ui/Badge";
import { cn } from "../../../../lib/utils";
function scoreColor(score) {
  if (score >= 700) return "text-green-700 bg-green-50";
  if (score >= 400) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

function confidenceBadge(confidence) {
  if (confidence >= 80) return { label: "High", variant: "success" };
  if (confidence >= 50) return { label: "Medium", variant: "warning" };
  return { label: "Low", variant: "destructive" };
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

  // Override disqualification
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  // Document viewer
  const [expandedDocApp, setExpandedDocApp] = useState(null);

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

  async function handleOverride() {
    if (!overrideTarget) return;
    setOverriding(true);
    setError("");
    try {
      const res = await fetch(`/api/manager/rental-application-units/${overrideTarget.applicationUnitId}/override-disqualification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reason: overrideReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.message || "Override failed");
      setOverrideTarget(null);
      setOverrideReason("");
      loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setOverriding(false);
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
          overrideReason: au?.overrideReason || null,
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
        overrideReason: au?.overrideReason || null,
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
        <div className="px-4 pt-4">
          <Link href="/manager/vacancies" className="text-sm text-blue-600 hover:text-blue-700">← Vacancies</Link>
        </div>
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
          <ErrorBanner error={error} className="text-sm" />

          <Panel title={`${sorted.length} Application${sorted.length !== 1 ? "s" : ""}`}>
            {loading && <p className="text-sm text-slate-500">Loading…</p>}

            {!loading && sorted.length === 0 && (
              <p className="text-sm text-slate-500">No applications for this unit yet.</p>
            )}

            {!loading && sorted.length > 0 && (
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Applicant</th>
                      <th>Income (CHF)</th>
                      <th>Score</th>
                      <th>Confidence</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, idx) => {
                      const conf = confidenceBadge(row.confidence || 0);
                      const isDocExpanded = expandedDocApp === row.id;
                      const reasons = Array.isArray(row.disqualifiedReasons)
                        ? row.disqualifiedReasons
                        : typeof row.disqualifiedReasons === "string"
                          ? [row.disqualifiedReasons]
                          : [];
                      return (
                        <React.Fragment key={row.id}>
                        <tr className={row.disqualified ? "bg-red-50/40" : ""}>
                          <td className="font-mono">{idx + 1}</td>
                          <td>
                            <div className="flex items-center flex-wrap gap-x-2">
                              <button
                                onClick={() => setExpandedDocApp(isDocExpanded ? null : row.id)}
                                className={cn("font-medium underline decoration-dotted underline-offset-2 transition-colors", isDocExpanded
                                    ? "text-indigo-700"
                                    : "text-slate-900 hover:text-indigo-600")}
                                title="Click to view corroborative documents"
                              >
                                {row.name}
                              </button>
                              {row.disqualified && (
                                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                                  Disqualified
                                </span>
                              )}
                              {row.overrideReason && !row.disqualified && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700" title={`Override: ${row.overrideReason}`}>
                                  ✓ Override
                                </span>
                              )}
                              {isDocExpanded && (
                                <span className="text-xs text-indigo-500">▼ docs</span>
                              )}
                            </div>
                          </td>
                          <td>
                            {row.income != null ? formatNumber(row.income) : "—"}
                          </td>
                          <td>
                            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", scoreColor(row.score || 0))}>
                              {row.score ?? "—"}
                            </span>
                          </td>
                          <td>
                            <Badge variant={conf.variant} size="sm">
                              {row.confidence ?? 0}% {conf.label}
                            </Badge>
                          </td>
                          <td>
                            {(row.status || "").replace(/_/g, " ")}
                          </td>
                          <td className="text-right space-x-2">
                            <button
                              onClick={() => router.push(`/manager/rental-applications/${row.id}`)}
                              className="cell-link text-xs"
                            >
                              View
                            </button>
                            {row.applicationUnitId && !row.disqualified && (
                              <button
                                onClick={() => setAdjustTarget(row.applicationUnitId)}
                                className="text-xs text-amber-600 hover:underline"
                              >
                                Adjust
                              </button>
                            )}
                            {row.disqualified && row.applicationUnitId && (
                              <button
                                onClick={() => {
                                  setOverrideTarget({ applicationUnitId: row.applicationUnitId, name: row.name });
                                  setOverrideReason("");
                                }}
                                className="rounded px-2 py-0.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                              >
                                ⚠ Override
                              </button>
                            )}
                          </td>
                        </tr>
                        {isDocExpanded && (
                          <tr>
                            <td colSpan={7} className="bg-slate-50/50">
                              <div className="space-y-4">
                                {/* Disqualification reasons (human-friendly) */}
                                {row.disqualified && reasons.length > 0 && (
                                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                    <h4 className="text-sm font-semibold text-red-700 mb-2">Disqualification Reasons</h4>
                                    <ul className="list-disc ml-5 space-y-1.5">
                                      {formatDisqualificationReasons(reasons).map((text, i) => (
                                        <li key={i} className="text-sm text-red-700 leading-relaxed">{text}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {/* Corroborative documents */}
                                <DocumentsPanel applicationId={row.id} compact title={`Documents — ${row.name}`} />
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
            )}
          </Panel>
        </PageContent>

        {/* Override disqualification modal */}
        {overrideTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOverrideTarget(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-900">Override Disqualification</h3>
              <p className="mt-2 text-sm text-slate-600">
                You are about to override the automatic disqualification for <strong>{overrideTarget.name}</strong>.
                This candidate will become eligible for selection.
              </p>
              <div className="mt-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">
                  Reason for override *
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  placeholder="e.g. Verified income directly with employer; debt enforcement extract is clear…"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-400">Minimum 3 characters. This will be recorded for audit.</p>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setOverrideTarget(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  disabled={overriding || overrideReason.trim().length < 3}
                  onClick={handleOverride}
                  className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {overriding ? "Overriding…" : "Confirm Override"}
                </button>
              </div>
            </div>
          </div>
        )}

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
