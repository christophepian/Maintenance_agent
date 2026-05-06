import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import ConfigurableTable from "./ConfigurableTable";
import ErrorBanner from "./ui/ErrorBanner";
import { formatDate } from "../lib/format";
import { authHeaders } from "../lib/api";
import Badge from "./ui/Badge";
import { selectionVariant, leaseVariant } from "../lib/statusVariants";
import {
  FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear,
  SortToggle, SortPanelBody, SortRow, CheckboxGroupField,
} from "./ui/FilterPanel";

const SELECTION_LABEL_KEYS = {
  AWAITING_SIGNATURE: "selection.AWAITING_SIGNATURE",
  FALLBACK_1: "selection.FALLBACK_1",
  FALLBACK_2: "selection.FALLBACK_2",
};
function statusBadge(status, t) {
  return (
    <Badge variant={selectionVariant(status)} size="sm">
      {t(SELECTION_LABEL_KEYS[status] || "status.pending")}
    </Badge>
  );
}

function leaseBadge(lease, t) {
  if (!lease) return <span className="text-xs text-slate-400">{t("vacancies.noLease")}</span>;
  return (
    <Badge variant={leaseVariant(lease.status)} size="sm">
      {t(`leaseStatus.${lease.status}`, { defaultValue: lease.status })}
    </Badge>
  );
}

/**
 * Shared vacancies panel — renders vacant units table + awaiting-signature pipeline.
 * Used by both /owner/vacancies and /manager/inventory (vacancies tab).
 *
 * @param {Object} props
 * @param {"OWNER"|"MANAGER"} props.role — controls action link paths
 * @param {number} [props.refreshKey] — increment to trigger data reload
 */
const VACANCY_SUB_TABS = [
  { key: "candidates", labelKey: "vacancies.tabCandidates" },
  { key: "signature",  labelKey: "vacancies.tabSignature" },
];

