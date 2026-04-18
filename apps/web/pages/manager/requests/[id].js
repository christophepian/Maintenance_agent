import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";
import Badge from "../../../components/ui/Badge";
import { urgencyVariant } from "../../../lib/statusVariants";

import { cn } from "../../../lib/utils";
import {
  RequestStatusBadge as StatusBadge,
  LegalRecommendationPanel,
  RequestPhotosPanel,
  getNextStep,
  getAvailableCTAs,
  requestFormatDate as formatDate,
  formatCurrency,
} from "../requests";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const URGENCY_OPTIONS = [
  { value: "LOW",    label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH",   label: "High" },
];

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
  REPAIR:           { cls: "bg-green-50 text-green-700 border-green-200", label: "Repair", variant: "success" },
  MONITOR:          { cls: "bg-amber-50 text-amber-700 border-amber-200",      label: "Monitor", variant: "warning" },
  PLAN_REPLACEMENT: { cls: "bg-orange-50 text-orange-700 border-orange-200",   label: "Plan Replacement", variant: "warning" },
  REPLACE:          { cls: "bg-red-50 text-red-700 border-red-200",            label: "Replace", variant: "destructive" },
};

const NEXT_STEP_STYLES = {
  info:    "border-blue-200 bg-blue-50 text-blue-700",
  warn:    "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-green-200 bg-green-50 text-green-700",
  error:   "border-red-200 bg-red-50 text-red-700",
};

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

/* ── Urgency pill dropdown (self-contained, chevron built in) ── */

