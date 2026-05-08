import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import ConfigurableTable from "../../components/ConfigurableTable";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField, DateField } from "../../components/ui/FilterPanel";
import { ownerAuthHeaders } from "../../lib/api";
import Badge from "../../components/ui/Badge";
import OwnerPicker from "../../components/OwnerPicker";
import { invoiceVariant, ingestionVariant } from "../../lib/statusVariants";
import { formatChf, formatDate as formatDateLib } from "../../lib/format";
import { useTableSort, clientSort } from "../../lib/tableUtils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

// Re-evaluated on every Fast Refresh hot reload (module-level code always re-runs).
// Used to detect that a reload happened and suppress stale modal state.
const _moduleNonce = Date.now();

/* ── Helpers ────────────────────────────────────────────────── */

const formatDate = formatDateLib;
const formatCurrency = formatChf;

const SORT_FIELDS = ["status", "invoiceNumber", "amount", "createdAt"];

function fieldExtractor(inv, field) {
  switch (field) {
    case "status": return inv.status ?? "";
    case "invoiceNumber": return inv.invoiceNumber ?? "";
    case "amount": return getInvoiceTotal(inv);
    case "createdAt": return inv.createdAt || "";
    default: return "";
  }
}

function getInvoiceTotal(invoice) {
  if (typeof invoice.totalAmount === "number") return invoice.totalAmount;
  if (typeof invoice.amount === "number") return invoice.amount;
  return 0;
}

/* ── Status badges ───────────────────────────────────────────── */

const STATUS_TABS = [
  { key: "ALL" },
  { key: "ISSUED" },
  { key: "APPROVED" },
  { key: "PAID" },
  { key: "DISPUTED" },
];

/* ── Ingestion helpers (same as manager hub) ─────────────────── */

const INGESTION_LABEL = {
  PENDING_REVIEW: "Needs review",
  AUTO_CONFIRMED: "Auto-confirmed",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
};
function IngestionBadge({ ingestionStatus }) {
  if (!ingestionStatus) return null;
  return (
    <Badge variant={ingestionVariant(ingestionStatus)} size="sm" className="ml-1.5">
      {INGESTION_LABEL[ingestionStatus] || ingestionStatus}
    </Badge>
  );
}

