import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";
import { formatDate, formatDateLong } from "../../../lib/format";

const STATUS_COLORS = {
  PENDING: "bg-gray-100 text-gray-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  INVOICED: "bg-purple-100 text-purple-800",
};

/** Format an ISO time as HH:mm (local TZ). */
function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ContractorJobDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadJob() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${id}`, { headers: authHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to load job (${res.status})`);
      }
      const data = await res.json();
      setJob(data.data || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell role="CONTRACTOR">
        <PageShell>
          <p className="loading-text">Loading job…</p>
        </PageShell>
      </AppShell>
    );
  }

  if (error || !job) {
    return (
      <AppShell role="CONTRACTOR">
        <PageShell>
          <Link href="/contractor/jobs" className="text-indigo-600 hover:underline text-sm">
            ← My Jobs
          </Link>
          <div className="error-banner mt-4">
            {error || "Job not found"}
          </div>
        </PageShell>
      </AppShell>
    );
  }

  const req = job.request;
  const acceptedSlot = (job.appointmentSlots || []).find((s) => s.status === "ACCEPTED");

  return (
    <AppShell role="CONTRACTOR">
      <PageShell>
        <div className="mb-2">
          <Link href="/contractor/jobs" className="text-indigo-600 hover:underline text-sm">
            ← My Jobs
          </Link>
        </div>

        <PageHeader
          title={`Job #${job.id.slice(0, 8)}`}
          actions={
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                STATUS_COLORS[job.status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {job.status.replace("_", " ")}
            </span>
          }
        />

        <PageContent>
          {/* Info cards row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Location */}
            {req?.unit && (
              <Panel title="📍 Location">
                <p className="text-sm text-slate-800 font-medium">{req.unit.building.name}</p>
                <p className="text-xs text-slate-600">{req.unit.building.address}</p>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">Unit {req.unit.unitNumber}</p>
              </Panel>
            )}

            {/* Dates */}
            <Panel title="📅 Dates">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-slate-500">Created:</span>{" "}
                  <span className="text-slate-800">{formatDate(job.createdAt)}</span>
                </p>
                {job.startedAt && (
                  <p>
                    <span className="text-slate-500">Started:</span>{" "}
                    <span className="text-slate-800">{formatDate(job.startedAt)}</span>
                  </p>
                )}
                {job.completedAt && (
                  <p>
                    <span className="text-slate-500">Completed:</span>{" "}
                    <span className="text-green-700 font-medium">{formatDate(job.completedAt)}</span>
                  </p>
                )}
              </div>
            </Panel>

            {/* Appointment */}
            {acceptedSlot && (
              <Panel title="📅 Appointment">
                <p className="text-sm text-indigo-800 font-medium">
                  {fmtTime(acceptedSlot.startTime)} – {fmtTime(acceptedSlot.endTime)}
                </p>
                <p className="text-xs text-indigo-700">{formatDateLong(acceptedSlot.startTime)}</p>
              </Panel>
            )}

            {/* Cost */}
            {job.actualCost != null && (
              <Panel title="💰 Cost">
                <p className="text-xl font-bold text-green-800">CHF {job.actualCost}</p>
              </Panel>
            )}
          </div>

          {/* Scope of work */}
          {req && (
            <Panel title="📋 Scope of Work">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{req.description}</p>
              {req.category && (
                <p className="text-xs text-slate-600 mt-2">
                  <span className="font-medium">Category:</span> {req.category}
                </p>
              )}
              {req.appliance && (
                <p className="text-xs text-slate-600 mt-1">
                  <span className="font-medium">Appliance:</span> {req.appliance.category}
                  {req.appliance.serial ? ` (S/N: ${req.appliance.serial})` : ""}
                </p>
              )}
            </Panel>
          )}

          {/* Tenant contact */}
          {req?.tenant && (
            <Panel title="👤 Tenant Contact">
              <div className="text-sm space-y-1">
                {req.tenant.name && <p className="text-slate-800 font-medium">{req.tenant.name}</p>}
                <p className="text-slate-600">📞 {req.tenant.phone}</p>
                {req.tenant.email && <p className="text-slate-600">✉️ {req.tenant.email}</p>}
              </div>
            </Panel>
          )}

          {/* CTA: Create Invoice (for COMPLETED jobs) */}
          {job.status === "COMPLETED" && (
            <Panel bodyClassName="text-center py-6">
              <p className="text-indigo-800 mb-3 font-medium">
                This job is completed. Ready to submit an invoice?
              </p>
              <Link
                href={`/contractor/invoices?jobId=${job.id}`}
                className="inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors no-underline"
              >
                Create Invoice →
              </Link>
            </Panel>
          )}

          {/* Invoice submitted indicator */}
          {job.status === "INVOICED" && (
            <Panel>
              <p className="text-purple-800 font-medium">
                ✅ Invoice submitted for this job.
              </p>
              <Link
                href="/contractor/invoices"
                className="text-purple-700 hover:underline text-sm mt-1 inline-block"
              >
                View My Invoices →
              </Link>
            </Panel>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
