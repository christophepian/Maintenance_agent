import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import ConfigurableTable from "../../components/ConfigurableTable";
import PaginationControls from "../../components/PaginationControls";
import { useTableSort, useTablePagination, clientSort } from "../../lib/tableUtils";
import { authHeaders } from "../../lib/api";
import Badge from "../../components/ui/Badge";
import { requestVariant } from "../../lib/statusVariants";
import { cn } from "../../lib/utils";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS = [
  { key: "ALL",            label: "Overview",                statuses: null },
  { key: "PENDING",        label: "Pending Review",          statuses: ["PENDING_REVIEW"] },
  { key: "RFP_OPEN",       label: "RFP Open",                statuses: ["RFP_PENDING"] },
  { key: "OWNER_APPROVAL", label: "Pending Owner Approval",  statuses: ["PENDING_OWNER_APPROVAL"] },
  { key: "IN_PROGRESS",    label: "In Progress",             statuses: ["APPROVED", "ASSIGNED"] },
  {
    key: "DONE",
    label: "Done",
    statuses: ["COMPLETED"],
    // Belt-and-suspenders: catch ASSIGNED rows where Job is COMPLETED but mirror lagged
    extraFilter: (r) =>
      r.status === "COMPLETED" ||
      (r.status === "ASSIGNED" && r.job?.status === "COMPLETED"),
  },
  { key: "REJECTED",       label: "Rejected",                statuses: ["REJECTED"] },
  { key: "RFPS",           label: "RFPs",                    statuses: null, href: "/manager/rfps" },
];

// Derive TAB_KEYS from STATUS_TABS to prevent drift; preserve backward-compat aliases
const TAB_KEYS = STATUS_TABS.map((t) => t.key.toLowerCase());
// Old deep-link aliases → map to new index
const TAB_ALIASES = { overview: "all", pending_review: "pending", active: "in_progress", completed: "done", rejected: "rejected" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatCurrency(chf) {
  if (typeof chf !== "number") return "\u2014";
  const str = chf.toFixed(0);
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, "\u2019");
  return `CHF\u00A0${formatted}`;
}

function nextApproverLabel(status) {
  switch (status) {
    case "PENDING_REVIEW":         return "Manager";
    case "PENDING_OWNER_APPROVAL": return "Owner";
    case "RFP_PENDING":            return "Manager (RFP)";
    case "APPROVED":
    case "ASSIGNED":               return "Contractor";
    default:                       return "\u2014";
  }
}

const REQUEST_SORT_FIELDS = ["requestNumber", "status", "building", "category", "urgency", "createdAt", "estimatedCost", "contractor", "nextApprover", "payingParty", "approvalSource"];

