import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { ownerAuthHeaders } from "../../lib/api";
import Badge from "../../components/ui/Badge";
import { invoiceVariant } from "../../lib/statusVariants";

import { cn } from "../../lib/utils";
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

export default function OwnerFinance() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [includeQr, setIncludeQr] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function toggleAccordion(id) { setExpandedId((prev) => (prev === id ? null : id)); }

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
      if (!res.ok) throw new Error(`Failed to ${action} invoice`);
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (filter !== "ALL" && invoice.status !== filter) return false;
      if (dateFrom && invoice.createdAt < dateFrom) return false;
      if (dateTo && invoice.createdAt > dateTo + "T23:59:59") return false;
      return true;
    });
  }, [filter, dateFrom, dateTo, invoices]);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Finance"
          subtitle="Review, approve, and manage invoice payments"
          actions={
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={includeQr} onChange={(e) => setIncludeQr(e.target.checked)} />
              Include QR in PDF
            </label>
          }
        />

        <PageContent>
          <ErrorBanner error={error} className="text-sm" />

          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-start gap-3">
            <div className="flex flex-col items-center justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">Status</label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}
                className="min-h-[36px] appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ISSUED">Issued</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
                <option value="DISPUTED">Disputed</option>
              </select>
            </div>
            <div className="flex flex-col justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex flex-col justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {(filter !== "ALL" || dateFrom || dateTo) && (
              <div className="flex flex-col justify-end gap-1">
                <span className="text-xs opacity-0 select-none">x</span>
                <button onClick={() => { setFilter("ALL"); setDateFrom(""); setDateTo(""); }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:bg-slate-50">
                  Clear
                </button>
              </div>
            )}
          </div>

          <Panel>
            {loading ? (
              <p className="text-sm text-slate-600">Loading invoices...</p>
            ) : filteredInvoices.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                {invoices.length === 0 ? "No invoices yet" : "No results match the current filters."}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredInvoices.map((invoice) => {
                  const isExpanded = expandedId === invoice.id;
                  return (
                    <div key={invoice.id} className="rounded-lg border border-slate-200 bg-white">
                      <div
                        className="flex cursor-pointer flex-col gap-2 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                        onClick={() => toggleAccordion(invoice.id)}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {invoice.invoiceNumber || "Draft"}
                            </p>
                            <p className="text-xs text-slate-500">Created {formatDate(invoice.createdAt)}</p>
                          </div>
                          <p className="text-base font-bold text-slate-800">
                            {formatCurrency(getInvoiceTotal(invoice))}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 justify-end">
                          <Badge variant={invoiceVariant(invoice.status)} size="sm">
                            {invoice.status}
                          </Badge>
                          <svg
                            className={cn("h-4 w-4 text-slate-400 transition-transform", isExpanded ? "rotate-90" : "")}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-100 px-4 py-3">
                          <p className="mb-3 text-xs text-slate-500">
                            Job{" "}
                            <Link href="/owner/jobs" className="cell-link" onClick={(e) => e.stopPropagation()}>
                              {invoice.jobId?.slice(0, 8)}
                            </Link>
                          </p>
                          <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => window.open(`/api/invoices/${invoice.id}/pdf?includeQRBill=${includeQr}`, "_blank")}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View PDF
                            </button>
                            <button
                              onClick={() => window.open(`/api/invoices/${invoice.id}/qr-code.png`, "_blank")}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View QR
                            </button>
                            {invoice.status === "DRAFT" && (
                              <button
                                onClick={() => actionRequest(invoice.id, "approve")}
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                              >
                                Approve
                              </button>
                            )}
                            {invoice.status === "APPROVED" && (
                              <button
                                onClick={() => actionRequest(invoice.id, "mark-paid")}
                                className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800"
                              >
                                Mark paid
                              </button>
                            )}
                            {(invoice.status === "DRAFT" || invoice.status === "APPROVED") && (
                              <button
                                onClick={() => actionRequest(invoice.id, "dispute")}
                                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                              >
                                Dispute
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
