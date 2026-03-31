import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import { ownerAuthHeaders } from "../../lib/api";

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

const STATUS_COLORS = {
  DRAFT: "bg-slate-100 text-slate-600",
  ISSUED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  PAID: "bg-emerald-100 text-emerald-700",
  DISPUTED: "bg-rose-100 text-rose-700",
};

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
const INGESTION_CLS = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  AUTO_CONFIRMED: "bg-green-100 text-green-700",
  CONFIRMED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

function IngestionBadge({ ingestionStatus }) {
  if (!ingestionStatus) return null;
  return (
    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ml-1.5 " + (INGESTION_CLS[ingestionStatus] || "bg-slate-100 text-slate-600")}>
      {INGESTION_LABEL[ingestionStatus] || ingestionStatus}
    </span>
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

  useEffect(() => { fetchInvoices(); }, []);

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
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <button onClick={() => setError("")} className="ml-3 text-xs text-red-500 hover:text-red-700">Dismiss</button>
            </div>
          )}

          {/* Approval queue banner */}
          {approvalCount > 0 && direction === "incoming" && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-lg">⚡</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">{approvalCount} invoice{approvalCount !== 1 ? "s" : ""} awaiting your approval</p>
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
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors " +
                  (direction === tab.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700")
                }
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-start gap-3">
            <div className="flex flex-col items-center justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">Status</label>
              <select value={activeTab} onChange={(e) => setActiveTab(e.target.value)}
                className="min-h-[36px] appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {STATUS_TABS.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div className="flex flex-col justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            {(activeTab !== "ALL" || dateFrom || dateTo) && (
              <div className="flex flex-col justify-end gap-1">
                <span className="text-xs opacity-0 select-none">x</span>
                <button onClick={() => { setActiveTab("ALL"); setDateFrom(""); setDateTo(""); }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:bg-slate-50">
                  Clear
                </button>
              </div>
            )}
          </div>

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
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/manager/finance/invoices/${invoice.id}`)}
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
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[invoice.status] || "bg-slate-100 text-slate-600"}`}>
                        {invoice.status}
                      </span>

                      {/* Actions dropdown for incoming invoices */}
                      {!isOutgoing && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <ActionDropdown actions={[
                            ...(invoice.status === "ISSUED" || invoice.status === "DRAFT" ? [{
                              label: "✓ Approve",
                              onClick: () => actionRequest(invoice.id, "approve"),
                              className: "text-emerald-700 font-semibold",
                            }] : []),
                            ...(invoice.status === "APPROVED" ? [{
                              label: "💰 Mark as Paid",
                              onClick: () => actionRequest(invoice.id, "mark-paid"),
                              className: "text-emerald-700 font-semibold",
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
