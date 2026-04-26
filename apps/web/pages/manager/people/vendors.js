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

const VENDOR_SORT_FIELDS = ["name", "phone", "email", "hourlyRate", "companyName", "specialty"];

function vendorFieldExtractor(c, field) {
  switch (field) {
    case "name": return (c.name || "").toLowerCase();
    case "phone": return c.phone || "";
    case "email": return (c.email || "").toLowerCase();
    case "hourlyRate": return c.hourlyRate ?? -1;
    case "companyName": return (c.companyName || "").toLowerCase();
    case "specialty": return (c.specialty || "").toLowerCase();
    default: return "";
  }
}

const VENDOR_COLUMNS = [
  {
    id: "name",
    label: "Name",
    sortable: true,
    alwaysVisible: true,
    render: (c) => <span className="font-medium text-slate-900">{c.name || "\u2014"}</span>,
  },
  {
    id: "phone",
    label: "Phone",
    sortable: true,
    defaultVisible: true,
    render: (c) => <span className="text-slate-600">{c.phone || "\u2014"}</span>,
  },
  {
    id: "email",
    label: "Email",
    sortable: true,
    defaultVisible: true,
    render: (c) => <span className="text-slate-600">{c.email || "\u2014"}</span>,
  },
  {
    id: "hourlyRate",
    label: "Rate",
    sortable: true,
    defaultVisible: true,
    render: (c) => <span className="text-slate-600">{c.hourlyRate != null ? `CHF ${c.hourlyRate}/h` : "\u2014"}</span>,
  },
  {
    id: "companyName",
    label: "Company",
    sortable: true,
    defaultVisible: false,
    render: (c) => <span className="text-slate-600">{c.companyName || "\u2014"}</span>,
  },
  {
    id: "specialty",
    label: "Specialty",
    sortable: true,
    defaultVisible: false,
    render: (c) => <span className="text-slate-600">{c.specialty || "\u2014"}</span>,
  },
  {
    id: "actions",
    label: "",
    alwaysVisible: true,
    className: "text-right",
    render: (c) => (
      <Link href={`/manager/people/vendors/${c.id}`} className="text-blue-600 hover:text-blue-700 text-xs font-medium" onClick={(e) => e.stopPropagation()}>
        View \u2192
      </Link>
    ),
  },
];
export default function PeopleVendorsPage() {
  const router = useRouter();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadContractors();
  }, []);

  async function loadContractors() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/people/vendors", { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load contractors");
      setContractors(json?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = contractors.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q)
    );
  });

  const { sortField, sortDir, handleSort } = useTableSort(router, VENDOR_SORT_FIELDS, { defaultField: "name", defaultDir: "asc" });
  const sortedVendors = useMemo(() => clientSort(filtered, sortField, sortDir, vendorFieldExtractor), [filtered, sortField, sortDir]);

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader
          title="Contractors"
          subtitle={`${contractors.length} contractor${contractors.length !== 1 ? "s" : ""}`}
        />
        <PageContent>
          <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name, email, or phone…"
                className="input text-sm w-full max-w-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {!loading && !error && filtered.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">{search ? "No contractors match your search." : "No contractors found."}</p>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <ConfigurableTable
                tableId="manager-vendors"
                columns={VENDOR_COLUMNS}
                data={sortedVendors}
                rowKey={(c) => c.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(c) => router.push(`/manager/people/vendors/${c.id}`)}
                emptyState={<p className="text-sm text-slate-500">No contractors found.</p>}
              />
            )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
