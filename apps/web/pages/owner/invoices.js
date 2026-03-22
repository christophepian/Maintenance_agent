import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import { ownerAuthHeaders } from "../../lib/api";

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

const STATUS_COLORS = {
  DRAFT: "bg-slate-100 text-slate-600",
  ISSUED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  PAID: "bg-emerald-100 text-emerald-700",
  DISPUTED: "bg-rose-100 text-rose-700",
};

export default function OwnerInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [includeQr, setIncludeQr] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  function toggleAccordion(id) { setExpandedId((prev) => (prev === id ? null : id)); }

  useEffect(() => {
    fetchInvoices();
  }, []);

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
    return filter === "ALL"
      ? invoices
      : invoices.filter((invoice) => invoice.status === filter);
  }, [filter, invoices]);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Owner Invoices"
          subtitle="Review, approve, and manage invoice payments"
          actions={
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={includeQr}
                  onChange={(e) => setIncludeQr(e.target.checked)}
                />
                Include QR in PDF
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="ALL">All Invoices ({invoices.length})</option>
                <option value="DRAFT">Draft ({invoices.filter((i) => i.status === "DRAFT").length})</option>
                <option value="ISSUED">Issued ({invoices.filter((i) => i.status === "ISSUED").length})</option>
                <option value="APPROVED">Approved ({invoices.filter((i) => i.status === "APPROVED").length})</option>
                <option value="PAID">Paid ({invoices.filter((i) => i.status === "PAID").length})</option>
                <option value="DISPUTED">Disputed ({invoices.filter((i) => i.status === "DISPUTED").length})</option>
              </select>
            </div>
          }
        />

        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Panel>
            {loading ? (
              <p className="text-sm text-slate-600">Loading invoices...</p>
            ) : filteredInvoices.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                {filter === "ALL" ? "No invoices yet" : `No ${filter.toLowerCase()} invoices`}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredInvoices.map((invoice) => {
                  const isExpanded = expandedId === invoice.id;
                  return (
                    <div key={invoice.id} className="rounded-lg border border-slate-200 bg-white">
                      {/* Clickable header */}
                      <div
                        className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-slate-50"
                        onClick={() => toggleAccordion(invoice.id)}
                      >
                        <div className="flex items-center gap-4">
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
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[invoice.status] || "bg-slate-100 text-slate-600"}`}>
                            {invoice.status}
                          </span>
                          <svg
                            className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 px-4 py-3">
                          <p className="mb-3 text-xs text-slate-500">
                            Job{" "}
                            <Link href="/owner/jobs" className="text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
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
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                            )}
                            {invoice.status === "APPROVED" && (
                              <button
                                onClick={() => actionRequest(invoice.id, "mark-paid")}
                                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
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
