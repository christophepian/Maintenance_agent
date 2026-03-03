import { useState, useEffect } from 'react';
import AppShell from "../../components/AppShell";
import { formatDate } from "../../lib/format";

export default function OwnerJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

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

  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      INVOICED: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredJobs = filter === 'ALL' 
    ? jobs 
    : jobs.filter(j => j.status === filter);

  return (
    <AppShell role="OWNER">
      <div style={{ maxWidth: "1200px" }}>
        <div className="flex justify-between items-center mb-6">
          <h1 style={{ marginTop: 0, marginBottom: 0 }}>Jobs Overview</h1>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded bg-white"
          >
            <option value="ALL">All Jobs ({jobs.length})</option>
            <option value="PENDING">Pending ({jobs.filter(j => j.status === 'PENDING').length})</option>
            <option value="IN_PROGRESS">In Progress ({jobs.filter(j => j.status === 'IN_PROGRESS').length})</option>
            <option value="COMPLETED">Completed ({jobs.filter(j => j.status === 'COMPLETED').length})</option>
            <option value="INVOICED">Invoiced ({jobs.filter(j => j.status === 'INVOICED').length})</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-600">Loading jobs...</p>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
            <p className="text-gray-600">
              {filter === 'ALL' ? 'No jobs yet' : `No ${filter.toLowerCase()} jobs`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredJobs.map((job) => (
              <div key={job.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Job #{job.id.slice(0, 8)}</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="text-right">
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

                {/* Location, Tenant, Contractor */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {job.request?.unit && (
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <h4 className="font-semibold text-xs text-blue-900 mb-1">📍 Location</h4>
                      <p className="text-xs text-blue-800 font-medium">{job.request.unit.building.name}</p>
                      <p className="text-xs text-blue-700">{job.request.unit.building.address}</p>
                      <p className="text-xs text-blue-700 font-medium mt-1">Unit {job.request.unit.unitNumber}</p>
                    </div>
                  )}
                  
                  {job.request?.tenant && (
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                      <h4 className="font-semibold text-xs text-green-900 mb-1">👤 Tenant</h4>
                      {job.request.tenant.name && <p className="text-xs text-green-800 font-medium">{job.request.tenant.name}</p>}
                      <p className="text-xs text-green-700">📞 {job.request.tenant.phone}</p>
                      {job.request.tenant.email && <p className="text-xs text-green-700">✉️ {job.request.tenant.email}</p>}
                    </div>
                  )}

                  {job.contractor && (
                    <div className="p-3 bg-purple-50 rounded border border-purple-200">
                      <h4 className="font-semibold text-xs text-purple-900 mb-1">🔨 Contractor</h4>
                      <p className="text-xs text-purple-800 font-medium">{job.contractor.name}</p>
                      <p className="text-xs text-purple-700">📞 {job.contractor.phone}</p>
                      <p className="text-xs text-purple-700">✉️ {job.contractor.email}</p>
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

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                  <div>
                    <p className="font-medium text-gray-700">Created</p>
                    <p>{formatDate(job.createdAt)}</p>
                  </div>
                  {job.startedAt && (
                    <div>
                      <p className="font-medium text-gray-700">Started</p>
                      <p>{formatDate(job.startedAt)}</p>
                    </div>
                  )}
                  {job.completedAt && (
                    <div>
                      <p className="font-medium text-gray-700">Completed</p>
                      <p>{formatDate(job.completedAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
