import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel.jsx";
import { ownerAuthHeaders } from "../../lib/api";

// ─── Shared ────────────────────────────────────────────────────

const URGENCY_COLORS = {
  LOW:       "bg-slate-100 text-slate-600",
  MEDIUM:    "bg-blue-100 text-blue-700",
  HIGH:      "bg-amber-100 text-amber-800",
  EMERGENCY: "bg-red-100 text-red-700",
};

/** RAG left-border: green=LOW, neutral=MEDIUM, amber=HIGH, red=EMERGENCY */
const URGENCY_BORDER = {
  LOW:       "border-l-green-400",
  MEDIUM:    "border-l-slate-200",
  HIGH:      "border-l-amber-400",
  EMERGENCY: "border-l-red-500",
};

function UrgencyPill({ urgency }) {
  if (!urgency) return null;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_COLORS[urgency] || URGENCY_COLORS.MEDIUM}`}>
      {urgency.charAt(0) + urgency.slice(1).toLowerCase()}
    </span>
  );
}

const INPUT_CTRL  = "h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400";
const SELECT_CTRL = "min-h-[36px] appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400";

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH");
}

function formatCost(cost) {
  if (!cost) return "—";
  const str = Number(cost).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${str}`;
}

// ─── RFP pills ─────────────────────────────────────────────────

const RFP_STATUS_COLORS = {
  DRAFT:                  "bg-slate-50 text-slate-600 border-slate-200",
  OPEN:                   "bg-blue-50 text-blue-700 border-blue-200",
  AWARDED:                "bg-green-50 text-green-700 border-green-200",
  PENDING_OWNER_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  CLOSED:                 "bg-slate-50 text-slate-500 border-slate-200",
  CANCELLED:              "bg-red-50 text-red-600 border-red-200",
};

