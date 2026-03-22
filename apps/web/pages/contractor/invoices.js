import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel.jsx";
import ContractorPicker from "../../components/ContractorPicker";
import { formatDate } from "../../lib/format";
import { authHeaders } from "../../lib/api";

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "ISSUED", label: "Issued" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "DISPUTED", label: "Disputed" },
];

const STATUS_COLORS = {
  DRAFT: "bg-gray-100 text-gray-700",
  ISSUED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  PAID: "bg-green-600 text-white",
  DISPUTED: "bg-red-100 text-red-700",
};

export default function ContractorInvoices() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);

  function toggleAccordion(id) { setExpandedId((prev) => (prev === id ? null : id)); }

  // Create invoice form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formJobId, setFormJobId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Auto-open form when jobId query param present
  useEffect(() => {
    if (router.query.jobId) {
      setFormJobId(router.query.jobId);
      setShowCreateForm(true);
    }
  }, [router.query.jobId]);

  useEffect(() => {
    if (router.query.status) setActiveTab(router.query.status);
  }, [router.query.status]);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError("");
    try {
      const contractorId = localStorage.getItem("contractorId");
      const url = contractorId
        ? `/api/contractor/invoices?contractorId=${contractorId}`
        : "/api/invoices";
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      setInvoices(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const submitInvoice = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    if (!formJobId) { setFormError("Job ID is required"); return; }
    if (!formAmount || isNaN(Number(formAmount)) || Number(formAmount) <= 0) {
      setFormError("Please enter a valid amount (CHF)");
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          jobId: formJobId,
          amount: Number(formAmount),
          description: formDescription || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to create invoice (${res.status})`);
      }
      setFormSuccess("Invoice created successfully!");
      setFormAmount("");
      setFormDescription("");
      setShowCreateForm(false);
      if (router.query.jobId) {
        router.replace("/contractor/invoices", undefined, { shallow: true });
      }
      await fetchInvoices();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    if (activeTab === "ALL") return invoices;
    return invoices.filter((inv) => inv.status === activeTab);
  }, [invoices, activeTab]);

  return (
    <AppShell role="CONTRACTOR">
      <PageShell>
        <PageHeader
          title="My Invoices"
          actions={
            <div className="flex items-center gap-2">
              <ContractorPicker onSelect={() => fetchInvoices()} />
              {!showCreateForm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  + Create Invoice
                </button>
              )}
            </div>
          }
        />
        <PageContent>

        {showCreateForm && (
          <div className="mb-6 rounded-lg border-2 border-indigo-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Invoice</h3>
              <button
                onClick={() => { setShowCreateForm(false); setFormError(""); setFormSuccess(""); }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                ✕ Close
              </button>
            </div>
            {formError && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</div>
            )}
            <form onSubmit={submitInvoice} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Job ID</label>
                <input
                  type="text"
                  value={formJobId}
                  onChange={(e) => setFormJobId(e.target.value)}
                  readOnly={!!router.query.jobId}
                  placeholder="Job UUID"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={router.query.jobId ? { backgroundColor: "#f3f4f6", cursor: "not-allowed" } : {}}
                  required
                />
                {router.query.jobId && (
                  <p className="mt-1 text-xs text-gray-500">Pre-filled from job detail page</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount (CHF)</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  max="100000"
                  step="0.01"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description (optional)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of work performed"
                  maxLength={500}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={formSubmitting}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {formSubmitting ? "Submitting…" : "Submit Invoice"}
              </button>
            </form>
          </div>
        )}

        {formSuccess && (
          <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {formSuccess}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
            <button onClick={() => setError("")} style={{ marginLeft: 12, fontSize: "0.85em" }}>Dismiss</button>
          </div>
        )}

        <Panel bodyClassName="p-0">
          {/* Status Tabs */}
          <div className="tab-strip">
            {STATUS_TABS.map((tab) => {
              const count = tab.key === "ALL"
                ? invoices.length
                : invoices.filter((inv) => inv.status === tab.key).length;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={active ? "tab-btn-active" : "tab-btn"}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <p className="loading-text">Loading invoices…</p>
          ) : filteredInvoices.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">No invoices match this filter</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-4">
            {filteredInvoices.map((invoice) => {
              const isExpanded = expandedId === invoice.id;
              return (
                <div key={invoice.id} className="rounded-lg border border-gray-200 bg-white">
                  {/* Clickable header */}
                  <div
                    className="flex cursor-pointer items-center justify-between px-5 py-3 hover:bg-gray-50"
                    onClick={() => toggleAccordion(invoice.id)}
                  >
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-gray-900">
                        Invoice {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : `#${invoice.id.slice(0, 8)}`}
                      </p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[invoice.status] || "bg-gray-100 text-gray-700"}`}>
                        {invoice.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-base font-bold text-gray-900">
                        CHF {invoice.totalAmount ?? invoice.amount ?? (invoice.totalAmountCents ? (invoice.totalAmountCents / 100).toFixed(2) : "—")}
                      </p>
                      <svg
                        className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      {invoice.description && (
                        <p className="mb-3 text-sm text-gray-700">{invoice.description}</p>
                      )}

                      <p className="mb-3 text-xs text-gray-500">
                        Job:{" "}
                        <Link
                          href={`/contractor/jobs/${invoice.jobId}`}
                          className="text-indigo-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {invoice.jobId.slice(0, 8)}
                        </Link>
                      </p>

                      <div className="mb-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`/api/invoices/${invoice.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border border-gray-300 bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                          style={{ textDecoration: "none" }}
                        >
                          📄 Download PDF
                        </a>
                        <a
                          href={`/api/invoices/${invoice.id}/qr-code.png`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border border-gray-300 bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                          style={{ textDecoration: "none" }}
                        >
                          📱 QR Code
                        </a>
                      </div>

                      <div className="space-y-1 text-xs text-gray-500">
                        <p>Submitted: {invoice.submittedAt ? formatDate(invoice.submittedAt) : "Pending"}</p>
                        {invoice.approvedAt && <p>Approved: {formatDate(invoice.approvedAt)}</p>}
                        {invoice.paidAt && <p className="font-semibold text-green-700">Paid: {formatDate(invoice.paidAt)}</p>}
                      </div>

                      {invoice.status === "DISPUTED" && (
                        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3">
                          <p className="text-sm font-medium text-red-800">⚠️ This invoice is under dispute</p>
                          <p className="mt-1 text-xs text-red-700">Please contact the property owner to resolve</p>
                        </div>
                      )}
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
