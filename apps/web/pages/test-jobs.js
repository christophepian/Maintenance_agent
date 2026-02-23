import { useState, useEffect } from 'react';
import AppShell from '../components/AppShell';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001';

function TestJobsAndInvoices() {
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [log, setLog] = useState([]);

  const addLog = (msg) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Fetch requests
  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/requests');
      const data = await res.json();
      setRequests(data.data || []);
      addLog(`✓ Fetched ${(data.data || []).length} requests`);
    } catch (err) {
      setError(err.message);
      addLog(`✗ Error fetching requests: ${err.message}`);
    }
    setLoading(false);
  };

  // Fetch jobs
  const fetchJobs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data.data || []);
      addLog(`✓ Fetched ${(data.data || []).length} jobs`);
    } catch (err) {
      setError(err.message);
      addLog(`✗ Error fetching jobs: ${err.message}`);
    }
    setLoading(false);
  };

  // Fetch invoices
  const fetchInvoices = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      setInvoices(data.data || []);
      addLog(`✓ Fetched ${(data.data || []).length} invoices`);
    } catch (err) {
      setError(err.message);
      addLog(`✗ Error fetching invoices: ${err.message}`);
    }
    setLoading(false);
  };

  // Approve request (owner approval)
  const approveRequest = async () => {
    if (!selectedRequestId) {
      setError('Please select a request');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/requests/${selectedRequestId}/owner-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      console.log('Owner approve response:', { status: res.status, data });
      if (!res.ok) {
        const errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data);
        throw new Error(errorMsg || 'Failed to approve request');
      }
      addLog(`✓ Request ${selectedRequestId.slice(0, 8)}... approved`);
      await Promise.all([fetchRequests(), fetchJobs()]);
    } catch (err) {
      console.error('Approve request error:', err);
      const errorMsg = err.message || String(err);
      setError(errorMsg);
      addLog(`✗ Error approving request: ${errorMsg}`);
    }
    setLoading(false);
  };

  // Update job status to IN_PROGRESS
  const startJob = async () => {
    if (!selectedJobId) {
      setError('Please select a job');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/jobs/${selectedJobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start job');
      }
      addLog(`✓ Job ${selectedJobId.slice(0, 8)}... started`);
      await fetchJobs();
    } catch (err) {
      setError(err.message);
      addLog(`✗ Error starting job: ${err.message}`);
    }
    setLoading(false);
  };

  // Complete job (creates invoice automatically)
  const completeJob = async () => {
    if (!selectedJobId) {
      setError('Please select a job');
      return;
    }
    if (!actualCost || isNaN(actualCost)) {
      setError('Please enter actual cost');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/jobs/${selectedJobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          actualCost: parseInt(actualCost),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete job');
      }
      addLog(`✓ Job ${selectedJobId.slice(0, 8)}... completed with cost CHF ${actualCost}`);
      setActualCost('');
      await Promise.all([fetchJobs(), fetchInvoices()]);
    } catch (err) {
      setError(err.message);
      addLog(`✗ Error completing job: ${err.message}`);
    }
    setLoading(false);
  };

  // Approve invoice
  const approveInvoice = async () => {
    if (!selectedInvoiceId) {
      setError('Please select an invoice');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${selectedInvoiceId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve invoice');
      }
      addLog(`✓ Invoice ${selectedInvoiceId.slice(0, 8)}... approved`);
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
      addLog(`✗ Error approving invoice: ${err.message}`);
    }
    setLoading(false);
  };

  // Mark invoice paid
  const markInvoicePaid = async () => {
    if (!selectedInvoiceId) {
      setError('Please select an invoice');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${selectedInvoiceId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to mark invoice as paid');
      }
      addLog(`✓ Invoice ${selectedInvoiceId.slice(0, 8)}... marked as paid`);
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
      addLog(`✗ Error marking invoice as paid: ${err.message}`);
    }
    setLoading(false);
  };

  // Dispute invoice
  const disputeInvoice = async () => {
    if (!selectedInvoiceId) {
      setError('Please select an invoice');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${selectedInvoiceId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispute invoice');
      }
      addLog(`✓ Invoice ${selectedInvoiceId.slice(0, 8)}... disputed`);
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
      addLog(`✗ Error disputing invoice: ${err.message}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const getStatusColor = (status) => {
    const colors = {
      PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
      AUTO_APPROVED: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      PENDING_OWNER_APPROVAL: 'bg-orange-100 text-orange-800',
      PENDING: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      INVOICED: 'bg-purple-100 text-purple-800',
      DRAFT: 'bg-gray-100 text-gray-800',
      APPROVED: 'bg-green-100 text-green-800',
      PAID: 'bg-green-100 text-green-800',
      DISPUTED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Job & Invoice Testing</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-8">
          {/* REQUESTS PANEL */}
          <div className="bg-white rounded shadow p-6">
            <h2 className="text-xl font-bold mb-4">1. Requests</h2>
            <button
              onClick={fetchRequests}
              disabled={loading}
              className="w-full mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Refresh Requests
            </button>
            <select
              value={selectedRequestId}
              onChange={(e) => setSelectedRequestId(e.target.value)}
              className="w-full mb-4 p-2 border rounded"
            >
              <option value="">Select a request...</option>
              {requests.map((req) => (
                <option key={req.id} value={req.id}>
                  {req.description.slice(0, 20)}... ({req.status})
                </option>
              ))}
            </select>
            {selectedRequestId && (
              <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
                <p className="font-mono">
                  {requests.find((r) => r.id === selectedRequestId)?.category}
                </p>
              </div>
            )}
            <button
              onClick={approveRequest}
              disabled={loading || !selectedRequestId}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              Owner Approve Request
            </button>
          </div>

          {/* JOBS PANEL */}
          <div className="bg-white rounded shadow p-6">
            <h2 className="text-xl font-bold mb-4">2. Jobs</h2>
            <button
              onClick={fetchJobs}
              disabled={loading}
              className="w-full mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Refresh Jobs
            </button>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full mb-4 p-2 border rounded"
            >
              <option value="">Select a job...</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.id.slice(0, 8)}... ({job.status})
                </option>
              ))}
            </select>
            <div className="space-y-2 mb-4">
              <button
                onClick={startJob}
                disabled={loading || !selectedJobId}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
              >
                Start Job
              </button>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Actual cost (CHF)"
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value)}
                  className="flex-1 px-2 py-2 border rounded text-sm"
                />
                <button
                  onClick={completeJob}
                  disabled={loading || !selectedJobId || !actualCost}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  Complete
                </button>
              </div>
            </div>
          </div>

          {/* INVOICES PANEL */}
          <div className="bg-white rounded shadow p-6">
            <h2 className="text-xl font-bold mb-4">3. Invoices</h2>
            <button
              onClick={fetchInvoices}
              disabled={loading}
              className="w-full mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Refresh Invoices
            </button>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="w-full mb-4 p-2 border rounded"
            >
              <option value="">Select an invoice...</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  CHF {inv.totalAmount ?? inv.amount} ({inv.status})
                </option>
              ))}
            </select>
            <div className="space-y-2">
              <button
                onClick={approveInvoice}
                disabled={loading || !selectedInvoiceId}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
              >
                Approve Invoice
              </button>
              <button
                onClick={markInvoicePaid}
                disabled={loading || !selectedInvoiceId}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
              >
                Mark Paid
              </button>
              <button
                onClick={disputeInvoice}
                disabled={loading || !selectedInvoiceId}
                className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm"
              >
                Dispute
              </button>
            </div>
          </div>
        </div>

        {/* LOG PANEL */}
        <div className="bg-white rounded shadow p-6 mt-8">
          <h2 className="text-xl font-bold mb-4">Activity Log</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-48 overflow-y-auto">
            {log.length === 0 ? (
              <p>No activity yet...</p>
            ) : (
              log.map((entry, idx) => (
                <div key={idx}>{entry}</div>
              ))
            )}
          </div>
          <button
            onClick={() => setLog([])}
            className="mt-2 px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
          >
            Clear Log
          </button>
        </div>

        {/* DATA DISPLAY */}
        <div className="grid grid-cols-3 gap-8 mt-8">
          {/* Requests */}
          <div className="bg-white rounded shadow p-6">
            <h3 className="font-bold mb-4">Requests ({requests.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto text-sm">
              {requests.map((req) => (
                <div key={req.id} className="p-2 bg-gray-50 rounded">
                  <p className="font-mono text-xs">{req.id.slice(0, 8)}</p>
                  <p className="truncate">{req.description.slice(0, 30)}</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs mt-1 ${getStatusColor(req.status)}`}>
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Jobs */}
          <div className="bg-white rounded shadow p-6">
            <h3 className="font-bold mb-4">Jobs ({jobs.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto text-sm">
              {jobs.map((job) => (
                <div key={job.id} className="p-2 bg-gray-50 rounded">
                  <p className="font-mono text-xs">{job.id.slice(0, 8)}</p>
                  {job.request && (
                    <>
                      <p className="text-xs truncate">{job.request.description.slice(0, 40)}...</p>
                      {job.request.unit && (
                        <p className="text-xs text-blue-700">
                          📍 {job.request.unit.building.name}, Unit {job.request.unit.unitNumber}
                        </p>
                      )}
                      {job.request.tenant && (
                        <p className="text-xs text-green-700">
                          👤 {job.request.tenant.phone}
                        </p>
                      )}
                    </>
                  )}
                  <p className="text-xs">Cost: CHF {job.actualCost || 'TBD'}</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs mt-1 ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-white rounded shadow p-6">
            <h3 className="font-bold mb-4">Invoices ({invoices.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto text-sm">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-2 bg-gray-50 rounded">
                  <p className="font-mono text-xs">{inv.id.slice(0, 8)}</p>
                  <p className="text-xs">CHF {inv.totalAmount ?? inv.amount}</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs mt-1 ${getStatusColor(inv.status)}`}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AppShell>
      <TestJobsAndInvoices />
    </AppShell>
  );
}
