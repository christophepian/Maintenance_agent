import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel.jsx";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField, DateField, NumberField, SortToggle, SortPanelBody, SortRow } from "../../components/ui/FilterPanel";
import { ownerAuthHeaders } from "../../lib/api";
import Badge from "../../components/ui/Badge";
import OwnerPicker from "../../components/OwnerPicker";
import { urgencyVariant, rfpVariant } from "../../lib/statusVariants";

import { cn } from "../../lib/utils";
import { formatDate, formatDateTime } from "../../lib/format";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
import SortableHeader from "../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../lib/tableUtils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";
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
  const { t } = useTranslation("owner");
  const router = useRouter();
  const [tab, setTab] = useState("requests");

  useEffect(() => {
    if (router.isReady && router.query.tab === "rfps") setTab("rfps");
  }, [router.isReady, router.query.tab]);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <OwnerPicker onSelect={() => router.replace(router.asPath)} />
        <PageHeader title={t("owner:approvals.title.approvals")} />
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
  const { t } = useTranslation("owner");
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");
  const [requestNumberFilter, setRequestNumberFilter] = useState("");

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
    if (requestNumberFilter && String(r.requestNumber) !== String(requestNumberFilter)) return false;
    return true;
  });

  const activeCount = [dateFrom, dateTo, buildingFilter, unitFilter, urgencyFilter, requestNumberFilter].filter(Boolean).length;
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
    } else if (sortKey === "number") {
      cmp = (a.requestNumber || 0) - (b.requestNumber || 0);
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
          <FilterSection title={t("owner:approvals.title.dateRange")} first>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DateField label={t("owner:approvals.prop.from")} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <DateField label={t("owner:approvals.prop.to")} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </FilterSection>
          <FilterSection title={t("owner:approvals.title.scope")}>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label={t("owner:approvals.prop.building")} value={buildingFilter} onChange={(e) => { setBuildingFilter(e.target.value); setUnitFilter(""); }}>
                <option value="">{t("owner:approvals.text.allBuildings")}</option>
                {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
              </SelectField>
              <SelectField label={t("owner:approvals.prop.unit")} value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
                <option value="">{t("owner:approvals.text.allUnits")}</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </SelectField>
            </div>
          </FilterSection>
          <FilterSection title={t("owner:approvals.title.priority")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectField label={t("owner:approvals.prop.urgency")} value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
                <option value="">{t("owner:approvals.text.allLevels")}</option>
                <option value="LOW">{t("owner:approvals.text.low")}</option>
                <option value="MEDIUM">{t("owner:approvals.text.medium")}</option>
                <option value="HIGH">{t("owner:approvals.text.high")}</option>
                <option value="EMERGENCY">{t("owner:approvals.text.emergency")}</option>
              </SelectField>
            </div>
          </FilterSection>
          <FilterSection title={t("owner:approvals.title.request")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField label={t("owner:approvals.prop.requestNumber")} value={requestNumberFilter} onChange={(e) => setRequestNumberFilter(e.target.value)} placeholder={t("owner:approvals.placeholder.eG42")} />
            </div>
          </FilterSection>
          <FilterSectionClear hasFilter={hasFilter} onClear={() => { setDateFrom(""); setDateTo(""); setBuildingFilter(""); setUnitFilter(""); setUrgencyFilter(""); setRequestNumberFilter(""); }} />
        </FilterPanelBody>
      )}

      {sortOpen && (
        <SortPanelBody>
          <SortRow
            active={sortKey === "number"}
            dir={sortKey === "number" ? sortDir : "asc"}
            label={t("owner:approvals.title.request")}
            ascLabel="Low → High"
            descLabel="High → Low"
            onSelect={(dir) => handleSort("number", dir)}
          />
          <SortRow
            active={sortKey === "date"}
            dir={sortKey === "date" ? sortDir : "desc"}
            label={t("owner:approvals.prop.requestDate")}
            descLabel="Newest first"
            ascLabel="Oldest first"
            onSelect={(dir) => handleSort("date", dir)}
          />
          <SortRow
            active={sortKey === "urgency"}
            dir={sortKey === "urgency" ? sortDir : "desc"}
            label={t("owner:approvals.prop.urgency")}
            descLabel="High → Low"
            ascLabel="Low → High"
            onSelect={(dir) => handleSort("urgency", dir)}
          />
          <SortRow
            active={sortKey === "price"}
            dir={sortKey === "price" ? sortDir : "desc"}
            label={t("owner:approvals.prop.quotePrice")}
            descLabel="High → Low"
            ascLabel="Low → High"
            onSelect={(dir) => handleSort("price", dir)}
          />
        </SortPanelBody>
      )}

      {loading ? (
        <p className="loading-text">{t("owner:approvals.text.loading")}</p>
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
  const { t } = useTranslation("owner");
  const [rfps, setRfps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");
  const [requestNumberFilter, setRequestNumberFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING_OWNER_APPROVAL");

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
    if (requestNumberFilter && String(r.request?.requestNumber) !== String(requestNumberFilter)) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const activeCount = [dateFrom, dateTo, buildingFilter, urgencyFilter, requestNumberFilter].filter(Boolean).length;
  const hasFilter = activeCount > 0;
  const [filterOpen, setFilterOpen] = useState(false);

  const URGENCY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, EMERGENCY: 4 };
  const { sortField: rfpSF, sortDir: rfpSD, handleSort: handleRfpSort } = useLocalSort("createdAt", "desc");
  const sortedFiltered = useMemo(() => clientSort(filtered, rfpSF, rfpSD, (r, f) => {
    if (f === "id") return (r.id || "").toLowerCase();
    if (f === "category") return (r.category || "").toLowerCase();
    if (f === "building") return (r.building?.name || "").toLowerCase();
    if (f === "urgency") return URGENCY_RANK[r.request?.urgency] ?? 0;
    if (f === "quoteCount") return r.quoteCount ?? r.quotes?.length ?? 0;
    if (f === "createdAt") return r.createdAt || "";
    return "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filtered, rfpSF, rfpSD]);

  return (
    <>
      <ErrorBanner error={error} className="mb-4 text-sm" />

      <div className="flex items-center justify-end gap-2">
        <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
      </div>

      {filterOpen && (
        <FilterPanelBody>
          <FilterSection title={t("owner:approvals.title.status")} first>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectField label={t("owner:approvals.prop.show")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="PENDING_OWNER_APPROVAL">{t("owner:approvals.text.pendingApproval")}</option>
                <option value="">{t("owner:approvals.text.allRfps")}</option>
                <option value="DRAFT">{t("owner:approvals.text.draft")}</option>
                <option value="OPEN">{t("owner:approvals.text.open")}</option>
                <option value="CLOSED">{t("owner:approvals.text.closed")}</option>
                <option value="AWARDED">{t("owner:approvals.text.awarded")}</option>
                <option value="CANCELLED">{t("owner:approvals.text.cancelled")}</option>
              </SelectField>
            </div>
          </FilterSection>
          <FilterSection title={t("owner:approvals.title.dateRange")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DateField label={t("owner:approvals.prop.from")} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <DateField label={t("owner:approvals.prop.to")} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </FilterSection>
          <FilterSection title={t("owner:approvals.title.scope")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectField label={t("owner:approvals.prop.building")} value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
                <option value="">{t("owner:approvals.text.allBuildings")}</option>
                {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
              </SelectField>
            </div>
          </FilterSection>
          <FilterSection title={t("owner:approvals.title.priority")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectField label={t("owner:approvals.prop.urgency")} value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
                <option value="">{t("owner:approvals.text.allLevels")}</option>
                <option value="LOW">{t("owner:approvals.text.low")}</option>
                <option value="MEDIUM">{t("owner:approvals.text.medium")}</option>
                <option value="HIGH">{t("owner:approvals.text.high")}</option>
                <option value="EMERGENCY">{t("owner:approvals.text.emergency")}</option>
              </SelectField>
            </div>
          </FilterSection>
          <FilterSection title={t("owner:approvals.title.request")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField label={t("owner:approvals.prop.requestNumber")} value={requestNumberFilter} onChange={(e) => setRequestNumberFilter(e.target.value)} placeholder={t("owner:approvals.placeholder.eG42")} />
            </div>
          </FilterSection>
          <FilterSectionClear hasFilter={hasFilter} onClear={() => { setDateFrom(""); setDateTo(""); setBuildingFilter(""); setUrgencyFilter(""); setRequestNumberFilter(""); }} />
        </FilterPanelBody>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">{t("owner:approvals.text.loading")}</p>
      ) : sortedFiltered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">
            {rfps.length === 0 ? "No RFPs found." : "No results match the current filters."}
          </p>
        </div>
      ) : (
        <>
          {/* ── Cards: below md ── */}
          <div className="md:hidden space-y-3">
            {sortedFiltered.map((r) => {
              const borderColor = URGENCY_BORDER[r.request?.urgency] || "border-l-slate-200";
              const urgencyLabel = r.request?.urgency
                ? r.request.urgency.charAt(0) + r.request.urgency.slice(1).toLowerCase()
                : null;
              const quoteCount = r.quoteCount ?? r.quotes?.length ?? 0;
              const isPending = r.status === "PENDING_OWNER_APPROVAL";
              return (
                <Link key={r.id} href={`/owner/rfps/${r.id}`}>
                  <div className={cn("rounded-2xl border border-slate-200 border-l-4", borderColor, "bg-white p-4 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer")}>
                    <div className="flex flex-col gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{r.category || "General Maintenance"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {r.building?.name || "—"} · {formatDate(r.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {urgencyLabel && (
                          <span className="text-xs font-medium text-slate-600">{urgencyLabel}</span>
                        )}
                        {quoteCount > 0 && (
                          <span className="text-xs text-slate-500">{quoteCount} quote{quoteCount !== 1 ? "s" : ""}</span>
                        )}
                        <span className="text-xs font-medium text-blue-600">{isPending ? "Review" : "View"} →</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ── Table: md and above ── */}
          <div className="hidden md:block data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableHeader label="RFP" field="id" sortField={rfpSF} sortDir={rfpSD} onSort={handleRfpSort} />
                  <SortableHeader label={t("owner:approvals.prop.category")} field="category" sortField={rfpSF} sortDir={rfpSD} onSort={handleRfpSort} />
                  <SortableHeader label={t("owner:approvals.prop.building")} field="building" sortField={rfpSF} sortDir={rfpSD} onSort={handleRfpSort} />
                  <SortableHeader label={t("owner:approvals.prop.urgency")} field="urgency" sortField={rfpSF} sortDir={rfpSD} onSort={handleRfpSort} />
                  <SortableHeader label={t("owner:approvals.prop.quotes")} field="quoteCount" sortField={rfpSF} sortDir={rfpSD} onSort={handleRfpSort} />
                  <SortableHeader label={t("owner:approvals.prop.created")} field="createdAt" sortField={rfpSF} sortDir={rfpSD} onSort={handleRfpSort} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map((r) => {
                  const urgencyLabel = r.request?.urgency
                    ? r.request.urgency.charAt(0) + r.request.urgency.slice(1).toLowerCase()
                    : "—";
                  const quoteCount = r.quoteCount ?? r.quotes?.length ?? 0;
                  const isPending = r.status === "PENDING_OWNER_APPROVAL";
                  return (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.id?.slice(0, 8)}</td>
                      <td>{r.category || "—"}</td>
                      <td>{r.building?.name || "—"}</td>
                      <td>{urgencyLabel}</td>
                      <td>{quoteCount}</td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td>
                        <Link href={`/owner/rfps/${r.id}`} className="cell-link text-sm font-medium">
                          {isPending ? "Review →" : "View →"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export const getStaticProps = withTranslations(["common","owner"]);
