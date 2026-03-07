import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import { authHeaders } from "../../lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING_REVIEW", label: "Pending Review" },
  { key: "PENDING_OWNER_APPROVAL", label: "Owner Approval" },
  { key: "RFP_PENDING", label: "Auto-routed" },
  { key: "APPROVED", label: "Approved" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
];

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
    actionHint: "Approve \u2192 Assign contractor",
  },
  DISCRETIONARY: {
    cls: "bg-amber-50 text-amber-800 border-amber-200",
    heading: "Repair is at the landlord\u2019s discretion",
    description: "This isn\u2019t strictly required by law, but is common practice. Consider the tenant relationship and cost.",
    actionHint: "Review cost estimate \u2192 Decide",
  },
  NOT_OBLIGATED: {
    cls: "bg-red-50 text-red-800 border-red-200",
    heading: "Landlord is not obligated",
    description: "Based on Swiss law and the asset\u2019s condition, this repair falls on the tenant. You may still choose to cover it.",
    actionHint: "Decline or offer goodwill repair",
  },
  UNKNOWN: {
    cls: "bg-slate-100 text-slate-700 border-slate-200",
    heading: "Needs your judgement",
    description: "The legal engine couldn\u2019t determine obligation automatically. Review the details below and decide.",
    actionHint: "Review details \u2192 Decide",
  },
};

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

  const topic = (decision.legalTopic || "").replace(/_/g, " ").toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const uniqueCitations = [];
  const seen = new Set();
  for (const c of decision.citations || []) {
    const key = `${c.article}|${c.text}`;
    if (!seen.has(key)) { seen.add(key); uniqueCitations.push(c); }
  }

  return (
    <div className="border-t-2 border-blue-500 bg-slate-50 px-6 py-5">

      {/* Hero verdict card */}
      <div className={`rounded-lg border p-4 mb-5 ${ob.cls}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold">{ob.heading}</h4>
            <p className="mt-1 text-[13px] leading-snug opacity-90">{ob.description}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/60 px-2.5 py-0.5 text-[11px] font-semibold">
            {decision.confidence}% confidence
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs font-medium opacity-75">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span>Suggested next step: {ob.actionHint}</span>
        </div>
      </div>

      {/* Section 1: Recommended Actions */}
      {decision.recommendedActions?.length > 0 && (
        <div className="mb-4">
          <SectionLabel>What to do</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {decision.recommendedActions
              .filter((a) => a !== "MANUAL_REVIEW")
              .map((a, i) => {
                const actionMap = {
                  CREATE_RFP:     { label: "Create request for proposal",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
                  APPROVE_REPAIR: { label: "Approve the repair",            cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  DECLINE_REPAIR: { label: "Decline \u2014 tenant\u2019s responsibility", cls: "bg-red-50 text-red-700 border-red-200" },
                  REQUEST_QUOTE:  { label: "Request a quote first",         cls: "bg-amber-50 text-amber-700 border-amber-200" },
                };
                const m = actionMap[a] || { label: a.replace(/_/g, " "), cls: "bg-slate-50 text-slate-600 border-slate-200" };
                return (
                  <span key={i} className={`inline-block rounded-lg border px-3 py-1.5 text-xs font-medium ${m.cls}`}>
                    {m.label}
                  </span>
                );
              })}
          </div>
        </div>
      )}

      {/* Section 2: Legal Basis */}
      {uniqueCitations.length > 0 && (
        <div className="mb-4">
          <SectionLabel>Legal basis</SectionLabel>
          <div className="mt-1.5 flex flex-col gap-1.5">
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

      {/* Section 3: Analysis */}
      <div className="mb-4">
        <SectionLabel>Analysis &mdash; {topic}</SectionLabel>
        <ul className="mt-1.5 space-y-1">
          {(decision.reasons || []).map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="mt-0.5 text-slate-300">&bull;</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>

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

        {/* No depreciation data tip */}
        {!decision.depreciationSignal && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>Tip:</strong> No asset age data found. Add the appliance install date in unit management
            to unlock depreciation analysis and more accurate recommendations.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-[11px] text-slate-400">
        <span>Evaluation {decision.evaluationLogId?.slice(0, 8)}&hellip;</span>
        {decision.rfpId && (
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-600">
            RFP auto-created
          </span>
        )}
      </div>
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
// Main Page
// ---------------------------------------------------------------------------

export default function ManagerRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [actionLoading, setActionLoading] = useState(null);

  // Assign modal state
  const [assigningId, setAssigningId] = useState(null);
  const [selectedContractorId, setSelectedContractorId] = useState("");

  // Accordion state
  const [expandedId, setExpandedId] = useState(null);
  const [legalDecisions, setLegalDecisions] = useState({});

  useEffect(() => {
    if (router.query.filter) setActiveTab(router.query.filter);
  }, [router.query.filter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqRes, conRes] = await Promise.all([
        fetch("/api/requests?view=summary", { headers: authHeaders() }),
        fetch("/api/contractors", { headers: authHeaders() }),
      ]);
      const reqData = await reqRes.json();
      const conData = await conRes.json();
      if (!reqRes.ok) throw new Error(reqData?.error?.message || "Failed to load requests");
      setRequests(reqData?.data || []);
      setContractors(conData?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredRequests = useMemo(() => {
    if (activeTab === "ALL") return requests;
    return requests.filter((r) => r.status === activeTab);
  }, [requests, activeTab]);

  // Toggle accordion + lazy-fetch
  function toggleAccordion(requestId) {
    if (expandedId === requestId) { setExpandedId(null); return; }
    setExpandedId(requestId);
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

  const canExpand = (r) => r.status === "PENDING_REVIEW" || r.status === "PENDING_OWNER_APPROVAL" || r.status === "RFP_PENDING";

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
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((tab) => {
              const count = tab.key === "ALL"
                ? requests.length
                : requests.filter((r) => r.status === tab.key).length;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tab.label} <span className={active ? "text-blue-200" : "text-slate-400"}>({count})</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          {loading ? (
            <Panel><p className="text-sm text-slate-500">Loading requests&hellip;</p></Panel>
          ) : filteredRequests.length === 0 ? (
            <Panel><p className="text-sm text-slate-500">No requests match this filter.</p></Panel>
          ) : (
            <Panel bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 pl-3 pr-1 w-8"></th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Building / Unit</th>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5">Est. Cost</th>
                      <th className="px-3 py-2.5 hidden lg:table-cell">Contractor</th>
                      <th className="px-3 py-2.5 hidden sm:table-cell">Created</th>
                      <th className="px-3 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((r) => {
                      const expandable = canExpand(r);
                      const isExpanded = expandedId === r.id;
                      const legalState = legalDecisions[r.id];

                      return (
                        <Fragment key={r.id}>
                          <tr
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

                            <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>

                            <td className="px-3 py-2.5 text-slate-700">
                              {r.buildingName || "\u2014"}
                              {r.unitNumber ? <span className="text-slate-400"> / {r.unitNumber}</span> : ""}
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
                                {r.status === "PENDING_REVIEW" && (
                                  <button
                                    onClick={() => approveRequest(r.id)}
                                    disabled={actionLoading === r.id}
                                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {actionLoading === r.id ? "\u2026" : "Approve"}
                                  </button>
                                )}

                                {r.status === "RFP_PENDING" && (
                                  <a
                                    href="/manager/rfps"
                                    className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                                  >
                                    View RFP
                                  </a>
                                )}

                                {!r.assignedContractorName && assigningId !== r.id && (
                                  <button
                                    onClick={() => setAssigningId(r.id)}
                                    className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                  >
                                    Assign
                                  </button>
                                )}

                                {r.assignedContractorName && (
                                  <button
                                    onClick={() => doUnassignContractor(r.id)}
                                    disabled={actionLoading === r.id}
                                    className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {actionLoading === r.id ? "\u2026" : "Unassign"}
                                  </button>
                                )}

                                {assigningId === r.id && (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={selectedContractorId}
                                      onChange={(e) => setSelectedContractorId(e.target.value)}
                                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                                    >
                                      <option value="">Select&hellip;</option>
                                      {contractors.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.name || c.companyName || c.id.slice(0, 8)}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => doAssignContractor(r.id)}
                                      disabled={!selectedContractorId || actionLoading === r.id}
                                      className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      {actionLoading === r.id ? "\u2026" : "OK"}
                                    </button>
                                    <button
                                      onClick={() => { setAssigningId(null); setSelectedContractorId(""); }}
                                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Accordion row */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={9} className="p-0">
                                <LegalRecommendationPanel
                                  decision={legalState?.data}
                                  loading={legalState?.loading}
                                  error={legalState?.error}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
