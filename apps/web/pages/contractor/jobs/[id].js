import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import { authHeaders } from "../../../lib/api";
import { formatDate } from "../../../lib/format";

const STATUS_COLORS = {
  PENDING: "bg-gray-100 text-gray-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  INVOICED: "bg-purple-100 text-purple-800",
};

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
        <div style={{ maxWidth: 900 }}>
          <p className="text-gray-600">Loading job…</p>
        </div>
      </AppShell>
    );
  }

  if (error || !job) {
    return (
      <AppShell role="CONTRACTOR">
        <div style={{ maxWidth: 900 }}>
          <Link href="/contractor/jobs" className="text-indigo-600 hover:underline text-sm">
            ← My Jobs
          </Link>
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
            {error || "Job not found"}
          </div>
        </div>
      </AppShell>
    );
  }

  const req = job.request;

  return (
    <AppShell role="CONTRACTOR">
      <div style={{ maxWidth: 900 }}>
        {/* Back link */}
        <Link href="/contractor/jobs" className="text-indigo-600 hover:underline text-sm">
          ← My Jobs
        </Link>

        {/* Header */}
        <div className="mt-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ margin: 0 }}>
              Job #{job.id.slice(0, 8)}
            </h1>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                STATUS_COLORS[job.status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {job.status}
            </span>
          </div>
        </div>

        {/* Location & details */}
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {/* Building / Unit */}
          {req?.unit && (
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <h3 className="font-semibold text-sm text-blue-900 mb-2">📍 Location</h3>
              <p className="text-blue-800 font-medium">{req.unit.building.name}</p>
              <p className="text-sm text-blue-700">{req.unit.building.address}</p>
              <p className="text-sm text-blue-700 mt-1 font-medium">Unit {req.unit.unitNumber}</p>
            </div>
          )}

          {/* Dates */}
          <div className="p-4 bg-gray-50 rounded border border-gray-200">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">📅 Dates</h3>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-gray-500">Created:</span>{" "}
                <span className="text-gray-800">{formatDate(job.createdAt)}</span>
              </p>
              {job.startedAt && (
                <p>
                  <span className="text-gray-500">Started:</span>{" "}
                  <span className="text-gray-800">{formatDate(job.startedAt)}</span>
                </p>
              )}
              {job.completedAt && (
                <p>
                  <span className="text-gray-500">Completed:</span>{" "}
                  <span className="text-green-700 font-medium">{formatDate(job.completedAt)}</span>
                </p>
              )}
            </div>
          </div>

          {/* Cost */}
          {job.actualCost != null && (
            <div className="p-4 bg-green-50 rounded border border-green-200">
              <h3 className="font-semibold text-sm text-green-900 mb-2">💰 Cost</h3>
              <p className="text-xl font-bold text-green-800">CHF {job.actualCost}</p>
            </div>
          )}
        </div>

        {/* Scope of work (from request) */}
        {req && (
          <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">📋 Scope of Work</h3>
            <p className="text-gray-800 whitespace-pre-wrap">{req.description}</p>
            {req.category && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-medium">Category:</span> {req.category}
              </p>
            )}
            {req.appliance && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Appliance:</span> {req.appliance.category}
                {req.appliance.serial ? ` (S/N: ${req.appliance.serial})` : ""}
              </p>
            )}
          </div>
        )}

        {/* Tenant contact */}
        {req?.tenant && (
          <div className="mb-6 p-4 bg-yellow-50 rounded border border-yellow-200">
            <h3 className="font-semibold text-sm text-yellow-900 mb-2">👤 Tenant Contact</h3>
            <div className="text-sm space-y-1">
              {req.tenant.name && <p className="text-yellow-800">{req.tenant.name}</p>}
              <p className="text-yellow-700">📞 {req.tenant.phone}</p>
              {req.tenant.email && <p className="text-yellow-700">✉️ {req.tenant.email}</p>}
            </div>
          </div>
        )}

        {/* CTA: Create Invoice (for COMPLETED jobs without invoice) */}
        {job.status === "COMPLETED" && (
          <div className="mb-6 p-5 bg-indigo-50 rounded-lg border-2 border-indigo-200 text-center">
            <p className="text-indigo-800 mb-3 font-medium">
              This job is completed. Ready to submit an invoice?
            </p>
            <Link
              href={`/contractor/invoices?jobId=${job.id}`}
              className="inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              style={{ textDecoration: "none" }}
            >
              Create Invoice →
            </Link>
          </div>
        )}

        {/* Invoice submitted indicator */}
        {job.status === "INVOICED" && (
          <div className="mb-6 p-4 bg-purple-50 rounded border border-purple-200">
            <p className="text-purple-800 font-medium">
              ✅ Invoice submitted for this job.
            </p>
            <Link
              href="/contractor/invoices"
              className="text-purple-700 hover:underline text-sm mt-1 inline-block"
            >
              View My Invoices →
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