function RfpStatusPill({ status }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${RFP_STATUS_COLORS[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {status?.replace(/_/g, " ") || "—"}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
// Page shell
// ══════════════════════════════════════════════════════════════

export default function OwnerApprovalsPage() {
  const [tab, setTab] = useState("requests");

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader title="Approvals" />
        <PageContent>
          {/* Tab bar */}
          <div className="mb-6 flex border-b border-slate-200">
            {[
              { key: "requests", label: "Requests" },
              { key: "rfps",     label: "RFPs" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={[
                  "px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  tab === key
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "requests" && <RequestsTab />}
          {tab === "rfps"     && <RfpsTab />}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

// ══════════════════════════════════════════════════════════════
// Requests tab
// ══════════════════════════════════════════════════════════════

function RequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");

  function toggleAccordion(id) { setExpandedId((prev) => (prev === id ? null : id)); }

  useEffect(() => { loadPendingApprovals(); }, []);

  async function loadPendingApprovals() {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/approvals", { headers: ownerAuthHeaders() });
      const json = await res.json();
      setRequests(json.data || []);
    } catch (err) {
      console.error("Failed to load pending approvals:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(requestId) {
    if (!confirm("Approve this maintenance request?")) return;
    setActionInProgress(requestId);
    try {
      const res = await fetch(`/api/owner/approvals?id=${requestId}&action=approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: JSON.stringify({ comment: "Approved by owner" }),
      });
      if (res.ok) {
        await loadPendingApprovals();
      } else {
        const json = await res.json();
        alert(`Failed to approve: ${json.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Approve failed:", err);
      alert("Failed to approve request");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleReject(requestId) {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return;
    setActionInProgress(requestId);
    try {
      const res = await fetch(`/api/owner/approvals?id=${requestId}&action=reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        await loadPendingApprovals();
      } else {
        const json = await res.json();
        alert(`Failed to reject: ${json.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Reject failed:", err);
      alert("Failed to reject request");
    } finally {
      setActionInProgress(null);
    }
  }

  const buildings = [...new Set(requests.map((r) => r.unit?.building?.name).filter(Boolean))].sort();
  const units = [...new Set(
    requests
      .filter((r) => !buildingFilter || r.unit?.building?.name === buildingFilter)
      .map((r) => r.unit?.unitNumber)
      .filter(Boolean)
  )].sort();

  const filtered = requests.filter((r) => {
    if (dateFrom && r.createdAt < dateFrom) return false;
    if (dateTo && r.createdAt > dateTo + "T23:59:59") return false;
    if (buildingFilter && r.unit?.building?.name !== buildingFilter) return false;
    if (unitFilter && r.unit?.unitNumber !== unitFilter) return false;
    if (urgencyFilter && r.urgency !== urgencyFilter) return false;
    return true;
  });

  const hasFilter = dateFrom || dateTo || buildingFilter || unitFilter || urgencyFilter;

  return (
    <>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="flex flex-col justify-end gap-1">
          <label className="text-xs font-medium text-slate-500">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={INPUT_CTRL} />
        </div>
        <div className="flex flex-col justify-end gap-1">
          <label className="text-xs font-medium text-slate-500">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={INPUT_CTRL} />
        </div>
        <div className="flex flex-col items-center justify-end gap-1">
          <label className="text-xs font-medium text-slate-500">Building</label>
          <select value={buildingFilter} onChange={(e) => { setBuildingFilter(e.target.value); setUnitFilter(""); }} className={SELECT_CTRL}>
            <option value="">All buildings</option>
            {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="flex flex-col items-center justify-end gap-1">
          <label className="text-xs font-medium text-slate-500">Unit</label>
          <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className={SELECT_CTRL}>
            <option value="">All units</option>
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="flex flex-col items-center justify-end gap-1">
          <label className="text-xs font-medium text-slate-500">Urgency</label>
          <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)} className={SELECT_CTRL}>
            <option value="">All</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>
        {hasFilter && (
          <div className="flex flex-col justify-end gap-1">
            <span className="invisible text-xs">x</span>
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); setBuildingFilter(""); setUnitFilter(""); setUrgencyFilter(""); }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <Panel bodyClassName="p-0">
        {loading ? (
          <p className="loading-text">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">
              {requests.length === 0 ? "No requests pending your approval." : "No results match the current filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {filtered.map((req) => {
              const isExpanded = expandedId === req.id;
              const borderColor = URGENCY_BORDER[req.urgency] || "border-l-slate-200";
              return (
                <div key={req.id} className={`rounded-lg border border-slate-200 border-l-4 ${borderColor} bg-white shadow-sm`}>
                  <div
                    className="flex cursor-pointer items-center justify-between px-5 py-3.5 hover:bg-slate-50"
                    onClick={() => toggleAccordion(req.id)}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {req.requestNumber ? `#${req.requestNumber} — ` : ""}
                        {req.category || "General Maintenance"}
                      </p>
                      <p className="text-xs text-slate-500">Submitted {formatDateTime(req.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <UrgencyPill urgency={req.urgency} />
                      <svg
                        className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-4">
                      <div className="mb-4 space-y-2">
                        <div>
                          <span className="text-sm font-medium text-slate-700">Description:</span>
                          <p className="text-sm text-slate-600">{req.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-slate-700">Estimated Cost:</span>{" "}
                            <span className="text-slate-900">{formatCost(req.estimatedCost)}</span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">Building:</span>{" "}
                            <span className="text-slate-900">{req.unit?.building?.name || "—"}</span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">Unit:</span>{" "}
                            <span className="text-slate-900">{req.unit?.unitNumber || "—"}</span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">Tenant:</span>{" "}
                            <span className="text-slate-900">{req.tenant?.name || "—"}</span>
                          </div>
                        </div>
                        {req.appliance && (
                          <div className="text-sm">
                            <span className="font-medium text-slate-700">Appliance:</span>{" "}
                            <span className="text-slate-900">
                              {req.appliance.assetModel
                                ? `${req.appliance.assetModel.manufacturer} ${req.appliance.assetModel.model} (${req.appliance.assetModel.category})`
                                : req.appliance.name || "—"}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={actionInProgress === req.id}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500"
                        >
                          {actionInProgress === req.id ? "Processing..." : "Approve"}
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={actionInProgress === req.id}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {actionInProgress === req.id ? "Processing..." : "Reject"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// RFPs tab
// ══════════════════════════════════════════════════════════════

function RfpsTab() {
  const [rfps, setRfps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/rfps", { headers: ownerAuthHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || "Failed to load RFPs");
        setRfps(data?.data || []);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const buildings = [...new Set(rfps.map((r) => r.building?.name).filter(Boolean))].sort();

  const filtered = rfps.filter((r) => {
    if (dateFrom && r.createdAt < dateFrom) return false;
    if (dateTo && r.createdAt > dateTo + "T23:59:59") return false;
    if (buildingFilter && r.building?.name !== buildingFilter) return false;
    if (urgencyFilter && r.request?.urgency !== urgencyFilter) return false;
    return true;
  });

  const pendingApproval = filtered.filter((r) => r.status === "PENDING_OWNER_APPROVAL");

  const hasFilter = dateFrom || dateTo || buildingFilter || urgencyFilter;

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="flex flex-col justify-end gap-1">
          <label className="text-xs font-medium text-slate-500">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={INPUT_CTRL} />
        </div>
        <div className="flex flex-col justify-end gap-1">
          <label className="text-xs font-medium text-slate-500">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={INPUT_CTRL} />
        </div>
        <div className="flex flex-col items-center justify-end gap-1">
          <label className="text-xs font-medium text-slate-500">Building</label>
          <select value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)} className={SELECT_CTRL}>
            <option value="">All buildings</option>
            {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="flex flex-col items-center justify-end gap-1">
          <label className="text-xs font-medium text-slate-500">Urgency</label>
          <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)} className={SELECT_CTRL}>
            <option value="">All</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>
        {hasFilter && (
          <div className="flex flex-col justify-end gap-1">
            <span className="invisible text-xs">x</span>
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); setBuildingFilter(""); setUrgencyFilter(""); }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {pendingApproval.length > 0 && (
            <Panel title={`Awaiting Your Approval (${pendingApproval.length})`} bodyClassName="p-0">
              <table className="inline-table">
                <thead>
                  <tr>
                    <th>RFP</th>
                    <th>Category</th>
                    <th>Building</th>
                    <th>Urgency</th>
                    <th>Quotes</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApproval.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.id?.slice(0, 8)}</td>
                      <td>{r.category || "—"}</td>
                      <td>{r.building?.name || "—"}</td>
                      <td><UrgencyPill urgency={r.request?.urgency} /></td>
                      <td>{r.quoteCount ?? r.quotes?.length ?? 0}</td>
                      <td><RfpStatusPill status={r.status} /></td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td>
                        <Link href={`/owner/rfps/${r.id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                          Review →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          <Panel title={`All RFPs (${filtered.length})`} bodyClassName="p-0">
            {filtered.length > 0 ? (
              <table className="inline-table">
                <thead>
                  <tr>
                    <th>RFP</th>
                    <th>Category</th>
                    <th>Building</th>
                    <th>Urgency</th>
                    <th>Quotes</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.id?.slice(0, 8)}</td>
                      <td>{r.category || "—"}</td>
                      <td>{r.building?.name || "—"}</td>
                      <td><UrgencyPill urgency={r.request?.urgency} /></td>
                      <td>{r.quoteCount ?? r.quotes?.length ?? 0}</td>
                      <td><RfpStatusPill status={r.status} /></td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td>
                        <Link href={`/owner/rfps/${r.id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                {rfps.length === 0 ? "No RFPs found." : "No results match the current filters."}
              </p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
