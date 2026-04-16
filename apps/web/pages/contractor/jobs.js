import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel.jsx";
import ContractorPicker from "../../components/ContractorPicker";
import ErrorBanner from "../../components/ui/ErrorBanner";
import Badge from "../../components/ui/Badge";
import { jobVariant } from "../../lib/statusVariants";
import { formatDate, formatDateLong } from "../../lib/format";
import { authHeaders } from "../../lib/api";

import { cn } from "../../lib/utils";
/* ── Tab config (F-UI1) ────────────────────────────────── */
const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "history", label: "History" },
];
const TAB_KEYS = TABS.map((t) => t.key);

/* ── Helpers ────────────────────────────────────────────── */

/** Find the ACCEPTED appointment slot for a job (if any). */
function acceptedSlot(job) {
  return (job.appointmentSlots || []).find((s) => s.status === "ACCEPTED");
}

/** Format an ISO time as HH:mm (local TZ, SSR-safe). */
function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Format an ISO date as "Monday, 15 Jan 2026" (SSR-safe). */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDayLabel(iso) {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Date-only key for grouping (local TZ). */
function dateKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Group upcoming jobs by confirmed-slot day.
 * Returns [{ label, sortKey, jobs }]. Unscheduled jobs go last.
 */
function groupByDay(jobs) {
  const buckets = {};
  const unscheduled = [];
  jobs.forEach((job) => {
    const slot = acceptedSlot(job);
    if (slot) {
      const key = dateKey(slot.startTime);
      if (!buckets[key]) buckets[key] = { label: fmtDayLabel(slot.startTime), sortKey: key, jobs: [] };
      buckets[key].jobs.push({ ...job, _slot: slot });
    } else {
      unscheduled.push(job);
    }
  });
  const sorted = Object.values(buckets)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((g) => ({
      ...g,
      jobs: g.jobs.sort((a, b) => a._slot.startTime.localeCompare(b._slot.startTime)),
    }));
  if (unscheduled.length) sorted.push({ label: "Unscheduled", sortKey: "zzzz", jobs: unscheduled });
  return sorted;
}

/** Short location string: "BuildingName · Unit X" */
function shortLocation(job) {
  const unit = job.request?.unit;
  if (unit) return `${unit.building.name} · Unit ${unit.unitNumber}`;
  if (job.buildingName && job.unitNumber) return `${job.buildingName} · Unit ${job.unitNumber}`;
  if (job.buildingName) return job.buildingName;
  return null;
}

/* ═══════════════════════════════════════════════════════════ */

export default function ContractorJobs() {
  const router = useRouter();

  /* ── Tab state (URL-persisted, F-UI1) ── */
  const activeTab = router.isReady
    ? Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0
    : 0;
  const setActiveTab = useCallback(
    (index) => {
      router.push(
        { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  /* ── Data ── */
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ── Expand / collapse card ── */
  const [expandedId, setExpandedId] = useState(null);
  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  /* ── Inline actions ── */
  const [actionJobId, setActionJobId] = useState(null);
  const [actualCost, setActualCost] = useState("");

  /* ── Fetch ── */
  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const contractorId = localStorage.getItem("contractorId");
      const url = contractorId
        ? `/api/contractor/jobs?contractorId=${contractorId}&view=full`
        : "/api/jobs?view=full";
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      setJobs(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  /* ── Derived lists ── */
  const upcomingJobs = useMemo(
    () => jobs.filter((j) => j.status === "PENDING" || j.status === "IN_PROGRESS"),
    [jobs],
  );
  const historyJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "COMPLETED" || j.status === "INVOICED")
        .sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt)),
    [jobs],
  );
  const dayGroups = useMemo(() => groupByDay(upcomingJobs), [upcomingJobs]);

  /* ── Mutations ── */
  const startJob = async (jobId) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      if (!res.ok) throw new Error("Failed to start job");
      await fetchJobs();
      setActionJobId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const completeJob = async (jobId) => {
    if (!actualCost || isNaN(actualCost)) {
      setError("Please enter actual cost");
      return;
    }
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "COMPLETED", actualCost: parseInt(actualCost) }),
      });
      if (!res.ok) throw new Error("Failed to complete job");
      await fetchJobs();
      setActionJobId(null);
      setActualCost("");
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── Render ── */
  return (
    <AppShell role="CONTRACTOR">
      <PageShell>
        <PageHeader
          title="My Jobs"
          actions={<ContractorPicker onSelect={() => fetchJobs()} />}
        />

        <PageContent>
          {/* Error banner */}
          <ErrorBanner error={error} onDismiss={() => setError("")} />

          <Panel bodyClassName="p-0">
            {/* Tab strip */}
            <div className="tab-strip">
              {TABS.map((tab, i) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(i)}
                  className={activeTab === i ? "tab-btn-active" : "tab-btn"}
                >
                  {tab.label}
                  <span className="tab-panel-count">
                    {i === 0 ? upcomingJobs.length : historyJobs.length}
                  </span>
                </button>
              ))}
            </div>

            {/* ── Upcoming tab ── */}
            <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
              {loading ? (
                <p className="loading-text">Loading jobs…</p>
              ) : dayGroups.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-text">No upcoming jobs</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {dayGroups.map((group) => (
                    <div key={group.sortKey}>
                      <p className="day-header">{group.label}</p>
                      <div className="space-y-2">
                        {group.jobs.map((job) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            slot={job._slot || null}
                            expanded={expandedId === job.id}
                            onToggle={() => toggleExpand(job.id)}
                            actionJobId={actionJobId}
                            setActionJobId={setActionJobId}
                            actualCost={actualCost}
                            setActualCost={setActualCost}
                            onStartJob={startJob}
                            onCompleteJob={completeJob}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── History tab ── */}
            <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
              {loading ? (
                <p className="loading-text">Loading jobs…</p>
              ) : historyJobs.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-text">No completed jobs yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      slot={acceptedSlot(job)}
                      expanded={expandedId === job.id}
                      onToggle={() => toggleExpand(job.id)}
                      actionJobId={actionJobId}
                      setActionJobId={setActionJobId}
                      actualCost={actualCost}
                      setActualCost={setActualCost}
                      onStartJob={startJob}
                      onCompleteJob={completeJob}
                    />
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

/* ═══════════════════════════════════════════════════════════
   JobCard — collapsed / expanded
   ═══════════════════════════════════════════════════════════ */

function JobCard({
  job,
  slot,
  expanded,
  onToggle,
  actionJobId,
  setActionJobId,
  actualCost,
  setActualCost,
  onStartJob,
  onCompleteJob,
}) {
  const req = job.request;
  const category = req?.category || req?.appliance?.category || null;
  const loc = shortLocation(job);
  const timeLabel = slot ? `${fmtTime(slot.startTime)}–${fmtTime(slot.endTime)}` : null;

  return (
    <div className="job-card">
      {/* ── Collapsed header ── */}
      <div className="job-card-header" onClick={onToggle} role="button" tabIndex={0}>
        <span className="job-card-time">{timeLabel || "—"}</span>
        <span className="job-card-meta">
          {category && <strong>{category}</strong>}
          {category && loc && " — "}
          {loc}
          {!category && !loc && (
            <span>Job #{job.id.slice(0, 8)}</span>
          )}
        </span>
        <Badge variant={jobVariant(job.status)} size="sm">
          {job.status.replace("_", " ")}
        </Badge>
        <span className={cn("job-card-chevron", expanded ? " job-card-chevron-open" : "")}>
          ▸
        </span>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="job-card-body">
          <div className="grid gap-4 sm:grid-cols-2 mt-3">
            {/* Location */}
            {req?.unit && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-xs font-semibold text-blue-900 mb-1">📍 Location</h4>
                <p className="text-sm text-blue-700 font-medium">{req.unit.building.name}</p>
                <p className="text-xs text-blue-700">{req.unit.building.address}</p>
                <p className="text-xs text-blue-700 mt-0.5 font-medium">Unit {req.unit.unitNumber}</p>
              </div>
            )}
            {!req?.unit && (job.buildingName || job.unitNumber) && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-xs font-semibold text-blue-900 mb-1">📍 Location</h4>
                {job.buildingName && <p className="text-sm text-blue-700 font-medium">{job.buildingName}</p>}
                {job.unitNumber && <p className="text-xs text-blue-700 font-medium">Unit {job.unitNumber}</p>}
              </div>
            )}

            {/* Tenant contact */}
            {req?.tenant && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-xs font-semibold text-green-900 mb-1">👤 Tenant</h4>
                {req.tenant.name && <p className="text-sm text-green-700 font-medium">{req.tenant.name}</p>}
                <p className="text-xs text-green-700">📞 {req.tenant.phone}</p>
                {req.tenant.email && <p className="text-xs text-green-700">✉️ {req.tenant.email}</p>}
              </div>
            )}

            {/* Appointment */}
            {slot && (
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <h4 className="text-xs font-semibold text-indigo-900 mb-1">📅 Appointment</h4>
                <p className="text-sm text-indigo-700 font-medium">
                  {fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
                </p>
                <p className="text-xs text-indigo-700">{formatDateLong(slot.startTime)}</p>
              </div>
            )}

            {/* Appliance */}
            {req?.appliance && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="text-xs font-semibold text-amber-900 mb-1">🔧 Appliance</h4>
                <p className="text-sm text-amber-700">
                  {req.appliance.category}
                  {req.appliance.serial && ` (S/N: ${req.appliance.serial})`}
                </p>
              </div>
            )}
          </div>

          {/* Scope of work */}
          {(req?.description || job.requestDescription) && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="text-xs font-semibold text-slate-700 mb-1">📋 Scope</h4>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">
                {req?.description || job.requestDescription}
              </p>
            </div>
          )}

          {/* Invoice addressee */}
          {job.invoiceAddressedTo && (
            <div
              className={cn("mt-3 p-3 rounded-lg border", job.invoiceAddressedTo === "TENANT"
                  ? "bg-orange-50 border-orange-200"
                  : "bg-indigo-50 border-indigo-200")}
            >
              <span
                className={cn("text-xs font-semibold", job.invoiceAddressedTo === "TENANT" ? "text-orange-900" : "text-indigo-900")}
              >
                🧾 Invoice to:{" "}
              </span>
              <span
                className={cn("text-sm font-medium", job.invoiceAddressedTo === "TENANT" ? "text-orange-700" : "text-indigo-700")}
              >
                {job.invoiceAddressedTo === "TENANT" ? "Tenant" : "Property Manager"}
              </span>
            </div>
          )}

          {/* Timestamps */}
          <div className="mt-3 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>Created: {formatDate(job.createdAt)}</span>
            {job.startedAt && <span>Started: {formatDate(job.startedAt)}</span>}
            {job.completedAt && <span>Completed: {formatDate(job.completedAt)}</span>}
            {job.actualCost != null && (
              <span className="font-semibold text-slate-700">CHF {job.actualCost}</span>
            )}
          </div>

          {/* CTAs */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* Start Job */}
            {job.status === "PENDING" && actionJobId !== job.id && (
              <button
                onClick={() => setActionJobId(job.id)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start Job
              </button>
            )}
            {job.status === "PENDING" && actionJobId === job.id && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">Ready to start?</span>
                <button
                  onClick={() => onStartJob(job.id)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  Confirm Start
                </button>
                <button
                  onClick={() => setActionJobId(null)}
                  className="px-3 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Complete Job */}
            {job.status === "IN_PROGRESS" && actionJobId !== job.id && (
              <button
                onClick={() => setActionJobId(job.id)}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
              >
                Complete Job
              </button>
            )}
            {job.status === "IN_PROGRESS" && actionJobId === job.id && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Actual cost (CHF)"
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value)}
                  className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => onCompleteJob(job.id)}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  Complete
                </button>
                <button
                  onClick={() => {
                    setActionJobId(null);
                    setActualCost("");
                  }}
                  className="px-3 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Completed / Invoiced status links */}
            {job.status === "COMPLETED" && (
              <Link
                href={`/contractor/invoices?jobId=${job.id}`}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors no-underline"
              >
                Create Invoice →
              </Link>
            )}
            {job.status === "INVOICED" && (
              <Link
                href="/contractor/invoices"
                className="text-sm text-purple-700 hover:underline"
              >
                View Invoice →
              </Link>
            )}

            {/* Always: View Detail link */}
            <Link
              href={`/contractor/jobs/${job.id}`}
              className="text-sm text-slate-600 hover:text-slate-900 hover:underline ml-auto"
            >
              View Detail →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
