import { useState, useEffect } from 'react';
import AppShell from "../../components/AppShell";

export default function ContractorJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [actualCost, setActualCost] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const startJob = async (jobId) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });
      if (!res.ok) throw new Error('Failed to start job');
      await fetchJobs();
      setSelectedJob(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const completeJob = async (jobId) => {
    if (!actualCost || isNaN(actualCost)) {
      setError('Please enter actual cost');
      return;
    }
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          actualCost: parseInt(actualCost),
        }),
      });
      if (!res.ok) throw new Error('Failed to complete job');
      await fetchJobs();
      setSelectedJob(null);
      setActualCost('');
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      INVOICED: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <AppShell role="CONTRACTOR">
      <div style={{ maxWidth: "1200px" }}>
        <h1 style={{ marginTop: 0, marginBottom: '24px' }}>My Jobs</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-600">Loading jobs...</p>
        ) : jobs.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
            <p className="text-gray-600">No jobs assigned yet</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Job #{job.id.slice(0, 8)}</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    {job.actualCost && <p className="font-semibold text-lg">CHF {job.actualCost}</p>}
                  </div>
                </div>

                {/* Request Details */}
                {job.request && (
                  <div className="mb-4 p-4 bg-gray-50 rounded border border-gray-200">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Request Details</h4>
                    <p className="text-gray-800 mb-2">{job.request.description}</p>
                    {job.request.category && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Category:</span> {job.request.category}
                      </p>
                    )}
                  </div>
                )}

                {/* Location & Contact */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {job.request?.unit && (
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <h4 className="font-semibold text-sm text-blue-900 mb-1">📍 Location</h4>
                      <p className="text-sm text-blue-800">{job.request.unit.building.name}</p>
                      <p className="text-sm text-blue-700">{job.request.unit.building.address}</p>
                      <p className="text-sm text-blue-700 font-medium">Unit {job.request.unit.unitNumber}</p>
                    </div>
                  )}
                  
                  {job.request?.tenant && (
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                      <h4 className="font-semibold text-sm text-green-900 mb-1">👤 Tenant Contact</h4>
                      {job.request.tenant.name && <p className="text-sm text-green-800 font-medium">{job.request.tenant.name}</p>}
                      <p className="text-sm text-green-700">📞 {job.request.tenant.phone}</p>
                      {job.request.tenant.email && <p className="text-sm text-green-700">✉️ {job.request.tenant.email}</p>}
                    </div>
                  )}
                </div>

                {job.request?.appliance && (
                  <div className="mb-4 p-3 bg-amber-50 rounded border border-amber-200">
                    <h4 className="font-semibold text-sm text-amber-900 mb-1">🔧 Appliance</h4>
                    <p className="text-sm text-amber-800">
                      {job.request.appliance.category}
                      {job.request.appliance.serial && ` (Serial: ${job.request.appliance.serial})`}
                    </p>
                  </div>
                )}

                {selectedJob === job.id ? (
                  <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
                    {job.status === 'PENDING' && (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-700">Ready to start this job?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startJob(job.id)}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Start Job
                          </button>
                          <button
                            onClick={() => setSelectedJob(null)}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {job.status === 'IN_PROGRESS' && (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-700">Complete this job and submit invoice:</p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Actual cost (CHF)"
                            value={actualCost}
                            onChange={(e) => setActualCost(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded"
                          />
                          <button
                            onClick={() => completeJob(job.id)}
                            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 whitespace-nowrap"
                          >
                            Complete Job
                          </button>
                          <button
                            onClick={() => {
                              setSelectedJob(null);
                              setActualCost('');
                            }}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4">
                    {job.status === 'PENDING' && (
                      <button
                        onClick={() => setSelectedJob(job.id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Start Job
                      </button>
                    )}
                    {job.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => setSelectedJob(job.id)}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >
                        Complete Job
                      </button>
                    )}
                    {(job.status === 'COMPLETED' || job.status === 'INVOICED') && (
                      <p className="text-sm text-gray-600">
                        {job.status === 'COMPLETED' ? 'Completed - Invoice pending' : 'Invoiced'}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                  <p>Created: {new Date(job.createdAt).toLocaleDateString()}</p>
                  {job.startedAt && <p>Started: {new Date(job.startedAt).toLocaleDateString()}</p>}
                  {job.completedAt && <p>Completed: {new Date(job.completedAt).toLocaleDateString()}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
