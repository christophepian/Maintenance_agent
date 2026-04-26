import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { useTableSort, clientSort } from "../../../lib/tableUtils";
import { authHeaders } from "../../../lib/api";

const TENANT_SORT_FIELDS = ["name", "phone", "email", "unit", "building", "floor"];

function tenantFieldExtractor(t, field) {
  switch (field) {
    case "name": return (t.name || "").toLowerCase();
    case "phone": return t.phone || "";
    case "email": return (t.email || "").toLowerCase();
    case "unit": return (t.unit?.unitNumber || "").toLowerCase();
    case "building": return (t.unit?.building?.name || "").toLowerCase();
    case "floor": return t.unit?.floor ?? "";
    default: return "";
  }
}

const TENANT_COLUMNS = [
  {
    id: "name",
    label: "Name",
    sortable: true,
    alwaysVisible: true,
    render: (t) => <span className="font-medium text-slate-900">{t.name || "\u2014"}</span>,
  },
  {
    id: "phone",
    label: "Phone",
    sortable: true,
    defaultVisible: true,
    render: (t) => <span className="text-slate-600">{t.phone || "\u2014"}</span>,
  },
  {
    id: "email",
    label: "Email",
    sortable: true,
    defaultVisible: true,
    render: (t) => <span className="text-slate-600">{t.email || "\u2014"}</span>,
  },
  {
    id: "unit",
    label: "Unit",
    sortable: true,
    defaultVisible: true,
    render: (t) => (
      <span className="text-slate-600">
        {t.unit ? `${t.unit.unitNumber}${t.unit.floor ? ` (Floor ${t.unit.floor})` : ""}` : "\u2014"}
      </span>
    ),
  },
  {
    id: "building",
    label: "Building",
    sortable: true,
    defaultVisible: false,
    render: (t) => <span className="text-slate-600">{t.unit?.building?.name || "\u2014"}</span>,
  },
  {
    id: "floor",
    label: "Floor",
    sortable: true,
    defaultVisible: false,
    render: (t) => <span className="text-slate-600">{t.unit?.floor ?? "\u2014"}</span>,
  },
  {
    id: "actions",
    label: "",
    alwaysVisible: true,
    className: "text-right",
    render: (t) => (
      <Link href={`/manager/people/tenants/${t.id}`} className="text-blue-600 hover:text-blue-700 text-xs font-medium" onClick={(e) => e.stopPropagation()}>
        View \u2192
      </Link>
    ),
  },
];
export default function PeopleTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTenants();
  }, []);

  async function loadTenants() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/people/tenants", { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load tenants");
      setTenants(json?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = tenants.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.name || "").toLowerCase().includes(q) ||
      (t.email || "").toLowerCase().includes(q) ||
      (t.phone || "").includes(q) ||
      (t.unit?.unitNumber || "").toLowerCase().includes(q)
    );
  });

  const { sortField, sortDir, handleSort } = useTableSort(router, TENANT_SORT_FIELDS, { defaultField: "name", defaultDir: "asc" });
  const sortedTenants = useMemo(() => clientSort(filtered, sortField, sortDir, tenantFieldExtractor), [filtered, sortField, sortDir]);

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader
          title="Tenants"
          subtitle={`${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`}
        />
        <PageContent>
          <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name, email, phone, or unit…"
                className="input text-sm w-full max-w-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {!loading && !error && filtered.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">{search ? "No tenants match your search." : "No tenants found."}</p>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <ConfigurableTable
                tableId="manager-tenants"
                columns={TENANT_COLUMNS}
                data={sortedTenants}
                rowKey={(t) => t.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(t) => router.push(`/manager/people/tenants/${t.id}`)}
                emptyState={<p className="text-sm text-slate-500">No tenants found.</p>}
              />
            )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
