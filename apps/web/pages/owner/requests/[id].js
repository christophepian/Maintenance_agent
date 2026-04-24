import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { ownerAuthHeaders } from "../../../lib/api";
import Badge from "../../../components/ui/Badge";
import { urgencyVariant } from "../../../lib/statusVariants";
import RecommendationPanel from "../../../components/RecommendationPanel";
import { cn } from "../../../lib/utils";
import {
  LegalRecommendationPanel,
  RequestPhotosPanel,
  getNextStep,
  requestFormatDate as formatDate,
  formatCurrency,
} from "../../manager/requests";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const REQUEST_STAGES_BASE = [
  { key: "review",      label: "Review" },
  { key: "rfp",         label: "RFP" },
  { key: "contractor",  label: "Contractor" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed",   label: "Completed" },
];

const REQUEST_STAGES_WITH_OWNER = [
  { key: "review",         label: "Review" },
  { key: "rfp",            label: "RFP" },
  { key: "contractor",     label: "Contractor" },
  { key: "owner_approval", label: "Pending Owner Approval" },
  { key: "in_progress",    label: "In Progress" },
  { key: "completed",      label: "Completed" },
];

function getStagesForStatus(status) {
  return status === "PENDING_OWNER_APPROVAL"
    ? REQUEST_STAGES_WITH_OWNER
    : REQUEST_STAGES_BASE;
}

function stageIndexForStatus(status) {
  if (status === "PENDING_OWNER_APPROVAL") return 3;
  switch (status) {
    case "PENDING_REVIEW":  return 0;
    case "RFP_PENDING":
    case "AUTO_APPROVED":
    case "APPROVED":
    case "REJECTED":        return 1;
    case "ASSIGNED":        return 2;
    case "IN_PROGRESS":     return 3;
    case "COMPLETED":       return 4;
    default:                return 0;
  }
}

const REC_STYLES = {
  REPAIR:           { variant: "success",     label: "Repair" },
  MONITOR:          { variant: "warning",     label: "Monitor" },
  PLAN_REPLACEMENT: { variant: "warning",     label: "Plan Replacement" },
  REPLACE:          { variant: "destructive", label: "Replace" },
};

const NEXT_STEP_STYLES = {
  info:    "border-blue-200 bg-blue-50 text-blue-700",
  warn:    "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-green-200 bg-green-50 text-green-700",
  error:   "border-red-200 bg-red-50 text-red-700",
};

/** Build a human-readable reason string for why owner sign-off is required. */
function buildApprovalReason(r, rfpData) {
  const awardedQuote = rfpData?.quotes?.find((q) => q.id === rfpData?.awardedQuoteId);
  const contractorName =
    rfpData?.awardedContractor?.name ||
    awardedQuote?.contractor?.name ||
    null;
  const amountChf =
    awardedQuote?.amountCents != null
      ? formatCurrency(awardedQuote.amountCents / 100)
      : null;

  let reason = "Quoted amount exceeds the auto-approval limit for this building.";
  if (r?.approvalSource === "MANAGER_MANUAL") {
    reason = "Manager escalated this request for your review.";
  }

  return { reason, contractorName, amountChf };
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || "\u2014"}</dd>
    </div>
  );
}

/* ── Status pipeline timeline ───────────────────────────────── */

