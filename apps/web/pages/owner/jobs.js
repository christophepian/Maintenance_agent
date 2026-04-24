import { useState, useEffect } from "react";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField, DateField } from "../../components/ui/FilterPanel";
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

  const activeCount = [filter !== "ALL" ? filter : "", dateFrom, dateTo, buildingFilter, unitFilter, urgencyFilter].filter(Boolean).length;
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader title="Jobs Overview" />

        <PageContent>
          <ErrorBanner error={error} className="text-sm" />

          <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
          {filterOpen && (
            <FilterPanelBody>
              <FilterSection title="Status" first>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectField label="Status" value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="ALL">All statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="INVOICED">Invoiced</option>
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSection title="Date range">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DateField label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <DateField label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </FilterSection>
              <FilterSection title="Scope">
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Building" value={buildingFilter} onChange={(e) => { setBuildingFilter(e.target.value); setUnitFilter(""); }}>
                    <option value="">All buildings</option>
                    {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
                  </SelectField>
                  <SelectField label="Unit" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
                    <option value="">All units</option>
                    {units.map((u) => <option key={u} value={u}>{u}</option>)}
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSection title="Priority">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectField label="Urgency" value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
                    <option value="">All levels</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="EMERGENCY">Emergency</option>
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSectionClear hasFilter={activeCount > 0} onClear={() => { setFilter("ALL"); setDateFrom(""); setDateTo(""); setBuildingFilter(""); setUnitFilter(""); setUrgencyFilter(""); }} />
            </FilterPanelBody>
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
                        className="flex cursor-pointer flex-col gap-2 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                        onClick={() => toggleAccordion(job.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {job.request?.category || `Job #${job.id.slice(0, 8)}`}
                          </p>
                          <Badge variant={jobVariant(job.status)} size="sm">
                            {job.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
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
