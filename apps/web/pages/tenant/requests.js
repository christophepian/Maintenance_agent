import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel.jsx";
import { formatDateTime } from "../../lib/format";
import { tenantFetch, tenantHeaders } from "../../lib/api";
import TenantPicker from "../../components/TenantPicker";
import ErrorBanner from "../../components/ui/ErrorBanner";
import Badge from "../../components/ui/Badge";
import { requestVariant } from "../../lib/statusVariants";

import { cn } from "../../lib/utils";
// ---------------------------------------------------------------------------
// Scheduling Slots Panel (Tenant — accept / decline)
// ---------------------------------------------------------------------------

const SLOT_STATUS_COLORS = {
  PROPOSED: "border-yellow-200 bg-yellow-50",
  ACCEPTED: "border-green-200 bg-green-50",
  DECLINED: "border-red-200 bg-red-50",
};

function formatSlotTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-CH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TenantSchedulingPanel({ requestId }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await tenantFetch(
        `/api/tenant-portal/requests/${requestId}/slots`,
      );
      const data = await res.json();
      if (!res.ok) {
        // 404 means no job yet — that's fine, just no slots
        if (res.status === 404) { setSlots([]); return; }
        throw new Error(data?.error?.message || "Failed to load slots");
      }
      setSlots(data?.data || []);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  async function handleAction(slotId, action) {
    setActionLoading(slotId);
    setError("");
    try {
      const res = await tenantFetch(
        `/api/tenant-portal/slots/${slotId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Failed to ${action} slot`);
      loadSlots();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <p className="text-xs text-slate-400 mt-2">Checking appointments…</p>;
  if (slots.length === 0) return null;

  const accepted = slots.find((s) => s.status === "ACCEPTED");
  const proposed = slots.filter((s) => s.status === "PROPOSED");
  const allDeclined = slots.length > 0 && slots.every((s) => s.status === "DECLINED");

  return (
    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
      <h3 className="text-sm font-semibold text-indigo-900 mb-2">
        📅 Appointment Scheduling
      </h3>

      <ErrorBanner error={error} className="mb-2 text-xs" />

      {accepted ? (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-green-700">✓</span>
            <span className="text-sm font-semibold text-green-900">
              Appointment Confirmed
            </span>
          </div>
          <p className="text-sm text-green-700">
            {formatSlotTime(accepted.startTime)} – {formatSlotTime(accepted.endTime)}
          </p>
        </div>
      ) : allDeclined ? (
        <p className="text-sm text-red-700">
          All proposed time slots have been declined. The manager will be notified
          and the contractor may propose new slots.
        </p>
      ) : (
        <>
          <p className="text-xs text-indigo-700 mb-2">
            The contractor has proposed the following time slots.
            Please accept one or decline those that don't work.
          </p>
          <div className="space-y-2">
            {proposed.map((slot) => (
              <div
                key={slot.id}
                className={cn("flex items-center justify-between rounded-lg border p-3", SLOT_STATUS_COLORS[slot.status] || "bg-white border-slate-200")}
              >
                <p className="text-sm font-medium text-slate-900">
                  {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction(slot.id, "accept")}
                    disabled={!!actionLoading}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading === slot.id ? "…" : "Accept"}
                  </button>
                  <button
                    onClick={() => handleAction(slot.id, "decline")}
                    disabled={!!actionLoading}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Show declined slots in muted style */}
          {slots.filter((s) => s.status === "DECLINED").length > 0 && (
            <div className="mt-2 space-y-1">
              {slots
                .filter((s) => s.status === "DECLINED")
                .map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-2 opacity-60"
                  >
                    <p className="text-xs text-slate-500 line-through">
                      {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                    </p>
                    <span className="text-xs text-red-600">Declined</span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tenant Photos / Attachments Panel
// ---------------------------------------------------------------------------

function TenantPhotosPanel({ requestId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tenantFetch(`/api/tenant-portal/maintenance-attachments/${requestId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Not available");
        const body = await res.json();
        if (!cancelled) setAttachments(body?.data || []);
      })
      .catch(() => { if (!cancelled) setAttachments([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [requestId]);

  function handleUpload(e) {
    const files = e.target.files;
    if (!files?.length) return;
    const uploads = Array.from(files).map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await tenantFetch(
        `/api/tenant-portal/maintenance-attachments/${requestId}`,
        { method: "POST", body: fd },
      );
      if (!res.ok) throw new Error("Upload failed");
      const body = await res.json();
      return body?.data;
    });
    Promise.all(uploads)
      .then((newItems) => setAttachments((prev) => [...prev, ...newItems.filter(Boolean)]))
      .catch(() => alert("One or more uploads failed"))
      .finally(() => { e.target.value = ""; });
  }

  function isImage(name) {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name || "");
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function downloadUrl(a) {
    return `/api/tenant-portal/maintenance-attachments/${a.id}/download`;
  }

  if (loading) return <p className="text-xs text-slate-400 mt-2">Loading photos…</p>;

  const images = attachments.filter((a) => isImage(a.filename));
  const fileList = attachments.filter((a) => !isImage(a.filename));

  return (
    <div className="mt-3">
      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center">
          <p className="text-xs text-slate-400 mb-2">No photos yet</p>
          <label className="cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            Upload photo
            <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      ) : (
        <>
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {images.map((a, i) => (
                <button key={i} onClick={() => setPreviewUrl(downloadUrl(a))} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <img src={downloadUrl(a)} alt={a.filename} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </button>
              ))}
            </div>
          )}

          {fileList.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {fileList.map((a, i) => (
                <a key={i} href={downloadUrl(a)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50">
                  <span className="font-medium text-slate-700">{a.filename}</span>
                  {a.size && <span className="text-slate-400">{formatSize(a.size)}</span>}
                </a>
              ))}
            </div>
          )}

          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            + Upload more
            <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
          </label>
        </>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="Preview" className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain" />
            <button onClick={() => setPreviewUrl(null)} className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg hover:bg-slate-100">
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tenant Job Review Panel (confirm completion + rate)
// ---------------------------------------------------------------------------

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
          className={cn("text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 rounded disabled:cursor-default", n <= (value || 0) ? "text-yellow-400" : "text-slate-300")}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function TenantJobReviewPanel({ job, onRefresh }) {
  const [confirming, setConfirming] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [scores, setScores] = useState({ scorePunctuality: 0, scoreAccuracy: 0, scoreCourtesy: 0 });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!job) return null;
  const isCompleted = job.status === "COMPLETED" || job.status === "INVOICED";
  if (!isCompleted) return null;

  async function handleConfirm() {
    setConfirming(true);
    setError("");
    try {
      const res = await tenantFetch(`/api/tenant-portal/jobs/${job.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to confirm");
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  }

  async function handleRate(e) {
    e.preventDefault();
    const allFilled = CRITERIA.every((c) => scores[c.key] > 0);
    if (!allFilled) { setError("Please rate all three criteria."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await tenantFetch(`/api/tenant-portal/jobs/${job.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scores, comment: comment.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to submit rating");
      setShowRating(false);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-green-100 bg-green-50/50 p-4">
      <h3 className="text-sm font-semibold text-green-900 mb-2">✅ Job Completed</h3>

      <ErrorBanner error={error} className="mb-2 text-xs" />

      {/* Step 1: confirm */}
      {!job.confirmedAt && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-green-700">
            The contractor has marked this job as done. Please confirm you are satisfied.
          </p>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="ml-3 flex-shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {confirming ? "…" : "Confirm completion"}
          </button>
        </div>
      )}

      {/* Step 2: rate */}
      {job.confirmedAt && !job.tenantRated && !showRating && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-green-700">Completion confirmed. How was the service?</p>
          <button
            onClick={() => setShowRating(true)}
            className="ml-3 flex-shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Rate the service
          </button>
        </div>
      )}

      {showRating && (
        <form onSubmit={handleRate} className="mt-2 space-y-3">
          {CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center justify-between">
              <span className="text-xs text-slate-700 w-40">{c.label}</span>
              <StarRow
                value={scores[c.key]}
                onChange={(v) => setScores((prev) => ({ ...prev, [c.key]: v }))}
                disabled={submitting}
              />
            </div>
          ))}
          <div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comment (optional)"
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRating(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit rating"}
            </button>
          </div>
        </form>
      )}

      {job.tenantRated && (
        <p className="text-xs text-green-700 font-medium">Thank you — your rating has been submitted.</p>
      )}
    </div>
  );
}

const CATEGORIES = ["stove", "oven", "dishwasher", "bathroom", "lighting"];

// ---------------------------------------------------------------------------
// Tenant Claim Analysis Panel (Phase D-4)
// ---------------------------------------------------------------------------

const OBLIGATION_BADGE = {
  OBLIGATED: { variant: "success", label: "Landlord obligated" },
  DISCRETIONARY: { variant: "warning", label: "Discretionary" },
  TENANT_RESPONSIBLE: { variant: "destructive", label: "Tenant responsible" },
  RECOMMENDED: { variant: "info", label: "Recommended" },
  NOT_APPLICABLE: { variant: "muted", label: "N/A" },
  UNKNOWN: { variant: "muted", label: "Unknown" },
};

function TenantClaimAnalysisPanel({ requestId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const res = await tenantFetch(`/api/requests/${requestId}/claim-analysis`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `Analysis failed (${res.status})`);
      }
      const body = await res.json();
      setAnalysis(body?.data || null);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  if (!analysis && !loading && !error) {
    return (
      <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-violet-900">⚖️ Legal Analysis</h3>
            <p className="text-xs text-violet-700 mt-0.5">
              Get a detailed analysis of your legal rights for this issue.
            </p>
          </div>
          <button
            onClick={runAnalysis}
            className="flex-shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
          >
            Analyse my claim
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/50 p-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          <p className="text-xs text-violet-700">Analysing your claim…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-lg border border-red-100 bg-red-50/50 p-4">
        <p className="text-xs text-red-700 mb-2">{error}</p>
        <button
          onClick={runAnalysis}
          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          Try again
        </button>
      </div>
    );
  }

  const a = analysis;
  const badge = OBLIGATION_BADGE[a.legalObligation] || OBLIGATION_BADGE.UNKNOWN;

  return (
    <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/30 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-violet-900">⚖️ Legal Analysis</h3>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="text-xs text-violet-600 hover:text-violet-700 underline"
        >
          Re-analyse
        </button>
      </div>

      {/* Obligation badge + confidence */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={badge.variant} size="sm">
          {badge.label}
        </Badge>
        <span className="text-xs text-slate-500">
          Confidence: {Math.round(a.confidence || 0)}%
        </span>
        {a.legalTopic && (
          <span className="text-xs text-slate-400">• {a.legalTopic}</span>
        )}
      </div>

      {/* Tenant Guidance — always visible */}
      {a.tenantGuidance && (
        <div className="rounded-lg bg-white border border-violet-100 p-3">
          <p className="text-xs font-medium text-slate-800 mb-1">{a.tenantGuidance.summary}</p>
          {a.tenantGuidance.nextSteps?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-600 mb-1">Next steps:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                {a.tenantGuidance.nextSteps.map((step, i) => (
                  <li key={i} className="text-xs text-slate-700">{step}</li>
                ))}
              </ol>
            </div>
          )}
          {a.tenantGuidance.deadlines?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-orange-700">
                ⏰ {a.tenantGuidance.deadlines.join(" • ")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Rent reduction estimate */}
      {a.rentReduction && a.rentReduction.totalReductionChf > 0 && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3">
          <p className="text-xs font-semibold text-green-900 mb-1">
            💰 Estimated rent reduction
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold text-green-700">
              CHF {a.rentReduction.totalReductionChf.toFixed(0)}
            </span>
            <span className="text-xs text-green-700">
              / month ({a.rentReduction.totalReductionPercent}% of CHF {a.rentReduction.netRentChf})
            </span>
          </div>
          {a.rentReduction.capApplied && (
            <p className="text-xs text-green-600 mt-1">Cap applied (max 70%)</p>
          )}
          {a.temporalContext?.backdatedReductionChf > 0 && (
            <p className="text-xs text-green-600 mt-1">
              Back-dated: ~CHF {a.temporalContext.backdatedReductionChf.toFixed(0)}
              {a.temporalContext.durationMonths
                ? ` (${a.temporalContext.durationMonths} months)`
                : ""}
            </p>
          )}
        </div>
      )}

      {/* Expand/collapse for detailed sections */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-violet-600 hover:text-violet-700 font-medium"
      >
        {expanded ? "▾ Hide details" : "▸ Show detailed analysis"}
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Matched defects */}
          {a.matchedDefects?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">
                Matched precedents ({a.matchedDefects.length})
              </p>
              <div className="space-y-1.5">
                {a.matchedDefects.map((d, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 bg-white p-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-800">{d.defect}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {d.category} • {d.reductionPercent}% reduction
                          {d.reductionMax ? ` (max ${d.reductionMax}%)` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 ml-2">
                        {Math.round(d.matchConfidence)}% match
                      </span>
                    </div>
                    {d.matchReasons?.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        {d.matchReasons.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legal basis */}
          {a.legalBasis?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Legal basis</p>
              <div className="space-y-1">
                {a.legalBasis.map((b, i) => (
                  <div key={i} className="text-xs text-slate-600">
                    <span className="font-medium">{b.article}</span>
                    {b.text && <span> — {b.text}</span>}
                    <span className="text-slate-400 ml-1">({b.authority})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Landlord obligations */}
          {a.landlordObligations && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-900 mb-1">
                Landlord obligations
              </p>
              <p className="text-xs text-amber-700">{a.landlordObligations.summary}</p>
              {a.landlordObligations.requiredActions?.length > 0 && (
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {a.landlordObligations.requiredActions.map((act, i) => (
                    <li key={i} className="text-xs text-amber-700">{act}</li>
                  ))}
                </ul>
              )}
              {a.landlordObligations.timeline && (
                <p className="text-xs text-amber-600 mt-1">
                  Timeline: {a.landlordObligations.timeline}
                </p>
              )}
            </div>
          )}

          {/* Temporal context */}
          {a.temporalContext?.seasonalAdjustment && (
            <div className="text-xs text-slate-500">
              🌡️ Seasonal adjustment applied
              {a.temporalContext.proRatedPercent != null
                ? ` — pro-rated to ${a.temporalContext.proRatedPercent}%`
                : ""}
            </div>
          )}

          {/* Escalation */}
          {a.tenantGuidance?.escalation && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-2.5">
              <p className="text-xs font-semibold text-red-700">Escalation</p>
              <p className="text-xs text-red-700">{a.tenantGuidance.escalation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewRequestModal({ onClose, onCreated }) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (description.trim().length < 10) {
      setError("Description must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const body = { description: description.trim() };
      if (category) body.category = category;
      if (contactPhone.trim()) body.contactPhone = contactPhone.trim();

      const res = await tenantFetch("/api/tenant-portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Failed to submit request");
      onCreated();
    } catch (err) {
      setError(err.message || "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">New Maintenance Request</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <ErrorBanner error={error} className="text-sm" />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail (e.g. the kitchen faucet is dripping)"
              rows={4}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <p className="mt-1 text-xs text-slate-400">{description.trim().length}/2000 — min 10 characters</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">— Select a category (optional) —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Contact phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+41 79 123 45 67"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TenantRequestsPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selfPayLoading, setSelfPayLoading] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showNewRequest, setShowNewRequest] = useState(false);

  function toggleAccordion(id) { setExpandedId((prev) => (prev === id ? null : id)); }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tenantSession");
    if (!raw) { setLoading(false); router.push("/tenant"); return; }
    try { setSession(JSON.parse(raw)); } catch { setLoading(false); router.push("/tenant"); }
  }, [router]);

  const fetchRequests = useCallback(async () => {
    if (!session?.tenant?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await tenantFetch("/api/tenant-portal/requests");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Failed to load requests");
        return;
      }
      setRequests(data.data || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleSelfPay(requestId) {
    setSelfPayLoading(requestId);
    setError(null);
    try {
      const res = await tenantFetch(`/api/tenant-portal/requests/${requestId}/self-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message || "Failed to accept self-pay");
        return;
      }
      fetchRequests();
    } catch (err) {
      setError(String(err));
    } finally {
      setSelfPayLoading(null);
    }
  }

  if (!session) {
    return (
      <AppShell role="TENANT">
        <PageShell>
          <PageHeader title="My Requests" />
          <PageContent>
            <Panel>
              <div className="empty-state">
                <p className="empty-state-text">Please sign in to view your requests.</p>
                <button
                  onClick={() => router.push("/tenant")}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Sign in
                </button>
              </div>
            </Panel>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  function handleTenantSwitch() {
    const raw = localStorage.getItem("tenantSession");
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }

  return (
    <AppShell role="TENANT">
      <PageShell>
        <TenantPicker onSelect={handleTenantSwitch} />
        <PageHeader
          title="My Maintenance Requests"
          actions={
            <button
              onClick={() => setShowNewRequest(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + New request
            </button>
          }
        />
        <PageContent>
          {error && <div className="notice notice-err mb-4">{error}</div>}

          {showNewRequest && (
            <NewRequestModal
              onClose={() => setShowNewRequest(false)}
              onCreated={() => { setShowNewRequest(false); fetchRequests(); }}
            />
          )}

          <Panel bodyClassName="p-0">
            {loading ? (
              <p className="loading-text">Loading…</p>
            ) : requests.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No maintenance requests yet.</p>
                <button
                  onClick={() => setShowNewRequest(true)}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Submit your first request
                </button>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {requests.map((r) => {
              const isExpanded = expandedId === r.id;
              return (
                <div key={r.id} className="card border overflow-hidden">
                  {/* Clickable header */}
                  <div
                    className="flex cursor-pointer items-start justify-between p-4 hover:bg-slate-50"
                    onClick={() => toggleAccordion(r.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {r.requestNumber ? <span className="text-slate-500 font-mono">#{r.requestNumber}</span> : null}
                        {r.requestNumber ? " " : ""}{r.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={requestVariant(r.status)} size="sm">
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                        {r.payingParty === "TENANT" && (
                          <Badge variant="warning" size="sm">
                            Self-pay
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-slate-400">
                        {r.buildingName && <span>{r.buildingName}</span>}
                        {r.unitNumber && <span>Unit {r.unitNumber}</span>}
                        {r.category && <span>{r.category}</span>}
                        <span>{formatDateTime(r.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {r.status === "OWNER_REJECTED" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelfPay(r.id); }}
                          disabled={selfPayLoading === r.id}
                          className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded hover:bg-orange-600 disabled:opacity-50"
                        >
                          {selfPayLoading === r.id ? "Processing…" : "Proceed at my own expense"}
                        </button>
                      )}
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
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                      {r.rejectionReason && r.status === "OWNER_REJECTED" && (
                        <p className="mb-2 text-xs text-red-600">Reason: {r.rejectionReason}</p>
                      )}

                      {/* Photos / Attachments */}
                      <TenantPhotosPanel requestId={r.id} />

                      {/* Scheduling — show whenever a job may exist (component handles no-slots gracefully) */}
                      {r.status !== "PENDING_REVIEW" && r.status !== "OWNER_REJECTED" && (
                        <TenantSchedulingPanel requestId={r.id} />
                      )}

                      {/* Legal claim analysis */}
                      <TenantClaimAnalysisPanel requestId={r.id} />

                      {/* Job completion review */}
                      {r.job && (
                        <TenantJobReviewPanel
                          job={r.job}
                          onRefresh={fetchRequests}
                        />
                      )}
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