function StatusPipeline({ status, payingParty }) {
  const [expanded, setExpanded] = useState(false);
  const stages = getStagesForStatus(status);
  const idx = stageIndexForStatus(status);
  const isRejected = status === "REJECTED";
  const isTenantFunded = payingParty === "TENANT";

  function connectorColor(i) {
    if (i >= idx) return "bg-slate-200";
    if (isRejected && !isTenantFunded) return "bg-red-300";
    if (isTenantFunded && isRejected) return "bg-orange-300";
    return "bg-green-400";
  }

  function getDotCls(i) {
    const isCurrent = i === idx;
    const reached = i <= idx;
    const rejectedHere = isRejected && !isTenantFunded && i === idx;
    const tenantFundedHere = isTenantFunded && isRejected && i === idx;
    if (rejectedHere)     return "bg-red-500 border-red-600";
    if (tenantFundedHere) return "bg-orange-500 border-orange-600";
    if (isCurrent)        return "bg-indigo-500 border-indigo-600 ring-4 ring-indigo-100";
    if (reached)          return "bg-green-500 border-green-600";
    return "bg-slate-200 border-slate-300";
  }

  function getLabelText(stage, i) {
    const isCurrent = i === idx;
    if (!isCurrent) return stage.label;
    switch (status) {
      case "PENDING_REVIEW":         return "Pending Review";
      case "RFP_PENDING":            return "RFP Pending";
      case "PENDING_OWNER_APPROVAL": return "Pending Owner Approval";
      case "AUTO_APPROVED":          return "Auto-Approved";
      case "APPROVED":               return "Approved";
      case "REJECTED":               return isTenantFunded ? "Tenant-Funded" : "Rejected";
      default:                       return stage.label;
    }
  }

  function getLabelCls(i) {
    const reached = i <= idx;
    const isCurrent = i === idx;
    const rejectedHere = isRejected && !isTenantFunded && i === idx;
    const tenantFundedHere = isTenantFunded && isRejected && i === idx;
    if (rejectedHere)     return "text-red-600 font-semibold";
    if (tenantFundedHere) return "text-orange-600 font-semibold";
    if (isCurrent)        return "text-indigo-700 font-semibold";
    if (reached)          return "text-green-700";
    return "text-slate-400";
  }

  const currentStage = stages[idx];
  const nextStage    = stages[idx + 1] ?? null;

  return (
    <>
      {/* Mobile: compressed summary + optional expand */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 focus-visible:outline-none"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("h-3 w-3 rounded-full border-2 shrink-0", getDotCls(idx))} />
            <span className={cn("text-sm truncate", getLabelCls(idx))}>{getLabelText(currentStage, idx)}</span>
            {nextStage && (
              <>
                <svg className="h-3.5 w-3.5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <div className={cn("h-3 w-3 rounded-full border-2 shrink-0", getDotCls(idx + 1))} />
                <span className={cn("text-sm truncate text-slate-400", getLabelCls(idx + 1))}>{getLabelText(nextStage, idx + 1)}</span>
              </>
            )}
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", expanded && "rotate-180")}
          >
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {stages.map((stage, i) => (
              <div key={stage.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-0.5">
                  <div className={cn("h-3.5 w-3.5 rounded-full border-2 shrink-0", getDotCls(i))} />
                  {i < stages.length - 1 && (
                    <div className={cn("mt-1 h-5 w-0.5", connectorColor(i))} />
                  )}
                </div>
                <span className={cn("pt-0.5 text-xs leading-5", getLabelCls(i))}>
                  {getLabelText(stage, i)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: horizontal pipeline */}
      <div className="hidden sm:flex sm:items-start sm:w-full">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex flex-col items-center flex-1">
            <div className="flex items-center w-full">
              {i > 0 && <div className={cn("h-0.5 flex-1", connectorColor(i - 1))} />}
              <div className={cn("h-3.5 w-3.5 rounded-full border-2 shrink-0", getDotCls(i))} />
              {i < stages.length - 1 && <div className={cn("h-0.5 flex-1", connectorColor(i))} />}
            </div>
            <span className={cn("mt-1.5 text-[11px] leading-tight text-center", getLabelCls(i))}>
              {getLabelText(stage, i)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Depreciation bar ────────────────────────────────────────── */

function DepreciationBar({ pct }) {
  const c =
    pct >= 100 ? "bg-red-500"    :
    pct >= 85  ? "bg-orange-500" :
    pct >= 65  ? "bg-amber-500"  :
                 "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", c)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600 tabular-nums w-10 text-right">{pct}%</span>
    </div>
  );
}

/* ── Asset recommendation content ── */

function AssetRecommendationContent({ assetId, repairReplaceData, requestEstimate }) {
  if (!assetId) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-slate-400 m-0">No asset linked to this request.</p>
        <p className="text-xs text-slate-400 mt-1 m-0">Link an asset to get repair / replace recommendations.</p>
      </div>
    );
  }

  if (!repairReplaceData || repairReplaceData.loading) {
    return <p className="text-sm text-slate-400 animate-pulse m-0">Loading asset analysis&hellip;</p>;
  }

  if (repairReplaceData.error) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Recommendation</span>
          <p className="mt-1 text-sm text-slate-400 m-0">Not available</p>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Estimated price</span>
          <p className="mt-1 text-sm text-slate-400 m-0">Not available</p>
        </div>
      </div>
    );
  }

  const items = repairReplaceData.data || [];
  const item  = items.find((a) => a.applianceId === assetId);

  if (!item) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-slate-400 m-0">No repair-vs-replace data available for this asset.</p>
      </div>
    );
  }

  const rec = REC_STYLES[item.recommendation] || REC_STYLES.REPAIR;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Badge variant={rec.variant} size="lg" className="shrink-0">{rec.label}</Badge>
        {item.explanation && (
          <p className="text-xs text-slate-500 leading-relaxed m-0">{item.explanation}</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">{item.applianceName || "Asset"}</span>
          {item.ageMonths != null && item.usefulLifeMonths != null && (
            <span>{Math.round(item.ageMonths / 12)}y / {Math.round(item.usefulLifeMonths / 12)}y useful life</span>
          )}
        </div>
        <DepreciationBar pct={item.depreciationPct ?? 0} />
      </div>

      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
        <div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Est. repair</span>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 m-0">
            {requestEstimate > 0
              ? formatCurrency(requestEstimate)
              : item.cumulativeRepairCostChf > 0
                ? <>{formatCurrency(item.cumulativeRepairCostChf)} <span className="font-normal text-xs text-slate-400">(cumulative)</span></>
                : "\u2014"}
          </p>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Est. replacement</span>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 m-0">
            {item.estimatedReplacementCostChf > 0 ? formatCurrency(item.estimatedReplacementCostChf) : "\u2014"}
          </p>
        </div>
      </div>

      {item.repairReplaceRatio != null && item.repairReplaceRatio > 0 && (
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            Ratio:{" "}
            <strong className={
              item.repairReplaceRatio >= 0.6 ? "text-red-600"    :
              item.repairReplaceRatio >= 0.4 ? "text-orange-600" :
              "text-slate-700"
            }>
              {Math.round(item.repairReplaceRatio * 100)}%
            </strong>
          </span>
          {item.breakEvenMonths != null && (
            <span>
              Break-even:{" "}
              <strong className={
                item.breakEvenMonths === 0 ? "text-red-600"    :
                item.breakEvenMonths < 12  ? "text-red-600"    :
                item.breakEvenMonths < 36  ? "text-amber-600"  :
                "text-slate-700"
              }>
                {item.breakEvenMonths === 0 ? "Exceeded" : `${item.breakEvenMonths}mo`}
              </strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════ */

export default function OwnerRequestDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [request, setRequest]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab]         = useState("details");

  const [legalState, setLegalState]       = useState({ loading: true, error: null, data: null });
  const [repairReplace, setRepairReplace] = useState(null);
  const [rfpData, setRfpData]             = useState(null);

  /* Data loading */

  const loadRequest = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/requests/${id}`, { headers: ownerAuthHeaders() });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || "Failed to load request");
      setRequest(body.data || null);
    } catch (e) { setError(String(e?.message || e)); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadRequest(); }, [loadRequest]);

  useEffect(() => {
    if (!id) return;
    setLegalState({ loading: true, error: null, data: null });
    fetch(`/api/requests/${id}/legal-decision`, { headers: ownerAuthHeaders() })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message || "Evaluation failed");
        setLegalState({ loading: false, error: null, data: body.data });
      })
      .catch((e) => setLegalState({ loading: false, error: String(e?.message || e), data: null }));
  }, [id]);

  useEffect(() => {
    const rfpId = request?.rfpId;
    if (!rfpId || request?.status !== "PENDING_OWNER_APPROVAL") { setRfpData(null); return; }
    fetch(`/api/rfps/${rfpId}`, { headers: ownerAuthHeaders() })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) return;
        setRfpData(body.data || null);
      })
      .catch(() => {});
  }, [request?.rfpId, request?.status]);

  useEffect(() => {
    const unitId = request?.unitId;
    if (!unitId) return;
    setRepairReplace({ loading: true, error: null, data: null });
    fetch(`/api/units/${unitId}/repair-replace-analysis`, { headers: ownerAuthHeaders() })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message || "Analysis not available");
        setRepairReplace({ loading: false, error: null, data: body.data || [] });
      })
      .catch((e) => setRepairReplace({ loading: false, error: String(e?.message || e), data: null }));
  }, [request?.unitId]);

  /* Owner Actions */

  async function handleApprove() {
    if (!confirm("Approve this maintenance request?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/owner/approvals?id=${id}&action=approve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body:    JSON.stringify({ comment: "Approved by owner" }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error?.message || d?.error || "Failed to approve");
      }
      await loadRequest();
    } catch (e) { setError(String(e?.message || e)); }
    finally { setActionLoading(false); }
  }

  async function handleReject() {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/owner/approvals?id=${id}&action=reject`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body:    JSON.stringify({ reason: reason || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error?.message || d?.error || "Failed to reject");
      }
      await loadRequest();
    } catch (e) { setError(String(e?.message || e)); }
    finally { setActionLoading(false); }
  }

  /* Derived */

  const r                  = request;
  const unit               = r?.unit;
  const building           = unit?.building;
  const tenant             = r?.tenant;
  const asset              = r?.asset;
  const rfpId              = r?.rfpId || legalState.data?.rfpId || null;
  const nextStep           = r ? getNextStep(r, legalState.data) : null;
  const isTenantFunded     = r?.payingParty === "TENANT";
  const needsOwnerApproval = r?.status === "PENDING_OWNER_APPROVAL";
  const { reason: approvalReason, contractorName, amountChf } = needsOwnerApproval
    ? buildApprovalReason(r, rfpData)
    : {};
  const urgencyDisplay = r?.urgency === "EMERGENCY" ? "HIGH" : (r?.urgency || "MEDIUM");

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageContent>

          {/* Page header */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => router.push("/owner/approvals")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 transition mr-1"
              aria-label="Back to approvals"
            >
              &larr;
            </button>
            <h1 className="text-xl font-bold text-slate-900 m-0">
              {loading ? "Request" : `Request #${r?.requestNumber || id?.slice(0, 8) || ""}`}
            </h1>
            {!loading && r && (
              <>
                <Badge variant={urgencyVariant(r.urgency)} size="sm">{urgencyDisplay}</Badge>
                {isTenantFunded && <Badge variant="warning" size="sm">Tenant-funded</Badge>}
              </>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 flex items-center justify-between" role="alert">
              <span className="text-sm text-red-700"><strong>Error:</strong> {error}</span>
              <button onClick={() => setError("")} className="text-xs text-red-500 hover:text-red-700 ml-4" aria-label="Dismiss error">Dismiss</button>
            </div>
          )}

          {loading ? (
            <Panel><p className="loading-text">Loading request&hellip;</p></Panel>
          ) : !r ? (
            <div className="empty-state"><p className="empty-state-text">Request not found.</p></div>
          ) : (
            <div className="space-y-6">

              {/* 1. Timeline */}
              <Panel>
                <StatusPipeline status={r.status} payingParty={r.payingParty} />

                {needsOwnerApproval && (
                  <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
                    <p className="text-sm font-semibold text-amber-900 m-0">Your approval is required</p>
                    <p className="text-xs text-amber-800 leading-relaxed m-0">{approvalReason}</p>

                    {(contractorName || amountChf || rfpId) && (
                      <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 sm:justify-between">
                        {contractorName && (
                          <div>
                            <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wide block">Selected Contractor</span>
                            <span className="text-sm font-semibold text-slate-900">{contractorName}</span>
                          </div>
                        )}
                        {amountChf && (
                          <div>
                            <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wide block">Quote Amount</span>
                            <span className="text-sm font-semibold text-slate-900">{amountChf}</span>
                          </div>
                        )}
                        {rfpId && (
                          <div className="flex items-end">
                            <Link href={`/owner/rfps/${rfpId}`} className="cell-link text-xs font-medium">
                              View full tender &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {needsOwnerApproval && (
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="flex-1 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                    >
                      {actionLoading ? "…" : "✗ Reject"}
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {actionLoading ? "…" : "✓ Approve"}
                    </button>
                  </div>
                )}

                {!needsOwnerApproval && nextStep && (
                  <div className={cn("mt-4 rounded-lg border px-4 py-3", NEXT_STEP_STYLES[nextStep.variant] || NEXT_STEP_STYLES.info)}>
                    <p className="text-sm font-semibold m-0">{nextStep.label}</p>
                    <p className="mt-0.5 text-xs opacity-80 m-0">{nextStep.description}</p>
                    {isTenantFunded && r.rejectionReason && (
                      <p className="text-xs opacity-80 mt-1 m-0">Reason: &ldquo;{r.rejectionReason}&rdquo;</p>
                    )}
                  </div>
                )}
              </Panel>

              {/* 2. Tab bar */}
              <div className="tab-strip">
                {[
                  { key: "details",  label: "Details" },
                  { key: "advisory", label: "Advisory" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={activeTab === tab.key ? "tab-btn-active" : "tab-btn"}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 3. Details tab */}
              {activeTab === "details" && (
                <Panel>
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-4">
                    {building && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Building</span>
                        <span className="text-sm font-medium text-slate-900">{building.name}</span>
                        {building.address && <p className="text-xs text-slate-400 mt-0.5 m-0">{building.address}</p>}
                      </div>
                    )}
                    {unit && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Unit</span>
                        <span className="text-sm font-medium text-slate-900">{unit.unitNumber}</span>
                        {unit.floor != null && <span className="text-xs text-slate-400 ml-1.5">Floor {unit.floor}</span>}
                      </div>
                    )}
                    {tenant && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Tenant</span>
                        <span className="text-sm font-medium text-slate-900">{tenant.name}</span>
                        {tenant.phone && <p className="text-xs text-slate-400 mt-0.5 m-0">{tenant.phone}</p>}
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Description</span>
                    <p className="mt-1 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap m-0">
                      {r.description || <span className="text-slate-400">&mdash;</span>}
                    </p>
                  </div>

                  <div className="card-section mb-6">
                    <RequestPhotosPanel requestId={id} />
                  </div>

                  <div className="card-section">
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                      <Field label="Created">{formatDate(r.createdAt)}</Field>
                      {r.category && (
                        <Field label="Category">
                          <Badge variant="muted" size="sm">{r.category}</Badge>
                        </Field>
                      )}
                      {r.estimatedCost > 0 && (
                        <Field label="Estimated Cost">
                          <span className="font-semibold">{formatCurrency(r.estimatedCost)}</span>
                        </Field>
                      )}
                      <Field label="Paying Party">
                        <Badge variant={isTenantFunded ? "warning" : "muted"} size="sm">
                          {isTenantFunded ? "Tenant" : "Landlord"}
                        </Badge>
                      </Field>
                      {isTenantFunded && r.rejectionReason && (
                        <Field label="Rejection Reason">
                          <span className="text-orange-700">{r.rejectionReason}</span>
                        </Field>
                      )}
                    </dl>
                  </div>

                  {r.assignedContractor && (
                    <div className="card-section">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Contractor</h4>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                        <Field label="Name">
                          <span className="text-sm font-medium">
                            {r.assignedContractor.name || r.assignedContractor.companyName || "\u2014"}
                          </span>
                        </Field>
                        {r.assignedContractor.phone && <Field label="Phone">{r.assignedContractor.phone}</Field>}
                        {r.assignedContractor.email && <Field label="Email">{r.assignedContractor.email}</Field>}
                      </dl>
                    </div>
                  )}

                  {asset && (
                    <div className="card-section">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Asset</h4>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                        <Field label="Name">{asset.name || "\u2014"}</Field>
                        {asset.brand       && <Field label="Brand">{asset.brand}</Field>}
                        {asset.modelNumber && <Field label="Model">{asset.modelNumber}</Field>}
                        {asset.installedAt && <Field label="Installed">{formatDate(asset.installedAt)}</Field>}
                      </dl>
                    </div>
                  )}

                  {rfpId && (
                    <div className="card-section">
                      <Link href={`/owner/rfps/${rfpId}`} className="cell-link text-sm font-medium">
                        View Request for Proposals &rarr;
                      </Link>
                    </div>
                  )}
                </Panel>
              )}

              {/* 4. Advisory tab */}
              {activeTab === "advisory" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Panel title="Legal Analysis" bodyClassName="p-0">
                    <LegalRecommendationPanel
                      decision={legalState.data}
                      loading={legalState.loading}
                      error={legalState.error}
                    />
                    {!legalState.loading && !legalState.data && !legalState.error && (
                      <div className="px-6 py-8 text-center">
                        <p className="text-sm text-slate-400 m-0">No legal analysis available for this request.</p>
                      </div>
                    )}
                  </Panel>

                  <Panel title="Maintenance Decision">
                    {asset ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                          <div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Asset</span>
                            <span className="text-sm font-medium text-slate-900">{asset.name || "\u2014"}</span>
                          </div>
                          {asset.brand && (
                            <div>
                              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Brand</span>
                              <span className="text-sm text-slate-700">{asset.brand}</span>
                            </div>
                          )}
                          {asset.installedAt && (
                            <div>
                              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Installed</span>
                              <span className="text-sm text-slate-700">{formatDate(asset.installedAt)}</span>
                            </div>
                          )}
                        </div>
                        {r.assetId && (
                          <div className="border-t border-slate-100 pt-4">
                            <AssetRecommendationContent
                              assetId={r.assetId}
                              repairReplaceData={repairReplace}
                              requestEstimate={r.estimatedCost}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-sm text-slate-400 m-0">No asset linked to this request.</p>
                      </div>
                    )}
                  </Panel>

                  <div className="lg:col-span-2">
                    <RecommendationPanel requestId={r.id} />
                  </div>
                </div>
              )}

            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
