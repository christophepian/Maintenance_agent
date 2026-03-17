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

export default function OwnerInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [includeQr, setIncludeQr] = useState(true);

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
              <div className="space-y-4">
                {filteredInvoices.map((invoice) => (
                  <div key={invoice.id} className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm text-slate-500">
                          {invoice.invoiceNumber || "Draft"}
                        </div>
                        <div className="text-lg font-semibold text-slate-900">
                          {formatCurrency(getInvoiceTotal(invoice))}
                        </div>
                        <div className="text-xs text-slate-500">
                          Created {formatDate(invoice.createdAt)}
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-2 text-sm text-slate-700 sm:items-end">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                          {invoice.status}
                        </span>
                        <span className="text-xs text-slate-500">
                          Job <Link href="/owner/jobs" className="text-indigo-600 hover:underline">{invoice.jobId?.slice(0, 8)}</Link>
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
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
                ))}
              </div>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
