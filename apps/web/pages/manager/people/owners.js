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
          <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name, email, or billing entity\u2026"
                className="input text-sm w-full max-w-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search owners"
              />
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
              />
            )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
