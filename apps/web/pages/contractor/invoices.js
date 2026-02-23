import { useState, useEffect } from 'react';
import AppShell from "../../components/AppShell";

export default function ContractorInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const getStatusColor = (status) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
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

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-600">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
            <p className="text-gray-600">No invoices yet</p>
            <p className="text-sm text-gray-500 mt-2">Invoices are created automatically when you complete a job</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {invoices.map((invoice) => (
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

                <div className="pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                  <p>Submitted: {invoice.submittedAt ? new Date(invoice.submittedAt).toLocaleDateString() : 'Pending'}</p>
                  {invoice.approvedAt && <p>Approved: {new Date(invoice.approvedAt).toLocaleDateString()}</p>}
                  {invoice.paidAt && <p className="font-semibold text-green-700">Paid: {new Date(invoice.paidAt).toLocaleDateString()}</p>}
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
