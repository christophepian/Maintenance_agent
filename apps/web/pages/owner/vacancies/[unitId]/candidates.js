import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import { formatNumber } from "../../../../lib/format";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import DocumentsPanel from "../../../../components/DocumentsPanel";
import { formatDisqualificationReasons } from "../../../../lib/formatDisqualificationReasons";
import { ownerAuthHeaders } from "../../../../lib/api";
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

const ROLES = [
  { key: "primary", label: "Primary", color: "bg-indigo-600" },
  { key: "backup1", label: "Backup 1", color: "bg-amber-600" },
  { key: "backup2", label: "Backup 2", color: "bg-slate-500" },
];

export default function OwnerCandidatesPage() {
  const router = useRouter();
  const { unitId } = router.query;

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Track unit label client-side to avoid SSR hydration mismatch
  // (router.query is empty on server without getServerSideProps)
  const [unitLabel, setUnitLabel] = useState("");
  useEffect(() => {
    if (unitId) setUnitLabel(unitId.slice(0, 8));
  }, [unitId]);

  // Selection state: maps role key → applicationUnitId
  const [selection, setSelection] = useState({
    primary: null,
    backup1: null,
    backup2: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedDocApp, setExpandedDocApp] = useState(null);
  const [overrideTarget, setOverrideTarget] = useState(null); // { applicationUnitId, name }
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  useEffect(() => {
    if (!router.isReady || !unitId) return;
    loadCandidates();
  }, [router.isReady, unitId]);

  async function loadCandidates() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/owner/rental-applications?unitId=${unitId}`, {
        headers: ownerAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load candidates");
      setApplications(data.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Build ranked rows from summary DTOs
  const rows = useMemo(() => {
    return (applications || [])
      .map((app) => {
        const au = (app.unitApplications || []).find((u) => u.unitId === unitId);
        return {
          id: app.id,
          applicationUnitId: au?.id,
          name: app.primaryApplicantName || "Unknown",
          income: app.totalMonthlyIncome,
          score: au?.scoreTotal,
          confidence: au?.confidenceScore,
          disqualified: !!au?.disqualified,
          disqualifiedReasons: au?.disqualifiedReasons || [],
          overrideReason: au?.overrideReason || null,
          status: au?.status || app.status,
        };
      })
      .sort((a, b) => {
        if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1;
        return (b.score || 0) - (a.score || 0);
      });
  }, [applications]);

  // Eligible candidates (not disqualified)
  const eligible = useMemo(() => rows.filter((r) => !r.disqualified), [rows]);

  function isSelected(auId) {
    return Object.values(selection).includes(auId);
  }

  function roleOf(auId) {
    for (const [key, val] of Object.entries(selection)) {
      if (val === auId) return key;
    }
    return null;
  }

  function toggleSelection(roleKey, auId) {
    setSelection((prev) => {
      // If already assigned this role → deselect
      if (prev[roleKey] === auId) return { ...prev, [roleKey]: null };
      // Remove from any other role first
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k] === auId) next[k] = null;
      }
      next[roleKey] = auId;
      return next;
    });
  }

  async function handleSubmit() {
    if (!selection.primary) {
      setError("You must select at least a primary candidate.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const body = {
        primaryApplicationUnitId: selection.primary,
      };
      if (selection.backup1) body.backup1ApplicationUnitId = selection.backup1;
      if (selection.backup2) body.backup2ApplicationUnitId = selection.backup2;

      const res = await fetch(`/api/owner/units/${unitId}/select-tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Selection failed");

      setSuccess("Candidates selected successfully. The primary candidate has been notified to sign the lease.");
      setShowConfirm(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOverride() {
    if (!overrideTarget || !overrideReason.trim()) return;
    setOverriding(true);
    setError("");
    try {
      const res = await fetch(
        `/api/owner/rental-application-units/${overrideTarget.applicationUnitId}/override-disqualification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
          body: JSON.stringify({ reason: overrideReason.trim() }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.message || "Override failed");

      // Reload candidates to get fresh data
      await loadCandidates();
      setOverrideTarget(null);
      setOverrideReason("");
    } catch (e) {
      setError(e.message);
    } finally {
      setOverriding(false);
    }
  }

  const selectionSummary = useMemo(() => {
    return ROLES.map((r) => {
      const auId = selection[r.key];
      const row = rows.find((x) => x.applicationUnitId === auId);
      return { ...r, candidate: row || null };
    });
  }, [selection, rows]);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Select Tenants"
          subtitle={unitLabel ? `Choose primary and backup candidates for unit ${unitLabel}…` : "Select tenant candidates"}
          actions={
            <Link
              href="/owner/vacancies"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Back to Vacancies
            </Link>
          }
        />

        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <p className="font-semibold">Candidates selected successfully!</p>
              <p className="mt-1">
                The primary candidate has been notified and is awaiting lease signature.
                You can track progress on the vacancies page.
              </p>
              <div className="mt-3 flex items-center gap-4">
                <Link href="/owner/vacancies" className="font-semibold text-green-800 hover:underline">
                  View awaiting signatures →
                </Link>
              </div>
            </div>
          )}

          {/* Selection summary */}
          {!success && (
            <Panel title="Your Selection">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {selectionSummary.map((s) => (
                  <div
                    key={s.key}
                    className={`rounded-lg border-2 p-4 text-center ${
                      s.candidate
                        ? "border-indigo-200 bg-indigo-50"
                        : "border-dashed border-slate-200 bg-slate-50"
                    }`}
                  >
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-bold text-white ${s.color}`}
                    >
                      {s.label}
                    </span>
                    {s.candidate ? (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-slate-900">{s.candidate.name}</p>
                        <p className="text-xs text-slate-500">
                          Score: {s.candidate.score} · Income: CHF{" "}
                          {s.candidate.income != null ? formatNumber(s.candidate.income) : "—"}
                        </p>
                        <button
                          onClick={() => toggleSelection(s.key, s.candidate.applicationUnitId)}
                          className="mt-2 text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-slate-400">
                        {s.key === "primary" ? "Required" : "Optional"} — click a candidate below
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setSelection({ primary: null, backup1: null, backup2: null })}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Clear All
                </button>
                <button
                  disabled={!selection.primary}
                  onClick={() => setShowConfirm(true)}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm Selection
                </button>
              </div>
            </Panel>
          )}

          {/* Confirmation modal */}
          {showConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-bold text-slate-900">Confirm Tenant Selection</h3>
                <p className="mt-2 text-sm text-slate-600">
                  This will notify the selected candidates and reject all others. This action cannot be undone.
                </p>
                <ul className="mt-4 space-y-2">
                  {selectionSummary
                    .filter((s) => s.candidate)
                    .map((s) => (
                      <li key={s.key} className="flex items-center gap-2 text-sm">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold text-white ${s.color}`}>
                          {s.label}
                        </span>
                        <span className="font-medium text-slate-900">{s.candidate.name}</span>
                        <span className="text-slate-400">Score: {s.candidate.score}</span>
                      </li>
                    ))}
                </ul>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    onClick={handleSubmit}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                  >
                    {submitting ? "Processing…" : "Confirm & Notify"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Candidates table */}
          {!success && (
            <Panel title={`${rows.length} Candidate${rows.length !== 1 ? "s" : ""}`}>
              {loading && <p className="text-sm text-slate-500">Loading candidates…</p>}

              {!loading && rows.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">No applications submitted for this unit.</p>
              )}

              {!loading && rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Applicant</th>
                        <th className="px-4 py-3">Income (CHF)</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">Confidence</th>
                        <th className="px-4 py-3 text-right">Assign</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {rows.map((row, idx) => {
                        const conf = confidenceBadge(row.confidence || 0);
                        const currentRole = roleOf(row.applicationUnitId);
                        const roleInfo = currentRole ? ROLES.find((r) => r.key === currentRole) : null;
                        const isDocExpanded = expandedDocApp === row.id;
                        const reasons = Array.isArray(row.disqualifiedReasons)
                          ? row.disqualifiedReasons
                          : typeof row.disqualifiedReasons === "string"
                            ? [row.disqualifiedReasons]
                            : [];

                        return (
                          <React.Fragment key={row.applicationUnitId || row.id}>
                          <tr
                            className={`${
                              row.disqualified ? "bg-red-50/40" : ""
                            } ${currentRole ? "ring-2 ring-indigo-200 ring-inset" : ""}`}
                          >
                            <td className="px-4 py-3 text-slate-600 font-mono">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center flex-wrap gap-x-2">
                                <button
                                  onClick={() => setExpandedDocApp(isDocExpanded ? null : row.id)}
                                  className={`font-medium underline decoration-dotted underline-offset-2 transition-colors ${
                                    isDocExpanded
                                      ? "text-indigo-700"
                                      : "text-slate-900 hover:text-indigo-600"
                                  }`}
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
                                {roleInfo && (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-xs font-bold text-white ${roleInfo.color}`}
                                  >
                                    {roleInfo.label}
                                  </span>
                                )}
                                {isDocExpanded && (
                                  <span className="text-xs text-indigo-500">▼ docs</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {row.income != null ? formatNumber(row.income) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(row.score || 0)}`}
                              >
                                {row.score ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${conf.cls}`}>
                                {row.confidence ?? 0}% {conf.label}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right">
                              {row.disqualified ? (
                                <button
                                  onClick={() => {
                                    setOverrideTarget({ applicationUnitId: row.applicationUnitId, name: row.name });
                                    setOverrideReason("");
                                  }}
                                  className="rounded px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                                  title="Override disqualification and make this candidate eligible"
                                >
                                  ⚠ Override
                                </button>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  {ROLES.map((r) => {
                                    const isThis = selection[r.key] === row.applicationUnitId;
                                    return (
                                      <button
                                        key={r.key}
                                        onClick={() => toggleSelection(r.key, row.applicationUnitId)}
                                        title={`Set as ${r.label}`}
                                        className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                                          isThis
                                            ? `${r.color} text-white`
                                            : "border border-slate-200 text-slate-500 hover:bg-slate-100"
                                        }`}
                                      >
                                        {r.label.charAt(0)}
                                        {r.key !== "primary" ? r.key.slice(-1) : ""}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                          {isDocExpanded && (
                            <tr>
                              <td colSpan={6} className="px-4 py-3 bg-slate-50/50">
                                <div className="space-y-4">
                                  {/* Disqualification reasons (human-friendly) */}
                                  {row.disqualified && reasons.length > 0 && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                      <h4 className="text-sm font-semibold text-red-800 mb-2">Disqualification Reasons</h4>
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
                </div>
              )}
            </Panel>
          )}

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
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                    Reason for override *
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