export default function VacanciesPanel({ role = "OWNER", refreshKey = 0 }) {
  const { t } = useTranslation("common");
  // ── Tab ──────────────────────────────────────────────────────
  const [subTab, setSubTab] = useState("candidates");

  // ── Data ─────────────────────────────────────────────────────
  const [vacancyRows, setVacancyRows] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectionsLoading, setSelectionsLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Search / Filter ───────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState([]); // array of building names
  const [hasCandidatesFilter, setHasCandidatesFilter] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Sort ──────────────────────────────────────────────────────
  const [sortOpen, setSortOpen] = useState(false);
  const [candSortDir, setCandSortDir] = useState("desc"); // candidates: by count
  const [sigSortDir, setSigSortDir] = useState("desc");   // signature: by createdAt

  const fetchJson = useCallback(async (path) => {
    const res = await fetch(path, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || "Request failed");
    return data;
  }, []);

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const vacantRes = await fetchJson("/api/vacant-units");
      const vacantUnits = vacantRes.data || [];
      const rows = await Promise.all(
        vacantUnits.map(async (unit) => {
          let candidateCount = 0;
          try {
            const appsRes = await fetchJson(`/api/owner/rental-applications?unitId=${unit.id}`);
            candidateCount = (appsRes.data || []).length;
          } catch { /* ignore */ }
          return {
            ...unit,
            buildingName: unit.building?.name || "—",
            buildingAddress: unit.building?.address || "",
            candidateCount,
          };
        })
      );
      setVacancyRows(rows);
    } catch (err) {
      setError(err?.message || "Failed to load vacancies");
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  const loadSelections = useCallback(async () => {
    setSelectionsLoading(true);
    try {
      const res = await fetchJson("/api/owner/selections");
      setSelections(res.data || []);
    } catch { /* Non-critical */ } finally {
      setSelectionsLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    loadVacancies();
    loadSelections();
  }, [refreshKey, loadVacancies, loadSelections]);

  // ── Tab switch — reset filters ────────────────────────────────
  function switchTab(key) {
    setSubTab(key);
    setSearch("");
    setBuildingFilter([]);
    setHasCandidatesFilter(false);
    setFilterOpen(false);
    setSortOpen(false);
  }

  // ── Building option lists ─────────────────────────────────────
  const candBuildings = useMemo(
    () => [...new Set(vacancyRows.map((u) => u.buildingName).filter((b) => b && b !== "—"))].sort(),
    [vacancyRows]
  );
  const sigBuildings = useMemo(
    () => [...new Set(selections.map((s) => s.buildingName).filter((b) => b && b !== "—"))].sort(),
    [selections]
  );
  const buildings = subTab === "candidates" ? candBuildings : sigBuildings;

  // ── Filtered + sorted data ────────────────────────────────────
  const filteredVacancies = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = vacancyRows.filter((u) => {
      if (q && !((u.buildingName || "").toLowerCase().includes(q) || (u.unitNumber || "").toLowerCase().includes(q))) return false;
      if (buildingFilter.length > 0 && !buildingFilter.includes(u.buildingName)) return false;
      if (hasCandidatesFilter && u.candidateCount === 0) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const cmp = (a.candidateCount || 0) - (b.candidateCount || 0);
      return candSortDir === "asc" ? cmp : -cmp;
    });
  }, [vacancyRows, search, buildingFilter, hasCandidatesFilter, candSortDir]);

  const filteredSelections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = selections.filter((s) => {
      if (q && !((s.buildingName || "").toLowerCase().includes(q) || (s.unitNumber || "").toLowerCase().includes(q) || (s.primaryCandidate?.name || "").toLowerCase().includes(q))) return false;
      if (buildingFilter.length > 0 && !buildingFilter.includes(s.buildingName)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const da = new Date(a.createdAt || 0);
      const db = new Date(b.createdAt || 0);
      return sigSortDir === "desc" ? db - da : da - db;
    });
  }, [selections, search, buildingFilter, sigSortDir]);

  // ── Active counts ─────────────────────────────────────────────
  const activeFilterCount = [
    buildingFilter.length > 0,
    hasCandidatesFilter && subTab === "candidates",
  ].filter(Boolean).length;

  const sortActive = subTab === "candidates" ? candSortDir !== "desc" : sigSortDir !== "desc";

  function clearFilters() {
    setBuildingFilter([]);
    setHasCandidatesFilter(false);
  }

  // ── Action paths ──────────────────────────────────────────────
  const fillPath = (unitId) =>
    role === "MANAGER" ? `/manager/vacancies/${unitId}/fill` : `/owner/vacancies/${unitId}/fill`;
  const candidatesPath = (unitId) =>
    role === "MANAGER" ? `/manager/vacancies/${unitId}/applications` : `/owner/vacancies/${unitId}/candidates`;

  return (
    <>
      <ErrorBanner error={error} className="text-sm" />

      {/* Segmented control */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 gap-0.5 mb-4">
        {VACANCY_SUB_TABS.map(({ key, labelKey }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={[
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              subTab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <FilterPanelBody>
          <FilterSection title="Building scope" first>
            <CheckboxGroupField
              options={buildings}
              value={buildingFilter}
              onChange={setBuildingFilter}
            />
          </FilterSection>
          {subTab === "candidates" && (
            <FilterSection title="Candidates">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={hasCandidatesFilter}
                  onChange={(e) => setHasCandidatesFilter(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                Has candidates
              </label>
            </FilterSection>
          )}
          <FilterSectionClear hasFilter={activeFilterCount > 0} onClear={clearFilters} />
        </FilterPanelBody>
      )}

      {/* Sort panel — candidates */}
      {sortOpen && subTab === "candidates" && (
        <SortPanelBody>
          <SortRow
            active
            dir={candSortDir}
            label="Number of candidates"
            descLabel="Most → Fewest"
            ascLabel="Fewest → Most"
            onSelect={(dir) => setCandSortDir(dir)}
          />
        </SortPanelBody>
      )}

      {/* Sort panel — awaiting signature */}
      {sortOpen && subTab === "signature" && (
        <SortPanelBody>
          <SortRow
            active
            dir={sigSortDir}
            label="Received on"
            descLabel="Most recent first"
            ascLabel="Oldest first"
            onSelect={(dir) => setSigSortDir(dir)}
          />
        </SortPanelBody>
      )}

      {/* ── Candidate Selection tab ─────────────────────────── */}
      {subTab === "candidates" && (
        loading ? (
          <p className="loading-text">Loading vacancies…</p>
        ) : (
          <ConfigurableTable
            tableId="vacancies-vacant-units"
            toolbarSlot={
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search building or unit…"
                    aria-label="Search vacancies"
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <FilterToggle open={filterOpen} onToggle={() => { setFilterOpen((v) => !v); setSortOpen(false); }} activeCount={activeFilterCount} />
                  <SortToggle open={sortOpen} onToggle={() => { setSortOpen((v) => !v); setFilterOpen(false); }} active={sortActive} />
                </div>
              </div>
            }
            columns={[
              { id: "building", label: "Building", sortable: false, defaultVisible: true,
                render: (u) => u.buildingName },
              { id: "unit", label: "Unit", sortable: false, defaultVisible: true,
                render: (u) => u.unitNumber || "—" },
              { id: "rent", label: "Rent", sortable: false, defaultVisible: true,
                render: (u) => u.monthlyRentChf != null ? `CHF ${u.monthlyRentChf}.-` : "—" },
              { id: "charges", label: "Charges", sortable: false, defaultVisible: true,
                render: (u) => u.monthlyChargesChf != null ? `CHF ${u.monthlyChargesChf}.-` : "—" },
              { id: "total", label: "Total", sortable: false, defaultVisible: true, className: "font-semibold",
                render: (u) => u.monthlyRentChf != null || u.monthlyChargesChf != null
                  ? `CHF ${(u.monthlyRentChf || 0) + (u.monthlyChargesChf || 0)}.-`
                  : "—" },
              { id: "candidates", label: "Candidates", sortable: false, defaultVisible: true,
                render: (u) => u.candidateCount > 0
                  ? <Badge variant="brand" size="sm">{u.candidateCount}</Badge>
                  : <span className="text-slate-400 text-xs">None yet</span> },
              { id: "actions", label: "Actions", sortable: false, alwaysVisible: true, className: "text-right", headerClassName: "text-right",
                render: (u) => (
                  <div className="flex items-center justify-end gap-2">
                    <Link href={fillPath(u.id)} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100">
                      Fill vacancy →
                    </Link>
                    <Link href={candidatesPath(u.id)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                      Review candidates
                    </Link>
                  </div>
                ) },
            ]}
            data={filteredVacancies}
            rowKey="id"
            emptyState={<p className="empty-state-text">No vacant residential units{search || activeFilterCount > 0 ? " match your filters" : " detected"}.</p>}
            mobileCard={(u) => (
              <div className="table-card">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <p className="table-card-sub truncate">{u.buildingName}</p>
                  {u.candidateCount > 0
                    ? <Badge variant="brand" size="sm">{u.candidateCount} candidate{u.candidateCount !== 1 ? "s" : ""}</Badge>
                    : <span className="text-xs text-slate-400 shrink-0">No candidates</span>}
                </div>
                <p className="table-card-head">{u.unitNumber || "—"}</p>
                <div className="table-card-footer">
                  <span>
                    {u.monthlyRentChf != null || u.monthlyChargesChf != null
                      ? `CHF ${(u.monthlyRentChf || 0) + (u.monthlyChargesChf || 0)}.-`
                      : "No rent set"}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link href={fillPath(u.id)} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100">
                    Fill vacancy →
                  </Link>
                  <Link href={candidatesPath(u.id)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                    Review candidates
                  </Link>
                </div>
              </div>
            )}
          />
        )
      )}

      {/* ── Awaiting Signature tab ──────────────────────────── */}
      {subTab === "signature" && (
        selectionsLoading ? (
          <p className="loading-text">Loading pipeline…</p>
        ) : (
          <ConfigurableTable
            tableId="vacancies-awaiting-signature"
            toolbarSlot={
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search building, unit or candidate…"
                    aria-label="Search vacancies"
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <FilterToggle open={filterOpen} onToggle={() => { setFilterOpen((v) => !v); setSortOpen(false); }} activeCount={activeFilterCount} />
                  <SortToggle open={sortOpen} onToggle={() => { setSortOpen((v) => !v); setFilterOpen(false); }} active={sortActive} />
                </div>
              </div>
            }
            columns={[
              { id: "building", label: "Building", sortable: false, defaultVisible: true,
                render: (sel) => sel.buildingName || "—" },
              { id: "unit", label: "Unit", sortable: false, defaultVisible: true,
                render: (sel) => sel.unitNumber || "—" },
              { id: "candidate", label: "Primary Candidate", sortable: false, defaultVisible: true,
                render: (sel) => sel.primaryCandidate
                  ? <span><span className="font-medium text-slate-900">{sel.primaryCandidate.name}</span><span className="ml-2 text-xs text-slate-400">{sel.primaryCandidate.email}</span></span>
                  : <span className="text-slate-400">—</span> },
              { id: "status", label: "Status", sortable: false, defaultVisible: true,
                render: (sel) => statusBadge(sel.status, t) },
              { id: "lease", label: "Lease", sortable: false, defaultVisible: true,
                render: (sel) => leaseBadge(sel.lease, t) },
              { id: "received", label: "Received on", sortable: false, defaultVisible: true,
                render: (sel) => formatDate(sel.createdAt) },
              { id: "deadline", label: "Deadline", sortable: false, defaultVisible: true,
                render: (sel) => formatDate(sel.deadlineAt) },
            ]}
            data={filteredSelections}
            rowKey="id"
            emptyState={<p className="empty-state-text">{t("vacancies.emptySignature")}{search || buildingFilter.length > 0 ? ` ${t("empty.noResults")}` : ""}.</p>}
            mobileCard={(sel) => (
              <div className="table-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="table-card-head">{sel.unitNumber || "—"}</p>
                    <p className="table-card-sub">{sel.buildingName || "—"}</p>
                  </div>
                  {statusBadge(sel.status, t)}
                </div>
                <p className="mt-2 text-[13px] text-slate-700">
                  {sel.primaryCandidate
                    ? sel.primaryCandidate.name
                    : <span className="text-slate-400">{t("empty.noData")}</span>}
                </p>
                <div className="table-card-footer">
                  {leaseBadge(sel.lease, t)}
                  <span>Received {formatDate(sel.createdAt)}</span>
                </div>
              </div>
            )}
          />
        )
      )}
    </>
  );
}
