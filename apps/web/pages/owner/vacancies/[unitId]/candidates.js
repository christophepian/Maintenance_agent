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
import ErrorBanner from "../../../../components/ui/ErrorBanner";
import Badge from "../../../../components/ui/Badge";
import Button from "../../../../components/ui/Button";
import { Modal, ModalFooter } from "../../../../components/ui/Modal";
import { ownerAuthHeaders } from "../../../../lib/api";
import { cn } from "../../../../lib/utils";
import SortableHeader from "../../../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../../../lib/tableUtils";
import { withServerTranslations } from "../../../../lib/i18n";
import { useTranslation } from "next-i18next";
function scoreColor(score) {
  if (score >= 700) return "text-green-700 bg-green-50";
  if (score >= 400) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}
function scoreVariant(score) {
  if (score >= 700) return "success";
  if (score >= 400) return "warning";
  return "destructive";
}

function confidenceBadge(confidence) {
  if (confidence >= 80) return { label: "High", variant: "success" };
  if (confidence >= 50) return { label: "Medium", variant: "warning" };
  return { label: "Low", variant: "destructive" };
}

const ROLES = [
  { key: "primary", label: "Primary", color: "bg-indigo-600", variant: "brand" },
  { key: "backup1", label: "Backup 1", color: "bg-amber-600", variant: "warning" },
  { key: "backup2", label: "Backup 2", color: "bg-slate-500", variant: "muted" },
];

