import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import ContractorPicker from "../../../components/ContractorPicker";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import ResourceShell from "../../../components/ui/ResourceShell";
import { authHeaders } from "../../../lib/api";
import { useDetailResource } from "../../../lib/hooks/useDetailResource";
import { formatDate, formatDateLong } from "../../../lib/format";

import { cn } from "../../../lib/utils";
import Badge from "../../../components/ui/Badge";
import { jobVariant, slotVariant } from "../../../lib/statusVariants";

function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Rating ──────────────────────────────────────────────────────────────────

const CRITERIA = [
  { key: "scorePunctuality", label: "Punctuality" },
  { key: "scoreAccuracy",    label: "Accuracy of information given" },
  { key: "scoreCourtesy",    label: "Courtesy" },
];

function StarRow({ value, onChange, disabled }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          aria-label={`Rate ${n} of 5`}
          className={cn("text-2xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 rounded disabled:cursor-default", n <= (value || 0) ? "text-yellow-400" : "text-slate-300")}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function RatingModal({ jobId, contractorId, onClose, onDone }) {
  const [scores, setScores] = useState({ scorePunctuality: 0, scoreAccuracy: 0, scoreCourtesy: 0 });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!contractorId) { setError("Contractor ID not set — select your contractor profile first."); return; }
    const allFilled = CRITERIA.every((c) => scores[c.key] > 0);
    if (!allFilled) { setError("Please rate all three criteria."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/contractor/jobs/${jobId}/rate?contractorId=${contractorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...scores, comment: comment.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to submit rating");
      onDone();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Rate the tenant</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <ErrorBanner error={error} className="text-sm" />
          {CRITERIA.map((c) => (
            <div key={c.key}>
              <p className="mb-1 text-sm font-medium text-slate-700">{c.label}</p>
              <StarRow value={scores[c.key]} onChange={(v) => setScores((p) => ({ ...p, [c.key]: v }))} disabled={submitting} />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Comment (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Skip for now
            </button>
            <button type="submit" disabled={submitting} className="button-primary text-sm disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit rating"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Slot proposal ───────────────────────────────────────────────────────────

/**
 * Renders the current proposed/accepted slots, and (if PENDING) a form
 * to add new slots for the tenant to choose from.
 */
function SlotPanel({ jobId, contractorId, jobStatus, onRefresh }) {
  const [slots, setSlots] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState([{ date: "", startHour: "09", startMin: "00", durationH: "2" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadSlots = useCallback(async () => {
    if (!contractorId) return;
    try {
      const res = await fetch(`/api/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSlots(data?.data || []);
    } catch { /* silent */ }
  }, [jobId, contractorId]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  function addRow() {
    if (rows.length >= 5) return;
    setRows((p) => [...p, { date: "", startHour: "09", startMin: "00", durationH: "2" }]);
  }
  function removeRow(i) {
    setRows((p) => p.filter((_, idx) => idx !== i));
  }
  function updateRow(i, field, value) {
    setRows((p) => p.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!contractorId) { setError("Select your contractor profile first."); return; }
    const slotsPayload = rows.map((r) => {
      const startDate = new Date(`${r.date}T${r.startHour}:${r.startMin}:00`);
      const endDate = new Date(startDate.getTime() + Number(r.durationH) * 3600 * 1000);
      return { startTime: startDate.toISOString(), endTime: endDate.toISOString() };
    });
    const invalid = slotsPayload.some((s) => isNaN(new Date(s.startTime).getTime()));
    if (invalid) { setError("Please fill in all dates."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ slots: slotsPayload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to propose slots");
      setShowForm(false);
      setRows([{ date: "", startHour: "09", startMin: "00", durationH: "2" }]);
      loadSlots();
      onRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }



  const canPropose = jobStatus === "PENDING" || jobStatus === "IN_PROGRESS";
  const hasAccepted = slots.some((s) => s.status === "ACCEPTED");

  return (
    <Panel title="📅 Appointment Slots">
      {slots.length > 0 && (
        <div className="space-y-2 mb-3">
          {slots.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span className="font-medium">
                {new Date(s.startTime).toLocaleDateString("en-CH", { weekday: "short", day: "numeric", month: "short" })}
                {" · "}
                {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
              </span>
              <Badge variant={slotVariant(s.status)} size="sm">{s.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {slots.length === 0 && !showForm && canPropose && (
        <p className="text-sm text-slate-500 mb-3">No slots proposed yet. Propose times for the tenant to choose from.</p>
      )}

      {hasAccepted && (
        <p className="text-xs text-green-700 font-medium">Appointment confirmed by tenant.</p>
      )}

      {canPropose && !hasAccepted && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="mt-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              + Propose appointment times
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="mt-2 space-y-3">
              <ErrorBanner error={error} className="text-xs" />
              {rows.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
                  <input
                    type="date"
                    value={r.date}
                    onChange={(e) => updateRow(i, "date", e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    required
                    className="rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                  />
                  <select value={r.startHour} onChange={(e) => updateRow(i, "startHour", e.target.value)} className="filter-select text-xs px-2 py-1">
                    {Array.from({ length: 13 }, (_, h) => h + 7).map((h) => (
                      <option key={h} value={String(h).padStart(2, "0")}>{String(h).padStart(2, "0")}h</option>
                    ))}
                  </select>
                  <select value={r.startMin} onChange={(e) => updateRow(i, "startMin", e.target.value)} className="filter-select text-xs px-2 py-1">
                    {["00", "15", "30", "45"].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={r.durationH} onChange={(e) => updateRow(i, "durationH", e.target.value)} className="filter-select text-xs px-2 py-1">
                    {["1", "1.5", "2", "3", "4"].map((d) => <option key={d} value={d}>{d}h</option>)}
                  </select>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)} className="text-xs text-red-500 hover:text-red-700" aria-label="Remove schedule row">✕</button>
                  )}
                </div>
              ))}
              {rows.length < 5 && (
                <button type="button" onClick={addRow} className="cell-link text-xs">+ Add another slot</button>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={submitting} className="button-primary text-xs px-3 py-1.5 disabled:opacity-50">
                  {submitting ? "Sending…" : "Send to tenant"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </Panel>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ContractorJobDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: job, loading, error, refresh: loadJob } = useDetailResource(
    id ? `/api/jobs/${id}` : null
  );
  const [contractorId, setContractorId] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setContractorId(localStorage.getItem("contractorId"));
    }
  }, []);

  async function handleMarkComplete() {
    if (!contractorId) { setActionError("Select your contractor profile first."); return; }
    setCompleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/contractor/jobs/${id}/complete?contractorId=${contractorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to mark complete");
      await loadJob();
      setShowRating(true);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCompleting(false);
    }
  }

  const req = job?.request;
  const acceptedSlot = (job?.appointmentSlots || []).find((s) => s.status === "ACCEPTED");
  const isActive = job?.status === "PENDING" || job?.status === "IN_PROGRESS";
  const contractorRated = job?.ratings?.some((r) => r.raterRole === "CONTRACTOR");

  return (
    <AppShell role="CONTRACTOR">
      <PageShell>
        <div className="mb-2">
          <Link href="/contractor/jobs" className="cell-link text-sm">← My Jobs</Link>
        </div>
        <ResourceShell loading={loading} error={error} hasData={!!job} loadingText="Loading job…" emptyMessage="Job not found.">
        {job && (<>
        <PageHeader
          title={`Job #${job.id.slice(0, 8)}`}
          actions={
            <Badge variant={jobVariant(job.status)}>{job.status.replace("_", " ")}</Badge>
          }
        />

        {/* Contractor picker if no ID is set */}
        {!contractorId && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
            <p className="mb-2 text-sm font-medium text-yellow-700">Select your contractor profile to use job actions:</p>
            <ContractorPicker onSelect={(cid) => setContractorId(cid)} />
          </div>
        )}

        <PageContent>
          <ErrorBanner error={actionError} className="mb-4 text-sm" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {req?.unit && (
              <Panel title="📍 Location">
                <p className="text-sm text-slate-800 font-medium">{req.unit.building.name}</p>
                <p className="text-xs text-slate-600">{req.unit.building.address}</p>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">Unit {req.unit.unitNumber}</p>
              </Panel>
            )}

            <Panel title="📅 Dates">
              <div className="space-y-1 text-sm">
                <p><span className="text-slate-500">Created:</span> <span className="text-slate-800">{formatDate(job.createdAt)}</span></p>
                {job.startedAt && <p><span className="text-slate-500">Started:</span> <span className="text-slate-800">{formatDate(job.startedAt)}</span></p>}
                {job.completedAt && <p><span className="text-slate-500">Completed:</span> <span className="text-green-700 font-medium">{formatDate(job.completedAt)}</span></p>}
              </div>
            </Panel>

            {acceptedSlot && (
              <Panel title="✅ Confirmed Appointment">
                <p className="text-sm text-indigo-700 font-medium">{fmtTime(acceptedSlot.startTime)} – {fmtTime(acceptedSlot.endTime)}</p>
                <p className="text-xs text-indigo-700">{formatDateLong(acceptedSlot.startTime)}</p>
              </Panel>
            )}

            {job.actualCost != null && (
              <Panel title="💰 Cost">
                <p className="text-xl font-bold text-green-700">CHF {job.actualCost}</p>
              </Panel>
            )}
          </div>

          {req && (
            <Panel title="📋 Scope of Work">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{req.description}</p>
              {req.category && <p className="text-xs text-slate-600 mt-2"><span className="font-medium">Category:</span> {req.category}</p>}
              {req.appliance && <p className="text-xs text-slate-600 mt-1"><span className="font-medium">Appliance:</span> {req.appliance.category}{req.appliance.serial ? ` (S/N: ${req.appliance.serial})` : ""}</p>}
            </Panel>
          )}

          {req?.tenant && (
            <Panel title="👤 Tenant Contact">
              <div className="text-sm space-y-1">
                {req.tenant.name && <p className="text-slate-800 font-medium">{req.tenant.name}</p>}
                <p className="text-slate-600">📞 {req.tenant.phone}</p>
                {req.tenant.email && <p className="text-slate-600">✉️ {req.tenant.email}</p>}
              </div>
            </Panel>
          )}

          {/* Appointment slot proposal (PENDING / IN_PROGRESS) */}
          {isActive && (
            <SlotPanel
              jobId={job.id}
              contractorId={contractorId}
              jobStatus={job.status}
              onRefresh={loadJob}
            />
          )}

          {/* Mark as complete */}
          {isActive && (
            <Panel bodyClassName="text-center py-6">
              <p className="text-slate-700 mb-3 font-medium">Work done? Mark the job as complete.</p>
              <button
                onClick={handleMarkComplete}
                disabled={completing}
                className="inline-block px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {completing ? "Marking complete…" : "Mark as complete"}
              </button>
            </Panel>
          )}

          {/* Rate tenant (completed, not yet rated) */}
          {job.status === "COMPLETED" && !contractorRated && !showRating && (
            <Panel bodyClassName="text-center py-6">
              <p className="text-indigo-700 mb-3 font-medium">
                Job completed! Please rate the tenant before submitting your invoice.
              </p>
              <button
                onClick={() => setShowRating(true)}
                className="inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Rate tenant
              </button>
            </Panel>
          )}

          {/* Create Invoice (completed + rated) */}
          {job.status === "COMPLETED" && contractorRated && (
            <Panel bodyClassName="text-center py-6">
              <p className="text-indigo-700 mb-3 font-medium">This job is completed. Ready to submit an invoice?</p>
              <Link
                href={`/contractor/invoices?jobId=${job.id}`}
                className="inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors no-underline"
              >
                Create Invoice →
              </Link>
            </Panel>
          )}

          {/* Invoiced */}
          {job.status === "INVOICED" && (
            <Panel>
              <p className="text-purple-700 font-medium">✅ Invoice submitted for this job.</p>
              <Link href="/contractor/invoices" className="text-purple-700 hover:underline text-sm mt-1 inline-block">
                View My Invoices →
              </Link>
            </Panel>
          )}
        </PageContent>

        {/* Rating modal */}
        {showRating && (
          <RatingModal
            jobId={job.id}
            contractorId={contractorId}
            onClose={() => setShowRating(false)}
            onDone={() => { setShowRating(false); loadJob(); }}
          />
        )}
        </>)}
        </ResourceShell>
      </PageShell>
    </AppShell>
  );
}
