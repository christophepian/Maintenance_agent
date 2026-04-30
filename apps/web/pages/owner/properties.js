import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import ConfigurableTable from "../../components/ConfigurableTable";
import VacanciesPanel from "../../components/VacanciesPanel";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { useTableSort, clientSort } from "../../lib/tableUtils";
import { ownerAuthHeaders } from "../../lib/api";
import { cn } from "../../lib/utils";
import { formatChf, formatChfCents } from "../../lib/format";

// ── Monopoly palette: deterministic top-band colour from building name ──────
// Colours are kept fun/bold (the Monopoly identity), but the rest of the
// card follows the app design system (surface tokens, font-sans, slate scale).
const MONOPOLY_COLORS = [
  "#4f46e5", // indigo  (brand)
  "#0369a1", // sky-700
  "#15803d", // green-700
  "#b45309", // amber-700
  "#7c3aed", // violet-600
  "#be185d", // pink-700
  "#0f766e", // teal-700
  "#b91c1c", // red-700
];

function monopolyColor(seed) {
  const h = [...(seed || "x")].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return MONOPOLY_COLORS[h % MONOPOLY_COLORS.length];
}

// ── Stat row helper ─────────────────────────────────────────────────────────
function StatRow({ label, value, sub, valueClass = "" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-2">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={cn("text-xs font-semibold text-slate-800 text-right tabular-nums", valueClass)}>
        {value}
        {sub && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{sub}</span>}
      </span>
    </div>
  );
}

