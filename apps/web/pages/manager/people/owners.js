import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { useTableSort, clientSort } from "../../../lib/tableUtils";
import { authHeaders } from "../../../lib/api";
import { cn } from "../../../lib/utils";

const OWNER_SORT_FIELDS = ["name", "email", "billingEntity"];

function ownerFieldExtractor(o, field) {
  switch (field) {
    case "name": return (o.name || "").toLowerCase();
    case "email": return (o.email || "").toLowerCase();
    case "billingEntity": return (o.billingEntity?.name || "").toLowerCase();
    default: return "";
  }
}

const OWNER_COLUMNS = [
  {
    id: "name",
    label: "Name",
    sortable: true,
    alwaysVisible: true,
    render: (o) => <span className="font-medium text-slate-900">{o.name || "\u2014"}</span>,
  },
  {
    id: "email",
    label: "Email",
    sortable: true,
    defaultVisible: true,
    render: (o) => <span className="text-slate-600">{o.email || "\u2014"}</span>,
  },
  {
    id: "billingEntity",
    label: "Billing Entity",
    sortable: true,
    defaultVisible: true,
    render: (o) => <span className="text-slate-600">{o.billingEntity?.name || "\u2014"}</span>,
  },
];

export default function PeopleOwnersPage() {
  const router = useRouter();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadOwners();
  }, []);

  async function loadOwners() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/people/owners", { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load owners");
      setOwners(json?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = owners.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (o.name || "").toLowerCase().includes(q) ||
      (o.email || "").toLowerCase().includes(q) ||
      (o.billingEntity?.name || "").toLowerCase().includes(q)
    );
  });

  const { sortField, sortDir, handleSort } = useTableSort(router, OWNER_SORT_FIELDS, { defaultField: "name", defaultDir: "asc" });
  const sortedOwners = useMemo(() => clientSort(filtered, sortField, sortDir, ownerFieldExtractor), [filtered, sortField, sortDir]);

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader
          title="Owners"
          subtitle={loading ? "Property owners and co-owners" : `${owners.length} owner${owners.length !== 1 ? "s" : ""}`}
        />
        <PageContent>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="search"
              placeholder="Search by name, email, or billing entity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search owners"
              className="filter-input flex-1 min-w-0 mb-0"
            />
            <button
              type="button"
              aria-label="Sort owners"
              onClick={() => {
                const cycle = ["name", "email", "billingEntity"];
                const next = cycle[(cycle.indexOf(sortField) + 1) % cycle.length];
                handleSort(next);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path fillRule="evenodd" d="M2 3.75A.75.75 0 0 1 2.75 3h11.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 7.5a.75.75 0 0 1 .75-.75h7.508a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 7.5ZM14 7a.75.75 0 0 1 .75.75v6.59l1.95-2.1a.75.75 0 1 1 1.1 1.02l-3.25 3.5a.75.75 0 0 1-1.1 0l-3.25-3.5a.75.75 0 0 1 1.1-1.02l1.95 2.1V7.75A.75.75 0 0 1 14 7ZM2 11.25a.75.75 0 0 1 .75-.75h4.562a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
              <span className="hidden sm:inline capitalize">{sortField === "email" ? "Email" : sortField === "billingEntity" ? "Entity" : "Name"}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={cn("w-3 h-3 transition-transform", sortDir === "desc" && "rotate-180")} aria-hidden="true"><path fillRule="evenodd" d="M8 2a.75.75 0 0 1 .75.75v8.69l1.22-1.22a.75.75 0 1 1 1.06 1.06l-2.5 2.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 0 1 1.06-1.06l1.22 1.22V2.75A.75.75 0 0 1 8 2Z" clipRule="evenodd" /></svg>
            </button>
          </div>

            {loading && <p className="text-sm text-slate-500">Loading\u2026</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {!loading && !error && (
              <ConfigurableTable
                tableId="manager-owners"
                columns={OWNER_COLUMNS}
                data={sortedOwners}
                rowKey={(o) => o.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                emptyState={
                  <div className="empty-state">
                    <p className="empty-state-text">{search ? "No owners match your search." : "No owners found."}</p>
                  </div>
                }
                mobileCard={(o) => (
                  <div className="table-card">
                    <p className="table-card-head">{o.name || "—"}</p>
                    <div className="table-card-footer">
                      <span>{o.email || "—"}</span>
                      {o.billingEntity?.name && <span>{o.billingEntity.name}</span>}
                    </div>
                  </div>
                )}
              />
            )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