export default function OwnerCandidatesPage() {
  const { t } = useTranslation("owner");
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

  const { sortField: candSF, sortDir: candSD, handleSort: handleCandSort } = useLocalSort("score", "desc");
  const sortedRows = useMemo(() => clientSort(rows, candSF, candSD, (r, f) => {
    if (f === "name") return (r.name || "").toLowerCase();
    if (f === "income") return r.income ?? 0;
    if (f === "score") return r.score ?? 0;
    if (f === "confidence") return r.confidence ?? 0;
    return 0;
  }), [rows, candSF, candSD]);

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
      if (!res.ok) throw new Error(data?.error?.message || data?.message || "Selection failed");

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
          title={t("owner:vacancies[unitid]Candidates.title.selectTenants")}
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
          <ErrorBanner error={error} className="text-sm" />
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <p className="font-semibold">{t("owner:vacanciesUnitidCandidates.text.candidatesSelectedSuccessfully")}</p>
              <p className="mt-1">
                The primary candidate has been notified and is awaiting lease signature.
                You can track progress on the vacancies page.
              </p>
              <div className="mt-3 flex items-center gap-4">
                <Link href="/owner/vacancies" className="font-semibold text-green-700 hover:underline">
                  View awaiting signatures →
                </Link>
              </div>
            </div>
          )}

          {/* Selection summary */}
          {!success && (
            <Panel title={t("owner:vacancies[unitid]Candidates.title.yourSelection")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {selectionSummary.map((s) => (
                  <div
                    key={s.key}
                    className={cn("rounded-lg border-2 p-4 text-center", s.candidate
                        ? "border-indigo-200 bg-indigo-50"
                        : "border-dashed border-slate-200 bg-slate-50")}
                  >
                    <Badge variant={s.variant} size="lg">
                      {s.label}
                    </Badge>
                    {s.candidate ? (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-slate-900">{s.candidate.name}</p>
                        <p className="text-xs text-slate-500">
                          Score: {s.candidate.score} · Income: CHF{" "}
                          {s.candidate.income != null ? formatNumber(s.candidate.income) : "—"}
                        </p>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => toggleSelection(s.key, s.candidate.applicationUnitId)}
                          className="mt-2 text-xs text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelection({ primary: null, backup1: null, backup2: null })}
                >
                  Clear All
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!selection.primary}
                  onClick={() => setShowConfirm(true)}
                >
                  Confirm Selection
                </Button>
              </div>
            </Panel>
          )}

          {/* Confirmation modal */}
          {showConfirm && (
            <Modal
              title={t("owner:vacancies[unitid]Candidates.heading.confirmTenantSelection")}
              description="This will notify the selected candidates and reject all others. This action cannot be undone."
              onClose={() => setShowConfirm(false)}
            >
              <ul className="mt-2 mb-6 space-y-2">
                {selectionSummary
                  .filter((s) => s.candidate)
                  .map((s) => (
                    <li key={s.key} className="flex items-center gap-2 text-sm">
                      <Badge variant={s.variant} size="sm">
                        {s.label}
                      </Badge>
                      <span className="font-medium text-slate-900">{s.candidate.name}</span>
                      <span className="text-slate-400">Score: {s.candidate.score}</span>
                    </li>
                  ))}
              </ul>
              <ModalFooter>
                <Button variant="secondary" size="sm" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? "Processing…" : "Confirm & Notify"}
                </Button>
              </ModalFooter>
            </Modal>
          )}

          {/* Candidates table */}
          {!success && (
            <Panel title={`${rows.length} Candidate${rows.length !== 1 ? "s" : ""}`}>
              {loading && <p className="text-sm text-slate-500">{t("owner:vacanciesUnitidCandidates.text.loadingCandidates")}</p>}

              {!loading && rows.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">{t("owner:vacanciesUnitidCandidates.text.noApplicationsSubmittedForThisUnit")}</p>
              )}

              {!loading && rows.length > 0 && (
                <>
                  {/* Mobile card list — sm:hidden */}
                  <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
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
                        <div key={row.applicationUnitId || row.id} className={cn("table-card", row.disqualified ? "bg-red-50/40" : "", currentRole ? "ring-2 ring-blue-200 ring-inset" : "")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs text-slate-400">#{idx + 1}</span>
                              <button
                                onClick={() => setExpandedDocApp(isDocExpanded ? null : row.id)}
                                className={cn("table-card-head underline decoration-dotted underline-offset-2", isDocExpanded ? "text-indigo-700" : "text-slate-900")}
                              >{row.name}</button>
                              {row.disqualified && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">{t("owner:vacanciesUnitidCandidates.text.disqualified")}</span>}
                              {row.overrideReason && !row.disqualified && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">{t("owner:vacanciesUnitidCandidates.text.override")}</span>}
                              {roleInfo && <span className={cn("rounded px-1.5 py-0.5 text-xs font-bold text-white", roleInfo.color)}>{roleInfo.label}</span>}
                            </div>
                            <Badge variant={scoreVariant(row.score || 0)} size="sm">{row.score ?? "—"}</Badge>
                          </div>
                          <div className="table-card-footer">
                            <Badge variant={conf.variant} size="sm">{row.confidence ?? 0}% {conf.label}</Badge>
                            {row.income != null && <span>CHF {formatNumber(row.income)}</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {row.disqualified ? (
                              <button
                                onClick={() => { setOverrideTarget({ applicationUnitId: row.applicationUnitId, name: row.name }); setOverrideReason(""); }}
                                className="rounded px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100"
                              >{t("owner:vacanciesUnitidCandidates.text.override2")}</button>
                            ) : (
                              ROLES.map((r) => {
                                const isThis = selection[r.key] === row.applicationUnitId;
                                return (
                                  <button
                                    key={r.key}
                                    onClick={() => toggleSelection(r.key, row.applicationUnitId)}
                                    title={`Set as ${r.label}`}
                                    className={cn("rounded px-2 py-1 text-xs font-semibold transition-colors", isThis ? `${r.color} text-white` : "border border-slate-200 text-slate-500 hover:bg-slate-100")}
                                  >{r.label}</button>
                                );
                              })
                            )}
                          </div>
                          {isDocExpanded && (
                            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                              {row.disqualified && reasons.length > 0 && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                  <h4 className="text-sm font-semibold text-red-700 mb-2">{t("owner:vacanciesUnitidCandidates.text.disqualificationReasons")}</h4>
                                  <ul className="list-disc ml-5 space-y-1.5">
                                    {formatDisqualificationReasons(reasons).map((text, i) => (
                                      <li key={i} className="text-sm text-red-700 leading-relaxed">{text}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <DocumentsPanel applicationId={row.id} compact title={`Documents — ${row.name}`} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Wide table — hidden sm:block */}
                  <div className="hidden sm:block data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="px-4 py-3">{t("owner:vacancies[unitid]Candidates.col.rank")}</th>
                          <SortableHeader label={t("owner:vacanciesUnitidCandidates.prop.applicant")} field="name" sortField={candSF} sortDir={candSD} onSort={handleCandSort} />
                          <SortableHeader label="Income (CHF)" field="income" sortField={candSF} sortDir={candSD} onSort={handleCandSort} />
                          <SortableHeader label={t("owner:vacanciesUnitidCandidates.prop.score")} field="score" sortField={candSF} sortDir={candSD} onSort={handleCandSort} />
                          <SortableHeader label={t("owner:vacanciesUnitidCandidates.prop.confidence")} field="confidence" sortField={candSF} sortDir={candSD} onSort={handleCandSort} />
                          <th className="px-4 py-3 text-right">{t("owner:vacancies[unitid]Candidates.col.assign")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {sortedRows.map((row, idx) => {
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
                            <tr className={cn(row.disqualified ? "bg-red-50/40" : "", currentRole ? "ring-2 ring-blue-200 ring-inset" : "")}>
                              <td className="px-4 py-3 text-slate-600 font-mono">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center flex-wrap gap-x-2">
                                  <button
                                    onClick={() => setExpandedDocApp(isDocExpanded ? null : row.id)}
                                    className={cn("font-medium underline decoration-dotted underline-offset-2 transition-colors", isDocExpanded ? "text-indigo-700" : "text-slate-900 hover:text-indigo-600")}
                                    title={t("owner:vacancies[unitid]Candidates.title.clickToViewCorroborativeDocuments")}
                                  >{row.name}</button>
                                  {row.disqualified && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">{t("owner:vacanciesUnitidCandidates.text.disqualified")}</span>}
                                  {row.overrideReason && !row.disqualified && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700" title={`Override: ${row.overrideReason}`}>{t("owner:vacanciesUnitidCandidates.text.override")}</span>}
                                  {roleInfo && <span className={cn("rounded px-1.5 py-0.5 text-xs font-bold text-white", roleInfo.color)}>{roleInfo.label}</span>}
                                  {isDocExpanded && <span className="text-xs text-indigo-500">{t("owner:vacanciesUnitidCandidates.text.docs")}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{row.income != null ? formatNumber(row.income) : "—"}</td>
                              <td className="px-4 py-3"><Badge variant={scoreVariant(row.score || 0)} size="sm">{row.score ?? "—"}</Badge></td>
                              <td className="px-4 py-3"><Badge variant={conf.variant} size="sm">{row.confidence ?? 0}% {conf.label}</Badge></td>
                              <td className="px-4 py-3 text-right">
                                {row.disqualified ? (
                                  <button
                                    onClick={() => { setOverrideTarget({ applicationUnitId: row.applicationUnitId, name: row.name }); setOverrideReason(""); }}
                                    className="rounded px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                                    title={t("owner:vacancies[unitid]Candidates.title.overrideDisqualificationAndMakeThisCandidateEligible")}
                                  >{t("owner:vacanciesUnitidCandidates.text.override2")}</button>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    {ROLES.map((r) => {
                                      const isThis = selection[r.key] === row.applicationUnitId;
                                      return (
                                        <button
                                          key={r.key}
                                          onClick={() => toggleSelection(r.key, row.applicationUnitId)}
                                          title={`Set as ${r.label}`}
                                          className={cn("rounded px-2 py-1 text-xs font-semibold transition-colors", isThis ? `${r.color} text-white` : "border border-slate-200 text-slate-500 hover:bg-slate-100")}
                                        >
                                          {r.label.charAt(0)}{r.key !== "primary" ? r.key.slice(-1) : ""}
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
                                    {row.disqualified && reasons.length > 0 && (
                                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                        <h4 className="text-sm font-semibold text-red-700 mb-2">{t("owner:vacanciesUnitidCandidates.text.disqualificationReasons")}</h4>
                                        <ul className="list-disc ml-5 space-y-1.5">
                                          {formatDisqualificationReasons(reasons).map((text, i) => (
                                            <li key={i} className="text-sm text-red-700 leading-relaxed">{text}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
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
                </>
              )}
            </Panel>
          )}

          {/* Override disqualification modal */}
          {overrideTarget && (
            <Modal
              title={t("owner:vacancies[unitid]Candidates.heading.overrideDisqualification")}
              onClose={() => setOverrideTarget(null)}
            >
              <p className="mb-4 text-sm text-muted-text">
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
                  placeholder={t("owner:vacancies[unitid]Candidates.placeholder.eGVerifiedIncomeDirectlyWithEmployerDebtEnforcementExtractIsClear")}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-400">{t("owner:vacanciesUnitidCandidates.text.minimum3CharactersThisWillBeRecordedForAudit")}</p>
              </div>
              <ModalFooter className="mt-5">
                <Button variant="secondary" size="sm" onClick={() => setOverrideTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant="warning"
                  size="sm"
                  disabled={overriding || overrideReason.trim().length < 3}
                  onClick={handleOverride}
                >
                  {overriding ? "Overriding…" : "Confirm Override"}
                </Button>
              </ModalFooter>
            </Modal>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common","owner"]);
