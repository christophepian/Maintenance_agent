/**
 * Imported Statement Review Page
 *
 * /manager/finance/imports/[id]
 *
 * Manager reviews OCR-extracted data:
 *   - Statement metadata (building, fiscal year, period, status)
 *   - Account balances list with match confidence + manual resolution
 *   - Approve / Reject actions
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import Section from "../../../../components/layout/Section";
import Badge from "../../../../components/ui/Badge";
import { authHeaders } from "../../../../lib/api";
import { formatDate, formatChfCents } from "../../../../lib/format";
import { cn } from "../../../../lib/utils";
import { withServerTranslations } from "../../../../lib/i18n";
import CreateBuildingModal from "../../../../components/CreateBuildingModal";

// ── Status / confidence helpers ───────────────────────────────────────────────

function statusVariant(status) {
  switch (status) {
    case "APPROVED":       return "success";
    case "REJECTED":       return "destructive";
    case "PENDING_REVIEW": return "warning";
    case "PROCESSING":     return "info";
    default:               return "default";
  }
}

function confidenceVariant(conf) {
  switch (conf) {
    case "AUTO":      return "success";
    case "FUZZY":     return "info";
    case "CLAUDE":    return "brand";
    case "MANUAL":    return "warning";
    case "UNMATCHED": return "destructive";
    default:          return "default";
  }
}

// ── Account resolve inline form ───────────────────────────────────────────────

function ResolveAccountRow({ balance, orgId, onResolved }) {
  const { t } = useTranslation("manager");
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState(balance.accountId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/coa", { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setAccounts(j.data ?? []))
      .catch(() => {});
  }, [open]);

  async function handleSave() {
    if (!accountId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/imported-statements/${balance.statementId ?? ""}/balances/${balance.id}`,
        {
          method: "PATCH",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed");
      setOpen(false);
      onResolved();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        className="text-xs text-brand-dark hover:underline"
        onClick={() => setOpen(true)}
      >
        {t("manager:financeImports.action.resolveAccount")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <select
        className="form-input text-xs"
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
      >
        <option value="">— select —</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code ? `${a.code} ` : ""}{a.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive-text">{error}</p>}
      <div className="flex gap-1">
        <button className="button-primary text-xs py-0.5 px-2" onClick={handleSave} disabled={saving || !accountId}>
          Save
        </button>
        <button className="button-secondary text-xs py-0.5 px-2" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Building assign inline form ───────────────────────────────────────────────

function AssignBuildingInline({ statementId, onAssigned }) {
  const { t } = useTranslation("manager");
  const [buildings, setBuildings] = useState([]);
  const [buildingId, setBuildingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  function loadBuildings() {
    fetch("/api/buildings", { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setBuildings(j.data ?? []))
      .catch(() => {});
  }

  useEffect(() => { loadBuildings(); }, []);

  async function handleSave() {
    if (!buildingId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/imported-statements/${statementId}/building`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed");
      onAssigned(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function handleCreated(newBuilding) {
    setCreateOpen(false);
    // Refresh list and auto-select the newly created building
    loadBuildings();
    setBuildingId(newBuilding.id);
  }

  return (
    <>
      {createOpen && (
        <CreateBuildingModal
          onCreated={handleCreated}
          onClose={() => setCreateOpen(false)}
        />
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
          {t("manager:financeImports.text.noBuildingAssigned")}
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="form-label">{t("manager:financeImports.prop.building")}</label>
            <select
              className="form-input w-full"
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
            >
              <option value="">— select existing —</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <button
            className="button-primary text-sm"
            onClick={handleSave}
            disabled={saving || !buildingId}
          >
            {t("manager:financeImports.action.assignBuilding")}
          </button>
        </div>
        <button
          type="button"
          className="text-xs text-brand-dark hover:underline self-start"
          onClick={() => setCreateOpen(true)}
        >
          + Create new building
        </button>
        {error && <p className="text-sm text-destructive-text">{error}</p>}
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImportedStatementReviewPage() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const { id } = router.query;

  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const fetchStatement = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/imported-statements/${id}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || t("manager:financeImports.text.notFound"));
      setStatement(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { fetchStatement(); }, [fetchStatement]);

  async function handleApprove() {
    if (!window.confirm(t("manager:financeImports.text.approveConfirm"))) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/imported-statements/${id}/approve`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to approve");
      setStatement(json.data);
    } catch (e) {
      setActionError(String(e?.message || e));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    const notes = window.prompt(t("manager:financeImports.text.rejectConfirm"));
    if (notes === null) return; // cancelled
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/imported-statements/${id}/reject`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to reject");
      setStatement(json.data);
    } catch (e) {
      setActionError(String(e?.message || e));
    } finally {
      setActionLoading(false);
    }
  }

  const s = statement;
  const isPendingReview = s?.status === "PENDING_REVIEW";
  const hasUnmatched = s?.accountBalances?.some((ab) => ab.matchConfidence === "UNMATCHED");
  const needsBuilding = isPendingReview && !s?.buildingId;

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={t("manager:financeImports.title.reviewStatement")}
          backButton={
            <Link href="/manager/finance?tab=imports" className="text-sm text-brand-dark hover:underline flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Imports
            </Link>
          }
          actions={
            isPendingReview ? (
              <div className="flex gap-2">
                <button
                  className="button-destructive text-sm"
                  onClick={handleReject}
                  disabled={actionLoading}
                >
                  {t("manager:financeImports.action.reject")}
                </button>
                <button
                  className="button-primary text-sm"
                  onClick={handleApprove}
                  disabled={actionLoading || needsBuilding}
                  title={needsBuilding ? t("manager:financeImports.text.noBuildingAssigned") : undefined}
                >
                  {t("manager:financeImports.action.approve")}
                </button>
              </div>
            ) : null
          }
        />
        <PageContent>
          {loading && <p className="loading-text">{t("manager:financeImports.text.loading")}</p>}
          {error && <div className="notice notice-err">{error}</div>}
          {actionError && <div className="notice notice-err">{actionError}</div>}

          {s && (
            <div className="space-y-6">
              {/* ── Metadata ── */}
              <Panel>
                {needsBuilding && (
                  <div className="mb-4">
                    <AssignBuildingInline
                      statementId={s.id}
                      onAssigned={(updated) => setStatement(updated)}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">
                      {t("manager:financeImports.prop.building")}
                    </p>
                    <p className="font-medium">{s.buildingName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">
                      {t("manager:financeImports.prop.fiscalYear")}
                    </p>
                    <p className="font-medium">{s.fiscalYear}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">
                      {t("manager:financeImports.prop.period")}
                    </p>
                    <p className="font-medium">
                      {s.periodStart ? formatDate(s.periodStart) : "—"}
                      {s.periodEnd ? ` → ${formatDate(s.periodEnd)}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">
                      {t("manager:financeImports.prop.status")}
                    </p>
                    <Badge variant={statusVariant(s.status)}>
                      {t(`manager:financeImports.status.${s.status}`)}
                    </Badge>
                  </div>
                  {s.approvedBy && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">
                        {t("manager:financeImports.prop.approvedBy")}
                      </p>
                      <p className="font-medium">{s.approvedBy}</p>
                    </div>
                  )}
                  {s.notes && (
                    <div className="col-span-2 md:col-span-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Notes</p>
                      <p className="text-slate-700">{s.notes}</p>
                    </div>
                  )}
                </div>
              </Panel>

              {/* ── Unmatched warning ── */}
              {isPendingReview && hasUnmatched && (
                <div className="notice bg-amber-50 border-amber-300 text-amber-800">
                  {t("manager:financeImports.text.unmatchedWarning")}
                </div>
              )}

              {/* ── Account Balances ── */}
              {s.accountBalances?.length > 0 && (
                <Section title={t("manager:financeImports.title.accountBalances")}>
                  {/* Mobile */}
                  <div className="md:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                    {s.accountBalances.map((ab) => (
                      <div key={ab.id} className="table-card">
                        <div className="flex items-center justify-between">
                          <span className="table-card-head">
                            {ab.rawAccountCode} — {ab.rawAccountName}
                          </span>
                          <Badge variant={confidenceVariant(ab.matchConfidence)}>
                            {t(`manager:financeImports.confidence.${ab.matchConfidence}`)}
                          </Badge>
                        </div>
                        <div className="table-card-footer">
                          <span className={cn("font-mono font-medium", ab.balanceType === "CREDIT" ? "text-success-text" : "")}>
                            {ab.balanceType === "CREDIT" ? "+" : ""}{formatChfCents(ab.balanceCents)}
                          </span>
                          {ab.accountName && <span className="text-slate-500">{ab.accountCode} {ab.accountName}</span>}
                        </div>
                        {ab.matchConfidence === "UNMATCHED" && (
                          <div className="mt-1">
                            <ResolveAccountRow
                              balance={{ ...ab, statementId: s.id }}
                              onResolved={fetchStatement}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop */}
                  <div className="hidden md:block overflow-hidden rounded-lg border border-table-border">
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>{t("manager:financeImports.prop.accountCode")}</th>
                            <th>{t("manager:financeImports.prop.accountName")}</th>
                            <th className="text-right">{t("manager:financeImports.prop.balance")}</th>
                            <th>{t("manager:financeImports.prop.matchConfidence")}</th>
                            <th>{t("manager:financeImports.prop.matchedAccount")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.accountBalances.map((ab) => (
                            <tr key={ab.id}>
                              <td className="font-mono text-sm">{ab.rawAccountCode}</td>
                              <td>{ab.rawAccountName}</td>
                              <td className={cn("text-right font-mono", ab.balanceType === "CREDIT" ? "text-success-text" : "")}>
                                {ab.balanceType === "CREDIT" ? "+" : ""}{formatChfCents(ab.balanceCents)}
                              </td>
                              <td>
                                <Badge variant={confidenceVariant(ab.matchConfidence)}>
                                  {t(`manager:financeImports.confidence.${ab.matchConfidence}`)}
                                </Badge>
                              </td>
                              <td>
                                {ab.matchConfidence === "UNMATCHED" ? (
                                  <ResolveAccountRow
                                    balance={{ ...ab, statementId: s.id }}
                                    onResolved={fetchStatement}
                                  />
                                ) : (
                                  <span className="text-sm text-slate-700">
                                    {ab.accountCode ? `${ab.accountCode} ` : ""}{ab.accountName ?? "—"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Section>
              )}
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common", "manager"]);
