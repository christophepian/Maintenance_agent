import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { ownerAuthHeaders } from "../../../lib/api";

const STATUS_COLORS = {
  DRAFT: "bg-slate-50 text-slate-600 border-slate-200",
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  AWARDED: "bg-green-50 text-green-700 border-green-200",
  PENDING_OWNER_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  CLOSED: "bg-slate-50 text-slate-500 border-slate-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
};

const QUOTE_STATUS_COLORS = {
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  AWARDED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
};

function StatusPill({ status, colorMap }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
        (colorMap || STATUS_COLORS)[status] || "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {status?.replace(/_/g, " ") || "—"}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH");
}

function formatCHF(cents) {
  if (cents == null) return "—";
  return `CHF ${(cents / 100).toFixed(2)}`;
}

export default function OwnerRfpDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [rfp, setRfp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [awardError, setAwardError] = useState("");

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rfps/${id}`, { headers: ownerAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load RFP");
      setRfp(data?.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApproveAward = useCallback(
    async (quoteId, contractorName) => {
      if (!confirm(`Approve award to ${contractorName || "this contractor"}?`)) return;
      setAwarding(true);
      setAwardError("");
      try {
        const res = await fetch(`/api/rfps/${id}/award`, {
          method: "POST",
          headers: { ...ownerAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg =
            data?.error?.message ||
            data?.error?.code ||
            "Failed to approve award";
          throw new Error(msg);
        }
        await loadData();
      } catch (e) {
        setAwardError(String(e?.message || e));
      } finally {
        setAwarding(false);
      }
    },
    [id, loadData],
  );

  const title = rfp ? `RFP #${rfp.id?.slice(0, 8)}` : "RFP Detail";

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title={title}
          subtitle={rfp ? `Category: ${rfp.category || "—"}` : "Loading…"}
          actions={
            <Link
              href="/owner/rfps"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Back to RFPs
            </Link>
          }
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : rfp ? (
            <>
              {/* Owner Approval Banner */}
              {rfp.status === "PENDING_OWNER_APPROVAL" && (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-6 py-4 text-sm text-amber-900">
                  <p className="font-semibold text-base mb-1">⚠️ Your Approval Required</p>
                  <p>
                    The manager has selected a quote that exceeds the building's auto-approval
                    threshold. Please review the quotes below and approve the award.
                  </p>
                </div>
              )}

              {/* RFP Metadata */}
              <Panel title="RFP Details">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Status</dt>
                    <dd className="mt-1">
                      <StatusPill status={rfp.status} colorMap={STATUS_COLORS} />
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
                    <dt className="text-sm font-medium text-slate-500">Building</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {rfp.building?.name || "—"}
                      {rfp.building?.address && (
                        <span className="text-slate-500"> · {rfp.building.address}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Unit</dt>
                    <dd className="mt-1 text-sm text-slate-900">{rfp.unit?.unitNumber || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Quote Deadline</dt>
                    <dd className="mt-1 text-sm text-slate-900">{formatDate(rfp.deadlineAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Created</dt>
                    <dd className="mt-1 text-sm text-slate-900">{formatDate(rfp.createdAt)}</dd>
                  </div>
                  {rfp.awardedContractor && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Awarded To</dt>
                      <dd className="mt-1 text-sm text-green-700 font-medium">
                        {rfp.awardedContractor.name}
                      </dd>
                    </div>
                  )}
                </dl>
              </Panel>

              {/* Quotes */}
              <Panel
                title={`Quotes (${rfp.quotes?.length || 0})`}
                bodyClassName="p-0"
              >
                {awardError && (
                  <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {awardError}
                  </div>
                )}
                {rfp.quotes?.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {rfp.quotes.map((q) => (
                      <div
                        key={q.id}
                        className={`p-4 ${
                          q.status === "AWARDED" ? "bg-green-50/40" :
                          q.status === "REJECTED" ? "bg-slate-50/60 opacity-75" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">
                              {q.contractor?.name || q.contractorId?.slice(0, 8)}
                            </span>
                            <StatusPill status={q.status || "SUBMITTED"} colorMap={QUOTE_STATUS_COLORS} />
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-base font-semibold text-slate-900 font-mono">
                              {formatCHF(q.amountCents)}
                              {q.vatIncluded === false && (
                                <span className="text-xs text-slate-400 ml-1">excl. VAT</span>
                              )}
                            </span>
                            {(rfp.status === "OPEN" || rfp.status === "PENDING_OWNER_APPROVAL") &&
                              q.status === "SUBMITTED" && (
                              <button
                                onClick={() => handleApproveAward(q.id, q.contractor?.name)}
                                disabled={awarding}
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {awarding ? "Awarding…" : "🏆 Award"}
                              </button>
                            )}
                          </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 text-sm mb-2">
                          {q.estimatedDurationDays && (
                            <div>
                              <dt className="text-xs text-slate-500">Duration</dt>
                              <dd className="text-slate-900">{q.estimatedDurationDays} day{q.estimatedDurationDays !== 1 ? "s" : ""}</dd>
                            </div>
                          )}
                          {q.earliestAvailability && (
                            <div>
                              <dt className="text-xs text-slate-500">Available</dt>
                              <dd className="text-slate-900">{formatDate(q.earliestAvailability)}</dd>
                            </div>
                          )}
                          {q.validUntil && (
                            <div>
                              <dt className="text-xs text-slate-500">Valid Until</dt>
                              <dd className="text-slate-900">{formatDate(q.validUntil)}</dd>
                            </div>
                          )}
                          <div>
                            <dt className="text-xs text-slate-500">Submitted</dt>
                            <dd className="text-slate-900">{formatDate(q.submittedAt)}</dd>
                          </div>
                        </dl>
                        {q.workPlan && (
                          <div className="mt-2">
                            <dt className="text-xs font-medium text-slate-500">Work Plan</dt>
                            <dd className="mt-0.5 text-sm text-slate-700 whitespace-pre-line">{q.workPlan}</dd>
                          </div>
                        )}
                        {q.assumptions && (
                          <div className="mt-2">
                            <dt className="text-xs font-medium text-slate-500">Assumptions</dt>
                            <dd className="mt-0.5 text-sm text-slate-500 whitespace-pre-line">{q.assumptions}</dd>
                          </div>
                        )}
                        {q.notes && (
                          <div className="mt-2">
                            <dt className="text-xs font-medium text-slate-500">Notes</dt>
                            <dd className="mt-0.5 text-sm text-slate-500">{q.notes}</dd>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    No quotes submitted yet.
                  </p>
                )}
              </Panel>
            </>
          ) : (
            <p className="text-sm text-slate-500">RFP not found.</p>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
