import { useState, useEffect } from "react";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import { formatDate } from "../../lib/format";

const STATUS_COLORS = {
  PENDING: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  INVOICED: "bg-purple-100 text-purple-700",
};

export default function OwnerJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);

  function toggleAccordion(id) { setExpandedId((prev) => (prev === id ? null : id)); }

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const filteredJobs = filter === "ALL"
    ? jobs
    : jobs.filter((j) => j.status === filter);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Jobs Overview"
          actions={
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">All Jobs ({jobs.length})</option>
              <option value="PENDING">Pending ({jobs.filter((j) => j.status === "PENDING").length})</option>
              <option value="IN_PROGRESS">In Progress ({jobs.filter((j) => j.status === "IN_PROGRESS").length})</option>
              <option value="COMPLETED">Completed ({jobs.filter((j) => j.status === "COMPLETED").length})</option>
              <option value="INVOICED">Invoiced ({jobs.filter((j) => j.status === "INVOICED").length})</option>
            </select>
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
              <p className="text-sm text-slate-600">Loading jobs...</p>
            ) : filteredJobs.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                {filter === "ALL" ? "No jobs yet" : `No ${filter.toLowerCase()} jobs`}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredJobs.map((job) => {
                  const isExpanded = expandedId === job.id;
                  return (
                    <div key={job.id} className="rounded-lg border border-slate-200 bg-white">
                      {/* Clickable header */}
                      <div
                        className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-slate-50"
                        onClick={() => toggleAccordion(job.id)}
                      >
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {job.request?.category || `Job #${job.id.slice(0, 8)}`}
                          </p>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[job.status] || "bg-gray-100 text-gray-700"}`}>
                            {job.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {job.actualCost && (
                            <span className="text-sm font-semibold text-slate-700">CHF {job.actualCost}</span>
                          )}
                          <span className="text-xs text-slate-400">{formatDate(job.createdAt)}</span>
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
                        <div className="border-t border-slate-100 px-4 py-4">
                          {job.request && (
                            <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <p className="text-xs font-semibold text-slate-600 mb-1">Request Details</p>
                              <p className="text-sm text-slate-800">{job.request.description}</p>
                              {job.request.category && (
                                <p className="text-xs text-slate-500 mt-1">Category: {job.request.category}</p>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mb-3">
                            {job.request?.unit && (
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                <p className="text-xs font-semibold text-blue-900 mb-1">Location</p>
                                <p className="text-xs font-medium text-blue-800">{job.request.unit.building.name}</p>
                                <p className="text-xs text-blue-700">{job.request.unit.building.address}</p>
                                <p className="text-xs font-medium text-blue-700 mt-0.5">Unit {job.request.unit.unitNumber}</p>
                              </div>
                            )}
                            {job.request?.tenant && (
                              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                                <p className="text-xs font-semibold text-green-900 mb-1">Tenant</p>
                                {job.request.tenant.name && <p className="text-xs font-medium text-green-800">{job.request.tenant.name}</p>}
                                <p className="text-xs text-green-700">{job.request.tenant.phone}</p>
                                {job.request.tenant.email && <p className="text-xs text-green-700">{job.request.tenant.email}</p>}
                              </div>
                            )}
                            {job.contractor && (
                              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                                <p className="text-xs font-semibold text-purple-900 mb-1">Contractor</p>
                                <p className="text-xs font-medium text-purple-800">{job.contractor.name}</p>
                                <p className="text-xs text-purple-700">{job.contractor.phone}</p>
                                <p className="text-xs text-purple-700">{job.contractor.email}</p>
                              </div>
                            )}
                          </div>

                          {job.request?.appliance && (
                            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <p className="text-xs font-semibold text-amber-900 mb-1">Appliance</p>
                              <p className="text-sm text-amber-800">
                                {job.request.appliance.category}
                                {job.request.appliance.serial && ` (Serial: ${job.request.appliance.serial})`}
                              </p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>Created: {formatDate(job.createdAt)}</span>
                            {job.startedAt && <span>Started: {formatDate(job.startedAt)}</span>}
                            {job.completedAt && <span>Completed: {formatDate(job.completedAt)}</span>}
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
