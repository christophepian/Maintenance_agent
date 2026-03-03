import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import AppShell from "../../components/AppShell";
import ContractorPicker from "../../components/ContractorPicker";
import { formatDate } from "../../lib/format";

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "ISSUED", label: "Issued" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "DISPUTED", label: "Disputed" },
];

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ContractorInvoices() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

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
                    <p className="text-sm text-gray-600 mt-1">Job: {invoice.jobId.slice(0, 8)}</p>
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