const SOURCE_LABEL = {
  BROWSER_UPLOAD: { text: "Upload", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  EMAIL_PDF: { text: "Email", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  MOBILE_CAPTURE: { text: "Mobile", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  MANUAL: { text: "Manual", cls: "bg-slate-50 text-slate-600 border-slate-200" },
};
function SourceChannelIcon({ channel }) {
  if (!channel || !SOURCE_LABEL[channel]) return null;
  const { text, cls } = SOURCE_LABEL[channel];
  return <span title={channel} className={"inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ml-1 " + cls}>{text}</span>;
}

/* ── ActionDropdown (same pattern as vacancies / manager hub) ── */

function ActionDropdown({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!actions.length) return null;

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
      >
        Actions ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black/5">
          <div className="py-1">
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                disabled={a.disabled}
                onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick(); }}
                className={"w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition disabled:opacity-40 " + (a.className || "text-slate-700")}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Direction tabs ──────────────────────────────────────────── */

const DIRECTION_TABS = [
  { key: "incoming", label: "Incoming", icon: "📥" },
  { key: "outgoing", label: "Outgoing", icon: "📤" },
];

/* ── PDF Download Modal ──────────────────────────────────────── */

function PdfDownloadModal({ invoice, onClose }) {
  const { t } = useTranslation("owner");
  const [includeQr, setIncludeQr] = useState(true);
  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={t("owner:invoices.heading.downloadPdf")}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-800 mb-1">{t("owner:invoices.heading.downloadPdf")}</h2>
        <p className="text-xs text-slate-500 mb-4">
          {invoice.reference || invoice.invoiceNumber || invoice.id?.slice(0, 8)}
        </p>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeQr}
            onChange={(e) => setIncludeQr(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          <div>
            <p className="text-sm font-medium text-slate-700">{t("owner:invoices.text.includeQrBill")}</p>
            <p className="text-xs text-slate-400">{t("owner:invoices.text.appendsTheSwissQrPaymentSlip")}</p>
          </div>
        </label>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <a
            href={`/api/invoices/${invoice.id}/pdf?includeQRBill=${includeQr}`}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Invoice slide-over detail panel ────────────────────────── */

const SOURCE_LABEL_DETAIL = SOURCE_LABEL;

function InvoiceSlideOver({ invoiceId, onClose, onAction }) {
  const { t } = useTranslation("owner");
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { headers: ownerAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Failed to load");
      setInv(data?.data || null);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function doAction(action, body) {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: body ? JSON.stringify(body) : JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message || d?.error || `Failed to ${action}`);
      }
      await load();
      if (onAction) onAction();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setActionLoading(false);
    }
  }

  const isIncoming = inv?.direction ? inv.direction === "INCOMING" : true;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invoice details"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {inv?.invoiceNumber || invoiceId?.slice(0, 8) || "Invoice"}
            </p>
            {inv && (
              <p className="text-xs text-slate-400 mt-0.5">
                {inv.direction === "INCOMING" ? "↓ Incoming" : "↑ Outgoing"}
                {inv.createdAt ? ` · ${formatDate(inv.createdAt)}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {inv && (
              <a
                href={`/owner/finance/invoices/${invoiceId}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Full page →
              </a>
            )}
            <button
              type="button"
              aria-label="Close invoice panel"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {loading ? (
            <p className="loading-text">Loading invoice…</p>
          ) : !inv ? (
            <p className="empty-state-text">Invoice not found.</p>
          ) : (
            <>
              {/* Status row */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={invoiceVariant(inv.status)} size="sm">{inv.status}</Badge>
                <IngestionBadge ingestionStatus={inv.ingestionStatus} />
                {inv.sourceChannel && SOURCE_LABEL_DETAIL[inv.sourceChannel] && (
                  <span className={"inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium " + SOURCE_LABEL_DETAIL[inv.sourceChannel].cls}>
                    {SOURCE_LABEL_DETAIL[inv.sourceChannel].text}
                  </span>
                )}
              </div>

              {/* Key fields */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { label: "Invoice #", value: inv.invoiceNumber },
                  { label: "Amount", value: formatCurrency(getInvoiceTotal(inv)) },
                  { label: "Issuer / Recipient", value: inv.recipientName || inv.issuerName },
                  { label: "Issue date", value: formatDate(inv.issueDate) },
                  { label: "Due date", value: formatDate(inv.dueDate) },
                  { label: "Currency", value: inv.currency || "CHF" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
                    <dd className="mt-0.5 text-sm text-slate-900">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>

              {/* Line items summary */}
              {inv.lineItems?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Line items</p>
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {inv.lineItems.map((li, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-slate-700 truncate flex-1 mr-2">{li.description || "—"}</span>
                        <span className="font-mono text-slate-900 shrink-0">{formatCurrency(li.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Timeline</p>
                <div className="space-y-1.5 text-xs text-slate-600">
                  {[{label:"Created",value:inv.createdAt},{label:"Submitted",value:inv.submittedAt},{label:"Approved",value:inv.approvedAt},{label:"Paid",value:inv.paidAt}]
                    .filter(e => e.value)
                    .map(({label,value}) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-slate-500">{label}</span>
                        <span>{formatDate(value)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        {inv && (
          <div className="border-t border-slate-200 px-5 py-4 flex flex-wrap gap-2">
            {isIncoming && inv.status === "ISSUED" && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => doAction("approve")}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
              >
                ✓ Approve
              </button>
            )}
            {isIncoming && ["ISSUED", "DRAFT", "APPROVED"].includes(inv.status) && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  const reason = window.prompt("Reason for dispute (required):");
                  if (reason?.trim()) doAction("dispute", { reason });
                }}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50"
              >
                ✗ Dispute
              </button>
            )}
            <a
              href={`/api/invoices/${invoiceId}/pdf`}
              download
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              ↓ PDF
            </a>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Main Component ──────────────────────────────────────────── */

export default function OwnerInvoices() {
  const { t } = useTranslation("owner");
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState("incoming");
  const [activeTab, setActiveTab] = useState("ALL");
  const [pdfModalInvoice, _setPdfModalInvoice] = useState(null);
  const [pdfModalNonce, setPdfModalNonce] = useState(_moduleNonce);
  // If the module nonce changed (hot reload), treat modal as closed.
  const effectivePdfModal = pdfModalNonce === _moduleNonce ? pdfModalInvoice : null;
  function setPdfModalInvoice(inv) {
    _setPdfModalInvoice(inv);
    setPdfModalNonce(_moduleNonce);
  }

  // Slide-over detail panel
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const openInvoice = useCallback((id) => {
    setSelectedInvoiceId(id);
    router.replace({ pathname: router.pathname, query: { ...router.query, invoiceId: id } }, undefined, { shallow: true });
  }, [router]);
  const closeInvoice = useCallback(() => {
    setSelectedInvoiceId(null);
    const { invoiceId: _removed, ...rest } = router.query;
    router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
  }, [router]);

  // Date filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const activeCount = [activeTab !== "ALL" ? activeTab : "", dateFrom, dateTo].filter(Boolean).length;
  const [filterOpen, setFilterOpen] = useState(false);
  const { sortField, sortDir, handleSort } = useTableSort(router, SORT_FIELDS);

  useEffect(() => { fetchInvoices(); }, []);

  // Deep-link: open overlay when ?invoiceId= is present on load
  const deepLinked = useRef(false);
  useEffect(() => {
    if (!router.isReady || deepLinked.current) return;
    if (router.query.invoiceId) {
      deepLinked.current = true;
      setSelectedInvoiceId(router.query.invoiceId);
    }
  }, [router.isReady, router.query.invoiceId]);

  // Legacy: remove highlightedId variable (replaced by overlay)
  const highlightedId = null;

  const fetchInvoices = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/owner/invoices", { headers: ownerAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load invoices");
      setInvoices(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const actionRequest = async (invoiceId, action) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `Failed to ${action} invoice`);
      }
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  /* Approval queue count — only INCOMING invoices awaiting owner approval */
  const approvalCount = useMemo(
    () => invoices.filter((inv) => {
      if (inv.status !== "ISSUED") return false;
      if (inv.direction) return inv.direction === "INCOMING";
      return !inv.leaseId; // heuristic fallback
    }).length,
    [invoices],
  );

  /* Direction-filtered, then status-filtered, then date-filtered */
  const isOutgoing = direction === "outgoing";

  const directionFiltered = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.direction) return isOutgoing ? inv.direction === "OUTGOING" : inv.direction === "INCOMING";
      // Heuristic: invoices with leaseId are outgoing (management → tenant)
      return isOutgoing ? !!inv.leaseId : !inv.leaseId;
    });
  }, [invoices, isOutgoing]);

  const filteredInvoices = useMemo(() => {
    return directionFiltered.filter((inv) => {
      if (activeTab !== "ALL" && inv.status !== activeTab) return false;
      if (dateFrom && inv.createdAt < dateFrom) return false;
      if (dateTo && inv.createdAt > dateTo + "T23:59:59") return false;
      return true;
    });
  }, [directionFiltered, activeTab, dateFrom, dateTo]);

  const sortedInvoices = useMemo(
    () => clientSort(filteredInvoices, sortField, sortDir, fieldExtractor),
    [filteredInvoices, sortField, sortDir],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const invoiceColumns = useMemo(() => [
    {
      id: "status",
      label: t("owner:invoices.col.status"),
      sortable: true,
      defaultVisible: true,
      render: (inv) => <Badge variant={invoiceVariant(inv.status)} size="sm">{inv.status}</Badge>,
    },
    {
      id: "invoiceNumber",
      label: t("owner:invoices.col.invoice"),
      sortable: true,
      defaultVisible: true,
      className: "cell-bold",
      render: (inv) => (
        <span className="flex items-center gap-1 flex-wrap">
          {inv.invoiceNumber || inv.id?.slice(0, 8) || "Draft"}
          <SourceChannelIcon channel={inv.sourceChannel} />
          <IngestionBadge ingestionStatus={inv.ingestionStatus} />
        </span>
      ),
    },
    {
      id: "recipient",
      label: isOutgoing ? t("owner:invoices.col.tenant") : t("owner:invoices.col.issuer"),
      sortable: false,
      defaultVisible: true,
      render: (inv) => inv.recipientName || <span className="text-slate-400">—</span>,
    },
    {
      id: "createdAt",
      label: t("owner:invoices.col.date"),
      sortable: true,
      defaultVisible: true,
      render: (inv) => formatDate(inv.createdAt),
    },
    {
      id: "amount",
      label: t("owner:invoices.col.amount"),
      sortable: true,
      defaultVisible: true,
      className: "font-semibold",
      render: (inv) => formatCurrency(getInvoiceTotal(inv)),
    },
    {
      id: "actions",
      label: t("owner:invoices.col.actions"),
      sortable: false,
      alwaysVisible: true,
      className: "text-right",
      headerClassName: "text-right",
      render: (inv) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ActionDropdown actions={[
            ...(!isOutgoing && (inv.status === "ISSUED" || inv.status === "DRAFT") ? [{ label: t("owner:invoices.col.Approve"), className: "text-green-700 font-semibold", onClick: () => actionRequest(inv.id, "approve") }] : []),
            ...(!isOutgoing && inv.status === "APPROVED" ? [{ label: t("owner:invoices.col.MarkAsPaid"), className: "text-green-700 font-semibold", onClick: () => actionRequest(inv.id, "mark-paid") }] : []),
            { label: t("owner:invoices.col.DownloadPdf"), onClick: () => setPdfModalInvoice(inv) },
            ...(!isOutgoing && (inv.status === "ISSUED" || inv.status === "DRAFT" || inv.status === "APPROVED") ? [{ label: t("owner:invoices.col.Dispute"), className: "text-rose-600", onClick: () => actionRequest(inv.id, "dispute") }] : []),
          ]} />
        </div>
      ),
    },
  ], [isOutgoing]);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <OwnerPicker onSelect={fetchInvoices} />
        <PageHeader
          title={t("owner:invoices.title.invoices")}
          subtitle={t("owner:invoices.prop.reviewApproveAndManageInvoicePayments")}
        />

        <PageContent>
          <ErrorBanner error={error} onDismiss={() => setError("")} className="mb-4 text-sm" />

          {/* Approval queue banner */}
          {approvalCount > 0 && direction === "incoming" && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-lg">⚡</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700">{approvalCount} invoice{approvalCount !== 1 ? "s" : ""} awaiting your approval</p>
                <p className="text-xs text-amber-600">{t("owner:invoices.text.reviewIssuedInvoicesAndApproveOrDisputeThem")}</p>
              </div>
              <button
                onClick={() => setActiveTab("ISSUED")}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Review now
              </button>
            </div>
          )}

          {/* Direction toggle */}
          <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
            {DIRECTION_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setDirection(tab.key); setActiveTab("ALL"); }}
                className={
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors " +
                  (direction === tab.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700")
                }
              >
                {tab.icon} {t(`owner:invoices.tabs.${tab.key.toLowerCase()}`)}
              </button>
            ))}
          </div>

          <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
          {filterOpen && (
            <FilterPanelBody>
              <FilterSection title={t("owner:invoices.title.status")} first>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectField label={t("owner:invoices.title.status")} value={activeTab} onChange={(e) => setActiveTab(e.target.value)}>
                    {STATUS_TABS.map((tab) => <option key={tab.key} value={tab.key}>{t(`owner:invoices.tabs.${tab.key.toLowerCase()}`)}</option>)}
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSection title={t("owner:invoices.title.dateRange")}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DateField label={t("owner:invoices.prop.from")} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <DateField label={t("owner:invoices.prop.to")} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </FilterSection>
              <FilterSectionClear hasFilter={activeCount > 0} onClear={() => { setActiveTab("ALL"); setDateFrom(""); setDateTo(""); }} />
            </FilterPanelBody>
          )}

          {/* Invoice table */}
          {loading ? (
            <p className="loading-text">{t("owner:invoices.text.loadingInvoices")}</p>
          ) : (
            <ConfigurableTable
              tableId="owner-invoices"
              columns={invoiceColumns}
              data={sortedInvoices}
              rowKey="id"
              rowId={(inv) => `invoice-${inv.id}`}
              rowClassName={() => ""}
              onRowClick={(inv) => openInvoice(inv.id)}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              emptyState={
                <p className="empty-state-text">
                  {invoices.length === 0 ? "No invoices yet." : "No invoices match the current filters."}
                </p>
              }
              mobileCard={(inv) => (
                <button
                  type="button"
                  onClick={() => openInvoice(inv.id)}
                  className="table-card w-full text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-slate-500">{inv.invoiceNumber || inv.id?.slice(0, 8)}</span>
                    <Badge variant={invoiceVariant(inv.status)} size="sm">{inv.status}</Badge>
                  </div>
                  <p className="table-card-head mt-1">{inv.recipientName || "—"}</p>
                  <div className="table-card-footer">
                    <span className="font-medium">{formatCurrency(getInvoiceTotal(inv))}</span>
                    <span>{formatDate(inv.createdAt)}</span>
                  </div>
                </button>
              )}
            />
          )}

          {/* Summary */}
          {!loading && sortedInvoices.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-1">
              <span>{sortedInvoices.length} invoice{sortedInvoices.length !== 1 ? "s" : ""}</span>
              <span>
                Total: {formatCurrency(sortedInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0))}
              </span>
            </div>
          )}
        </PageContent>
      </PageShell>
      <PdfDownloadModal invoice={effectivePdfModal} onClose={() => setPdfModalInvoice(null)} />
      {selectedInvoiceId && (
        <InvoiceSlideOver
          invoiceId={selectedInvoiceId}
          onClose={closeInvoice}
          onAction={fetchInvoices}
        />
      )}
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","owner"]);
