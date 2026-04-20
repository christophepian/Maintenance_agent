import { useState, useEffect } from "react";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { formatDate } from "../../lib/format";
import Badge from "../../components/ui/Badge";
import { urgencyVariant, jobVariant } from "../../lib/statusVariants";

import { cn } from "../../lib/utils";
function UrgencyPill({ urgency }) {
  if (!urgency) return null;
  return (
    <Badge variant={urgencyVariant(urgency)} size="sm">
      {urgency.charAt(0) + urgency.slice(1).toLowerCase()}
    </Badge>
  );
}

export default function OwnerJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");

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

  // Derived filter options
  const buildings = [...new Set(jobs.map((j) => j.request?.unit?.building?.name).filter(Boolean))].sort();
  const units = [...new Set(
    jobs
      .filter((j) => !buildingFilter || j.request?.unit?.building?.name === buildingFilter)
      .map((j) => j.request?.unit?.unitNumber)
      .filter(Boolean)
  )].sort();

  const filteredJobs = jobs.filter((j) => {
    if (filter !== "ALL" && j.status !== filter) return false;
    if (dateFrom && j.createdAt < dateFrom) return false;
    if (dateTo && j.createdAt > dateTo + "T23:59:59") return false;
    if (buildingFilter && j.request?.unit?.building?.name !== buildingFilter) return false;
    if (unitFilter && j.request?.unit?.unitNumber !== unitFilter) return false;
    if (urgencyFilter && j.request?.urgency !== urgencyFilter) return false;
    return true;
  });

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader title="Jobs Overview" />

        <PageContent>
          <ErrorBanner error={error} className="text-sm" />

          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-start gap-3">
            <div className="flex flex-col items-center justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">Status</label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}
                className="min-h-[36px] appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="INVOICED">Invoiced</option>
              </select>
            </div>
            <div className="flex flex-col justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex flex-col justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex flex-col items-center justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">Building</label>
              <select value={buildingFilter} onChange={(e) => { setBuildingFilter(e.target.value); setUnitFilter(""); }}
                className="min-h-[36px] appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">All buildings</option>
                {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex flex-col items-center justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">Unit</label>
              <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}
                className="min-h-[36px] appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">All units</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col items-center justify-end gap-1">
              <label className="text-xs font-medium text-slate-500">Urgency</label>
              <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}
                className="min-h-[36px] appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">All</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
            </div>
            {(filter !== "ALL" || dateFrom || dateTo || buildingFilter || unitFilter || urgencyFilter) && (
              <div className="flex flex-col justify-end gap-1">
                <span className="text-xs opacity-0 select-none">x</span>
                <button onClick={() => { setFilter("ALL"); setDateFrom(""); setDateTo(""); setBuildingFilter(""); setUnitFilter(""); setUrgencyFilter(""); }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:bg-slate-50">
                  Clear
                </button>
              </div>
            )}
          </div>

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
                          <Badge variant={jobVariant(job.status)} size="sm">
                            {job.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <UrgencyPill urgency={job.request?.urgency} />
                          {job.actualCost && (
                            <span className="text-sm font-semibold text-slate-700">CHF {job.actualCost}</span>
                          )}
                          <span className="text-xs text-slate-400">{formatDate(job.createdAt)}</span>
                          <svg
                            className={cn("h-4 w-4 text-slate-400 transition-transform", isExpanded ? "rotate-90" : "")}
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
                                <p className="text-xs font-medium text-blue-700">{job.request.unit.building.name}</p>
                                <p className="text-xs text-blue-700">{job.request.unit.building.address}</p>
                                <p className="text-xs font-medium text-blue-700 mt-0.5">Unit {job.request.unit.unitNumber}</p>
                              </div>
                            )}
                            {job.request?.tenant && (
                              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                                <p className="text-xs font-semibold text-green-900 mb-1">Tenant</p>
                                {job.request.tenant.name && <p className="text-xs font-medium text-green-700">{job.request.tenant.name}</p>}
                                <p className="text-xs text-green-700">{job.request.tenant.phone}</p>
                                {job.request.tenant.email && <p className="text-xs text-green-700">{job.request.tenant.email}</p>}
                              </div>
                            )}
                            {job.contractor && (
                              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                                <p className="text-xs font-semibold text-purple-900 mb-1">Contractor</p>
                                <p className="text-xs font-medium text-purple-700">{job.contractor.name}</p>
                                <p className="text-xs text-purple-700">{job.contractor.phone}</p>
                                <p className="text-xs text-purple-700">{job.contractor.email}</p>
                              </div>
                            )}
                          </div>

                          {job.request?.asset && (
                            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <p className="text-xs font-semibold text-amber-900 mb-1">Asset</p>
                              <p className="text-sm text-amber-700">
                                {job.request.asset.name || job.request.asset.category}
                                {job.request.asset.serialNumber && ` (Serial: ${job.request.asset.serialNumber})`}
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
