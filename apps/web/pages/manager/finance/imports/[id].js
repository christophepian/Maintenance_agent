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

// ── Extracted data collapsible ────────────────────────────────────────────────

function ExtractedDataPanel({ rawOcrText }) {
  const [open, setOpen] = useState(false);

  // Split the stored string at the "---" separator inserted during ingestion
  const parts = rawOcrText.split(/\n---\n/);
  const summary = parts[0]?.trim() || "";
  let fields = null;
  if (parts[1]) {
    try { fields = JSON.parse(parts[1]); } catch { /* show raw */ }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors rounded-lg"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Extracted data</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {summary && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Summary</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{summary}</p>
            </div>
          )}
          {fields && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Fields</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(fields).map(([key, val]) =>
                      val != null && val !== "" ? (
                        <tr key={key} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-1.5 text-xs text-slate-500 font-medium whitespace-nowrap w-40">{key}</td>
                          <td className="px-3 py-1.5 text-slate-800 font-mono text-xs break-all">
                            {typeof val === "object" ? JSON.stringify(val) : String(val)}
                          </td>
                        </tr>
                      ) : null,
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!fields && parts[1] && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Raw</p>
              <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap bg-white rounded-lg border border-slate-200 p-3">{parts[1]}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

// ── Re-extract form ───────────────────────────────────────────────────────────

const RE_EXTRACT_DOC_TYPES = [
  { value: "FINANCIAL_STATEMENT", label: "Financial Statement (balance sheet)" },
  { value: "INVOICE",             label: "Invoice(s)" },
  { value: "MANAGEMENT_REPORT",   label: "Management Report" },
];

function ReExtractForm({ statementId, onStarted }) {
  const [hintDocType, setHintDocType] = useState("FINANCIAL_STATEMENT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/imported-statements/${statementId}/re-extract`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ hintDocType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to re-extract");
      onStarted(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-slate-700">
        No account balances were extracted. This usually means the wrong document type was detected.
        Choose the correct type and re-run extraction on the stored file.
      </p>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="form-label">Document type</label>
          <select
            className="form-input w-full"
            value={hintDocType}
            onChange={(e) => setHintDocType(e.target.value)}
          >
            {RE_EXTRACT_DOC_TYPES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="button-primary text-sm" disabled={loading}>
          {loading ? "Re-extracting…" : "Re-extract"}
        </button>
      </div>
      {error && <p className="text-sm text-destructive-text">{error}</p>}
    </form>
  );
}

// ── Approve confirmation modal ────────────────────────────────────────────────

function ApproveModal({ preview, onConfirm, onClose, loading }) {
  const fmtChf = (cents) => {
    const sign = cents < 0 ? "−" : "";
    const abs = Math.abs(cents);
    return `${sign}CHF ${(abs / 100).toLocaleString("de-CH", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">Confirm — post ledger entries</h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close" disabled={loading}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Summary row */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="bg-slate-50 rounded-lg px-4 py-2 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Entries</p>
              <p className="font-semibold text-slate-900">{preview.entries.length}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-2 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total debits</p>
              <p className="font-semibold text-slate-900 font-mono">{fmtChf(preview.totalDebitCents)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-2 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total credits</p>
              <p className="font-semibold text-success-text font-mono">{fmtChf(preview.totalCreditCents)}</p>
            </div>
            {preview.autoCreateCount > 0 && (
              <div className="bg-amber-50 rounded-lg px-4 py-2 text-center">
                <p className="text-xs text-amber-600 uppercase tracking-wide">New accounts</p>
                <p className="font-semibold text-amber-700">{preview.autoCreateCount} will be created</p>
              </div>
            )}
          </div>

          {/* Entry table */}
          <div className="overflow-hidden rounded-lg border border-table-border">
            <div className="overflow-x-auto">
              <table className="data-table text-sm">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.entries.map((e) => (
                    <tr key={e.balanceId}>
                      <td className="font-mono text-xs">{e.rawAccountCode}</td>
                      <td>
                        <span className={e.willAutoCreate ? "text-amber-700" : ""}>
                          {e.accountName ?? e.rawAccountName}
                        </span>
                        {e.willAutoCreate && (
                          <span className="ml-1 text-xs text-amber-500">(new)</span>
                        )}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {e.debitCents > 0 ? fmtChf(e.debitCents) : "—"}
                      </td>
                      <td className="text-right font-mono text-xs text-success-text">
                        {e.creditCents > 0 ? fmtChf(e.creditCents) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-slate-200 shrink-0">
          <button className="button-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="button-primary" onClick={onConfirm} disabled={loading}>
            {loading ? "Posting…" : `Post ${preview.entries.length} entries`}
          </button>
        </div>
      </div>
    </div>
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

  // Ledger preview state
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [approveModalOpen, setApproveModalOpen] = useState(false);

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

  const fetchPreview = useCallback(async () => {
    if (!id) return;
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const res = await fetch(`/api/imported-statements/${id}/ledger-preview`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load preview");
      setPreview(json.data);
    } catch (e) {
      setPreviewError(String(e?.message || e));
    } finally {
      setPreviewLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchStatement(); }, [fetchStatement]);

  // Poll every 4 s while OCR/Claude job is running
  useEffect(() => {
    if (!statement || statement.status !== "PROCESSING") return;
    const timer = setTimeout(() => fetchStatement(), 4000);
    return () => clearTimeout(timer);
  }, [statement, fetchStatement]);

  // Load preview whenever we land on PENDING_REVIEW with balances
  useEffect(() => {
    if (
      statement?.status === "PENDING_REVIEW" &&
      (statement.accountBalances?.length ?? 0) > 0
    ) {
      fetchPreview();
    } else {
      setPreview(null);
    }
  }, [statement, fetchPreview]);

  async function handleApprove() {
    // Open the modal — it will call doApprove on confirm
    setApproveModalOpen(true);
  }

  async function doApprove() {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/imported-statements/${id}/approve`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to approve");
      setApproveModalOpen(false);
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
  const hasNoBalances = isPendingReview && (s?.accountBalances?.length ?? 0) === 0;
  // Approve is available once we have a building, at least one balance, and a loaded preview
  const canApprove = isPendingReview && !needsBuilding && !hasNoBalances && preview !== null && !previewLoading;

  return (
    <AppShell role="MANAGER">
      {approveModalOpen && preview && (
        <ApproveModal
          preview={preview}
          onConfirm={doApprove}
          onClose={() => setApproveModalOpen(false)}
          loading={actionLoading}
        />
      )}
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
                  disabled={actionLoading || !canApprove}
                  title={
                    needsBuilding ? t("manager:financeImports.text.noBuildingAssigned")
                    : hasNoBalances ? "No account balances extracted — re-extract first"
                    : previewLoading ? "Loading preview…"
                    : undefined
                  }
                >
                  {previewLoading
                    ? "Loading…"
                    : preview
                      ? `Post ${preview.entries.length} entries`
                      : t("manager:financeImports.action.approve")}
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
              {/* ── Processing banner ── */}
              {s.status === "PROCESSING" && (
                <div className="notice bg-blue-50 border-blue-300 text-blue-800 flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-blue-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Extracting data from document — this page refreshes automatically.
                </div>
              )}

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

              {/* ── Extracted Data ── */}
              {s.rawOcrText && (
                <ExtractedDataPanel rawOcrText={s.rawOcrText} />
              )}

              {/* ── No balances extracted — re-extract prompt ── */}
              {hasNoBalances && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-medium text-amber-800 mb-3">No account balances extracted</p>
                  <ReExtractForm
                    statementId={s.id}
                    onStarted={(updated) => { setStatement(updated); setPreview(null); }}
                  />
                </div>
              )}

              {/* ── Unmatched warning ── */}
              {isPendingReview && hasUnmatched && !hasNoBalances && (
                <div className="notice bg-amber-50 border-amber-300 text-amber-800">
                  {t("manager:financeImports.text.unmatchedWarning")}
                </div>
              )}

              {/* ── Ledger preview ── */}
              {isPendingReview && !hasNoBalances && (
                <div className="rounded-lg border border-slate-200 bg-slate-50">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">Step 3 — Ledger entries that will be posted</p>
                    <button
                      className="text-xs text-brand-dark hover:underline"
                      onClick={fetchPreview}
                      disabled={previewLoading}
                    >
                      {previewLoading ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>
                  <div className="px-4 py-4">
                    {previewLoading && (
                      <p className="text-sm text-slate-500">Loading preview…</p>
                    )}
                    {previewError && (
                      <p className="text-sm text-destructive-text">{previewError}</p>
                    )}
                    {preview && !previewLoading && (
                      <>
                        {preview.entries.length === 0 ? (
                          <p className="text-sm text-amber-700">
                            No entries would be posted — check the account balances above.
                          </p>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-3 mb-3 text-sm">
                              <span className="text-slate-600">
                                <strong>{preview.entries.length}</strong> entries
                              </span>
                              <span className="text-slate-600">
                                Debits: <strong className="font-mono">CHF {(preview.totalDebitCents / 100).toLocaleString("de-CH", { minimumFractionDigits: 2 })}</strong>
                              </span>
                              <span className="text-success-text">
                                Credits: <strong className="font-mono">CHF {(preview.totalCreditCents / 100).toLocaleString("de-CH", { minimumFractionDigits: 2 })}</strong>
                              </span>
                              {preview.autoCreateCount > 0 && (
                                <span className="text-amber-600">
                                  {preview.autoCreateCount} new account{preview.autoCreateCount > 1 ? "s" : ""} will be created
                                </span>
                              )}
                            </div>
                            <div className="overflow-hidden rounded-lg border border-slate-200">
                              <div className="overflow-x-auto">
                                <table className="data-table text-sm">
                                  <thead>
                                    <tr>
                                      <th>Code</th>
                                      <th>Account</th>
                                      <th className="text-right">Debit</th>
                                      <th className="text-right">Credit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {preview.entries.map((e) => (
                                      <tr key={e.balanceId}>
                                        <td className="font-mono text-xs">{e.rawAccountCode}</td>
                                        <td>
                                          <span className={e.willAutoCreate ? "text-amber-700" : ""}>
                                            {e.accountName ?? e.rawAccountName}
                                          </span>
                                          {e.willAutoCreate && (
                                            <span className="ml-1 text-xs text-amber-500">(new)</span>
                                          )}
                                        </td>
                                        <td className="text-right font-mono text-xs">
                                          {e.debitCents > 0
                                            ? `CHF ${(e.debitCents / 100).toLocaleString("de-CH", { minimumFractionDigits: 2 })}`
                                            : "—"}
                                        </td>
                                        <td className="text-right font-mono text-xs text-success-text">
                                          {e.creditCents > 0
                                            ? `CHF ${(e.creditCents / 100).toLocaleString("de-CH", { minimumFractionDigits: 2 })}`
                                            : "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Linked Invoices ── */}
              {s.linkedInvoices?.length > 0 && (
                <Section title={t("manager:financeImports.title.linkedInvoices")}>
                  <div className="overflow-hidden rounded-lg border border-table-border">
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Vendor</th>
                            <th>Description</th>
                            <th className="text-right">Amount</th>
                            <th>Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.linkedInvoices.map((inv) => (
                            <tr key={inv.id}>
                              <td>{inv.recipientName || "—"}</td>
                              <td className="text-slate-600 text-sm">{inv.description || "—"}</td>
                              <td className="text-right font-mono">
                                {inv.totalCents != null ? formatChfCents(inv.totalCents) : "—"}
                              </td>
                              <td className="text-slate-500 text-sm">
                                {inv.issueDate ? formatDate(inv.issueDate) : "—"}
                              </td>
                              <td>
                                <Badge variant="default">{inv.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Section>
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
