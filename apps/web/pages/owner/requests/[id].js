import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { ownerAuthHeaders } from "../../../lib/api";
import Badge from "../../../components/ui/Badge";
import RecommendationPanel from "../../../components/RecommendationPanel";

import { cn } from "../../../lib/utils";
// Reuse shared components from the manager requests list page
import {
  RequestStatusBadge as StatusBadge,
  LegalRecommendationPanel,
  RequestPhotosPanel,
  getNextStep,
  requestFormatDate as formatDate,
  formatCurrency,
} from "../../manager/requests";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

/** RAG urgency — LOW (green) → MEDIUM (amber) → HIGH (red) */
const URGENCY_RAG = {
  LOW:       { variant: "success", dot: "bg-green-500" },
  MEDIUM:    { variant: "warning", dot: "bg-amber-500" },
  HIGH:      { variant: "destructive", dot: "bg-red-500" },
  EMERGENCY: { variant: "destructive", dot: "bg-red-500" },
};

/**
 * Pipeline stages — base 5-stage flow.
 * When a request is at PENDING_OWNER_APPROVAL an extra "Owner Approval"
 * stage is inserted between "Contractor" and "In Progress" so the tollgate
 * appears at the correct chronological position (after quotes are received,
 * before work starts), not at the early RFP stage.
 */
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
  { key: "owner_approval", label: "Owner Approval" },
  { key: "in_progress",    label: "In Progress" },
  { key: "completed",      label: "Completed" },
];

function getStagesForStatus(status) {
  return status === "PENDING_OWNER_APPROVAL"
    ? REQUEST_STAGES_WITH_OWNER
    : REQUEST_STAGES_BASE;
}

