import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField, DateField } from "../../components/ui/FilterPanel";
import { ownerAuthHeaders } from "../../lib/api";
import Badge from "../../components/ui/Badge";
import { invoiceVariant, ingestionVariant } from "../../lib/statusVariants";

/* ── Formatting helpers ──────────────────────────────────────── */

function formatCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const formatted = safeValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${formatted}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
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

/* ── Main Component ──────────────────────────────────────────── */

export default function OwnerInvoices() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState("incoming");
  const [activeTab, setActiveTab] = useState("ALL");
  const [includeQr, setIncludeQr] = useState(true);

  // Date filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const activeCount = [activeTab !== "ALL" ? activeTab : "", dateFrom, dateTo].filter(Boolean).length;
  const [filterOpen, setFilterOpen] = useState(false);

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

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Invoices"
          subtitle="Review, approve, and manage invoice payments"
          actions={
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={includeQr} onChange={(e) => setIncludeQr(e.target.checked)} />
              Include QR in PDF
            </label>
          }
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

          {/* Invoice list */}
          <Panel>
            {loading ? (
              <p className="text-sm text-slate-600 p-4">Loading invoices...</p>
            ) : filteredInvoices.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                {invoices.length === 0 ? "No invoices yet" : "No invoices match the current filters."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    id={`invoice-${invoice.id}`}
                    className="flex flex-col gap-2 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors sm:flex-row sm:items-center sm:justify-between"
                    onClick={() => router.push(`/manager/finance/invoices?invoiceId=${invoice.id}`)}
                  >
                    {/* Left: info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {invoice.invoiceNumber || "Draft"}
                          </p>
                          <SourceChannelIcon channel={invoice.sourceChannel} />
                          <IngestionBadge ingestionStatus={invoice.ingestionStatus} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatDate(invoice.createdAt)}
                          {invoice.recipientName && ` · ${invoice.recipientName}`}
                        </p>
                      </div>
                    </div>

                    {/* Right: amount + status + actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <p className="text-base font-bold text-slate-800">
                        {formatCurrency(getInvoiceTotal(invoice))}
                      </p>
                      <Badge variant={invoiceVariant(invoice.status)} size="sm" className="whitespace-nowrap">
                        {invoice.status}
                      </Badge>

                      {/* Actions dropdown for incoming invoices */}
                      {!isOutgoing && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <ActionDropdown actions={[
                            ...(invoice.status === "ISSUED" || invoice.status === "DRAFT" ? [{
                              label: "✓ Approve",
                              onClick: () => actionRequest(invoice.id, "approve"),
                              className: "text-green-700 font-semibold",
                            }] : []),
                            ...(invoice.status === "APPROVED" ? [{
                              label: "💰 Mark as Paid",
                              onClick: () => actionRequest(invoice.id, "mark-paid"),
                              className: "text-green-700 font-semibold",
                            }] : []),
                            {
                              label: "📄 Download PDF",
                              onClick: () => window.open(`/api/invoices/${invoice.id}/pdf?includeQRBill=${includeQr}`, "_blank"),
                            },
                            ...(invoice.status === "ISSUED" || invoice.status === "DRAFT" || invoice.status === "APPROVED" ? [{
                              label: "⚠ Dispute",
                              onClick: () => actionRequest(invoice.id, "dispute"),
                              className: "text-rose-600",
                            }] : []),
                          ]} />
                        </div>
                      )}

                      {/* Read-only actions for outgoing */}
                      {isOutgoing && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <ActionDropdown actions={[
                            {
                              label: "📄 Download PDF",
                              onClick: () => window.open(`/api/invoices/${invoice.id}/pdf?includeQRBill=${includeQr}`, "_blank"),
                            },
                          ]} />
                        </div>
                      )}

                      <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Summary */}
          {!loading && filteredInvoices.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-1">
              <span>{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}</span>
              <span>
                Total: {formatCurrency(filteredInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0))}
              </span>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
