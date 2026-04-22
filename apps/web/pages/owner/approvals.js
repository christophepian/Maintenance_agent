import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel.jsx";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { ownerAuthHeaders } from "../../lib/api";
import Badge from "../../components/ui/Badge";
import { urgencyVariant, rfpVariant } from "../../lib/statusVariants";

import { cn } from "../../lib/utils";
import { formatDate, formatDateTime } from "../../lib/format";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
// ─── Shared ────────────────────────────────────────────────────

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
    <Badge variant={urgencyVariant(urgency)} size="sm">
      {urgency.charAt(0) + urgency.slice(1).toLowerCase()}
    </Badge>
  );
}

const INPUT_CTRL  = "h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400";
const SELECT_CTRL = "min-h-[36px] appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400";

function formatCost(cost) {
  if (!cost) return "—";
  const str = Number(cost).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${str}`;
}

// ─── RFP pills ─────────────────────────────────────────────────

function RfpStatusPill({ status }) {
  return (
    <Badge variant={rfpVariant(status)} size="sm">
      {status?.replace(/_/g, " ") || "—"}
    </Badge>
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
          <ScrollableTabs activeIndex={tab === "requests" ? 0 : 1}>
            {[
              { key: "requests", label: "Requests" },
              { key: "rfps",     label: "RFPs" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={tab === key ? "tab-btn-active" : "tab-btn"}
              >
                {label}
              </button>
            ))}
          </ScrollableTabs>

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
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");

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
              const borderColor = URGENCY_BORDER[req.urgency] || "border-l-slate-200";
              return (
                <div
                  key={req.id}
                  className={cn("rounded-lg border border-slate-200 border-l-4", borderColor, "bg-white shadow-sm cursor-pointer hover:bg-slate-50 transition-colors")}
                  onClick={() => router.push(`/owner/requests/${req.id}`)}
                >
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {req.requestNumber ? `#${req.requestNumber} — ` : ""}
                        {req.category || "General Maintenance"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {req.unit?.building?.name || ""}{req.unit?.unitNumber ? ` · Unit ${req.unit.unitNumber}` : ""}
                        {" · "}Submitted {formatDateTime(req.createdAt)}
                      </p>
                      {req.description && (
                        <p className="text-xs text-slate-400 mt-1 truncate max-w-lg">{req.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {req.estimatedCost > 0 && (
                        <span className="text-xs font-medium text-slate-600">{formatCost(req.estimatedCost)}</span>
                      )}
                      <UrgencyPill urgency={req.urgency} />
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
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
      <ErrorBanner error={error} className="mb-4 text-sm" />

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
              <div className="overflow-x-auto">
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
                        <Link href={`/owner/rfps/${r.id}`} className="cell-link text-sm font-medium">
                          Review →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Panel>
          )}

          <Panel title={`All RFPs (${filtered.length})`} bodyClassName="p-0">
            {filtered.length > 0 ? (
              <div className="overflow-x-auto">
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
                        <Link href={`/owner/rfps/${r.id}`} className="cell-link text-sm font-medium">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
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
