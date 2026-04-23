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

function BuildingsTab({ refreshKey }) {
  const router = useRouter();
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const { sortField, sortDir, handleSort } = useTableSort(router, BUILDINGS_SORT_FIELDS, { defaultField: "name", defaultDir: "asc" });
  const sortedBuildings = useMemo(() => clientSort(buildings, sortField, sortDir, buildingFieldExtractor), [buildings, sortField, sortDir]);

  if (error) {
    return <ErrorBanner error={error} className="text-sm" />;
  }

  return (
    <Panel bodyClassName="p-0">
      {loading ? (
        <p className="loading-text">Loading properties…</p>
      ) : buildings.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">No properties found.</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="sm:hidden divide-y divide-slate-100">
            {sortedBuildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => router.push(`/admin-inventory/buildings/${b.id}?from=/owner/properties&role=owner`)}
                className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{b.name}</p>
                  {b.address && <p className="text-xs text-slate-500 mt-0.5 truncate">{b.address}</p>}
                </div>
                <div className="shrink-0 flex items-center gap-2">
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
              onRowClick={(b) => router.push(`/admin-inventory/buildings/${b.id}?from=/owner/properties&role=owner`)}
              emptyState={<p className="text-sm text-slate-500">No properties found.</p>}
            />
          </div>
        </>
      )}
    </Panel>
  );
}
