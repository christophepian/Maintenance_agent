/**
 * Imported Statement Review Page
 *
 * /manager/finance/imports/[id]
 *
 * Manager reviews OCR-extracted data:
 *   - Statement metadata (building, fiscal year, period, status)
 *   - Account balances — editable (amount, type, COA match) with inline add-row
 *   - Accounting equation gate: approve is locked until debits = credits exactly
 *   - Approve / Reject actions
 */

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
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

// ── Section type helpers ──────────────────────────────────────────────────────

const SECTION_LABEL = {
  BALANCE_SHEET:    "Balance Sheet",
  INCOME_STATEMENT: "Income Statement",
  INVOICES:         "Invoices",
};

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

// ── Searchable account combobox ───────────────────────────────────────────────

function SearchableAccountSelect({ accounts, value, onChange, placeholder = "Search by code or name…", loading = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const selected = useMemo(() => accounts.find((a) => a.id === value), [accounts, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts.slice(0, 80);
    return accounts
      .filter(
        (a) =>
          (a.code && a.code.toLowerCase().includes(q)) ||
          a.name.toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [accounts, query]);

  function handleFocus() {
    setOpen(true);
    setQuery("");
  }

  function handleBlur() {
    // Small delay so onMouseDown on a list item fires before the blur closes the list
    setTimeout(() => setOpen(false), 150);
  }

  const displayValue = open
    ? query
    : selected
      ? `${selected.code ? selected.code + " — " : ""}${selected.name}`
      : "";

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className="form-input text-sm w-full"
        placeholder={loading ? "Loading accounts…" : placeholder}
        disabled={loading}
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {open && !loading && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">No accounts match</p>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors",
                  value === a.id ? "bg-brand-50 text-brand-dark font-medium" : "text-slate-800",
                )}
                onMouseDown={() => { onChange(a.id); setOpen(false); setQuery(""); }}
              >
                {a.code && (
                  <span className="font-mono text-xs text-slate-400 mr-2">{a.code}</span>
                )}
                {a.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Balance row editor (edit existing or add new) ────────────────────────────

function BalanceRowEditor({ balance, statementId, accounts, accountsLoading, onSaved, onCancel }) {
  const isNew = !balance;

  const [rawAccountCode, setRawAccountCode] = useState(balance?.rawAccountCode ?? "");
  const [rawAccountName, setRawAccountName] = useState(balance?.rawAccountName ?? "");
  const [amountStr, setAmountStr] = useState(
    balance ? (balance.balanceCents / 100).toFixed(2) : "",
  );
  const [balanceType, setBalanceType] = useState(balance?.balanceType ?? "DEBIT");
  const [accountId, setAccountId] = useState(balance?.accountId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const balanceCents = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(balanceCents) || balanceCents < 0) {
      setError("Enter a valid positive amount in CHF");
      return;
    }

    if (isNew && (!rawAccountCode.trim() || !rawAccountName.trim())) {
      setError("Account code and name are required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let res;
      if (isNew) {
        res = await fetch(`/api/imported-statements/${statementId}/balances`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            rawAccountCode: rawAccountCode.trim(),
            rawAccountName: rawAccountName.trim(),
            balanceCents,
            balanceType,
            ...(accountId ? { accountId } : {}),
          }),
        });
      } else {
        res = await fetch(
          `/api/imported-statements/${statementId}/balances/${balance.id}`,
          {
            method: "PATCH",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({
              balanceCents,
              balanceType,
              ...(accountId ? { accountId } : {}),
            }),
          },
        );
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message || "Failed to save");
      onSaved(json.data); // pass updated statement back so parent can skip a re-fetch
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
      {isNew && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="form-label text-xs">Account code</label>
            <input
              className="form-input text-sm font-mono"
              value={rawAccountCode}
              onChange={(e) => setRawAccountCode(e.target.value)}
              placeholder="e.g. 1020"
            />
          </div>
          <div>
            <label className="form-label text-xs">Account name</label>
            <input
              className="form-input text-sm"
              value={rawAccountName}
              onChange={(e) => setRawAccountName(e.target.value)}
              placeholder="e.g. Bank account"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="form-label text-xs">Amount (CHF)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="form-input text-sm font-mono"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="form-label text-xs">Side</label>
          <select
            className="form-input text-sm"
            value={balanceType}
            onChange={(e) => setBalanceType(e.target.value)}
          >
            <option value="DEBIT">Debit — Asset / Expense</option>
            <option value="CREDIT">Credit — Liability / Equity / Income</option>
          </select>
        </div>
      </div>

      <div>
        <label className="form-label text-xs">Chart of accounts match (optional)</label>
        <SearchableAccountSelect
          accounts={accounts}
          loading={accountsLoading}
          value={accountId}
          onChange={setAccountId}
        />
      </div>

      {error && <p className="text-xs text-destructive-text">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          className="button-primary text-xs py-1 px-3"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="button-secondary text-xs py-1 px-3"
          onClick={onCancel}
          disabled={saving}
        >
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
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error?.message || "Failed");
      onAssigned(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function handleCreated(newBuilding) {
    setCreateOpen(false);
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

// ── Re-extract form ───────────────────────────────────────────────────────────

const RE_EXTRACT_DOC_TYPES = [
  { value: "FINANCIAL_STATEMENT", label: "Financial Statement (balance sheet)" },
  { value: "INVOICE",             label: "Invoice(s)" },
  { value: "MANAGEMENT_REPORT",   label: "Management Report" },
];

function ReExtractPanel({ statementId, hasBalances, onStarted }) {
  const [open, setOpen] = useState(!hasBalances);
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
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error?.message || "Failed to re-extract");
      onStarted(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
          onClick={() => setOpen(true)}
        >
          Re-extract document
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border px-4 py-4",
      hasBalances ? "border-slate-200 bg-slate-50" : "border-amber-300 bg-amber-50",
    )}>
      {hasBalances ? (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-700">Re-extract document</p>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-600"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <p className="text-sm font-medium text-amber-800 mb-3">No account balances extracted</p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          {hasBalances
            ? "Re-running extraction will replace all current account balances and linked invoices with a fresh extraction from the stored file."
            : "This usually means the wrong document type was detected. Choose the correct type and re-run extraction on the stored file."}
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
    </div>
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

  const [statement, setStatement]       = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]   = useState("");

  // Ledger preview
  const [preview, setPreview]           = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [approveModalOpen, setApproveModalOpen] = useState(false);

  // COA accounts for the combobox
  const [coaAccounts, setCoaAccounts]   = useState([]);
  const [coaLoading, setCoaLoading]     = useState(true);

  // Balance row editing state
  const [editingBalanceId, setEditingBalanceId] = useState(null);
  const [addingRow, setAddingRow]       = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchStatement = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/imported-statements/${id}`, { headers: authHeaders() });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error?.message || t("manager:financeImports.text.notFound"));
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
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error?.message || "Failed to load preview");
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

  // Load preview whenever we land on PENDING_REVIEW with balances (auto-refreshes on statement change)
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

  // Load COA accounts once for the combobox
  useEffect(() => {
    fetch("/api/coa/accounts", { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => { setCoaAccounts(j.data ?? []); setCoaLoading(false); })
      .catch(() => setCoaLoading(false));
  }, []);

  // ── Balance edit callbacks ─────────────────────────────────────────────────

  // Called by BalanceRowEditor when a PATCH or POST succeeds.
  // The endpoint returns the updated statement, so we can skip a re-fetch.
  function handleBalanceSaved(updatedStatement) {
    setEditingBalanceId(null);
    setAddingRow(false);
    if (updatedStatement) {
      setStatement(updatedStatement);
    } else {
      fetchStatement();
    }
  }

  // ── Approve / Reject ───────────────────────────────────────────────────────

  async function handleApprove() {
    if (isInvoicesSection) {
      if (!window.confirm("Confirm all invoices in this section? Their status will be set to Issued.")) return;
      await doApprove();
      return;
    }
    if (isIncomeStatement) {
      if (!window.confirm(
        "Approve this income statement?\n\n" +
        "If the building has no prior ledger activity for this period, the entries will be posted as starting balances. " +
        "Otherwise they will be stored as reference only — no journal entries will be created.",
      )) return;
      await doApprove();
      return;
    }
    // Balance sheet: open the full ledger preview modal
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
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error?.message || "Failed to approve");
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
    if (notes === null) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/imported-statements/${id}/reject`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error?.message || "Failed to reject");
      setStatement(json.data);
    } catch (e) {
      setActionError(String(e?.message || e));
    } finally {
      setActionLoading(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const s = statement;
  const isPendingReview   = s?.status === "PENDING_REVIEW";
  const sectionType       = s?.sectionType ?? "BALANCE_SHEET";
  const isBalanceSheet    = sectionType === "BALANCE_SHEET";
  const isIncomeStatement = sectionType === "INCOME_STATEMENT";
  const isInvoicesSection = sectionType === "INVOICES";
  const hasUnmatched      = s?.accountBalances?.some((ab) => ab.matchConfidence === "UNMATCHED");
  const needsBuilding     = isPendingReview && !s?.buildingId;
  const hasNoBalances     = (s?.accountBalances?.length ?? 0) === 0;

  // Running totals (client-side, mirrors server mapDTO logic)
  const totalDebitCents  = s?.accountBalances?.reduce((sum, ab) => sum + (ab.balanceType === "DEBIT"  ? ab.balanceCents : 0), 0) ?? 0;
  const totalCreditCents = s?.accountBalances?.reduce((sum, ab) => sum + (ab.balanceType === "CREDIT" ? ab.balanceCents : 0), 0) ?? 0;

  // Authoritative imbalance from the server DTO (recomputed on every fetch)
  const imbalanceCents    = s?.balanceImbalanceCents ?? null;
  // For BALANCE_SHEET the equation must hold exactly before posting
  const isExactlyBalanced = isBalanceSheet ? (imbalanceCents === 0) : true;
  // Show the imbalance warning banner only for balance sheets
  const hasBalanceWarning = isBalanceSheet && imbalanceCents !== null && imbalanceCents !== 0;

  // Approve availability:
  // - INVOICES: building only
  // - IS: building + balances (posting is conditional)
  // - BS: building + balances + exact equation + preview loaded
  const canApprove =
    isPendingReview && !needsBuilding && (
      isInvoicesSection ? true
      : isIncomeStatement ? !hasNoBalances
      : /* BS */ !hasNoBalances && preview !== null && !previewLoading && isExactlyBalanced
    );

  const approveButtonLabel = isInvoicesSection
    ? `Confirm ${s?.linkedInvoices?.length ?? 0} invoice${s?.linkedInvoices?.length !== 1 ? "s" : ""}`
    : isIncomeStatement
      ? t("manager:financeImports.action.approve")
      : !isExactlyBalanced
        ? "Equation unbalanced"
        : previewLoading
          ? "Loading…"
          : preview
            ? `Post ${preview.entries.length} entries`
            : t("manager:financeImports.action.approve");

  const approveButtonTitle = needsBuilding
    ? t("manager:financeImports.text.noBuildingAssigned")
    : !isInvoicesSection && hasNoBalances
      ? "No account balances extracted — re-extract first"
      : isBalanceSheet && !isExactlyBalanced
        ? `Equation off by CHF ${((Math.abs(imbalanceCents ?? 0)) / 100).toFixed(2)} — edit balances until debits = credits exactly`
        : isBalanceSheet && previewLoading
          ? "Loading preview…"
          : undefined;

  // Pencil icon for edit button
  const PencilIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

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
          title={
            s
              ? `${SECTION_LABEL[s.sectionType] ?? "Import"} — FY ${s.fiscalYear}`
              : t("manager:financeImports.title.reviewStatement")
          }
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
                  title={approveButtonTitle}
                >
                  {approveButtonLabel}
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
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Section</p>
                    <p className="font-medium">{SECTION_LABEL[s.sectionType] ?? s.sectionType}</p>
                  </div>
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

              {/* ── Income statement info banner ── */}
              {isPendingReview && isIncomeStatement && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <p className="font-semibold mb-1">Income Statement — conditional posting</p>
                  <p>
                    If this building already has ledger entries for FY {s.fiscalYear}, these account balances will be
                    stored as <strong>reference data only</strong> — no journal entries will be created. If no prior
                    activity exists, they will be posted as opening balances.
                  </p>
                </div>
              )}

              {/* ── Re-extract panel ── available for non-INVOICES PENDING_REVIEW statements ── */}
              {isPendingReview && !isInvoicesSection && (
                <ReExtractPanel
                  statementId={s.id}
                  hasBalances={!hasNoBalances}
                  onStarted={(updated) => { setStatement(updated); setPreview(null); }}
                />
              )}

              {/* ── Unmatched warning ── */}
              {isPendingReview && !isInvoicesSection && hasUnmatched && !hasNoBalances && (
                <div className="notice bg-amber-50 border-amber-300 text-amber-800">
                  {t("manager:financeImports.text.unmatchedWarning")}
                </div>
              )}

              {/* ── Accounting equation warning (balance sheet only) ── */}
              {hasBalanceWarning && !hasNoBalances && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <p className="font-semibold mb-1">Accounting equation not balanced</p>
                  <p>
                    Debits and credits differ by{" "}
                    <strong className="font-mono">
                      CHF {(Math.abs(imbalanceCents) / 100).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                    </strong>
                    {imbalanceCents > 0 ? " (debits exceed credits)" : " (credits exceed debits)"}.
                    {" "}The equation must reach exactly zero before entries can be posted.
                    Use the edit buttons below to correct amounts or add missing rows.
                  </p>
                </div>
              )}

              {/* ── Ledger preview — balance sheet only ── */}
              {isPendingReview && isBalanceSheet && !hasNoBalances && (
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
                  {/* ── Mobile ── */}
                  <div className="md:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                    {s.accountBalances.map((ab) => (
                      <Fragment key={ab.id}>
                        <div className="table-card">
                          <div className="flex items-start justify-between gap-2">
                            <span className="table-card-head flex-1">
                              {ab.rawAccountCode} — {ab.rawAccountName}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant={confidenceVariant(ab.matchConfidence)}>
                                {t(`manager:financeImports.confidence.${ab.matchConfidence}`)}
                              </Badge>
                              {isPendingReview && (
                                <button
                                  type="button"
                                  className={cn(
                                    "icon-btn",
                                    editingBalanceId === ab.id ? "text-brand-dark" : "text-slate-400 hover:text-slate-600",
                                  )}
                                  onClick={() => setEditingBalanceId(editingBalanceId === ab.id ? null : ab.id)}
                                  title="Edit this row"
                                >
                                  {PencilIcon}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="table-card-footer">
                            <span className={cn("font-mono font-medium text-sm", ab.balanceType === "CREDIT" ? "text-success-text" : "")}>
                              {ab.balanceType === "DEBIT" ? "Dr " : "Cr "}{formatChfCents(ab.balanceCents)}
                            </span>
                            {ab.accountName && (
                              <span className="text-slate-500 text-xs">{ab.accountCode ? `${ab.accountCode} ` : ""}{ab.accountName}</span>
                            )}
                          </div>
                        </div>
                        {editingBalanceId === ab.id && isPendingReview && (
                          <div className="px-3 py-3 bg-slate-50">
                            <BalanceRowEditor
                              balance={ab}
                              statementId={s.id}
                              accounts={coaAccounts}
                              accountsLoading={coaLoading}
                              onSaved={handleBalanceSaved}
                              onCancel={() => setEditingBalanceId(null)}
                            />
                          </div>
                        )}
                      </Fragment>
                    ))}
                  </div>

                  {/* ── Desktop ── */}
                  <div className="hidden md:block overflow-hidden rounded-lg border border-table-border">
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>{t("manager:financeImports.prop.accountCode")}</th>
                            <th>{t("manager:financeImports.prop.accountName")}</th>
                            <th className="text-right">Debit</th>
                            <th className="text-right">Credit</th>
                            <th>{t("manager:financeImports.prop.matchConfidence")}</th>
                            <th>{t("manager:financeImports.prop.matchedAccount")}</th>
                            {isPendingReview && <th className="w-8" />}
                          </tr>
                        </thead>
                        <tbody>
                          {s.accountBalances.map((ab) => (
                            <Fragment key={ab.id}>
                              <tr className={editingBalanceId === ab.id ? "bg-slate-50" : ""}>
                                <td className="font-mono text-sm">{ab.rawAccountCode}</td>
                                <td>{ab.rawAccountName}</td>
                                <td className="text-right font-mono text-sm">
                                  {ab.balanceType === "DEBIT" ? formatChfCents(ab.balanceCents) : "—"}
                                </td>
                                <td className="text-right font-mono text-sm text-success-text">
                                  {ab.balanceType === "CREDIT" ? formatChfCents(ab.balanceCents) : "—"}
                                </td>
                                <td>
                                  <Badge variant={confidenceVariant(ab.matchConfidence)}>
                                    {t(`manager:financeImports.confidence.${ab.matchConfidence}`)}
                                  </Badge>
                                </td>
                                <td className="text-sm text-slate-700">
                                  {ab.accountCode ? `${ab.accountCode} ` : ""}{ab.accountName ?? "—"}
                                </td>
                                {isPendingReview && (
                                  <td>
                                    <button
                                      type="button"
                                      className={cn(
                                        "icon-btn",
                                        editingBalanceId === ab.id ? "text-brand-dark" : "text-slate-300 hover:text-slate-600",
                                      )}
                                      onClick={() => setEditingBalanceId(editingBalanceId === ab.id ? null : ab.id)}
                                      title={editingBalanceId === ab.id ? "Close editor" : "Edit this row"}
                                    >
                                      {PencilIcon}
                                    </button>
                                  </td>
                                )}
                              </tr>
                              {editingBalanceId === ab.id && isPendingReview && (
                                <tr>
                                  <td
                                    colSpan={isPendingReview ? 7 : 6}
                                    className="p-0 bg-slate-50 border-t border-slate-200"
                                  >
                                    <div className="px-4 py-3">
                                      <BalanceRowEditor
                                        balance={ab}
                                        statementId={s.id}
                                        accounts={coaAccounts}
                                        accountsLoading={coaLoading}
                                        onSaved={handleBalanceSaved}
                                        onCancel={() => setEditingBalanceId(null)}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>

                        {/* ── Totals footer (balance sheet only) ── */}
                        {isBalanceSheet && (
                          <tfoot>
                            <tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-medium">
                              <td colSpan={2} className="px-3 py-2 text-xs text-slate-500 uppercase tracking-wide text-right">
                                Total
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatChfCents(totalDebitCents)}
                              </td>
                              <td className={cn(
                                "px-3 py-2 text-right font-mono",
                                isExactlyBalanced ? "text-success-text" : "text-destructive-text",
                              )}>
                                {formatChfCents(totalCreditCents)}
                              </td>
                              <td colSpan={isPendingReview ? 3 : 2} className="px-3 py-2">
                                {imbalanceCents === 0 ? (
                                  <span className="text-xs text-success-text font-medium">✓ Balanced</span>
                                ) : imbalanceCents !== null ? (
                                  <span className="text-xs text-destructive-text">
                                    Δ {formatChfCents(Math.abs(imbalanceCents))}{" "}
                                    {imbalanceCents > 0 ? "(Dr > Cr)" : "(Cr > Dr)"}
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* ── Add row ── */}
                  {isPendingReview && (
                    <div className="mt-3">
                      {addingRow ? (
                        <BalanceRowEditor
                          balance={null}
                          statementId={s.id}
                          accounts={coaAccounts}
                          accountsLoading={coaLoading}
                          onSaved={handleBalanceSaved}
                          onCancel={() => setAddingRow(false)}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-sm text-brand-dark hover:underline flex items-center gap-1"
                          onClick={() => { setAddingRow(true); setEditingBalanceId(null); }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          Add balance row
                        </button>
                      )}
                    </div>
                  )}
                </Section>
              )}

              {/* ── Add row when no balances yet ── */}
              {isPendingReview && hasNoBalances && !isInvoicesSection && (
                <div className="mt-2">
                  {addingRow ? (
                    <BalanceRowEditor
                      balance={null}
                      statementId={s.id}
                      accounts={coaAccounts}
                      accountsLoading={coaLoading}
                      onSaved={handleBalanceSaved}
                      onCancel={() => setAddingRow(false)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-sm text-brand-dark hover:underline flex items-center gap-1"
                      onClick={() => setAddingRow(true)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Add balance row manually
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common", "manager"]);
