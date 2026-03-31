import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import SortableHeader from "../../components/SortableHeader";
import PaginationControls from "../../components/PaginationControls";
import { useTableSort, useTablePagination, clientSort } from "../../lib/tableUtils";
import { authHeaders } from "../../lib/api";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS = [
  { key: "ALL",              label: "Overview",         statuses: null },
  { key: "PENDING",          label: "Pending Review",   statuses: ["PENDING_REVIEW"] },
  { key: "OWNER_APPROVAL",   label: "Owner Approval",   statuses: ["PENDING_OWNER_APPROVAL"] },
  { key: "RFP_OPEN",         label: "RFP Open",         statuses: ["RFP_PENDING"] },
  { key: "AUTO_APPROVED",    label: "Auto-Approved",    statuses: ["AUTO_APPROVED"] },
  { key: "ACTIVE",           label: "Active",           statuses: ["APPROVED", "ASSIGNED", "IN_PROGRESS"] },
  { key: "DONE",             label: "Completed",        statuses: ["COMPLETED", "OWNER_REJECTED"] },
  { key: "RFPS",             label: "RFPs",             statuses: null, href: "/manager/rfps" },
];

// Derive TAB_KEYS from STATUS_TABS to prevent drift; preserve backward-compat aliases
const TAB_KEYS = STATUS_TABS.map((t) => t.key.toLowerCase());
// Old deep-link aliases → map to new index
const TAB_ALIASES = { overview: "all", pending_review: "pending", completed: "done" };

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

const REQUEST_SORT_FIELDS = ["requestNumber", "status", "building", "category", "estimatedCost", "contractor", "createdAt", "requestor", "nextApprover"];

function nextApproverLabel(status) {
  switch (status) {
    case "PENDING_REVIEW":         return "Manager";
    case "PENDING_OWNER_APPROVAL": return "Owner";
    case "RFP_PENDING":            return "Manager (RFP)";
    case "APPROVED":
    case "ASSIGNED":
    case "IN_PROGRESS":            return "Contractor";
    default:                       return "—";
  }
}

function requestFieldExtractor(r, field) {
  switch (field) {
    case "requestNumber": return r.requestNumber ?? 0;
    case "status": return r.status ?? "";
    case "building": return (r.buildingName || "").toLowerCase();
    case "category": return (r.category || "").toLowerCase();
    case "estimatedCost": return r.estimatedCost ?? -1;
    case "contractor": return (r.assignedContractorName || "").toLowerCase();
    case "createdAt": return r.createdAt || "";
    case "requestor": return r.tenant?.name ? r.tenant.name.toLowerCase() : "manager";
    case "nextApprover": return nextApproverLabel(r.status).toLowerCase();
    default: return "";
  }
}

// ---------------------------------------------------------------------------
// Badge sub-components (Tailwind)
// ---------------------------------------------------------------------------

const STATUS_CLASSES = {
  PENDING_REVIEW:          "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_OWNER_APPROVAL:  "bg-rose-50 text-rose-700 border-rose-200",
  RFP_PENDING:             "bg-indigo-50 text-indigo-700 border-indigo-200",
  APPROVED:                "bg-emerald-50 text-emerald-700 border-emerald-200",
  AUTO_APPROVED:           "bg-emerald-50 text-emerald-700 border-emerald-200",
  ASSIGNED:                "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS:             "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED:               "bg-violet-50 text-violet-700 border-violet-200",
  OWNER_REJECTED:           "bg-red-50 text-red-700 border-red-200",
};

