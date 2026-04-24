import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel.jsx";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField, DateField, SortToggle, SortPanelBody, SortRow } from "../../components/ui/FilterPanel";
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

  const activeCount = [dateFrom, dateTo, buildingFilter, unitFilter, urgencyFilter].filter(Boolean).length;
  const hasFilter = activeCount > 0;
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Sort state ──────────────────────────────────────────────
  const URGENCY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, EMERGENCY: 4 };
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [sortOpen, setSortOpen] = useState(false);
  const sortActive = !(sortKey === "date" && sortDir === "desc");

  function handleSort(key, dir) {
    setSortKey(key);
    setSortDir(dir);
  }

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "price") {
      cmp = (a.estimatedCost || 0) - (b.estimatedCost || 0);
    } else if (sortKey === "urgency") {
      cmp = (URGENCY_RANK[a.urgency] || 0) - (URGENCY_RANK[b.urgency] || 0);
    } else {
      // date
      cmp = new Date(a.createdAt) - new Date(b.createdAt);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <>
      {/* Filter + Sort toggles in same row */}
      <div className="flex items-center justify-end gap-2">
        <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
        <SortToggle open={sortOpen} onToggle={() => setSortOpen((v) => !v)} active={sortActive} />
      </div>

      {filterOpen && (
        <FilterPanelBody>
          <FilterSection title="Date range" first>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DateField label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <DateField label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </FilterSection>
          <FilterSection title="Scope">
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Building" value={buildingFilter} onChange={(e) => { setBuildingFilter(e.target.value); setUnitFilter(""); }}>
                <option value="">All buildings</option>
                {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
              </SelectField>
              <SelectField label="Unit" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
                <option value="">All units</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </SelectField>
            </div>
          </FilterSection>
          <FilterSection title="Priority">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectField label="Urgency" value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
                <option value="">All levels</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="EMERGENCY">Emergency</option>
              </SelectField>
            </div>
          </FilterSection>
          <FilterSectionClear hasFilter={hasFilter} onClear={() => { setDateFrom(""); setDateTo(""); setBuildingFilter(""); setUnitFilter(""); setUrgencyFilter(""); }} />
        </FilterPanelBody>
      )}

      {sortOpen && (
        <SortPanelBody>
          <SortRow
            active={sortKey === "date"}
            dir={sortKey === "date" ? sortDir : "desc"}
            label="Request date"
            descLabel="Newest first"
            ascLabel="Oldest first"
            onSelect={(dir) => handleSort("date", dir)}
          />
          <SortRow
            active={sortKey === "urgency"}
            dir={sortKey === "urgency" ? sortDir : "desc"}
            label="Urgency"
            descLabel="High → Low"
            ascLabel="Low → High"
            onSelect={(dir) => handleSort("urgency", dir)}
          />
          <SortRow
            active={sortKey === "price"}
            dir={sortKey === "price" ? sortDir : "desc"}
            label="Quote price"
            descLabel="High → Low"
            ascLabel="Low → High"
            onSelect={(dir) => handleSort("price", dir)}
          />
        </SortPanelBody>
      )}

      {loading ? (
        <p className="loading-text">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">
            {requests.length === 0 ? "No requests pending your approval." : "No results match the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((req) => {
            const borderColor = URGENCY_BORDER[req.urgency] || "border-l-slate-200";
            return (
              <div
                key={req.id}
                className={cn("rounded-2xl border border-slate-200 border-l-4", borderColor, "bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors")}
                onClick={() => router.push(`/owner/requests/${req.id}`)}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{req.description}</p>
                    )}
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3 sm:shrink-0">
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

  const activeCount = [dateFrom, dateTo, buildingFilter, urgencyFilter].filter(Boolean).length;
  const hasFilter = activeCount > 0;
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Sort state ──────────────────────────────────────────────
  const URGENCY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, EMERGENCY: 4 };
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [sortOpen, setSortOpen] = useState(false);
  const sortActive = !(sortKey === "date" && sortDir === "desc");

  function handleSort(key, dir) {
    setSortKey(key);
    setSortDir(dir);
  }

  const sortedFiltered = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "price") {
      // Use lowest accepted/submitted quote total, fallback 0
      const priceA = a.quotes?.reduce((min, q) => Math.min(min, q.totalCents ?? q.total ?? Infinity), Infinity) ?? 0;
      const priceB = b.quotes?.reduce((min, q) => Math.min(min, q.totalCents ?? q.total ?? Infinity), Infinity) ?? 0;
      cmp = (priceA === Infinity ? 0 : priceA) - (priceB === Infinity ? 0 : priceB);
    } else if (sortKey === "urgency") {
      cmp = (URGENCY_RANK[a.request?.urgency] || 0) - (URGENCY_RANK[b.request?.urgency] || 0);
    } else {
      cmp = new Date(a.createdAt) - new Date(b.createdAt);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const pendingApproval = sortedFiltered.filter((r) => r.status === "PENDING_OWNER_APPROVAL");

  return (
    <>
      <ErrorBanner error={error} className="mb-4 text-sm" />

      {/* Filter + Sort toggles in same row */}
      <div className="flex items-center justify-end gap-2">
        <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
        <SortToggle open={sortOpen} onToggle={() => setSortOpen((v) => !v)} active={sortActive} />
      </div>

      {/* Collapsible filter panel */}
      {filterOpen && (
        <FilterPanelBody>
          <FilterSection title="Date range" first>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DateField label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <DateField label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </FilterSection>
          <FilterSection title="Scope">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectField label="Building" value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
                <option value="">All buildings</option>
                {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
              </SelectField>
            </div>
          </FilterSection>
          <FilterSection title="Priority">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectField label="Urgency" value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
                <option value="">All levels</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="EMERGENCY">Emergency</option>
              </SelectField>
            </div>
          </FilterSection>
          <FilterSectionClear hasFilter={hasFilter} onClear={() => { setDateFrom(""); setDateTo(""); setBuildingFilter(""); setUrgencyFilter(""); }} />
        </FilterPanelBody>
      )}

      {sortOpen && (
        <SortPanelBody>
          <SortRow
            active={sortKey === "date"}
            dir={sortKey === "date" ? sortDir : "desc"}
            label="Request date"
            descLabel="Newest first"
            ascLabel="Oldest first"
            onSelect={(dir) => handleSort("date", dir)}
          />
          <SortRow
            active={sortKey === "urgency"}
            dir={sortKey === "urgency" ? sortDir : "desc"}
            label="Urgency"
            descLabel="High → Low"
            ascLabel="Low → High"
            onSelect={(dir) => handleSort("urgency", dir)}
          />
          <SortRow
            active={sortKey === "price"}
            dir={sortKey === "price" ? sortDir : "desc"}
            label="Quote price"
            descLabel="High → Low"
            ascLabel="Low → High"
            onSelect={(dir) => handleSort("price", dir)}
          />
        </SortPanelBody>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {pendingApproval.length > 0 && (
            <Panel title={`Awaiting Your Approval (${pendingApproval.length})`} bodyClassName="p-0">
              {/* Mobile: card list */}
              <div className="sm:hidden space-y-3">
                {pendingApproval.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{r.category || "—"}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{r.building?.name || "—"}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <RfpStatusPill status={r.status} />
                      <Link href={`/owner/rfps/${r.id}`} className="cell-link text-sm font-medium">
                        Review →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <table className="hidden sm:table inline-table">
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
            </Panel>
          )}

          <Panel title={`All RFPs (${sortedFiltered.length})`} bodyClassName="p-0">
            {sortedFiltered.length > 0 ? (
              <>
                {/* Mobile: card list */}
                <div className="sm:hidden space-y-3">
                  {sortedFiltered.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{r.category || "—"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{r.building?.name || "—"}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <RfpStatusPill status={r.status} />
                        <Link href={`/owner/rfps/${r.id}`} className="cell-link text-sm font-medium">
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <table className="hidden sm:table inline-table">
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
                    {sortedFiltered.map((r) => (
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
              </>
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
