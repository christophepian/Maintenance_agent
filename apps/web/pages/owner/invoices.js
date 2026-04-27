import { useMemo, useState, useEffect, useRef } from "react";
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
import { invoiceVariant, ingestionVariant } from "../../lib/statusVariants";
import { formatChf, formatDate as formatDateLib } from "../../lib/format";
import { useTableSort, clientSort } from "../../lib/tableUtils";

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
  { key: "ALL", label: "All" },
  { key: "ISSUED", label: "Issued" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "DISPUTED", label: "Disputed" },
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
  return <span title={channel} className={"inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ml-1 " + cls}>{text}</span>;
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
  const [includeQr, setIncludeQr] = useState(true);
  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Download PDF">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Download PDF</h2>
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
            <p className="text-sm font-medium text-slate-700">Include QR bill</p>
            <p className="text-xs text-slate-400">Appends the Swiss QR payment slip</p>
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

/* ── Main Component ──────────────────────────────────────────── */

export default function OwnerInvoices() {
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

  // Date filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const activeCount = [activeTab !== "ALL" ? activeTab : "", dateFrom, dateTo].filter(Boolean).length;
  const [filterOpen, setFilterOpen] = useState(false);
  const { sortField, sortDir, handleSort } = useTableSort(router, SORT_FIELDS);

  useEffect(() => { fetchInvoices(); }, []);

  // Deep-link: auto-scroll to invoice from ?invoiceId= query param
  const highlightedId = router.isReady ? router.query.invoiceId : null;
  useEffect(() => {
    if (!highlightedId || loading) return;
    const el = document.getElementById(`invoice-${highlightedId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-indigo-400", "bg-indigo-50");
      const timer = setTimeout(() => {
        el.classList.remove("ring-2", "ring-indigo-400", "bg-indigo-50");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedId, loading]);

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
      label: "Status",
      sortable: true,
      defaultVisible: true,
      render: (inv) => <Badge variant={invoiceVariant(inv.status)} size="sm">{inv.status}</Badge>,
    },
    {
      id: "invoiceNumber",
      label: "Invoice #",
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
      label: isOutgoing ? "Tenant" : "Issuer",
      sortable: false,
      defaultVisible: true,
      render: (inv) => inv.recipientName || <span className="text-slate-400">—</span>,
    },
    {
      id: "createdAt",
      label: "Date",
      sortable: true,
      defaultVisible: true,
      render: (inv) => formatDate(inv.createdAt),
    },
    {
      id: "amount",
      label: "Amount",
      sortable: true,
      defaultVisible: true,
      className: "font-semibold",
      render: (inv) => formatCurrency(getInvoiceTotal(inv)),
    },
    {
      id: "actions",
      label: "Actions",
      sortable: false,
      alwaysVisible: true,
      className: "text-right",
      headerClassName: "text-right",
      render: (inv) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ActionDropdown actions={[
            ...(!isOutgoing && (inv.status === "ISSUED" || inv.status === "DRAFT") ? [{ label: "✓ Approve", className: "text-green-700 font-semibold", onClick: () => actionRequest(inv.id, "approve") }] : []),
            ...(!isOutgoing && inv.status === "APPROVED" ? [{ label: "💰 Mark as Paid", className: "text-green-700 font-semibold", onClick: () => actionRequest(inv.id, "mark-paid") }] : []),
            { label: "📄 Download PDF", onClick: () => setPdfModalInvoice(inv) },
            ...(!isOutgoing && (inv.status === "ISSUED" || inv.status === "DRAFT" || inv.status === "APPROVED") ? [{ label: "⚠ Dispute", className: "text-rose-600", onClick: () => actionRequest(inv.id, "dispute") }] : []),
          ]} />
        </div>
      ),
    },
  ], [isOutgoing]);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Invoices"
          subtitle="Review, approve, and manage invoice payments"
        />

        <PageContent>
          <ErrorBanner error={error} onDismiss={() => setError("")} className="mb-4 text-sm" />

          {/* Approval queue banner */}
          {approvalCount > 0 && direction === "incoming" && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-lg">⚡</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700">{approvalCount} invoice{approvalCount !== 1 ? "s" : ""} awaiting your approval</p>
                <p className="text-xs text-amber-600">Review issued invoices and approve or dispute them</p>
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
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
          {filterOpen && (
            <FilterPanelBody>
              <FilterSection title="Status" first>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectField label="Status" value={activeTab} onChange={(e) => setActiveTab(e.target.value)}>
                    {STATUS_TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSection title="Date range">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DateField label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <DateField label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </FilterSection>
              <FilterSectionClear hasFilter={activeCount > 0} onClear={() => { setActiveTab("ALL"); setDateFrom(""); setDateTo(""); }} />
            </FilterPanelBody>
          )}

          {/* Invoice table */}
          {loading ? (
            <p className="loading-text">Loading invoices…</p>
          ) : (
            <ConfigurableTable
              tableId="owner-invoices"
              columns={invoiceColumns}
              data={sortedInvoices}
              rowKey="id"
              rowId={(inv) => `invoice-${inv.id}`}
              rowClassName={(inv) => inv.id === highlightedId ? "ring-2 ring-inset ring-indigo-400 bg-indigo-50" : ""}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              emptyState={
                <p className="empty-state-text">
                  {invoices.length === 0 ? "No invoices yet." : "No invoices match the current filters."}
                </p>
              }
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
    </AppShell>
  );
}