// Column definitions for ConfigurableTable — render closures capture outer scope via page component
function buildRequestColumns({ assigningId, setAssigningId, selectedContractorId, setSelectedContractorId, contractors, actionLoading, approveRequest, rejectRequest, doAssignContractor, doUnassignContractor, getAvailableCTAs }) {
  return [
    {
      id: "requestNumber",
      label: "#",
      sortable: true,
      alwaysVisible: true,
      className: "w-16",
      render: (r) => (
        <span className="font-mono text-slate-500">
          {r.requestNumber ? `#${r.requestNumber}` : "\u2014"}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      defaultVisible: true,
      render: (r) => (
        <>
          <StatusBadge request={r} />
          {r.payingParty === "TENANT" && (
            <span className="ml-1.5 inline-block rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
              Tenant-funded
            </span>
          )}
        </>
      ),
    },
    {
      id: "building",
      label: "Building / Unit",
      sortable: true,
      defaultVisible: true,
      render: (r) => (
        <span className="text-slate-700">
          {r.buildingId ? (
            <Link href={`/admin-inventory/buildings/${r.buildingId}?from=/manager/requests`} className="cell-link" onClick={(e) => e.stopPropagation()}>
              {r.buildingName || "\u2014"}
            </Link>
          ) : (r.buildingName || "\u2014")}
          {r.unitNumber ? (
            r.unitId ? (
              <span className="text-slate-400"> / <Link href={`/admin-inventory/units/${r.unitId}`} className="cell-link" onClick={(e) => e.stopPropagation()}>{r.unitNumber}</Link></span>
            ) : (
              <span className="text-slate-400"> / {r.unitNumber}</span>
            )
          ) : ""}
        </span>
      ),
    },
    {
      id: "category",
      label: "Category",
      sortable: true,
      defaultVisible: true,
      render: (r) => (
        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {r.category || "\u2014"}
        </span>
      ),
    },
    {
      id: "description",
      label: "Description",
      defaultVisible: true,
      className: "max-w-[260px]",
      render: (r) => (
        <span className="block truncate text-slate-600">{r.description || "\u2014"}</span>
      ),
    },
    {
      id: "urgency",
      label: "Emergency",
      sortable: true,
      defaultVisible: true,
      className: "w-24 text-center",
      render: (r) => (
        (r.urgency === "EMERGENCY" || r.urgency === "HIGH") ? (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", r.urgency === "EMERGENCY"
              ? "bg-red-100 text-red-700 border border-red-200"
              : "bg-orange-100 text-orange-700 border border-orange-200")}>
            <span className="text-xs">{r.urgency === "EMERGENCY" ? "\u{1F6A8}" : "\u26A0"}</span>
            {r.urgency === "EMERGENCY" ? "Emergency" : "High"}
          </span>
        ) : (
          <span className="text-slate-300">\u2014</span>
        )
      ),
    },
    {
      id: "contractor",
      label: "Contractor",
      sortable: true,
      defaultVisible: false,
      render: (r) => (
        <span className="text-slate-600 text-xs">
          {r.assignedContractorName || <span className="text-slate-300">\u2014</span>}
        </span>
      ),
    },
    {
      id: "estimatedCost",
      label: "Est. Cost",
      sortable: true,
      defaultVisible: false,
      className: "text-right",
      render: (r) => (
        <span className="font-mono text-xs text-slate-600">{formatCurrency(r.estimatedCost)}</span>
      ),
    },
    {
      id: "nextApprover",
      label: "Next Approver",
      sortable: true,
      defaultVisible: false,
      render: (r) => (
        <span className="text-xs text-slate-600">{nextApproverLabel(r.status)}</span>
      ),
    },
    {
      id: "payingParty",
      label: "Paying Party",
      sortable: true,
      defaultVisible: false,
      render: (r) => (
        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", r.payingParty === "TENANT"
            ? "bg-orange-50 text-orange-700 border border-orange-200"
            : "bg-slate-50 text-slate-600 border border-slate-200")}>
          {r.payingParty === "TENANT" ? "Tenant" : "Landlord"}
        </span>
      ),
    },
    {
      id: "approvalSource",
      label: "Approval Source",
      sortable: true,
      defaultVisible: false,
      render: (r) => (
        <span className="text-xs text-slate-500">
          {r.approvalSource ? r.approvalSource.replace("_", " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : <span className="text-slate-300">\u2014</span>}
        </span>
      ),
    },
    {
      id: "createdAt",
      label: "Created",
      sortable: true,
      defaultVisible: true,
      className: "hidden sm:table-cell",
      render: (r) => (
        <span className="text-slate-400 text-xs">{formatDate(r.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      label: "Actions",
      alwaysVisible: true,
      render: (r) => {
        const ctaList = getAvailableCTAs(r, assigningId);
        return (
          <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {ctaList.map((cta) => {
              switch (cta) {
                case 'approve':
                  return (
                    <button key="approve" onClick={() => approveRequest(r.id)} disabled={actionLoading === r.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                      {actionLoading === r.id ? "\u2026" : "Approve"}
                    </button>
                  );
                case 'reject':
                  return (
                    <button key="reject" onClick={() => rejectRequest(r.id)} disabled={actionLoading === r.id}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      {actionLoading === r.id ? "\u2026" : "Reject"}
                    </button>
                  );
                case 'view_rfp':
                  return (
                    <a key="view_rfp" href="/manager/rfps" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                      View RFP
                    </a>
                  );
                case 'assign':
                  return assigningId === r.id ? (
                    <div key="assign-modal" className="flex items-center gap-1.5">
                      <select value={selectedContractorId} onChange={(e) => setSelectedContractorId(e.target.value)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs">
                        <option value="">Select&hellip;</option>
                        {contractors.map((c) => (
                          <option key={c.id} value={c.id}>{c.name || c.companyName || c.id.slice(0, 8)}</option>
                        ))}
                      </select>
                      <button onClick={() => doAssignContractor(r.id)} disabled={!selectedContractorId || actionLoading === r.id}
                        className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {actionLoading === r.id ? "\u2026" : "OK"}
                      </button>
                      <button onClick={() => { setAssigningId(null); setSelectedContractorId(""); }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                        &times;
                      </button>
                    </div>
                  ) : (
                    <button key="assign" onClick={() => setAssigningId(r.id)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                      Assign
                    </button>
                  );
                case 'unassign':
                  return (
                    <button key="unassign" onClick={() => doUnassignContractor(r.id)} disabled={actionLoading === r.id}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                      {actionLoading === r.id ? "\u2026" : "Unassign"}
                    </button>
                  );
                default:
                  return null;
              }
            })}
          </div>
        );
      },
    },
  ];
}

function requestFieldExtractor(r, field) {
  switch (field) {
    case "requestNumber": return r.requestNumber ?? 0;
    case "status": return r.status ?? "";
    case "building": return (r.buildingName || "").toLowerCase();
    case "category": return (r.category || "").toLowerCase();
    case "urgency": {
      const order = { EMERGENCY: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return order[r.urgency] ?? 2;
    }
    case "createdAt": return r.createdAt || "";
    case "estimatedCost": return r.estimatedCost ?? -1;
    case "contractor": return (r.assignedContractorName || "").toLowerCase();
    case "nextApprover": return nextApproverLabel(r.status).toLowerCase();
    case "payingParty": return (r.payingParty || "").toLowerCase();
    case "approvalSource": return (r.approvalSource || "").toLowerCase();
    default: return "";
  }
}

// ---------------------------------------------------------------------------
// Badge sub-components (Tailwind)
// ---------------------------------------------------------------------------

function getStatusLabel(r) {
  const s = r.status;
  const js = r.job?.status;
  if (s === "PENDING_REVIEW")         return { label: "Pending Review",          variant: "warning"  };
  if (s === "RFP_PENDING")            return { label: "RFP Open",                variant: "info"     };
  if (s === "PENDING_OWNER_APPROVAL") return { label: "Awaiting Owner Approval", variant: "warning"  };
  if (s === "APPROVED")               return { label: "Approved",                variant: "info"     };
  if (s === "ASSIGNED") {
    if (js === "IN_PROGRESS")         return { label: "Work underway",           variant: "success"  };
    if (js === "COMPLETED" || js === "INVOICED") return { label: "Work done",    variant: "success"  };
    return                                       { label: "Assigned",            variant: "info"     };
  }
  if (s === "COMPLETED")              return { label: "Completed",               variant: "success"  };
  if (s === "REJECTED")               return { label: "Rejected",                variant: "danger"   };
  return { label: (s || "").replace(/_/g, " "), variant: "default" };
}

function StatusBadge({ request }) {
  const { label, variant } = getStatusLabel(request);
  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Obligation explanation \u2014 plain language for managers
// ---------------------------------------------------------------------------

const OBLIGATION_META = {
  OBLIGATED: {
    cls: "bg-green-50 text-green-700 border-green-200",
    heading: "Landlord is legally obligated to repair",
    description: "Swiss law requires the landlord to fix this. Approve the repair and assign a contractor.",
  },
  DISCRETIONARY: {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    heading: "Repair is at the landlord\u2019s discretion",
    description: "This isn\u2019t strictly required by law, but is common practice. Consider the tenant relationship and cost.",
  },
  NOT_OBLIGATED: {
    cls: "bg-red-50 text-red-700 border-red-200",
    heading: "Landlord is not obligated",
    description: "Based on Swiss law and the asset\u2019s condition, this repair falls on the tenant. You may still choose to cover it.",
  },
  UNKNOWN: {
    cls: "bg-slate-100 text-slate-700 border-slate-200",
    heading: "Needs your judgement",
    description: "The legal engine couldn\u2019t determine obligation automatically. Review the details below and decide.",
  },
};

// ---------------------------------------------------------------------------
// Status-driven CTA helper — single source of truth for action buttons
// ---------------------------------------------------------------------------

/**
 * Returns the set of CTA keys available for a given request.
 * Single source of truth — no inline status checks in JSX.
 *
 * @param {object} r - request object from API
 * @param {string|null} assigningId - currently open assign modal id
 * @returns {string[]} array of CTA keys
 */
function getAvailableCTAs(r, assigningId) {
  const ctaMap = {
    PENDING_REVIEW:           ['approve', 'reject'], // manager can approve (→ RFP) or reject
    RFP_PENDING:              ['view_rfp'],
    PENDING_OWNER_APPROVAL:   [],                         // owner-only — manager cannot approve/reject on behalf
    APPROVED:                 ['assign'],
    ASSIGNED:                 ['unassign'],
    COMPLETED:                [],
    REJECTED:                 [],
  };

  const base = ctaMap[r.status] || [];

  // Replace assign with unassign if contractor already set
  if (base.includes('assign') && r.assignedContractorName) {
    return base.map(k => k === 'assign' ? 'unassign' : k);
  }

  return base;
}

// ---------------------------------------------------------------------------
// Next-step display — status-driven banner for accordion detail view
// ---------------------------------------------------------------------------

/**
 * Returns the next-step info for a request based on its current status
 * and optional legal decision data.
 *
 * @param {object} r - request summary from API
 * @param {object|null} legalDecision - lazy-fetched legal decision (may be null/undefined)
 * @returns {{ label: string, description: string, variant: string } | null}
 */
function getNextStep(r, legalDecision) {
  const obl = legalDecision?.legalObligation;

  switch (r.status) {
    case 'PENDING_REVIEW':
      if (!r.unitId && !r.unit) {
        return {
          label: 'Unit Required',
          description: 'This request has no unit assigned. Assign a unit before legal evaluation can proceed.',
          variant: 'warn',
        };
      }
      return {
        label: 'Pending Review',
        description: 'Approve to create an RFP and begin the contractor selection process, or reject the request.',
        variant: 'info',
      };

    case 'RFP_PENDING':
      if (obl === 'OBLIGATED') {
        return {
          label: 'Legally required \u2014 RFP open',
          description: 'Swiss law requires this repair. An RFP has been created automatically.',
          variant: 'info',
        };
      }
      return {
        label: 'RFP open',
        description: 'The owner approved this request. Contractors are being invited to quote.',
        variant: 'info',
      };

    case 'PENDING_OWNER_APPROVAL':
      if (obl === 'OBLIGATED') {
        return {
          label: 'Legal obligation \u2014 owner review',
          description: 'Swiss law requires this repair. The owner should approve to proceed.',
          variant: 'warn',
        };
      }
      return {
        label: 'Awaiting owner approval',
        description: 'The selected quote exceeds the building\u2019s auto-approval threshold. The owner must approve before work can begin.',
        variant: 'warn',
      };

    case 'APPROVED':
      return {
        label: 'Ready to assign',
        description: 'Approved and ready. Assign a contractor to begin work.',
        variant: 'success',
      };

    case 'ASSIGNED': {
      const jobStatus = r.job?.status;
      if (jobStatus === 'IN_PROGRESS') {
        return {
          label: 'Work in progress',
          description: 'The contractor is actively working on this repair.',
          variant: 'info',
        };
      }
      if (jobStatus === 'COMPLETED' || jobStatus === 'INVOICED') {
        return {
          label: 'Work complete \u2014 invoice pending',
          description: 'The contractor has marked the job done. Awaiting invoice review.',
          variant: 'success',
        };
      }
      return {
        label: 'Work assigned',
        description: 'A contractor is assigned and will begin work shortly.',
        variant: 'info',
      };
    }

    case 'REJECTED':
      return {
        label: 'Rejected',
        description: 'This request was rejected. The tenant may choose to self-pay.',
        variant: 'error',
      };

    case 'COMPLETED':
      return {
        label: 'Completed',
        description: 'This repair has been completed.',
        variant: 'success',
      };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// SVG Chevron (matches depreciation page)
// ---------------------------------------------------------------------------

function Chevron({ expanded, className = "" }) {
  return (
    <svg
      className={cn("h-4 w-4 text-slate-400 transition-transform", expanded ? "rotate-90" : "", className)}
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Depreciation bar (Tailwind version matching depreciation page)
// ---------------------------------------------------------------------------

function DepreciationBar({ signal }) {
  if (!signal) return null;
  const pct = signal.remainingLifePct;
  const ageYears = Math.round(signal.ageMonths / 12 * 10) / 10;
  const lifespanYears = Math.round(signal.usefulLifeMonths / 12);
  const barColor = pct > 50 ? "bg-green-400" : pct > 20 ? "bg-amber-400" : "bg-red-400";
  const usedPct = Math.max(2, 100 - pct);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Age: {ageYears} yrs of {lifespanYears}-yr lifespan</span>
        <span className={cn("font-semibold", signal.fullyDepreciated ? "text-red-600" : "text-slate-700")}>
          {signal.fullyDepreciated ? "Fully depreciated" : `${pct}% remaining life`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className={cn("h-2 rounded-full", barColor, "transition-all duration-500")} style={{ width: `${usedPct}%` }} />
      </div>
      {signal.notes && (
        <p className="mt-1 text-[11px] text-slate-400">Source: {signal.notes}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legal Recommendation Panel (single column, reordered, hand-holding UX)
// ---------------------------------------------------------------------------

function LegalRecommendationPanel({ decision, loading: isLoading, error: loadError, requestStatus }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="text-sm text-slate-500">Evaluating legal obligations&hellip;</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="border-t border-red-100 bg-red-50 px-6 py-3">
        <p className="text-sm text-red-600">{"\u26A0"} Could not load recommendation: {loadError}</p>
      </div>
    );
  }

  if (!decision) return null;

  const ob = OBLIGATION_META[decision.legalObligation] || OBLIGATION_META.UNKNOWN;

  const uniqueCitations = [];
  const seen = new Set();
  for (const c of decision.citations || []) {
    const key = `${c.article}|${c.text}`;
    if (!seen.has(key)) { seen.add(key); uniqueCitations.push(c); }
  }

  return (
    <div className="px-6 py-4">

      {/* Hero verdict card */}
      <div className={cn("rounded-lg border p-4", ob.cls)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold">{ob.heading}</h4>
            <p className="mt-1 text-[13px] leading-snug opacity-90">{ob.description}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/60 px-2.5 py-0.5 text-[11px] font-semibold">
            {decision.confidence}% confidence
          </span>
        </div>
      </div>

      {/* Citations */}
      {uniqueCitations.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-col gap-1.5">
            {uniqueCitations.slice(0, 4).map((c, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-blue-700">{c.article}</span>
                <span className="ml-2 text-slate-500">{c.text}</span>
              </div>
            ))}
            {uniqueCitations.length > 4 && (
              <span className="text-[11px] text-slate-400">
                + {uniqueCitations.length - 4} more citation{uniqueCitations.length - 4 > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Depreciation sub-card */}
      {decision.depreciationSignal && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600 mb-1">Asset depreciation</p>
          <DepreciationBar signal={decision.depreciationSignal} />
          {decision.depreciationSignal.fullyDepreciated && (
            <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700 font-medium">
              Asset has exceeded its useful life &mdash; landlord typically bears full replacement cost.
            </div>
          )}
        </div>
      )}

      {/* Defect matches (Phase B) — show best match prominently */}
      {decision.defectMatches?.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-600 mb-1.5">
            Best matching legal rule
          </p>
          {/* Primary match — always the first (highest-scored) */}
          {(() => {
            const dm = decision.defectMatches[0];
            return (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {dm.defectEn || dm.defect}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {dm.categoryEn || dm.category} &bull; {dm.reductionPercent}% reduction
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {Math.round(dm.matchConfidence)}% match
                  </span>
                </div>
                {dm.matchReasons?.length > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    {dm.matchReasons.join(", ")}
                  </p>
                )}
              </div>
            );
          })()}
          {/* Additional precedents collapsed — only show count */}
          {decision.defectMatches.length > 1 && (
            <p className="text-[11px] text-slate-400 mt-1.5">
              + {decision.defectMatches.length - 1} additional precedent{decision.defectMatches.length > 2 ? "s" : ""} identified
            </p>
          )}
        </div>
      )}

      {/* Rent reduction estimate (Phase B) */}
      {decision.rentReductionEstimate && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Estimated rent reduction</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-lg font-bold text-amber-900">
              CHF {decision.rentReductionEstimate.totalReductionChf?.toFixed(0) ?? "—"}
            </span>
            <span className="text-xs text-amber-700">
              ({decision.rentReductionEstimate.totalReductionPercent?.toFixed(1) ?? "—"}% of net rent
              {decision.rentReductionEstimate.netRentChf ? ` CHF ${decision.rentReductionEstimate.netRentChf}` : ""})
            </span>
          </div>
          {decision.rentReductionEstimate.capApplied && (
            <p className="text-[11px] text-amber-600 mt-1">Cap applied — reduction clamped to legal maximum.</p>
          )}
        </div>
      )}

      {/* Recommended actions (Phase C) — context-aware based on request status */}
      {decision.recommendedActions?.length > 0 && (() => {
        // Statuses that mean we're past the initial review stage
        const pastReview = ['RFP_PENDING', 'PENDING_OWNER_APPROVAL', 'APPROVED', 'ASSIGNED', 'COMPLETED', 'REJECTED'];
        const pastOwnerApproval = ['APPROVED', 'ASSIGNED', 'COMPLETED'];
        const isPastReview = pastReview.includes(requestStatus);
        const isPastOwnerApproval = pastOwnerApproval.includes(requestStatus);

        const contextActions = decision.recommendedActions.map((action) => {
          // Mark actions as completed if the request has already progressed past them
          if (action === 'CREATE_RFP' && isPastReview) {
            return { label: '\u2713 RFP created', done: true };
          }
          if (action === 'NOTIFY_MANAGER' && isPastReview) {
            return { label: '\u2713 Manager notified', done: true };
          }
          if (action === 'ROUTE_TO_OWNER' && requestStatus === 'PENDING_OWNER_APPROVAL') {
            return { label: '\u2713 Routed to owner \u2014 awaiting decision', done: false };
          }
          if (action === 'ROUTE_TO_OWNER' && isPastOwnerApproval) {
            return { label: '\u2713 Owner decision received', done: true };
          }
          // Default: show the raw action as a pending recommendation
          return { label: action.replace(/_/g, ' '), done: false };
        });

        return (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-1.5">Recommended actions</p>
            <div className="flex flex-wrap gap-1.5">
              {contextActions.map((a, i) => (
                <span
                  key={i}
                  className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium", a.done
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-blue-50 border-blue-200 text-blue-700')}
                >
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Defect signals summary */}
      {decision.defectSignals && (decision.defectSignals.severity || decision.defectSignals.affectedArea) && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600 mb-1">Defect signals</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {decision.defectSignals.severity && (
              <span>Severity: <span className="font-medium text-slate-700">{decision.defectSignals.severity}</span></span>
            )}
            {decision.defectSignals.affectedArea && (
              <span>Area: <span className="font-medium text-slate-700">
                {typeof decision.defectSignals.affectedArea === "string"
                  ? decision.defectSignals.affectedArea
                  : (decision.defectSignals.affectedArea.rooms || []).join(", ") || "—"}
              </span></span>
            )}
            {decision.defectSignals.duration && (
              <span>Duration: <span className="font-medium text-slate-700">
                {typeof decision.defectSignals.duration === "string"
                  ? decision.defectSignals.duration
                  : [
                      decision.defectSignals.duration.ongoing && "ongoing",
                      decision.defectSignals.duration.seasonal && "seasonal",
                    ].filter(Boolean).join(", ") || "one-time"}
              </span></span>
            )}
          </div>
          {decision.defectSignals.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {decision.defectSignals.keywords.map((kw, i) => (
                <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {typeof kw === "string" ? kw : kw.term || JSON.stringify(kw)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Repair vs Replace Arbitrage Panel
// ---------------------------------------------------------------------------

const RECOMMENDATION_STYLES = {
  REPAIR:           { badge: "bg-green-100 text-green-700 border-green-200", label: "Repair" },
  MONITOR:          { badge: "bg-amber-100 text-amber-700 border-amber-200", label: "Monitor" },
  PLAN_REPLACEMENT: { badge: "bg-orange-100 text-orange-700 border-orange-200", label: "Plan Replacement" },
  REPLACE:          { badge: "bg-red-100 text-red-700 border-red-200", label: "Replace" },
};

function RepairReplacePanel({ state, requestCategory }) {
  if (!state) return null;

  if (state.loading) {
    return (
      <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="text-sm text-slate-500">Analysing repair vs replace&hellip;</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="border-t border-red-100 bg-red-50 px-6 py-3">
        <p className="text-sm text-red-600">\u26A0 Could not load repair/replace analysis: {state.error}</p>
      </div>
    );
  }

  const items = state.data;
  if (!items || items.length === 0) return null;

  // Sort: items matching the request category first, then by recommendation severity
  const severity = { REPLACE: 0, PLAN_REPLACEMENT: 1, MONITOR: 2, REPAIR: 3 };
  const sorted = [...items].sort((a, b) => {
    const aCat = requestCategory && (a.topic || "").toLowerCase().includes(requestCategory.toLowerCase()) ? 0 : 1;
    const bCat = requestCategory && (b.topic || "").toLowerCase().includes(requestCategory.toLowerCase()) ? 0 : 1;
    if (aCat !== bCat) return aCat - bCat;
    return (severity[a.recommendation] ?? 9) - (severity[b.recommendation] ?? 9);
  });

  return (
    <div className="px-6 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Repair vs Replace Analysis</p>

      <div className="space-y-2">
        {sorted.map((item) => {
          const style = RECOMMENDATION_STYLES[item.recommendation] || RECOMMENDATION_STYLES.REPAIR;
          const ageYears = item.ageMonths != null ? (item.ageMonths / 12).toFixed(1) : null;
          const lifeYears = item.usefulLifeMonths != null ? Math.round(item.usefulLifeMonths / 12) : null;
          const depPct = item.depreciationPct;
          const ratioDisplay = item.repairToReplacementRatio != null
            ? `${Math.round(item.repairToReplacementRatio * 100)}%`
            : null;
          const breakEvenDisplay = item.breakEvenMonths != null
            ? item.breakEvenMonths === 0
              ? "Exceeded"
              : item.breakEvenMonths < 12
                ? `${item.breakEvenMonths} mo`
                : `${(item.breakEvenMonths / 12).toFixed(1)} yr`
            : null;
          const isRelevant = requestCategory && (item.topic || "").toLowerCase().includes(requestCategory.toLowerCase());

          return (
            <div
              key={item.assetId}
              className={cn("rounded-lg border p-3", isRelevant
                  ? "border-indigo-200 bg-indigo-50/40"
                  : "border-slate-200 bg-white")}
              title={item.recommendationReason}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.assetName}</p>
                    {isRelevant && (
                      <span className="shrink-0 rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                        Related
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {item.topic || "\u2014"}
                    {ageYears && lifeYears ? ` \u00B7 ${ageYears} yr of ${lifeYears}-yr life` : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", style.badge)}>
                  {style.label}
                </span>
              </div>

              {/* Metrics row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
                {depPct != null && (
                  <span>
                    Depreciation:{" "}
                    <span className={cn("font-semibold", depPct >= 100 ? "text-red-600" : depPct >= 85 ? "text-orange-600" : depPct >= 65 ? "text-amber-600" : "text-slate-700")}>
                      {depPct}%
                    </span>
                  </span>
                )}
                {item.cumulativeRepairCostChf > 0 && (
                  <span>Repairs: <span className="font-medium text-slate-700">CHF {item.cumulativeRepairCostChf.toLocaleString("de-CH")}</span></span>
                )}
                {item.estimatedReplacementCostChf != null && (
                  <span>Replace est.: <span className="font-medium text-slate-700">CHF {item.estimatedReplacementCostChf.toLocaleString("de-CH")}</span></span>
                )}
                {ratioDisplay && (
                  <span>
                    Ratio:{" "}
                    <span className={cn("font-semibold", item.repairToReplacementRatio >= 0.6 ? "text-red-600" : item.repairToReplacementRatio >= 0.4 ? "text-orange-600" : "text-slate-700")}>
                      {ratioDisplay}
                    </span>
                  </span>
                )}
                {breakEvenDisplay && (
                  <span>
                    Break-even:{" "}
                    <span className={cn("font-semibold", item.breakEvenMonths <= 12 ? "text-red-600" : item.breakEvenMonths <= 36 ? "text-amber-600" : "text-slate-700")}>
                      {breakEvenDisplay}
                    </span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-slate-400">
        Ratio = cumulative repair cost \u00F7 replacement est. Hover a card for the recommendation reason.
      </p>
    </div>
  );
}

/** Consistent section label used inside the accordion */
function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Request Photos / Attachments Panel (inline component)
// ---------------------------------------------------------------------------

function RequestPhotosPanel({ requestId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/maintenance-attachments/${requestId}`, { headers: authHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error("Not available");
        const body = await res.json();
        if (!cancelled) setAttachments(body?.data || []);
      })
      .catch(() => {
        if (!cancelled) setAttachments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [requestId]);

  function handleUpload(e) {
    const files = e.target.files;
    if (!files?.length) return;
    const uploads = Array.from(files).map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/maintenance-attachments/${requestId}`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const body = await res.json();
      return body?.data;
    });
    Promise.all(uploads)
      .then((newItems) => {
        setAttachments((prev) => [...prev, ...newItems.filter(Boolean)]);
      })
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

  if (loading) {
    return (
      <div className="px-6 py-4">
        <SectionLabel>Photos / Attachments</SectionLabel>
        <p className="mt-2 text-xs text-slate-400">Loading&hellip;</p>
      </div>
    );
  }

  const images = attachments.filter((a) => isImage(a.filename));
  const files = attachments.filter((a) => !isImage(a.filename));

  /** Resolve download URL — DTO returns /maintenance-attachments/:id/download, proxy needs /api prefix */
  function downloadUrl(a) {
    return a.url?.startsWith("/") ? `/api${a.url}` : a.url;
  }

  return (
    <div className="px-6 py-4">
      <SectionLabel>Photos / Attachments</SectionLabel>

      {attachments.length === 0 ? (
        /* Empty state */
        <div className="mt-2 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
          <svg className="h-8 w-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm text-slate-500">No photos yet. Upload to document the issue.</p>
          <label className="mt-3 cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            Upload photo
            <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      ) : (
        <>
          {/* Image thumbnails */}
          {images.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {images.map((a, i) => (
                <button key={i} onClick={() => setPreviewUrl(downloadUrl(a))} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <img src={downloadUrl(a)} alt={a.filename} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </button>
              ))}
            </div>
          )}

          {/* Non-image files */}
          {files.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {files.map((a, i) => (
                <a key={i} href={downloadUrl(a)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium text-slate-700">{a.filename}</span>
                  {a.size && <span className="text-slate-400">{formatSize(a.size)}</span>}
                </a>
              ))}
            </div>
          )}

          {/* Upload more */}
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload more
            <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
          </label>
        </>
      )}

      {/* Lightbox modal */}
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
// Main Page
// ---------------------------------------------------------------------------

export default function ManagerRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const activeTab = useMemo(() => {
    if (!router.isReady) return 0;
    const raw = (router.query.tab || "").toLowerCase();
    const resolved = TAB_ALIASES[raw] || raw;
    const idx = TAB_KEYS.indexOf(resolved);
    return idx >= 0 ? idx : 0;
  }, [router.isReady, router.query.tab]);
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index], page: "0" } },
      undefined,
      { shallow: true }
    );
  }, [router]);

  const { sortField, sortDir, handleSort } = useTableSort(router, REQUEST_SORT_FIELDS);

  const [actionLoading, setActionLoading] = useState(null);

  // Assign modal state
  const [assigningId, setAssigningId] = useState(null);
  const [selectedContractorId, setSelectedContractorId] = useState("");



  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqRes, conRes] = await Promise.all([
        fetch("/api/requests?view=summary&order=desc&limit=2000", { headers: authHeaders() }),
        fetch("/api/contractors", { headers: authHeaders() }),
      ]);
      const reqData = await reqRes.json();
      const conData = await conRes.json();
      if (!reqRes.ok) throw new Error(reqData?.error?.message || "Failed to load requests");
      setRequests(reqData?.data || []);
      setRequestsTotal(reqData?.total ?? reqData?.data?.length ?? 0);
      setContractors(conData?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Redirect old ?requestId= deep-links to the new detail page
  useEffect(() => {
    if (!router.isReady) return;
    const requestId = router.query.requestId;
    if (requestId) {
      router.replace(`/manager/requests/${requestId}`);
    }
  }, [router.isReady, router.query.requestId]);

  const filteredRequests = useMemo(() => {
    const tab = STATUS_TABS[activeTab];
    if (!tab || !tab.statuses) return requests;
    if (tab.extraFilter) return requests.filter(tab.extraFilter);
    return requests.filter((r) => tab.statuses.includes(r.status));
  }, [requests, activeTab]);

  const sortedRequests = useMemo(
    () => clientSort(filteredRequests, sortField, sortDir, requestFieldExtractor),
    [filteredRequests, sortField, sortDir]
  );
  const pager = useTablePagination(router, sortedRequests.length, 25);
  const paginatedRequests = useMemo(
    () => pager.pageSlice(sortedRequests),
    [sortedRequests, pager.pageSlice]
  );



  // Actions
  async function approveRequest(id) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error?.message || "Failed to approve"); }
      await loadData();
    } catch (e) { setError(String(e?.message || e)); }
    finally { setActionLoading(null); }
  }

  async function rejectRequest(id) {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return; // user cancelled
    setActionLoading(id);
    try {
      const res = await fetch(`/api/requests/${id}/manager-reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reason: reason || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error?.message || "Failed to reject"); }
      await loadData();
    } catch (e) { setError(String(e?.message || e)); }
    finally { setActionLoading(null); }
  }

  async function setUrgency(id, urgency) {
    try {
      const res = await fetch(`/api/requests/${id}/urgency`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ urgency }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error?.message || "Failed to set urgency"); }
      await loadData();
    } catch (e) { setError(String(e?.message || e)); }
  }

  async function doAssignContractor(requestId) {
    if (!selectedContractorId) return;
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/requests/${requestId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ contractorId: selectedContractorId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error?.message || "Failed to assign"); }
      setAssigningId(null);
      setSelectedContractorId("");
      await loadData();
    } catch (e) { setError(String(e?.message || e)); }
    finally { setActionLoading(null); }
  }

  async function doUnassignContractor(requestId) {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/requests/${requestId}/assign`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error?.message || "Failed to unassign"); }
      await loadData();
    } catch (e) { setError(String(e?.message || e)); }
    finally { setActionLoading(null); }
  }

  const requestColumns = useMemo(
    () => buildRequestColumns({
      assigningId, setAssigningId, selectedContractorId, setSelectedContractorId,
      contractors, actionLoading,
      approveRequest, rejectRequest, doAssignContractor, doUnassignContractor,
      getAvailableCTAs,
    }),
    [assigningId, selectedContractorId, contractors, actionLoading]
  );

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Requests Inbox"
          subtitle="Review incoming maintenance requests. Click a row to see full details."
        />
        <PageContent>

          {/* Error banner */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
              <span><strong>Error:</strong> {error}</span>
              <button onClick={() => setError("")} className="text-xs text-red-500 hover:underline ml-4">Dismiss</button>
            </div>
          )}

          {/* Status Tabs */}
          <div className="tab-strip">
            {STATUS_TABS.map((tab, i) => {
              if (tab.href) {
                return (
                  <Link key={tab.key} href={tab.href} className="tab-btn">
                    {tab.label}
                  </Link>
                );
              }
              const count = !tab.statuses
                ? requestsTotal
                : tab.extraFilter
                  ? requests.filter(tab.extraFilter).length
                  : requests.filter((r) => tab.statuses.includes(r.status)).length;
              const active = activeTab === i;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(i)}
                  className={active ? "tab-btn-active" : "tab-btn"}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Content */}
          {loading ? (
            <div className="px-4"><p className="text-sm text-slate-500">Loading requests&hellip;</p></div>
          ) : filteredRequests.length === 0 ? (
            <div className="px-4"><p className="empty-state-text">No requests match this filter.</p></div>
          ) : (
            <div>
              <ConfigurableTable
                tableId="manager-requests"
                columns={requestColumns}
                data={paginatedRequests}
                rowKey={(r) => r.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(r) => router.push(`/manager/requests/${r.id}`)}
                emptyState={<p className="text-sm text-slate-500">No requests match this filter.</p>}
                mobileCard={(r) => {
                  const ctaList = getAvailableCTAs(r, assigningId);
                  return (
                    <div className="table-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-400">
                            {r.requestNumber ? `#${r.requestNumber}` : "—"}
                          </span>
                          <StatusBadge request={r} />
                          {(r.urgency === "EMERGENCY" || r.urgency === "HIGH") && (
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", r.urgency === "EMERGENCY"
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-orange-100 text-orange-700 border border-orange-200")}>
                              {r.urgency === "EMERGENCY" ? "🚨" : "⚠"} {r.urgency === "EMERGENCY" ? "Emergency" : "High"}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="table-card-head mt-1.5">{r.buildingName || "—"}{r.unitNumber ? ` / ${r.unitNumber}` : ""}</p>
                      {r.category && (
                        <p className="mt-0.5">
                          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{r.category}</span>
                        </p>
                      )}
                      {ctaList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                          {ctaList.map((cta) => {
                            switch (cta) {
                              case 'approve':
                                return (
                                  <button key="approve" onClick={() => approveRequest(r.id)} disabled={actionLoading === r.id}
                                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                                    {actionLoading === r.id ? "…" : "Approve"}
                                  </button>
                                );
                              case 'reject':
                                return (
                                  <button key="reject" onClick={() => rejectRequest(r.id)} disabled={actionLoading === r.id}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                    {actionLoading === r.id ? "…" : "Reject"}
                                  </button>
                                );
                              case 'view_rfp':
                                return (
                                  <a key="view_rfp" href="/manager/rfps" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                                    View RFP
                                  </a>
                                );
                              case 'assign':
                                return assigningId === r.id ? (
                                  <div key="assign-modal" className="flex items-center gap-1.5">
                                    <select value={selectedContractorId} onChange={(e) => setSelectedContractorId(e.target.value)}
                                      className="rounded border border-slate-300 px-2 py-1 text-xs">
                                      <option value="">Select…</option>
                                      {contractors.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name || c.companyName || c.id.slice(0, 8)}</option>
                                      ))}
                                    </select>
                                    <button onClick={() => doAssignContractor(r.id)} disabled={!selectedContractorId || actionLoading === r.id}
                                      className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                                      {actionLoading === r.id ? "…" : "OK"}
                                    </button>
                                    <button onClick={() => { setAssigningId(null); setSelectedContractorId(""); }}
                                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <button key="assign" onClick={() => setAssigningId(r.id)}
                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                                    Assign
                                  </button>
                                );
                              case 'unassign':
                                return (
                                  <button key="unassign" onClick={() => doUnassignContractor(r.id)} disabled={actionLoading === r.id}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                                    {actionLoading === r.id ? "…" : "Unassign"}
                                  </button>
                                );
                              default:
                                return null;
                            }
                          })}
                        </div>
                      )}
                    </div>
                  );
                }}
              />

              <PaginationControls
                currentPage={pager.currentPage}
                totalPages={pager.totalPages}
                totalItems={sortedRequests.length}
                pageSize={pager.pageSize}
                onPageChange={pager.setPage}
              />
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

// Named exports for the request detail page
export {
  StatusBadge as RequestStatusBadge,
  LegalRecommendationPanel,
  RepairReplacePanel,
  RequestPhotosPanel,
  SectionLabel,
  getNextStep,
  getAvailableCTAs,
  OBLIGATION_META,
  requestVariant as REQUEST_STATUS_VARIANT,
  formatDate as requestFormatDate,
  formatCurrency,
};