// ── Monopoly card ────────────────────────────────────────────────────────────
function MonopolyCard({ building, fin, onClick }) {
  const bandColor = monopolyColor(building.name);
  const unitCount = building.unitCount ?? building._count?.units ?? fin?.activeUnitsCount;

  // Financial metrics — derived from the YTD portfolio-summary slice
  const months = fin?._months ?? 1;
  const monthlyIncome = fin ? fin.earnedIncomeCents / months : null;
  const monthlyNOI    = fin ? fin.netIncomeCents / months : null;
  const avgRent       = fin && unitCount ? monthlyIncome / unitCount : null;
  const collectionPct = fin ? Math.round(fin.collectionRate * 100) : null;

  // Health badge
  const health = fin?.health;
  const healthBadge = health === "green"
    ? { label: "Healthy",  cls: "bg-success-light text-success-dark" }
    : health === "amber"
    ? { label: "Watch",    cls: "bg-warning-light text-warning-dark" }
    : health === "red"
    ? { label: "At Risk",  cls: "bg-destructive-light text-destructive-text" }
    : null;

  const amenities = [
    building.hasElevator && "Lift",
    building.hasConcierge && "Concierge",
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-surface-border bg-surface-raised shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      {/* Coloured band — Monopoly identity */}
      <div
        className="px-4 pt-4 pb-3.5 flex flex-col"
        style={{ backgroundColor: bandColor }}
      >
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70 mb-0.5">
          Title Deed
        </span>
        <span className="text-sm font-bold leading-snug text-white line-clamp-2">
          {building.name}
        </span>
        {(building.address || building.city) && (
          <span className="text-[10px] text-white/75 mt-0.5 line-clamp-1">
            {[building.address, building.city].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-4 pt-4 pb-4 gap-0">

        {/* Canton + amenity chips */}
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          {building.canton && (
            <span
              className="inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: bandColor }}
            >
              {building.canton}
            </span>
          )}
          {building.yearBuilt && (
            <span className="text-[10px] text-slate-400">{building.yearBuilt}</span>
          )}
          {amenities.map((a) => (
            <span key={a} className="text-[9px] bg-muted-light text-muted-text rounded px-1.5 py-0.5">
              {a}
            </span>
          ))}
        </div>

        {/* Stats — no top divider; rows separated internally */}
        <div className="divide-y divide-surface-border">
          {unitCount != null && (
            <StatRow label="Units" value={unitCount} />
          )}
          {avgRent != null && (
            <StatRow
              label="Avg rent / unit"
              value={formatChfCents(avgRent)}
              sub="/mo"
            />
          )}
          {monthlyNOI != null && (
            <StatRow
              label="NOI"
              value={formatChfCents(monthlyNOI)}
              sub="/mo"
              valueClass={monthlyNOI < 0 ? "text-destructive" : ""}
            />
          )}
          {collectionPct != null && (
            <StatRow
              label="Collection"
              value={`${collectionPct}%`}
              valueClass={
                collectionPct >= 95 ? "text-success" :
                collectionPct >= 80 ? "text-warning" :
                "text-destructive"
              }
            />
          )}
        </div>

        {/* Footer: status + health */}
        <div className="mt-auto pt-4 flex items-center justify-between gap-1 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
              building.isActive === false
                ? "bg-muted-light text-muted"
                : "bg-success-light text-success-dark"
            )}
          >
            {building.isActive === false ? "Inactive" : "Active"}
          </span>
          {healthBadge && (
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", healthBadge.cls)}>
              {healthBadge.label}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

const BUILDINGS_SORT_FIELDS = ["name", "address", "unitCount", "status", "canton"];

function buildingFieldExtractor(row, field) {
  switch (field) {
    case "name": return (row.name || "").toLowerCase();
    case "address": return (row.address || "").toLowerCase();
    case "unitCount": return row.unitCount ?? row._count?.units ?? 0;
    case "status": return row.isActive === false ? 0 : 1;
    case "canton": return (row.canton || "").toLowerCase();
    default: return "";
  }
}

const OWNER_BUILDING_COLUMNS = [
  {
    id: "name",
    label: "Building",
    sortable: true,
    alwaysVisible: true,
    render: (b) => <span className="font-medium text-slate-900">{b.name}</span>,
  },
  {
    id: "address",
    label: "Address",
    sortable: true,
    defaultVisible: true,
    render: (b) => <span className="text-slate-500">{b.address || "\u2014"}</span>,
  },
  {
    id: "unitCount",
    label: "Units",
    sortable: true,
    defaultVisible: true,
    render: (b) => <span>{b.unitCount ?? b._count?.units ?? "\u2014"}</span>,
  },
  {
    id: "status",
    label: "Status",
    sortable: true,
    defaultVisible: true,
    render: (b) => (
      <span className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
        (b.isActive === false
          ? "bg-slate-100 text-slate-500"
          : "bg-green-100 text-green-700")
      }>
        {b.isActive === false ? "Inactive" : "Active"}
      </span>
    ),
  },
  {
    id: "canton",
    label: "Canton",
    sortable: true,
    defaultVisible: false,
    render: (b) => <span className="text-slate-600">{b.canton || "\u2014"}</span>,
  },
];

export default function OwnerPropertiesPage() {
  const [tab, setTab] = useState("buildings");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Properties"
          subtitle="Buildings and units in your portfolio"
          actions={
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          }
        />
        <PageContent>
          {/* Tab bar */}
          <ScrollableTabs activeIndex={tab === "buildings" ? 0 : 1}>
            {[
              { key: "buildings", label: "Buildings" },
              { key: "vacancies", label: "Vacancies" },
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

          {tab === "buildings" && <BuildingsTab refreshKey={refreshKey} />}
          {tab === "vacancies" && <VacanciesPanel role="OWNER" refreshKey={refreshKey} />}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

// Returns { from, to, months } for trailing-12-months window
function trailingYear() {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  const fmt = (d) => d.toISOString().slice(0, 10);
  // months elapsed in this window (always 12)
  return { from: fmt(from), to: fmt(to), months: 12 };
}

function BuildingsTab({ refreshKey }) {
  const router = useRouter();
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("list"); // "list" | "monopoly"
  // Keyed by buildingId; loaded lazily when user switches to monopoly view
  const [finMap, setFinMap] = useState({});
  const [finLoading, setFinLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch("/api/buildings", { headers: ownerAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load properties");
        return res.json();
      })
      .then((data) => setBuildings(data.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Fetch portfolio financials when switching to monopoly view
  useEffect(() => {
    if (viewMode !== "monopoly") return;
    if (Object.keys(finMap).length > 0) return; // already loaded
    const { from, to, months } = trailingYear();
    setFinLoading(true);
    fetch(`/api/financials/portfolio-summary?from=${from}&to=${to}`, { headers: ownerAuthHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.data?.buildings) return;
        const map = {};
        for (const b of data.data.buildings) {
          map[b.buildingId] = { ...b, _months: months };
        }
        setFinMap(map);
      })
      .catch(() => {/* financials are optional — card degrades gracefully */})
      .finally(() => setFinLoading(false));
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const { sortField, sortDir, handleSort } = useTableSort(router, BUILDINGS_SORT_FIELDS, { defaultField: "name", defaultDir: "asc" });
  const sortedBuildings = useMemo(() => clientSort(buildings, sortField, sortDir, buildingFieldExtractor), [buildings, sortField, sortDir]);

  if (error) {
    return <ErrorBanner error={error} className="text-sm" />;
  }

  const buildingDetailUrl = (b) =>
    `/admin-inventory/buildings/${b.id}?from=/owner/properties&role=owner`;

  return (
    <>
      {/* View toggle — only shown when data is ready */}
      {!loading && buildings.length > 0 && (
        <div className="flex justify-end mb-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={cn(
                "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {/* List icon */}
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <rect x="2" y="3" width="12" height="1.5" rx="0.75" />
                <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" />
                <rect x="2" y="11.5" width="12" height="1.5" rx="0.75" />
              </svg>
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("monopoly")}
              aria-label="Monopoly board view"
              className={cn(
                "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors border-l border-slate-200",
                viewMode === "monopoly"
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {/* Grid icon */}
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
              <span className="hidden sm:inline">Monopoly</span>
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="loading-text">Loading properties…</p>
      ) : buildings.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">No properties found.</p>
        </div>
      ) : viewMode === "monopoly" ? (
        /* ── Monopoly card grid ─────────────────────────────────────── */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {sortedBuildings.map((b) => (
            <MonopolyCard
              key={b.id}
              building={b}
              fin={finMap[b.id] ?? null}
              onClick={() => router.push(buildingDetailUrl(b))}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-3">
            {sortedBuildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => router.push(buildingDetailUrl(b))}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{b.name}</p>
                  {b.address && <p className="text-xs text-slate-500 mt-0.5">{b.address}</p>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {b.unitCount != null && <span className="text-xs text-slate-400">{b.unitCount} units</span>}
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", b.isActive === false ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700")}>
                    {b.isActive === false ? "Inactive" : "Active"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop: configurable table */}
          <div className="hidden sm:block">
            <ConfigurableTable
                tableId="owner-buildings"
                columns={OWNER_BUILDING_COLUMNS}
                data={sortedBuildings}
                rowKey={(b) => b.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(b) => router.push(buildingDetailUrl(b))}
                emptyState={<p className="text-sm text-slate-500">No properties found.</p>}
              />
          </div>
        </>
      )}
    </>
  );
}
