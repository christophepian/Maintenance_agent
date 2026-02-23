import { useState, useEffect } from 'react';
import AppShell from "../../components/AppShell";

export default function OwnerInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      setInvoices(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const approveInvoice = async (invoiceId) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to approve invoice');
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  const markPaid = async (invoiceId) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to mark invoice as paid');
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  const disputeInvoice = async (invoiceId) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to dispute invoice');
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      APPROVED: 'bg-green-100 text-green-800',
      PAID: 'bg-green-600 text-white',
      DISPUTED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredInvoices = filter === 'ALL' 
    ? invoices 
    : invoices.filter(i => i.status === filter);

  return (
    <AppShell role="OWNER">
      <div style={{ maxWidth: "1200px" }}>
        <div className="flex justify-between items-center mb-6">
          <h1 style={{ marginTop: 0, marginBottom: 0 }}>Invoices</h1>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded bg-white"
          >
            <option value="ALL">All Invoices ({invoices.length})</option>
            <option value="DRAFT">Draft ({invoices.filter(i => i.status === 'DRAFT').length})</option>
            <option value="APPROVED">Approved ({invoices.filter(i => i.status === 'APPROVED').length})</option>
            <option value="PAID">Paid ({invoices.filter(i => i.status === 'PAID').length})</option>
            <option value="DISPUTED">Disputed ({invoices.filter(i => i.status === 'DISPUTED').length})</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-600">Loading invoices...</p>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
            <p className="text-gray-600">
              {filter === 'ALL' ? 'No invoices yet' : `No ${filter.toLowerCase()} invoices`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Invoice #{invoice.id.slice(0, 8)}</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      CHF {invoice.totalAmount ?? invoice.amount}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Job: {invoice.jobId.slice(0, 8)}</p>
                  </div>
                </div>

                {invoice.description && (
                  <p className="text-gray-700 mb-4">{invoice.description}</p>
                )}

                <div className="pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1 mb-4">
                  <p>Submitted: {invoice.submittedAt ? new Date(invoice.submittedAt).toLocaleDateString() : 'Pending'}</p>
                  {invoice.approvedAt && <p>Approved: {new Date(invoice.approvedAt).toLocaleDateString()}</p>}
                  {invoice.paidAt && <p className="font-semibold text-green-700">Paid: {new Date(invoice.paidAt).toLocaleDateString()}</p>}
                </div>

                {invoice.status === 'DRAFT' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveInvoice(invoice.id)}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    >
                      Approve Invoice
                    </button>
                    <button
                      onClick={() => disputeInvoice(invoice.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      Dispute
                    </button>
                  </div>
                )}

                {invoice.status === 'APPROVED' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => markPaid(invoice.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Mark as Paid
                    </button>
                    <button
                      onClick={() => disputeInvoice(invoice.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      Dispute
                    </button>
                  </div>
                )}

                {invoice.status === 'DISPUTED' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-800 font-medium">⚠️ This invoice is under dispute</p>
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
