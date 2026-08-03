import { useEffect, useMemo, useState } from "react";
import React from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import { formatNumber } from "../../../../lib/format";
import PageContent from "../../../../components/layout/PageContent";
import DocumentsPanel from "../../../../components/DocumentsPanel";
import ErrorBanner from "../../../../components/ui/ErrorBanner";
import { formatDisqualificationReasons } from "../../../../lib/formatDisqualificationReasons";
import { authHeaders } from "../../../../lib/api";
import Badge from "../../../../components/ui/Badge";
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

function confidenceBadge(confidence) {
  if (confidence >= 80) return { label: "High", variant: "success" };
  if (confidence >= 50) return { label: "Medium", variant: "warning" };
  return { label: "Low", variant: "destructive" };
}

export default function UnitApplicationsPage() {
  const { t } = useTranslation("manager");
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

  const { sortField: appSF, sortDir: appSD, handleSort: handleAppSort } = useLocalSort("score", "desc");
  const sorted = useMemo(() => {
    return clientSort(rows, appSF, appSD, (r, f) => {
      if (f === "rank") return r.score ?? 0; // rank by score
      if (f === "name") return (r.name || "").toLowerCase();
      if (f === "income") return r.income ?? 0;
      if (f === "score") return r.score ?? 0;
      if (f === "confidence") return r.confidence ?? 0;
      if (f === "status") return r.status || "";
      return 0;
    });
  }, [rows, appSF, appSD]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <div className="px-4 pt-4">
          <Link href="/manager/vacancies" className="text-sm text-blue-600 hover:text-blue-700">{t("manager:vacanciesUnitidApplications.text.vacancies")}</Link>
        </div>
        <PageHeader
          title={t("manager:vacancies[unitid]Applications.title.rentalApplications")}
          subtitle={unitLabel}
          actions={
            <div className="flex items-center gap-2">
              <select
                value={view}
                onChange={(e) => { setView(e.target.value); }}
                className="rounded-lg border border-surface-border px-3 py-2 text-sm"
              >
                <option value="summary">{t("manager:vacanciesUnitidApplications.text.summary")}</option>
                <option value="full">{t("manager:vacanciesUnitidApplications.text.fullDetail")}</option>
              </select>
              <button
                onClick={loadData}
                className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-muted-dark hover:bg-surface-subtle"
              >
                Refresh
              </button>
            </div>
          }
        />

        <PageContent>
          <ErrorBanner error={error} className="text-sm" />

          <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-dark">{`${sorted.length} Application${sorted.length !== 1 ? "s" : ""}`}</h2>
            {loading && <p className="text-sm text-muted">{t("manager:vacanciesUnitidApplications.text.loading")}</p>}

            {!loading && sorted.length === 0 && (
              <p className="text-sm text-muted">{t("manager:vacanciesUnitidApplications.text.noApplicationsForThisUnitYet")}</p>
            )}

            {!loading && sorted.length > 0 && (
              <>
                {/* Mobile card list — sm:hidden */}
                <div className="sm:hidden overflow-hidden rounded-lg border border-surface-border divide-y divide-surface-divider">
                  {sorted.map((row, idx) => {
                    const conf = confidenceBadge(row.confidence || 0);
                    const isDocExpanded = expandedDocApp === row.id;
                    const reasons = Array.isArray(row.disqualifiedReasons)
                      ? row.disqualifiedReasons
                      : typeof row.disqualifiedReasons === "string"
                        ? [row.disqualifiedReasons]
                        : [];
                    return (
                      <div key={row.id} className={cn("table-card", row.disqualified ? "bg-red-50/40" : "")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-foreground-dim">#{idx + 1}</span>
                            <button
                              onClick={() => setExpandedDocApp(isDocExpanded ? null : row.id)}
                              className={cn("table-card-head underline decoration-dotted underline-offset-2", isDocExpanded ? "text-indigo-700" : "text-foreground")}
                            >
                              {row.name}
                            </button>
                          </div>
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold shrink-0", scoreColor(row.score || 0))}>
                            {row.score ?? "—"}
                          </span>
                        </div>
                        <div className="table-card-footer">
                          {row.disqualified ? (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">{t("manager:vacanciesUnitidApplications.text.disqualified")}</span>
                          ) : row.overrideReason ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">{t("manager:vacanciesUnitidApplications.text.override")}</span>
                          ) : null}
                          <Badge variant={conf.variant} size="sm">{row.confidence ?? 0}% {conf.label}</Badge>
                          {row.income != null && <span>CHF {formatNumber(row.income)}</span>}
                        </div>
                        <div className="mt-2 flex gap-2 flex-wrap">
                          <button onClick={() => router.push(`/manager/rental-applications/${row.id}`)} className="text-xs font-medium text-blue-600 hover:text-blue-700">{t("manager:vacanciesUnitidApplications.text.view")}</button>
                          {row.applicationUnitId && !row.disqualified && (
                            <button onClick={() => setAdjustTarget(row.applicationUnitId)} className="text-xs text-amber-600 hover:underline">{t("manager:vacanciesUnitidApplications.text.adjust")}</button>
                          )}
                          {row.disqualified && row.applicationUnitId && (
                            <button
                              onClick={() => { setOverrideTarget({ applicationUnitId: row.applicationUnitId, name: row.name }); setOverrideReason(""); }}
                              className="rounded px-2 py-0.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                            >{t("manager:vacanciesUnitidApplications.text.override2")}</button>
                          )}
                        </div>
                        {isDocExpanded && (
                          <div className="mt-3 space-y-3 border-t border-surface-divider pt-3">
                            {row.disqualified && reasons.length > 0 && (
                              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                <h4 className="text-sm font-semibold text-red-700 mb-2">{t("manager:vacanciesUnitidApplications.text.disqualificationReasons")}</h4>
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
                <div className="hidden sm:block overflow-x-auto rounded-lg border border-surface-border">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("manager:vacancies[unitid]Applications.col.rank")}</th>
                        <SortableHeader label={t("manager:vacanciesUnitidApplications.prop.applicant")} field="name" sortField={appSF} sortDir={appSD} onSort={handleAppSort} />
                        <SortableHeader label="Income (CHF)" field="income" sortField={appSF} sortDir={appSD} onSort={handleAppSort} />
                        <SortableHeader label={t("manager:vacanciesUnitidApplications.prop.score")} field="score" sortField={appSF} sortDir={appSD} onSort={handleAppSort} />
                        <SortableHeader label={t("manager:vacanciesUnitidApplications.prop.confidence")} field="confidence" sortField={appSF} sortDir={appSD} onSort={handleAppSort} />
                        <SortableHeader label={t("manager:vacanciesUnitidApplications.prop.status")} field="status" sortField={appSF} sortDir={appSD} onSort={handleAppSort} />
                        <th className="text-right">{t("manager:vacancies[unitid]Applications.col.actions")}</th>
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
                                      : "text-foreground hover:text-indigo-600")}
                                  title={t("manager:vacancies[unitid]Applications.title.clickToViewCorroborativeDocuments")}
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
                                  <span className="text-xs text-indigo-500">{t("manager:vacanciesUnitidApplications.text.docs")}</span>
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
                              <td colSpan={7} className="bg-surface-subtle/50">
                                <div className="space-y-4">
                                  {row.disqualified && reasons.length > 0 && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                      <h4 className="text-sm font-semibold text-red-700 mb-2">{t("manager:vacanciesUnitidApplications.text.disqualificationReasons")}</h4>
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
          </div>
        </PageContent>

        {/* Override disqualification modal */}
        {overrideTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOverrideTarget(null)}>
            <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground">{t("manager:vacancies[unitid]Applications.heading.overrideDisqualification")}</h3>
              <p className="mt-2 text-sm text-muted-text">
                You are about to override the automatic disqualification for <strong>{overrideTarget.name}</strong>.
                This candidate will become eligible for selection.
              </p>
              <div className="mt-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-foreground-dim mb-1.5">
                  Reason for override *
                </label>
                <textarea
                  className="w-full rounded-lg border border-muted-ring px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  placeholder={t("manager:vacancies[unitid]Applications.placeholder.eGVerifiedIncomeDirectlyWithEmployerDebtEnforcementExtractIsClear")}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
                <p className="mt-1 text-xs text-foreground-dim">{t("manager:vacanciesUnitidApplications.text.minimum3CharactersThisWillBeRecordedForAudit")}</p>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setOverrideTarget(null)}
                  className="rounded-lg border border-surface-border px-4 py-2 text-sm text-muted-text hover:bg-surface-subtle"
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
            <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-foreground">{t("manager:vacancies[unitid]Applications.heading.adjustScore")}</h3>
              <p className="text-sm text-muted-text mt-1">{t("manager:vacanciesUnitidApplications.text.addOrSubtractPointsWithAReason")}</p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-dark mb-1">{t("manager:vacanciesUnitidApplications.text.scoreAdjustment")}</label>
                  <input
                    type="number"
                    value={scoreDelta}
                    onChange={(e) => setScoreDelta(e.target.value)}
                    min={-100} max={100}
                    className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-dark mb-1">{t("manager:vacanciesUnitidApplications.text.reason")}</label>
                  <textarea
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                    placeholder={t("manager:vacancies[unitid]Applications.placeholder.reasonForAdjustmentMin3Chars")}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => { setAdjustTarget(null); setScoreDelta(0); setAdjustReason(""); }}
                  className="flex-1 rounded-lg border border-surface-border bg-surface py-2 text-sm font-medium text-muted-dark"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustScore}
                  disabled={adjustLoading || !adjustReason.trim() || adjustReason.trim().length < 3}
                  className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-muted-ring"
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

export const getServerSideProps = withServerTranslations(["common","manager"]);