function stageIndexForStatus(status) {
  if (status === "PENDING_OWNER_APPROVAL") return 3; // index in the 6-stage pipeline
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

/** Recommendation badge styles from the depreciation engine */
const REC_STYLES = {
  REPAIR:           { variant: "success", label: "Repair" },
  MONITOR:          { variant: "warning", label: "Monitor" },
  PLAN_REPLACEMENT: { variant: "warning", label: "Plan Replacement" },
  REPLACE:          { variant: "destructive", label: "Replace" },
};

const NEXT_STEP_STYLES = {
  info:    "border-blue-200 bg-blue-50 text-blue-700",
  warn:    "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-green-200 bg-green-50 text-green-700",
  error:   "border-red-200 bg-red-50 text-red-700",
};

/* ═══════════════════════════════════════════════════════════════
   Owner-specific CTA logic
   ═══════════════════════════════════════════════════════════════
   In the current auth model there is NO delegation flag that lets
   a manager act on behalf of an owner. If that changes (e.g. an
   org-level "managerCanApprove" config), this function is the
   single place to update.
   ═══════════════════════════════════════════════════════════════ */

function getOwnerCTAs(r) {
  switch (r?.status) {
    case "PENDING_OWNER_APPROVAL": return ["approve", "reject"];
    case "RFP_PENDING":            return r.rfpId ? ["view_rfp"] : [];
    default:                       return [];
  }
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
  const stages = getStagesForStatus(status);
  const idx = stageIndexForStatus(status);
  const isRejected = status === "REJECTED";
  const isTenantFunded = isRejected && payingParty === "TENANT";

  function connectorColor(i) {
    if (i >= idx) return "bg-slate-200";
    if (isRejected && !isTenantFunded) return "bg-red-300";
    if (isTenantFunded) return "bg-orange-300";
    return "bg-green-400";
  }

  return (
    <div className="flex items-start w-full">
      {stages.map((stage, i) => {
        const reached = i <= idx;
        const isCurrent = i === idx;
        const rejectedHere = isRejected && !isTenantFunded && i === idx;
        const tenantFundedHere = isTenantFunded && i === idx;

        let dotCls;
        if (rejectedHere)          dotCls = "bg-red-500 border-red-600";
        else if (tenantFundedHere) dotCls = "bg-orange-500 border-orange-600";
        else if (isCurrent)        dotCls = "bg-indigo-500 border-indigo-600 ring-4 ring-indigo-100";
        else if (reached)          dotCls = "bg-green-500 border-green-600";
        else                       dotCls = "bg-slate-200 border-slate-300";

        let labelText = stage.label;
        let labelCls  = "text-slate-400";
        if (rejectedHere) {
          labelText = "Rejected"; labelCls = "text-red-600 font-semibold";
        } else if (tenantFundedHere) {
          labelText = "Tenant-funded"; labelCls = "text-orange-600 font-semibold";
        } else if (isCurrent) {
          labelCls = "text-indigo-700 font-semibold";
        } else if (reached) {
          labelCls = "text-green-700";
        }

        return (
          <div key={stage.key} className="flex flex-col items-center flex-1">
            <div className="flex items-center w-full">
              {i > 0 && <div className={cn("h-0.5 flex-1", connectorColor(i - 1))} />}
              <div className={cn("h-3.5 w-3.5 rounded-full border-2 shrink-0", dotCls)} />
              {i < stages.length - 1 && <div className={cn("h-0.5 flex-1", connectorColor(i))} />}
            </div>
            <span className={cn("mt-1.5 text-[11px] leading-tight text-center whitespace-nowrap", labelCls)}>
              {labelText}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Depreciation bar ────────────────────────────────────────── */

function DepreciationBar({ pct }) {
  const c =
    pct >= 100 ? "bg-red-500" :
    pct >= 85  ? "bg-orange-500" :
    pct >= 65  ? "bg-amber-500" :
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

/* ── Asset recommendation card ───────────────────────────────── */

function AssetRecommendationCard({ assetId, repairReplaceData, requestEstimate }) {
  if (!assetId) {
    return (
      <div className="px-6 py-6 text-center">
        <p className="text-sm text-slate-400 m-0">No asset linked to this request.</p>
        <p className="text-xs text-slate-400 mt-1 m-0">Link an asset to get repair / replace recommendations.</p>
      </div>
    );
  }

  if (!repairReplaceData || repairReplaceData.loading) {
    return <div className="px-6 py-6 text-center"><p className="text-sm text-slate-400 animate-pulse m-0">Loading asset analysis&hellip;</p></div>;
  }

  if (repairReplaceData.error) {
    // Graceful fallback — owner may not have access to the MANAGER-only endpoint
    return (
      <div className="px-6 py-5">
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
      </div>
    );
  }

  const items = repairReplaceData.data || [];
  const item = items.find((a) => a.applianceId === assetId);

  if (!item) {
    return (
      <div className="px-6 py-5">
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
      </div>
    );
  }

  const rec = REC_STYLES[item.recommendation] || REC_STYLES.REPAIR;

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="flex items-start gap-3">
        <Badge variant={rec.variant} size="lg" className="shrink-0">
          {rec.label}
        </Badge>
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
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Est. repair cost</span>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 m-0">
            {requestEstimate > 0
              ? formatCurrency(requestEstimate)
              : item.cumulativeRepairCostChf > 0
                ? <>{formatCurrency(item.cumulativeRepairCostChf)} <span className="font-normal text-xs text-slate-400">(cumulative)</span></>
                : "Not available"}
          </p>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Est. replacement cost</span>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 m-0">
            {item.estimatedReplacementCostChf > 0
              ? formatCurrency(item.estimatedReplacementCostChf)
              : "Not available"}
          </p>
        </div>
      </div>

      {item.repairReplaceRatio != null && item.repairReplaceRatio > 0 && (
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            Ratio:{" "}
            <strong className={
              item.repairReplaceRatio >= 0.6 ? "text-red-600" :
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
                item.breakEvenMonths === 0  ? "text-red-600" :
                item.breakEvenMonths < 12   ? "text-red-600" :
                item.breakEvenMonths < 36   ? "text-amber-600" :
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

  const [legalState, setLegalState]       = useState({ loading: true, error: null, data: null });
  const [repairReplace, setRepairReplace] = useState(null);
  const [rfpData, setRfpData]             = useState(null);

  /* ─── Data loading ─── */

  const loadRequest = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/requests/${id}`, { headers: ownerAuthHeaders() });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || "Failed to load request");
      setRequest(body.data || null);
    } catch (e) { setError(String(e?.message || e)); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadRequest(); }, [loadRequest]);

  // Legal decision (org-scoped — owners can access)
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

  // RFP detail — only needed when awaiting owner approval to show awarded quote context
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

  // Repair-replace analysis — MANAGER-only endpoint, attempt but handle 403
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

  /* ─── Owner Actions ─── */

  async function handleApprove() {
    if (!confirm("Approve this maintenance request?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/owner/approvals?id=${id}&action=approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: JSON.stringify({ comment: "Approved by owner" }),
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
        method: "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: JSON.stringify({ reason: reason || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error?.message || d?.error || "Failed to reject");
      }
      await loadRequest();
    } catch (e) { setError(String(e?.message || e)); }
    finally { setActionLoading(false); }
  }

  /* ─── Derived ─── */

  const r         = request;
  const unit      = r?.unit;
  const building  = unit?.building;
  const tenant    = r?.tenant;
  const asset     = r?.asset;
  const rfpId     = r?.rfpId || legalState.data?.rfpId || null;
  const nextStep  = r ? getNextStep(r, legalState.data) : null;
  const ctaList   = getOwnerCTAs(r);
  const urg       = URGENCY_RAG[r?.urgency] || URGENCY_RAG.MEDIUM;
  const urgLabel  = r?.urgency === "EMERGENCY" ? "HIGH" : (r?.urgency || "MEDIUM");

  /* ─── JSX ─── */

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title={loading ? "Request" : `Request #${r?.requestNumber || id?.slice(0, 8) || ""}`}
          breadcrumbs={[{ label: "Approvals", href: "/owner/approvals" }]}
          actions={
            <button
              onClick={() => router.push("/owner/approvals")}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              &larr; Back to approvals
            </button>
          }
        />

        <PageContent>
          {/* Error banner */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-red-700"><strong>Error:</strong> {error}</span>
              <button onClick={() => setError("")} className="text-xs text-red-500 hover:text-red-700 ml-4">Dismiss</button>
            </div>
          )}

          {loading ? (
            <Panel><p className="loading-text">Loading request&hellip;</p></Panel>
          ) : !r ? (
            <div className="empty-state"><p className="empty-state-text">Request not found.</p></div>
          ) : (
            <div className="space-y-6">

              {/* ═══ 1 · Timeline (full width) ═══ */}
              <Panel>
                <div className="flex items-center gap-3 mb-4">
                  <StatusBadge status={r.status} />
                  {r.payingParty === "TENANT" && (
                    <Badge variant="warning" size="sm">
                      Tenant-funded
                    </Badge>
                  )}
                  {r.approvalSource && (
                    <Badge variant="muted" size="sm">
                      {r.approvalSource.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                    </Badge>
                  )}
                </div>
                <StatusPipeline status={r.status} payingParty={r.payingParty} />

                {/* Owner CTAs — inline with timeline */}
                {ctaList.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                    {ctaList.includes("approve") && (
                      <button onClick={handleApprove} disabled={actionLoading}
                        className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50">
                        {actionLoading ? "\u2026" : "\u2713 Approve Request"}
                      </button>
                    )}
                    {ctaList.includes("reject") && (
                      <button onClick={handleReject} disabled={actionLoading}
                        className="rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50">
                        {actionLoading ? "\u2026" : "\u2717 Reject Request"}
                      </button>
                    )}
                    {ctaList.includes("view_rfp") && rfpId && (
                      <Link href={`/owner/rfps/${rfpId}`}
                        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition no-underline">
                        View RFP
                      </Link>
                    )}
                  </div>
                )}
              </Panel>

              {/* ═══ 2 · Approval context — only when awaiting owner decision ═══ */}
              {r.status === "PENDING_OWNER_APPROVAL" && rfpData && (() => {
                const awardedQuote = rfpData.quotes?.find((q) => q.id === rfpData.awardedQuoteId);
                const contractorName = rfpData.awardedContractor?.name
                  || awardedQuote?.contractor?.name
                  || null;
                const amountChf = awardedQuote?.amountCents != null
                  ? formatCurrency(awardedQuote.amountCents / 100)
                  : null;
                return (
                  <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-5 py-4 space-y-3">
                    <p className="text-sm font-semibold text-amber-900 m-0">Your approval is required to proceed</p>
                    <p className="text-xs text-amber-800 m-0">
                      The property manager selected a contractor quote that exceeds the building&rsquo;s
                      auto-approval threshold. Your sign-off is required before work can begin.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 pt-1">
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
                          <Link href={`/owner/rfps/${rfpId}`}
                            className="cell-link text-xs font-medium">
                            View full tender &rarr;
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ 3 · Details (full width top row) ═══ */}
              <Panel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left — Location + Description */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
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
                    </div>

                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Description</span>
                      <p className="mt-1 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap m-0">
                        {r.description || <span className="text-slate-400">&mdash;</span>}
                      </p>
                    </div>
                  </div>

                  {/* Right — Key fields */}
                  <div className="space-y-3 border-l border-slate-100 pl-6 max-md:border-l-0 max-md:pl-0 max-md:pt-4 max-md:border-t">
                    {/* Urgency RAG (read-only for owner — no selector) */}
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Urgency</span>
                      <Badge variant={urg.variant} size="lg" className="mt-1 gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", urg.dot)} />
                        {urgLabel}
                      </Badge>
                    </div>

                    {r.category && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Category</span>
                        <Badge variant="muted" size="sm" className="mt-0.5">
                          {r.category}
                        </Badge>
                      </div>
                    )}

                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Paying Party</span>
                      <Badge variant={r.payingParty === "TENANT" ? "warning" : "muted"} size="sm" className="mt-0.5">
                        {r.payingParty === "TENANT" ? "Tenant" : "Landlord"}
                      </Badge>
                    </div>

                    <div className="flex gap-6">
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Req #</span>
                        <span className="text-sm font-mono text-slate-900">{r.requestNumber ? `#${r.requestNumber}` : "\u2014"}</span>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Created</span>
                        <span className="text-sm text-slate-900">{formatDate(r.createdAt)}</span>
                      </div>
                    </div>

                    {r.estimatedCost > 0 && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Estimated Cost</span>
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(r.estimatedCost)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              {/* ═══ 3 · Two-column layout ═══ */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── Left column (2/3) ── */}
                <div className="lg:col-span-2 space-y-6">

                  {/* Tenant self-pay warning */}
                  {r.payingParty === "TENANT" && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-500 text-sm leading-none">{"\u26A0"}</span>
                        <p className="text-sm font-semibold text-orange-700 m-0">
                          Tenant-funded request{r.rejectionReason ? ` \u2014 "${r.rejectionReason}"` : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Next-step banner */}
                  {nextStep && (
                    <div className={cn("rounded-lg border px-4 py-3", NEXT_STEP_STYLES[nextStep.variant] || NEXT_STEP_STYLES.info)}>
                      <p className="text-sm font-semibold m-0">{nextStep.label}</p>
                      <p className="mt-0.5 text-xs opacity-80 m-0">{nextStep.description}</p>
                    </div>
                  )}

                  {/* Asset Recommendation */}
                  <Panel title="Asset Recommendation" bodyClassName="p-0">
                    <AssetRecommendationCard
                      assetId={r.assetId}
                      repairReplaceData={repairReplace}
                      requestEstimate={r.estimatedCost}
                    />
                  </Panel>

                  {/* Photos & Attachments */}
                  <Panel title="Photos &amp; Attachments" bodyClassName="p-0">
                    <RequestPhotosPanel requestId={id} />
                  </Panel>

                  {/* Legal Analysis */}
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
                </div>

                {/* ── Right column (1/3) ── */}
                <div className="space-y-6">

                  {/* Tenant */}
                  <Panel title="Tenant">
                    {tenant ? (
                      <dl className="space-y-3">
                        <Field label="Name">
                          <span className="text-sm font-medium">{tenant.name}</span>
                        </Field>
                        {tenant.phone && <Field label="Phone">{tenant.phone}</Field>}
                        {tenant.email && <Field label="Email">{tenant.email}</Field>}
                      </dl>
                    ) : (
                      <p className="text-sm text-slate-400 m-0">No tenant linked.</p>
                    )}
                  </Panel>

                  {/* Contractor */}
                  <Panel title="Contractor">
                    {r.assignedContractor ? (
                      <dl className="space-y-3">
                        <Field label="Name">
                          <span className="text-sm font-medium">
                            {r.assignedContractor.name || r.assignedContractor.companyName || "\u2014"}
                          </span>
                        </Field>
                        {r.assignedContractor.phone && <Field label="Phone">{r.assignedContractor.phone}</Field>}
                        {r.assignedContractor.email && <Field label="Email">{r.assignedContractor.email}</Field>}
                      </dl>
                    ) : (
                      <p className="text-sm text-slate-400 m-0">No contractor assigned yet.</p>
                    )}
                  </Panel>

                  {/* Asset */}
                  {asset && (
                    <Panel title="Asset">
                      <dl className="space-y-3">
                        <Field label="Name">{asset.name || "\u2014"}</Field>
                        {asset.brand && <Field label="Brand">{asset.brand}</Field>}
                        {asset.modelNumber && <Field label="Model">{asset.modelNumber}</Field>}
                        {asset.installedAt && <Field label="Installed">{formatDate(asset.installedAt)}</Field>}
                      </dl>
                    </Panel>
                  )}

                  {/* RFP */}
                  {rfpId && (
                    <Panel title="Request for Proposals">
                      <Link href={`/owner/rfps/${rfpId}`} className="cell-link text-sm font-medium">
                        View RFP &rarr;
                      </Link>
                    </Panel>
                  )}

                  {/* Strategy Recommendation */}
                  <RecommendationPanel requestId={r.id} />
                </div>
              </div>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