function StatusBadge({ status }) {
  const cls = STATUS_CLASSES[status] || "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Obligation explanation \u2014 plain language for managers
// ---------------------------------------------------------------------------

const OBLIGATION_META = {
  OBLIGATED: {
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    heading: "Landlord is legally obligated to repair",
    description: "Swiss law requires the landlord to fix this. Approve the repair and assign a contractor.",
  },
  DISCRETIONARY: {
    cls: "bg-amber-50 text-amber-800 border-amber-200",
    heading: "Repair is at the landlord\u2019s discretion",
    description: "This isn\u2019t strictly required by law, but is common practice. Consider the tenant relationship and cost.",
  },
  NOT_OBLIGATED: {
    cls: "bg-red-50 text-red-800 border-red-200",
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
    PENDING_REVIEW:           [],                         // auto-routed by legal engine
    RFP_PENDING:              ['view_rfp'],
    AUTO_APPROVED:            ['view_rfp'],
    PENDING_OWNER_APPROVAL:   ['approve', 'reject'],      // no RFP yet — owner decides first
    APPROVED:                 ['assign'],
    ASSIGNED:                 ['unassign'],
    IN_PROGRESS:              ['view_rfp'],               // read-only link
    COMPLETED:                [],
    OWNER_REJECTED:           [],
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
      if (!r.unitNumber) {
        return {
          label: 'Unit Required',
          description: 'This request has no unit assigned. Assign a unit before legal evaluation can proceed.',
          variant: 'warn',
        };
      }
      return {
        label: 'Auto-Routing',
        description: 'The legal engine is evaluating this request. It will be routed automatically based on obligation rules.',
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

    case 'AUTO_APPROVED':
      return {
        label: 'Auto-approved \u2014 RFP open',
        description: 'This repair was legally obligated and automatically approved.',
        variant: 'success',
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
        label: 'Awaiting owner decision',
        description: 'The owner must approve or reject before an RFP is created.',
        variant: 'warn',
      };

    case 'APPROVED':
      return {
        label: 'Ready to assign',
        description: 'Approved and ready. Assign a contractor to begin work.',
        variant: 'success',
      };

    case 'IN_PROGRESS':
      return {
        label: 'Work in progress',
        description: 'A contractor is assigned and work is underway.',
        variant: 'info',
      };

    case 'OWNER_REJECTED':
      return {
        label: 'Rejected by owner',
        description: 'The owner declined this request.',
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
      className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""} ${className}`}
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
  const barColor = pct > 50 ? "bg-emerald-400" : pct > 20 ? "bg-amber-400" : "bg-red-400";
  const usedPct = Math.max(2, 100 - pct);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Age: {ageYears} yrs of {lifespanYears}-yr lifespan</span>
        <span className={`font-semibold ${signal.fullyDepreciated ? "text-red-600" : "text-slate-700"}`}>
          {signal.fullyDepreciated ? "Fully depreciated" : `${pct}% remaining life`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${barColor} transition-all duration-500`} style={{ width: `${usedPct}%` }} />
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

function LegalRecommendationPanel({ decision, loading: isLoading, error: loadError }) {
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
      <div className={`rounded-lg border p-4 ${ob.cls}`}>
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
            <div className="mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700 font-medium">
              Asset has exceeded its useful life &mdash; landlord typically bears full replacement cost.
            </div>
          )}
        </div>
      )}
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
          <label className="mt-3 cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
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
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
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

  // Accordion state — auto-expand if ?requestId= is present
  const initialRequestId = router.isReady ? (router.query.requestId || null) : null;
  const [expandedId, setExpandedId] = useState(null);
  const [legalDecisions, setLegalDecisions] = useState({});
  const [requestDetails, setRequestDetails] = useState({});
  const [didAutoExpand, setDidAutoExpand] = useState(false);

  // Auto-expand from ?requestId= deep-link after data loads
  useEffect(() => {
    if (didAutoExpand || !initialRequestId || loading || !requests.length) return;
    const match = requests.find((r) => r.id === initialRequestId);
    if (match) {
      setExpandedId(initialRequestId);
      setDidAutoExpand(true);
      // Lazy-fetch detail for the auto-expanded request
      if (!requestDetails[initialRequestId]) {
        setRequestDetails((prev) => ({ ...prev, [initialRequestId]: { loading: true, data: null } }));
        fetch(`/api/requests/${initialRequestId}`, { headers: authHeaders() })
          .then(async (res) => {
            const body = await res.json();
            if (!res.ok) throw new Error("Failed to load detail");
            setRequestDetails((prev) => ({ ...prev, [initialRequestId]: { loading: false, data: body.data } }));
          })
          .catch(() => {
            setRequestDetails((prev) => ({ ...prev, [initialRequestId]: { loading: false, data: null } }));
          });
      }
      // Scroll to the row after a short delay for render
      setTimeout(() => {
        const el = document.getElementById(`request-row-${initialRequestId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [initialRequestId, loading, requests, didAutoExpand]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqRes, conRes] = await Promise.all([
        fetch("/api/requests?view=summary&order=desc&limit=200", { headers: authHeaders() }),
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

  const filteredRequests = useMemo(() => {
    const tab = STATUS_TABS[activeTab];
    if (!tab || !tab.statuses) return requests;
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

  // Toggle accordion + lazy-fetch
  function toggleAccordion(requestId) {
    if (expandedId === requestId) { setExpandedId(null); return; }
    setExpandedId(requestId);
    // Lazy-fetch full request detail (for tenant info, full description, etc.)
    if (!requestDetails[requestId]) {
      setRequestDetails((prev) => ({ ...prev, [requestId]: { loading: true, data: null } }));
      fetch(`/api/requests/${requestId}`, { headers: authHeaders() })
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error("Failed to load detail");
          setRequestDetails((prev) => ({ ...prev, [requestId]: { loading: false, data: body.data } }));
        })
        .catch(() => {
          setRequestDetails((prev) => ({ ...prev, [requestId]: { loading: false, data: null } }));
        });
    }
    if (!legalDecisions[requestId]) {
      setLegalDecisions((prev) => ({ ...prev, [requestId]: { loading: true, error: null, data: null } }));
      fetch(`/api/requests/${requestId}/legal-decision`, { headers: authHeaders() })
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body?.error?.message || "Evaluation failed");
          setLegalDecisions((prev) => ({
            ...prev,
            [requestId]: { loading: false, error: null, data: body.data },
          }));
        })
        .catch((e) => {
          setLegalDecisions((prev) => ({
            ...prev,
            [requestId]: { loading: false, error: String(e?.message || e), data: null },
          }));
        });
    }
  }

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
      const res = await fetch(`/api/requests/${id}/owner-reject`, {
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

  const canExpand = (r) =>
    r.status === "PENDING_REVIEW" ||
    r.status === "PENDING_OWNER_APPROVAL" ||
    r.status === "RFP_PENDING" ||
    r.status === "AUTO_APPROVED" ||
    r.status === "APPROVED" ||
    r.status === "ASSIGNED" ||
    r.status === "IN_PROGRESS" ||
    r.status === "COMPLETED" ||
    r.status === "OWNER_REJECTED";

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Requests Inbox"
          subtitle="Review incoming maintenance requests. Click a pending row to see the legal recommendation."
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
            <Panel><p className="text-sm text-slate-500">Loading requests&hellip;</p></Panel>
          ) : filteredRequests.length === 0 ? (
            <Panel><p className="empty-state-text">No requests match this filter.</p></Panel>
          ) : (
            <Panel bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 pl-3 pr-1 w-8"></th>
                      <SortableHeader label="#" field="requestNumber" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-16" />
                      <SortableHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Requestor" field="requestor" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                      <SortableHeader label="Next Approver" field="nextApprover" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                      <SortableHeader label="Building / Unit" field="building" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Category" field="category" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <th className="px-3 py-2.5">Description</th>
                      <SortableHeader label="Est. Cost" field="estimatedCost" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Contractor" field="contractor" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                      <SortableHeader label="Created" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                      <th className="px-3 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequests.map((r) => {
                      const expandable = canExpand(r);
                      const isExpanded = expandedId === r.id;
                      const legalState = legalDecisions[r.id];

                      return (
                        <Fragment key={r.id}>
                          <tr
                            id={`request-row-${r.id}`}
                            onClick={expandable ? () => toggleAccordion(r.id) : undefined}
                            className={[
                              "border-b border-slate-50 transition-colors",
                              expandable ? "cursor-pointer hover:bg-slate-50/80" : "",
                              isExpanded ? "bg-slate-50" : "",
                            ].join(" ")}
                          >
                            {/* Chevron */}
                            <td className="py-2.5 pl-3 pr-1">
                              {expandable && <Chevron expanded={isExpanded} />}
                            </td>

                            <td className="px-3 py-2.5 text-sm font-mono text-slate-500">
                              {r.requestNumber ? `#${r.requestNumber}` : "\u2014"}
                            </td>

                            <td className="px-3 py-2.5">
                              <StatusBadge status={r.status} />
                              {r.payingParty === "TENANT" && (
                                <span className="ml-1.5 inline-block rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                  Tenant-funded
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2.5 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                              {r.tenant?.id ? (
                                <Link href={`/manager/people/tenants/${r.tenant.id}`} className="text-sm text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                                  {r.tenant.name || "Tenant"}
                                </Link>
                              ) : (
                                <span className="text-sm text-slate-400">Manager</span>
                              )}
                            </td>

                            <td className="px-3 py-2.5 hidden lg:table-cell text-sm text-slate-500">
                              {nextApproverLabel(r.status)}
                            </td>

                            <td className="px-3 py-2.5 text-slate-700">
                              {r.buildingId ? (
                                <Link href={`/manager/buildings/${r.buildingId}/financials`} className="text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                                  {r.buildingName || "\u2014"}
                                </Link>
                              ) : (r.buildingName || "\u2014")}
                              {r.unitNumber ? (
                                r.unitId ? (
                                  <span className="text-slate-400"> / <Link href={`/admin-inventory/units/${r.unitId}`} className="text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>{r.unitNumber}</Link></span>
                                ) : (
                                  <span className="text-slate-400"> / {r.unitNumber}</span>
                                )
                              ) : ""}
                            </td>

                            <td className="px-3 py-2.5">
                              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {r.category || "\u2014"}
                              </span>
                            </td>

                            <td className="px-3 py-2.5 max-w-[260px] truncate text-slate-600">
                              {r.description || "\u2014"}
                            </td>

                            <td className="px-3 py-2.5 font-medium text-slate-700">
                              {typeof r.estimatedCost === "number" ? formatCurrency(r.estimatedCost) : "\u2014"}
                            </td>

                            <td className="px-3 py-2.5 hidden lg:table-cell text-slate-500">
                              {r.assignedContractorName || "\u2014"}
                            </td>

                            <td className="px-3 py-2.5 hidden sm:table-cell text-slate-400 text-xs">
                              {formatDate(r.createdAt)}
                            </td>

                            {/* Actions */}
                            <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {getAvailableCTAs(r, assigningId).map((cta) => {
                                  switch (cta) {
                                    case 'approve':
                                      return (
                                        <button key="approve"
                                          onClick={() => approveRequest(r.id)}
                                          disabled={actionLoading === r.id}
                                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                          {actionLoading === r.id ? "\u2026" : "Approve"}
                                        </button>
                                      );
                                    case 'reject':
                                      return (
                                        <button key="reject"
                                          onClick={() => rejectRequest(r.id)}
                                          disabled={actionLoading === r.id}
                                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                          {actionLoading === r.id ? "\u2026" : "Reject"}
                                        </button>
                                      );
                                    case 'view_rfp':
                                      return (
                                        <a key="view_rfp" href="/manager/rfps"
                                          className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                                        >
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
                                            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                                            {actionLoading === r.id ? "\u2026" : "OK"}
                                          </button>
                                          <button onClick={() => { setAssigningId(null); setSelectedContractorId(""); }}
                                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                                            &times;
                                          </button>
                                        </div>
                                      ) : (
                                        <button key="assign" onClick={() => setAssigningId(r.id)}
                                          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700">
                                          Assign
                                        </button>
                                      );
                                    case 'unassign':
                                      return (
                                        <button key="unassign"
                                          onClick={() => doUnassignContractor(r.id)}
                                          disabled={actionLoading === r.id}
                                          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                        >
                                          {actionLoading === r.id ? "\u2026" : "Unassign"}
                                        </button>
                                      );
                                    default:
                                      return null;
                                  }
                                })}
                              </div>
                            </td>
                          </tr>

                          {/* Accordion row */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={10} className="p-0">
                                {(() => {
                                  const detail = requestDetails[r.id];
                                  const d = detail?.data;
                                  const tenant = d?.tenant;
                                  const rfpId = legalState?.data?.rfpId || d?.rfpId || null;

                                  return (
                                    <div className="divide-y divide-slate-100">

                                      {/* Section 1 — Tenant info */}
                                      <div className="px-6 py-4">
                                        <SectionLabel>Tenant</SectionLabel>
                                        {detail?.loading ? (
                                          <p className="mt-1 text-xs text-slate-400">Loading&hellip;</p>
                                        ) : tenant ? (
                                          <div className="mt-2 grid grid-cols-3 gap-4">
                                            <div>
                                              <p className="text-[11px] uppercase tracking-wider text-slate-400">Name</p>
                                              {d?.tenantId ? (
                                                <Link href={`/manager/people/tenants/${d.tenantId}`} className="text-sm text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                                                  {tenant.name || "\u2014"}
                                                </Link>
                                              ) : (
                                                <p className="text-sm text-slate-700">{tenant.name || "\u2014"}</p>
                                              )}
                                            </div>
                                            <div>
                                              <p className="text-[11px] uppercase tracking-wider text-slate-400">Phone</p>
                                              <p className="text-sm text-slate-700">{tenant.phone || "\u2014"}</p>
                                            </div>
                                            <div>
                                              <p className="text-[11px] uppercase tracking-wider text-slate-400">Email</p>
                                              <p className="text-sm text-slate-700">{tenant.email || "\u2014"}</p>
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="mt-1 text-sm text-slate-400">\u2014</p>
                                        )}
                                      </div>

                                      {/* Section 2 — Tenant self-pay banner */}
                                      {d?.payingParty === "TENANT" && (
                                        <div className="px-6 py-3 bg-orange-50 border-b border-orange-100">
                                          <div className="flex items-start gap-2">
                                            <span className="text-orange-500 text-base leading-none mt-0.5">⚠</span>
                                            <div>
                                              <p className="text-sm font-semibold text-orange-800">Tenant-funded request</p>
                                              <p className="text-xs text-orange-700 mt-0.5">
                                                The owner rejected this request{d.rejectionReason ? ` ("${d.rejectionReason}")` : ""}. The tenant chose to proceed at their own expense.
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Section 3 — Full description */}
                                      <div className="px-6 py-4">
                                        <SectionLabel>Description</SectionLabel>
                                        <p className="mt-1 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                          {r.description || <span className="text-slate-400">\u2014</span>}
                                        </p>
                                      </div>

                                      {/* Section 3 — Photos / attachments */}
                                      <div className="border-t border-slate-100">
                                        <RequestPhotosPanel requestId={r.id} />
                                      </div>

                                      {/* Section 4 — Legal basis (CO articles + depreciation) */}
                                      <div className="border-t border-slate-100">
                                        <LegalRecommendationPanel
                                          decision={legalState?.data}
                                          loading={legalState?.loading}
                                          error={legalState?.error}
                                        />
                                      </div>

                                      {/* Section 5 — Next-step banner */}
                                      {(() => {
                                        const step = getNextStep(r, legalState?.data);
                                        if (!step) return null;
                                        const variantStyles = {
                                          info:    'border-blue-200 bg-blue-50 text-blue-800',
                                          warn:    'border-amber-200 bg-amber-50 text-amber-800',
                                          success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
                                          error:   'border-red-200 bg-red-50 text-red-800',
                                        };
                                        return (
                                          <div className="px-6 py-4 border-t border-slate-100">
                                            <div className={`rounded-lg border px-4 py-3 text-sm ${variantStyles[step.variant] || variantStyles.info}`}>
                                              <p className="font-semibold">{step.label}</p>
                                              <p className="mt-0.5 text-xs opacity-80">{step.description}</p>
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {/* Section 6 — Urgency */}
                                      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
                                        <div>
                                          <span className="text-sm font-medium text-slate-700">Urgency</span>
                                          <p className="text-xs text-slate-400 mt-0.5">Drives contractor dispatch priority</p>
                                        </div>
                                        <select
                                          value={d?.urgency || r.urgency || "MEDIUM"}
                                          onChange={(e) => setUrgency(r.id, e.target.value)}
                                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                          <option value="LOW">Low</option>
                                          <option value="MEDIUM">Medium</option>
                                          <option value="HIGH">High</option>
                                          <option value="EMERGENCY">Emergency</option>
                                        </select>
                                      </div>

                                      {/* Section 7 — RFP link (conditional) */}
                                      {rfpId && (
                                        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
                                          <span className="text-sm text-slate-500">Request for Proposal</span>
                                          <a href={`/manager/rfps/${rfpId}`} className="text-sm font-medium text-blue-600 hover:underline">
                                            View RFP &rarr;
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                currentPage={pager.currentPage}
                totalPages={pager.totalPages}
                totalItems={sortedRequests.length}
                pageSize={pager.pageSize}
                onPageChange={pager.setPage}
              />
            </Panel>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
