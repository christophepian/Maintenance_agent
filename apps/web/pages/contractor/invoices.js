import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AppShell from "../../components/AppShell";
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
export default function ContractorInvoices() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

  // Create invoice form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formJobId, setFormJobId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

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
    setError('');
    try {
      // Use contractor-scoped endpoint for security (falls back to /api/invoices if no contractorId)
      const contractorId = localStorage.getItem("contractorId");
      const url = contractorId
        ? `/api/contractor/invoices?contractorId=${contractorId}`
        : '/api/invoices';
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
    setFormError('');
    setFormSuccess('');
    if (!formJobId) { setFormError('Job ID is required'); return; }
    if (!formAmount || isNaN(Number(formAmount)) || Number(formAmount) <= 0) {
      setFormError('Please enter a valid amount (CHF)');
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
      setFormSuccess('Invoice created successfully!');
      setFormAmount('');
      setFormDescription('');
      setShowCreateForm(false);
      // Remove jobId from URL without reload
      if (router.query.jobId) {
        router.replace('/contractor/invoices', undefined, { shallow: true });
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

  const getStatusColor = (status) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ISSUED: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      PAID: 'bg-green-600 text-white',
      DISPUTED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <AppShell role="CONTRACTOR">
      <div style={{ maxWidth: "1200px" }}>
        <h1 style={{ marginTop: 0, marginBottom: '24px' }}>My Invoices</h1>

        <ContractorPicker onSelect={() => fetchInvoices()} />

        {/* Create Invoice Form */}
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="mb-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm"
          >
            + Create Invoice
          </button>
        )}

        {showCreateForm && (
          <div className="mb-6 p-5 bg-white border-2 border-indigo-200 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create Invoice</h3>
              <button
                onClick={() => { setShowCreateForm(false); setFormError(''); setFormSuccess(''); }}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕ Close
              </button>
            </div>
            {formError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">{formError}</div>
            )}
            <form onSubmit={submitInvoice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job ID</label>
                <input
                  type="text"
                  value={formJobId}
                  onChange={(e) => setFormJobId(e.target.value)}
                  readOnly={!!router.query.jobId}
                  placeholder="Job UUID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={router.query.jobId ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
                  required
                />
                {router.query.jobId && (
                  <p className="mt-1 text-xs text-gray-500">Pre-filled from job detail page</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (CHF)</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  max="100000"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of work performed"
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={formSubmitting}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50"
              >
                {formSubmitting ? 'Submitting…' : 'Submit Invoice'}
              </button>
            </form>
          </div>
        )}

        {formSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
            {formSuccess}
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
            {error}
            <button onClick={() => setError('')} style={{ marginLeft: 12, fontSize: "0.85em" }}>Dismiss</button>
          </div>
        )}

        {/* Status Tabs */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
          {STATUS_TABS.map((tab) => {
            const count = tab.key === "ALL"
              ? invoices.length
              : invoices.filter((inv) => inv.status === tab.key).length;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: "0.85em", fontWeight: active ? 700 : 400,
                  border: active ? "2px solid #0b3a75" : "1px solid #ccc",
                  backgroundColor: active ? "#e3f2fd" : "#fff",
                  color: active ? "#0b3a75" : "#333", cursor: "pointer",
                }}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-gray-600">Loading invoices...</p>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
            <p className="text-gray-600">No invoices match this filter</p>
            <p className="text-sm text-gray-500 mt-2">Invoices are created automatically when you complete a job</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Invoice {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : `#${invoice.id.slice(0, 8)}`}
                    </h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      CHF {invoice.totalAmount ?? invoice.amount ?? (invoice.totalAmountCents ? (invoice.totalAmountCents / 100).toFixed(2) : "—")}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Job: <Link href={`/contractor/jobs/${invoice.jobId}`} className="text-indigo-600 hover:underline">{invoice.jobId.slice(0, 8)}</Link>
                    </p>
                  </div>
                </div>

                {invoice.description && (
                  <p className="text-gray-700 mb-4">{invoice.description}</p>
                )}

                {/* Download links */}
                <div className="flex gap-2 mb-4">
                  <a
                    href={`/api/invoices/${invoice.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 text-sm hover:bg-gray-200"
                    style={{ textDecoration: "none" }}
                  >
                    📄 Download PDF
                  </a>
                  <a
                    href={`/api/invoices/${invoice.id}/qr-code.png`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 text-sm hover:bg-gray-200"
                    style={{ textDecoration: "none" }}
                  >
                    📱 QR Code
                  </a>
                </div>

                <div className="pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                  <p>Submitted: {invoice.submittedAt ? formatDate(invoice.submittedAt) : 'Pending'}</p>
                  {invoice.approvedAt && <p>Approved: {formatDate(invoice.approvedAt)}</p>}
                  {invoice.paidAt && <p className="font-semibold text-green-700">Paid: {formatDate(invoice.paidAt)}</p>}
                </div>

                {invoice.status === 'DISPUTED' && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-800 font-medium">⚠️ This invoice is under dispute</p>
                    <p className="text-xs text-red-700 mt-1">Please contact the property owner to resolve</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