function UrgencyPill({ urgency, onChangeUrgency }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const displayLabel = urgency === "EMERGENCY" ? "High" : (urgency ? urgency.charAt(0) + urgency.slice(1).toLowerCase() : "Medium");

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer"
      >
        <Badge variant={urgencyVariant(urgency)} size="sm" className="inline-flex items-center gap-1.5">
          {displayLabel}
          <svg className={cn("h-3 w-3 transition-transform", open ? "rotate-180" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </Badge>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[120px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {URGENCY_OPTIONS.map((opt) => {
            const isActive = (urgency === "EMERGENCY" ? "HIGH" : urgency) === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChangeUrgency(opt.value); setOpen(false); }}
                className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition", isActive ? "bg-slate-50" : "")}
              >
                <Badge variant={urgencyVariant(opt.value)} size="sm">{opt.label}</Badge>
                {isActive && <span className="ml-auto text-indigo-500">{"\u2713"}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Status pipeline timeline ───────────────────────────────── */

function StatusPipeline({ status, payingParty }) {
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

  return (
    <div className="flex items-start w-full">
      {stages.map((stage, i) => {
        const reached = i <= idx;
        const isCurrent = i === idx;
        const rejectedHere = isRejected && !isTenantFunded && i === idx;
        const tenantFundedHere = isTenantFunded && isRejected && i === idx;

        let dotCls;
        if (rejectedHere)          dotCls = "bg-red-500 border-red-600";
        else if (tenantFundedHere) dotCls = "bg-orange-500 border-orange-600";
        else if (isCurrent)        dotCls = "bg-indigo-500 border-indigo-600 ring-4 ring-indigo-100";
        else if (reached)          dotCls = "bg-green-500 border-green-600";
        else                       dotCls = "bg-slate-200 border-slate-300";

        /* Override label for the current stage to match actual status */
        let labelText = stage.label;
        let labelCls  = "text-slate-400";

        if (isCurrent) {
          switch (status) {
            case "PENDING_REVIEW":         labelText = "Pending Review"; break;
            case "RFP_PENDING":            labelText = "RFP Pending"; break;
            case "PENDING_OWNER_APPROVAL": labelText = "Owner Approval"; break;
            case "AUTO_APPROVED":          labelText = "Auto-Approved"; break;
            case "APPROVED":               labelText = "Approved"; break;
            case "REJECTED":               labelText = isTenantFunded ? "Tenant-Funded" : "Rejected"; break;
            default:                       break;
          }
          labelCls = rejectedHere
            ? "text-red-600 font-semibold"
            : tenantFundedHere
              ? "text-orange-600 font-semibold"
              : "text-indigo-700 font-semibold";
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

/* ── Asset recommendation (inline content, no wrapping Panel) ── */

function AssetRecommendationContent({ applianceId, repairReplaceData, requestEstimate }) {
  if (!applianceId) return null;

  if (!repairReplaceData || repairReplaceData.loading) {
    return <p className="text-sm text-slate-400 animate-pulse m-0">Loading asset analysis&hellip;</p>;
  }
  if (repairReplaceData.error) {
    return <p className="text-sm text-red-500 m-0">Failed to load asset analysis.</p>;
  }

  const items = repairReplaceData.data || [];
  const item = items.find((a) => (a.applianceId || a.assetId) === applianceId);
  if (!item) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-slate-400 m-0">No repair-vs-replace data available for this appliance.</p>
        <p className="text-xs text-slate-300 mt-1 m-0">Asset inventory records are required for analysis.</p>
      </div>
    );
  }

  const rec = REC_STYLES[item.recommendation] || REC_STYLES.REPAIR;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Badge variant={rec.variant} size="lg" className="shrink-0">
          {rec.label}
        </Badge>
        {item.explanation && (
          <p className="text-xs text-slate-500 leading-relaxed m-0">{item.explanation}</p>
        )}
      </div>

      {/* Depreciation */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">{item.applianceName || "Asset"}</span>
          {item.ageMonths != null && item.usefulLifeMonths != null && (
            <span>{Math.round(item.ageMonths / 12)}y / {Math.round(item.usefulLifeMonths / 12)}y useful life</span>
          )}
        </div>
        <DepreciationBar pct={item.depreciationPct ?? 0} />
      </div>

      {/* Cost comparison */}
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

export default function RequestDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [request, setRequest]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [legalState, setLegalState]               = useState({ loading: true, error: null, data: null });
  const [repairReplace, setRepairReplace]         = useState(null);
  const [contractors, setContractors]             = useState([]);
  const [assigningOpen, setAssigningOpen]         = useState(false);
  const [selectedContractorId, setSelectedContractorId] = useState("");
  const [activeTab, setActiveTab]                 = useState("details");

  /* ─── Data loading ─── */

  const loadRequest = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/requests/${id}`, { headers: authHeaders() });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || "Failed to load request");
      setRequest(body.data || null);
    } catch (e) { setError(String(e?.message || e)); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadRequest(); }, [loadRequest]);

  // Legal decision
  useEffect(() => {
    if (!id) return;
    setLegalState({ loading: true, error: null, data: null });
    fetch(`/api/requests/${id}/legal-decision`, { headers: authHeaders() })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message || "Evaluation failed");
        setLegalState({ loading: false, error: null, data: body.data });
      })
      .catch((e) => setLegalState({ loading: false, error: String(e?.message || e), data: null }));
  }, [id]);

  // Contractors (for assign form)
  useEffect(() => {
    fetch("/api/contractors", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.data) setContractors(d.data); })
      .catch(() => {});
  }, []);

  // Repair-replace analysis (per unit)
  useEffect(() => {
    const unitId = request?.unitId;
    if (!unitId) return;
    setRepairReplace({ loading: true, error: null, data: null });
    fetch(`/api/units/${unitId}/repair-replace-analysis`, { headers: authHeaders() })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message || "Analysis failed");
        setRepairReplace({ loading: false, error: null, data: body.data || [] });
      })
      .catch((e) => setRepairReplace({ loading: false, error: String(e?.message || e), data: null }));
  }, [request?.unitId]);

  /* ─── Actions ─── */

  async function performAction(action, body) {
    setActionLoading(true);
    try {
      const url = `/api/requests/${id}/${action}`;
      const method =
        action === "assign"       ? "POST"  :
        action === "urgency"      ? "PATCH" :
        action === "status"       ? "PATCH" :
        action === "owner-reject" ? "POST"  : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error?.message || `Failed to ${action}`);
      }
      await loadRequest();
    } catch (e) { setError(String(e?.message || e)); }
    finally { setActionLoading(false); }
  }

  async function approveRequest() { await performAction("status", { status: "APPROVED" }); }

  async function rejectRequest() {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return;
    await performAction("owner-reject", { reason: reason || null });
  }

  async function doAssign() {
    if (!selectedContractorId) return;
    await performAction("assign", { contractorId: selectedContractorId });
    setAssigningOpen(false);
    setSelectedContractorId("");
  }

  async function doUnassign() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/requests/${id}/assign`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error?.message || "Failed to unassign"); }
      await loadRequest();
    } catch (e) { setError(String(e?.message || e)); }
    finally { setActionLoading(false); }
  }

  async function setUrgency(val) { await performAction("urgency", { urgency: val }); }

  /* ─── Derived ─── */

  const r         = request;
  const unit      = r?.unit;
  const building  = unit?.building;
  const tenant    = r?.tenant;
  const appliance = r?.appliance;
  const rfpId     = legalState.data?.rfpId || r?.rfpId || null;
  const nextStep  = r ? getNextStep(r, legalState.data) : null;
  const ctaList   = r ? getAvailableCTAs(r, assigningOpen ? id : null) : [];
  const isTenantFunded = r?.payingParty === "TENANT";

  /* ─── JSX ─── */

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageContent>
          {/* ── Custom header (title + urgency pill + tenant-funded pill) ── */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => router.push("/manager/requests")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 transition mr-1"
            >
              &larr;
            </button>
            <h1 className="text-xl font-bold text-slate-900 m-0">
              {loading ? "Request" : `Request #${r?.requestNumber || id?.slice(0, 8) || ""}`}
            </h1>
            {!loading && r && (
              <>
                <UrgencyPill urgency={r.urgency} onChangeUrgency={setUrgency} />
                {isTenantFunded && (
                  <Badge variant="warning" size="sm">
                    Tenant-funded
                  </Badge>
                )}
              </>
            )}
          </div>

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

              {/* ═══ 1 · Timeline + CTAs ═══ */}
              <Panel>
                <div className="flex items-center gap-3 mb-4">
                  {!(isTenantFunded && r.status === "REJECTED") && (
                    <StatusBadge status={r.status} />
                  )}
                  {r.approvalSource && (
                    <Badge variant="muted" size="sm">
                      {r.approvalSource.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                    </Badge>
                  )}
                </div>
                <StatusPipeline status={r.status} payingParty={r.payingParty} />

                {/* Next-step banner + actions — inside Timeline card */}
                {(nextStep || ctaList.length > 0 || assigningOpen) && (
                  <div className={cn("mt-5 rounded-lg border px-4 py-3", nextStep ? (NEXT_STEP_STYLES[nextStep.variant] || NEXT_STEP_STYLES.info) : "border-slate-200 bg-slate-50")}>
                    {nextStep && (
                      <div className="mb-2">
                        <p className="text-sm font-semibold m-0">{nextStep.label}</p>
                        <p className="mt-0.5 text-xs opacity-80 m-0">{nextStep.description}</p>
                      </div>
                    )}
                    {isTenantFunded && r.rejectionReason && (
                      <p className="text-xs text-orange-700 mb-2 m-0">Reason: &ldquo;{r.rejectionReason}&rdquo;</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {ctaList.includes("approve") && (
                        <button onClick={approveRequest} disabled={actionLoading}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50">
                          {actionLoading ? "\u2026" : "\u2713 Approve"}
                        </button>
                      )}
                      {ctaList.includes("reject") && (
                        <button onClick={rejectRequest} disabled={actionLoading}
                          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50">
                          {actionLoading ? "\u2026" : "\u2717 Reject"}
                        </button>
                      )}
                      {ctaList.includes("view_rfp") && rfpId && (
                        <Link href={`/manager/rfps/${rfpId}`}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition no-underline">
                          View RFP
                        </Link>
                      )}
                      {ctaList.includes("assign") && !assigningOpen && (
                        <button onClick={() => setAssigningOpen(true)}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
                          Assign Contractor
                        </button>
                      )}
                      {ctaList.includes("unassign") && (
                        <button onClick={doUnassign} disabled={actionLoading}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50">
                          {actionLoading ? "\u2026" : "Unassign"}
                        </button>
                      )}
                    </div>

                    {assigningOpen && (
                      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-100/50">
                        <select value={selectedContractorId} onChange={(e) => setSelectedContractorId(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                          <option value="">Select contractor&hellip;</option>
                          {contractors.map((c) => (
                            <option key={c.id} value={c.id}>{c.name || c.companyName || c.id.slice(0, 8)}</option>
                          ))}
                        </select>
                        <button onClick={doAssign} disabled={!selectedContractorId || actionLoading}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50">
                          {actionLoading ? "\u2026" : "Confirm"}
                        </button>
                        <button onClick={() => { setAssigningOpen(false); setSelectedContractorId(""); }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Panel>

              {/* ═══ 2 · Tab bar ═══ */}
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

              {/* ═══ 3 · Tab content ═══ */}

              {/* ── Details tab ── */}
              {activeTab === "details" && (
                <Panel>
                  {/* Location + Tenant row */}
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-4">
                    {building && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Building</span>
                        <Link href={`/manager/buildings/${building.id}/financials`} className="cell-link text-sm font-medium">
                          {building.name}
                        </Link>
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
                        {r.tenantId ? (
                          <Link href={`/manager/people/tenants/${r.tenantId}`} className="cell-link text-sm font-medium">
                            {tenant.name}
                          </Link>
                        ) : <span className="text-sm font-medium text-slate-900">{tenant.name}</span>}
                        {tenant.phone && <p className="text-xs text-slate-400 mt-0.5 m-0">{tenant.phone}</p>}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Description</span>
                    <p className="mt-1 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap m-0">
                      {r.description || <span className="text-slate-400">&mdash;</span>}
                    </p>
                  </div>

                  {/* Photos */}
                  <div className="border-t border-slate-100 pt-4 mb-4">
                    <RequestPhotosPanel requestId={id} />
                  </div>

                  {/* Metadata grid */}
                  <div className="border-t border-slate-100 pt-4">
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                      <Field label="Created">{formatDate(r.createdAt)}</Field>
                      {r.category && (
                        <Field label="Category">
                          <Badge variant="muted" size="sm">
                            {r.category}
                          </Badge>
                        </Field>
                      )}
                      {r.estimatedCost > 0 && (
                        <Field label="Estimated Cost">
                          <span className="font-semibold">{formatCurrency(r.estimatedCost)}</span>
                        </Field>
                      )}
                      {r.contactPhone && <Field label="Contact">{r.contactPhone}</Field>}
                      {!isTenantFunded && (
                        <Field label="Paying Party">
                          <Badge variant="muted" size="sm">
                            Landlord
                          </Badge>
                        </Field>
                      )}
                      {isTenantFunded && r.rejectionReason && (
                        <Field label="Rejection Reason">
                          <span className="text-orange-700">{r.rejectionReason}</span>
                        </Field>
                      )}
                    </dl>
                  </div>

                  {/* Contractor — only when assigned */}
                  {r.assignedContractor && (
                    <div className="border-t border-slate-100 pt-4 mt-4">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Contractor</h4>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                        <Field label="Name">
                          <Link href={`/manager/people/vendors/${r.assignedContractor.id}`} className="cell-link font-medium text-sm">
                            {r.assignedContractor.name || r.assignedContractor.companyName || "\u2014"}
                          </Link>
                        </Field>
                        {r.assignedContractor.phone && <Field label="Phone">{r.assignedContractor.phone}</Field>}
                        {r.assignedContractor.email && <Field label="Email">{r.assignedContractor.email}</Field>}
                      </dl>
                    </div>
                  )}

                  {/* Appliance */}
                  {appliance && (
                    <div className="border-t border-slate-100 pt-4 mt-4">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Appliance</h4>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                        <Field label="Name">{appliance.name || "\u2014"}</Field>
                        {appliance.manufacturer && <Field label="Manufacturer">{appliance.manufacturer}</Field>}
                        {appliance.modelNumber && <Field label="Model">{appliance.modelNumber}</Field>}
                        {appliance.installationDate && <Field label="Installed">{formatDate(appliance.installationDate)}</Field>}
                      </dl>
                    </div>
                  )}

                  {/* RFP link */}
                  {rfpId && (
                    <div className="border-t border-slate-100 pt-4 mt-4">
                      <Link href={`/manager/rfps/${rfpId}`} className="cell-link text-sm font-medium">
                        View Request for Proposals &rarr;
                      </Link>
                    </div>
                  )}
                </Panel>
              )}

              {/* ── Advisory tab ── */}
              {activeTab === "advisory" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Column 1 — Legal Engine */}
                  <Panel title="Legal Analysis" bodyClassName="p-0">
                    <LegalRecommendationPanel
                      decision={legalState.data}
                      loading={legalState.loading}
                      error={legalState.error}
                      requestStatus={r.status}
                    />
                    {!legalState.loading && !legalState.data && !legalState.error && (
                      <div className="px-6 py-8 text-center">
                        <p className="text-sm text-slate-400 m-0">No legal analysis available for this request.</p>
                      </div>
                    )}
                  </Panel>

                  {/* Column 2 — Maintenance Decision (Repair vs Replace) */}
                  <Panel title="Maintenance Decision">
                    {appliance ? (
                      <div className="space-y-4">
                        {/* Linked appliance summary */}
                        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                          <div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Appliance</span>
                            <span className="text-sm font-medium text-slate-900">{appliance.name || "\u2014"}</span>
                          </div>
                          {appliance.assetModel?.manufacturer && (
                            <div>
                              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Manufacturer</span>
                              <span className="text-sm text-slate-700">{appliance.assetModel.manufacturer}</span>
                            </div>
                          )}
                          {appliance.assetModel?.category && (
                            <div>
                              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Category</span>
                              <Badge variant="muted" size="sm">
                                {appliance.assetModel.category}
                              </Badge>
                            </div>
                          )}
                          {appliance.installDate && (
                            <div>
                              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Installed</span>
                              <span className="text-sm text-slate-700">{formatDate(appliance.installDate)}</span>
                            </div>
                          )}
                        </div>
                        {/* Repair vs Replace analysis (if available) */}
                        {r.applianceId && (
                          <div className="border-t border-slate-100 pt-4">
                            <AssetRecommendationContent
                              applianceId={r.applianceId}
                              repairReplaceData={repairReplace}
                              requestEstimate={r.estimatedCost}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-sm text-slate-400 m-0">No appliance linked to this request.</p>
                      </div>
                    )}
                  </Panel>
                </div>
              )}
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
