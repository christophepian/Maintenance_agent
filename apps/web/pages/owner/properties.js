import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import SortableHeader from "../../components/SortableHeader";
import VacanciesPanel from "../../components/VacanciesPanel";
import { useTableSort, clientSort } from "../../lib/tableUtils";
import { ownerAuthHeaders } from "../../lib/api";

const BUILDINGS_SORT_FIELDS = ["name", "address", "unitCount", "status"];

function buildingFieldExtractor(row, field) {
  switch (field) {
    case "name": return (row.name || "").toLowerCase();
    case "address": return (row.address || "").toLowerCase();
    case "unitCount": return row.unitCount ?? row._count?.units ?? 0;
    case "status": return row.isActive === false ? 0 : 1;
    default: return "";
  }
}

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
          {/* Tab bar — same pattern as approvals.js */}
          <div className="mb-6 flex border-b border-slate-200">
            {[
              { key: "buildings", label: "Buildings" },
              { key: "vacancies", label: "Vacancies" },
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
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
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
        <div style={{ overflowX: "auto" }}>
          <table className="inline-table">
            <thead>
              <tr>
                <SortableHeader label="Building" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Address" field="address" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Units" field="unitCount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedBuildings.map((b) => (
                <tr
                  key={b.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => router.push(`/admin-inventory/buildings/${b.id}?from=/owner/properties`)}
                >
                  <td className="cell-bold">{b.name}</td>
                  <td className="text-slate-500">{b.address || "—"}</td>
                  <td>{b.unitCount ?? b._count?.units ?? "—"}</td>
                  <td>
                    <span className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                      (b.isActive === false
                        ? "bg-slate-100 text-slate-500"
                        : "bg-green-100 text-green-700")
                    }>
                      {b.isActive === false ? "Inactive" : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
