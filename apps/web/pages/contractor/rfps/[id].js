import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import ContractorPicker from "../../../components/ContractorPicker";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import { formatDate, formatChfCents } from "../../../lib/format";
import { authHeaders } from "../../../lib/api";
import { useDetailResource } from "../../../lib/hooks/useDetailResource";
import Badge from "../../../components/ui/Badge";
import { rfpVariant, slotVariant } from "../../../lib/statusVariants";

import { cn } from "../../../lib/utils";

/* ── Quote Submission Form ─────────────────────────────────────── */

function QuoteForm({ rfpId, onSubmitted }) {
  const [form, setForm] = useState({
    amountCents: "",
    workPlan: "",
    notes: "",
    estimatedDurationDays: "",
    earliestAvailability: "",
    assumptions: "",
    validUntil: "",
    vatIncluded: true,
  });
  const [lineItems, setLineItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { description: "", amountCents: "" }]);
  };

  const updateLineItem = (idx, field, value) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  };

  const removeLineItem = (idx) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const amountCents = Math.round(parseFloat(form.amountCents) * 100);
    if (!amountCents || amountCents < 1) {
      return setError("Amount must be at least CHF 0.01");
    }
    if (!form.workPlan.trim()) {
      return setError("Work plan is required");
    }

    const contractorId =
      typeof window !== "undefined" ? localStorage.getItem("contractorId") : null;
    if (!contractorId) {
      return setError("No contractor selected");
    }

    const body = {
      amountCents,
      currency: "CHF",
      vatIncluded: form.vatIncluded,
      workPlan: form.workPlan.trim(),
    };
    if (form.notes.trim()) body.notes = form.notes.trim();
    if (form.estimatedDurationDays) body.estimatedDurationDays = parseInt(form.estimatedDurationDays, 10);
    if (form.earliestAvailability) body.earliestAvailability = new Date(form.earliestAvailability).toISOString();
    if (form.assumptions.trim()) body.assumptions = form.assumptions.trim();
    if (form.validUntil) body.validUntil = new Date(form.validUntil).toISOString();
    if (lineItems.length > 0) {
      body.lineItems = lineItems
        .filter((li) => li.description.trim())
        .map((li) => ({
          description: li.description.trim(),
          amountCents: Math.round(parseFloat(li.amountCents || "0") * 100),
        }));
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/contractor/rfps/${rfpId}/quotes?contractorId=${contractorId}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.message || "Failed to submit quote");
      onSubmitted();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
      <h2 className="text-base font-semibold text-slate-900 mb-4">Submit Your Quote</h2>

      <ErrorBanner error={error} className="mb-4 text-sm" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Total Amount (CHF) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="amountCents"
            step="0.01"
            min="0.01"
            value={form.amountCents}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. 1500.00"
          />
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="vatIncluded"
              checked={form.vatIncluded}
              onChange={handleChange}
              className="rounded border-slate-300"
            />
            VAT included
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Estimated Duration (days)
          </label>
          <input
            type="number"
            name="estimatedDurationDays"
            min="1"
            value={form.estimatedDurationDays}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. 5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Earliest Availability
          </label>
          <input
            type="date"
            name="earliestAvailability"
            value={form.earliestAvailability}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Quote Valid Until
          </label>
          <input
            type="date"
            name="validUntil"
            value={form.validUntil}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Work Plan <span className="text-red-500">*</span>
        </label>
        <textarea
          name="workPlan"
          value={form.workPlan}
          onChange={handleChange}
          required
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Describe the proposed work plan, methods, and timeline…"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Assumptions / Exclusions
        </label>
        <textarea
          name="assumptions"
          value={form.assumptions}
          onChange={handleChange}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Any assumptions, exclusions, or conditions…"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Additional Notes
        </label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Any other information for the manager…"
        />
      </div>

      {/* Line Items */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">
            Line Items (optional)
          </label>
          <button
            type="button"
            onClick={addLineItem}
            className="cell-link text-xs"
          >
            + Add line item
          </button>
        </div>
        {lineItems.map((item, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input
              type="text"
              value={item.description}
              onChange={(e) => updateLineItem(idx, "description", e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="Description"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={item.amountCents}
              onChange={(e) => updateLineItem(idx, "amountCents", e.target.value)}
              className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="CHF"
            />
            <button
              type="button"
              onClick={() => removeLineItem(idx)}
              className="text-red-500 hover:text-red-700 text-sm px-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Quote"}
      </button>
    </form>
  );
}

/* ── Quote Summary (read-only, after submission) ───────────────── */

/* ── Slot Proposal Form ────────────────────────────────────────── */

function SlotProposalForm({ jobId, onProposed }) {
  const [slots, setSlots] = useState([{ date: "", startTime: "", endTime: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addSlot = () => {
    if (slots.length >= 5) return;
    setSlots((prev) => [...prev, { date: "", startTime: "", endTime: "" }]);
  };

  const removeSlot = (idx) => {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSlot = (idx, field, value) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const contractorId =
      typeof window !== "undefined" ? localStorage.getItem("contractorId") : null;
    if (!contractorId) return setError("No contractor selected");

    // Validate and build ISO timestamps
    const parsed = [];
    for (let i = 0; i < slots.length; i++) {
      const { date, startTime, endTime } = slots[i];
      if (!date || !startTime || !endTime) {
        return setError(`Slot ${i + 1}: date, start time, and end time are all required`);
      }
      const start = new Date(`${date}T${startTime}`);
      const end = new Date(`${date}T${endTime}`);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return setError(`Slot ${i + 1}: invalid date/time`);
      }
      if (start >= end) {
        return setError(`Slot ${i + 1}: start time must be before end time`);
      }
      if (start <= new Date()) {
        return setError(`Slot ${i + 1}: must be in the future`);
      }
      parsed.push({ startTime: start.toISOString(), endTime: end.toISOString() });
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`,
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ slots: parsed }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to propose slots");
      onProposed();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner error={error} className="text-sm" />

      {slots.map((slot, idx) => (
        <div key={idx} className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
            <input
              type="date"
              value={slot.date}
              onChange={(e) => updateSlot(idx, "date", e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input
              type="time"
              value={slot.startTime}
              onChange={(e) => updateSlot(idx, "startTime", e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input
              type="time"
              value={slot.endTime}
              onChange={(e) => updateSlot(idx, "endTime", e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {slots.length > 1 && (
            <button
              type="button"
              onClick={() => removeSlot(idx)}
              className="text-red-500 hover:text-red-700 text-sm px-2 py-2"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3">
        {slots.length < 5 && (
          <button
            type="button"
            onClick={addSlot}
            className="cell-link text-xs"
          >
            + Add another time slot
          </button>
        )}
        <span className="text-xs text-slate-400">{slots.length}/5 slots</span>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? "Proposing…" : "Propose Time Slots"}
      </button>
    </form>
  );
}

/* ── Existing Slots Display ────────────────────────────────────── */



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

function ExistingSlotsPanel({ slots }) {
  if (!slots || slots.length === 0) return null;

  const accepted = slots.find((s) => s.status === "ACCEPTED");

  return (
    <div className="space-y-3">
      {accepted && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-green-700 text-lg">✓</span>
            <h3 className="text-sm font-semibold text-green-900">
              Appointment Confirmed
            </h3>
          </div>
          <p className="text-sm text-green-700">
            {formatSlotTime(accepted.startTime)} – {formatSlotTime(accepted.endTime)}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {slots.map((slot) => (
          <div
            key={slot.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div>
              <p className="text-sm font-medium">
                {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
              </p>
            </div>
            <Badge variant={slotVariant(slot.status)} size="sm">
              {slot.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Scheduling Section (Contractor) ──────────────────────────── */

function SchedulingSection({ jobId }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSlots = useCallback(async () => {
    if (!jobId) return;
    const contractorId =
      typeof window !== "undefined" ? localStorage.getItem("contractorId") : null;
    if (!contractorId) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`,
        { headers: authHeaders() },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load slots");
      setSlots(data?.data || []);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const hasAccepted = slots.some((s) => s.status === "ACCEPTED");
  const hasProposed = slots.some((s) => s.status === "PROPOSED");

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
      <h2 className="text-base font-semibold text-slate-900 mb-1">
        📅 Appointment Scheduling
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Propose up to 5 time slots for the tenant to choose from.
        The tenant has 72 hours to respond before the manager is notified.
      </p>

      <ErrorBanner error={error} className="mb-4 text-sm" />

      {loading ? (
        <p className="text-sm text-slate-400">Loading slots…</p>
      ) : (
        <>
          <ExistingSlotsPanel slots={slots} />

          {hasAccepted ? (
            <p className="mt-3 text-sm text-green-700 font-medium">
              The tenant has accepted a time slot. No further action needed.
            </p>
          ) : hasProposed ? (
            <p className="mt-3 text-sm text-yellow-700">
              Waiting for tenant to respond to your proposed time slots…
            </p>
          ) : (
            <SlotProposalForm jobId={jobId} onProposed={loadSlots} />
          )}
        </>
      )}
    </div>
  );
}

const QUOTE_STATUS_CONFIG = {
  AWARDED: {
    borderClass: "border-green-300",
    bgClass: "bg-green-50",
    icon: "🎉",
    heading: "Your Quote Has Been Awarded!",
    headingColor: "text-green-900",
    labelColor: "text-green-700",
    valueColor: "text-green-900",
    rowBorder: "border-green-100",
  },
  REJECTED: {
    borderClass: "border-amber-200",
    bgClass: "bg-amber-50",
    icon: "—",
    heading: "This RFP was awarded to another contractor",
    headingColor: "text-amber-900",
    labelColor: "text-amber-700",
    valueColor: "text-amber-900",
    rowBorder: "border-amber-100",
  },
  SUBMITTED: {
    borderClass: "border-green-200",
    bgClass: "bg-green-50",
    icon: "✓",
    heading: "Your Quote Has Been Submitted",
    headingColor: "text-green-900",
    labelColor: "text-green-700",
    valueColor: "text-green-900",
    rowBorder: "border-green-100",
  },
};

function QuoteSummary({ quote }) {
  const status = quote.status || "SUBMITTED";
  const cfg = QUOTE_STATUS_CONFIG[status] || QUOTE_STATUS_CONFIG.SUBMITTED;

  return (
    <div className={cn(cfg.bgClass, "border", cfg.borderClass, "rounded-lg p-6 mb-4")}>
      <div className="flex items-center gap-2 mb-4">
        <span className={cn(cfg.headingColor, "text-lg")}>{cfg.icon}</span>
        <h2 className={cn("text-base font-semibold", cfg.headingColor)}>{cfg.heading}</h2>
      </div>
      {status === "REJECTED" && (
        <p className="text-sm text-amber-700 mb-4">
          Thank you for your submission. Your quote details are shown below for your records.
        </p>
      )}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className={cn("text-sm font-medium", cfg.labelColor)}>Amount</dt>
          <dd className={cn("mt-1 text-sm font-semibold", cfg.valueColor)}>{formatChfCents(quote.amountCents)}</dd>
        </div>
        <div>
          <dt className={cn("text-sm font-medium", cfg.labelColor)}>VAT</dt>
          <dd className={cn("mt-1 text-sm", cfg.valueColor)}>{quote.vatIncluded ? "Included" : "Excluded"}</dd>
        </div>
        {quote.estimatedDurationDays && (
          <div>
            <dt className={cn("text-sm font-medium", cfg.labelColor)}>Est. Duration</dt>
            <dd className={cn("mt-1 text-sm", cfg.valueColor)}>{quote.estimatedDurationDays} day{quote.estimatedDurationDays !== 1 ? "s" : ""}</dd>
          </div>
        )}
        {quote.earliestAvailability && (
          <div>
            <dt className={cn("text-sm font-medium", cfg.labelColor)}>Earliest Available</dt>
            <dd className={cn("mt-1 text-sm", cfg.valueColor)}>{formatDate(quote.earliestAvailability)}</dd>
          </div>
        )}
        {quote.validUntil && (
          <div>
            <dt className={cn("text-sm font-medium", cfg.labelColor)}>Valid Until</dt>
            <dd className={cn("mt-1 text-sm", cfg.valueColor)}>{formatDate(quote.validUntil)}</dd>
          </div>
        )}
        <div>
          <dt className={cn("text-sm font-medium", cfg.labelColor)}>Submitted</dt>
          <dd className={cn("mt-1 text-sm", cfg.valueColor)}>{formatDate(quote.submittedAt)}</dd>
        </div>
      </dl>
      {quote.workPlan && (
        <div className="mt-3">
          <dt className={cn("text-sm font-medium", cfg.labelColor)}>Work Plan</dt>
          <dd className={cn("mt-1 text-sm", cfg.valueColor, "whitespace-pre-line")}>{quote.workPlan}</dd>
        </div>
      )}
      {quote.assumptions && (
        <div className="mt-3">
          <dt className={cn("text-sm font-medium", cfg.labelColor)}>Assumptions</dt>
          <dd className={cn("mt-1 text-sm", cfg.valueColor, "whitespace-pre-line")}>{quote.assumptions}</dd>
        </div>
      )}
      {quote.notes && (
        <div className="mt-3">
          <dt className={cn("text-sm font-medium", cfg.labelColor)}>Notes</dt>
          <dd className={cn("mt-1 text-sm", cfg.valueColor, "whitespace-pre-line")}>{quote.notes}</dd>
        </div>
      )}
      {quote.lineItems && quote.lineItems.length > 0 && (
        <div className="mt-3">
          <dt className={cn("text-sm font-medium", cfg.labelColor, "mb-1")}>Line Items</dt>
          <dd className="mt-1">
            <table className="inline-table">
              <tbody>
                {quote.lineItems.map((li, idx) => (
                  <tr key={idx} className={cn("border-b", cfg.rowBorder, "last:border-0")}>
                    <td className={cn("py-1", cfg.valueColor)}>{li.description}</td>
                    <td className={cn("py-1 text-right font-mono", cfg.valueColor)}>{formatChfCents(li.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </dd>
        </div>
      )}
    </div>
  );
}

export default function ContractorRfpDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [contractorId, setContractorId] = useState(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setContractorId(localStorage.getItem("contractorId"));
    }
  }, []);

  const { data: rfp, loading, error, refresh: loadData } = useDetailResource(
    id && contractorId ? `/api/contractor/rfps/${id}?contractorId=${contractorId}` : null
  );

  const noContractor = !contractorId && typeof window !== "undefined";

  const title = rfp ? `RFP #${rfp.id?.slice(0, 8)}` : "RFP Detail";

  return (
    <AppShell role="CONTRACTOR">
      <div className="max-w-[900px]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="mt-0 mb-1">{title}</h1>
            <p className="text-sm text-slate-500">
              {rfp ? `Category: ${rfp.category || "—"}` : "Loading…"}
            </p>
          </div>
          <Link
            href="/contractor/rfps"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to RFPs
          </Link>
        </div>

        <ContractorPicker onSelect={() => setContractorId(localStorage.getItem("contractorId"))} />

        <ErrorBanner error={noContractor ? "No contractor selected. Please select a contractor first." : error} className="mb-4" />

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rfp ? (
          <>
            {/* RFP Metadata */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
              <h2 className="text-base font-semibold text-slate-900 mb-4">RFP Details</h2>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Status</dt>
                  <dd className="mt-1">
                    <Badge variant={rfpVariant(rfp.status)}>{rfp.status}</Badge>
                    {rfp.isInvited && (
                      <Badge variant="brand" size="sm" className="ml-2">
                        You are invited
                      </Badge>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Category</dt>
                  <dd className="mt-1 text-sm text-slate-900">{rfp.category || "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Legal Obligation</dt>
                  <dd className="mt-1 text-sm text-slate-900">{rfp.legalObligation || "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Location</dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {rfp.buildingName || "—"}
                    {rfp.postalCode && (
                      <span className="text-slate-500"> · {rfp.postalCode}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Unit</dt>
                  <dd className="mt-1 text-sm text-slate-900">{rfp.unitNumber || "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Quote Deadline</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formatDate(rfp.deadlineAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Created</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formatDate(rfp.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Quotes Submitted</dt>
                  <dd className="mt-1 text-sm text-slate-900">{rfp.quoteCount}</dd>
                </div>
              </dl>
            </div>

            {/* Linked Request — contractor-safe (no tenant identity, no full address) */}
            {rfp.request && (
              <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Work Description</h2>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Request #</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">
                      #{rfp.request.requestNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Category</dt>
                    <dd className="mt-1 text-sm text-slate-900">{rfp.request.category || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Request Date</dt>
                    <dd className="mt-1 text-sm text-slate-900">{formatDate(rfp.request.createdAt)}</dd>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <dt className="text-sm font-medium text-slate-500">Description</dt>
                    <dd className="mt-1 text-sm text-slate-900 whitespace-pre-line">
                      {rfp.request.description || "—"}
                    </dd>
                  </div>
                  {rfp.request.attachmentCount > 0 && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Photos / Attachments</dt>
                      <dd className="mt-1 text-sm text-slate-900">
                        {rfp.request.attachmentCount} file{rfp.request.attachmentCount !== 1 ? "s" : ""}
                        <span className="text-xs text-slate-400 ml-1">(available after award)</span>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Quote Section: submitted quote summary OR submission form */}
            {rfp.myQuote ? (
              <QuoteSummary quote={rfp.myQuote} />
            ) : rfp.status === "OPEN" ? (
              <QuoteForm rfpId={rfp.id} onSubmitted={() => loadData()} />
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                <p className="text-sm text-slate-600">
                  This RFP is no longer accepting quotes.
                </p>
              </div>
            )}

            {/* Scheduling Section: appears after award when a job exists */}
            {rfp.status === "AWARDED" && rfp.jobId && (
              <SchedulingSection jobId={rfp.jobId} />
            )}
          </>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded p-8 text-center">
            <p className="text-slate-600">RFP not found or not accessible.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
