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
import { cn } from "../../../lib/utils";

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
          <div className="flex items-center gap-2 mb-4">
            <input
              type="search"
              placeholder="Search by name, email, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="filter-input flex-1 min-w-0 mb-0"
            />
            <button
              type="button"
              aria-label="Sort contractors"
              onClick={() => {
                const cycle = ["name", "specialty", "hourlyRate"];
                const next = cycle[(cycle.indexOf(sortField) + 1) % cycle.length];
                handleSort(next);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path fillRule="evenodd" d="M2 3.75A.75.75 0 0 1 2.75 3h11.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 7.5a.75.75 0 0 1 .75-.75h7.508a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 7.5ZM14 7a.75.75 0 0 1 .75.75v6.59l1.95-2.1a.75.75 0 1 1 1.1 1.02l-3.25 3.5a.75.75 0 0 1-1.1 0l-3.25-3.5a.75.75 0 0 1 1.1-1.02l1.95 2.1V7.75A.75.75 0 0 1 14 7ZM2 11.25a.75.75 0 0 1 .75-.75h4.562a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
              <span className="hidden sm:inline capitalize">{sortField === "specialty" ? "Specialty" : sortField === "hourlyRate" ? "Rate" : "Name"}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={cn("w-3 h-3 transition-transform", sortDir === "desc" && "rotate-180")} aria-hidden="true"><path fillRule="evenodd" d="M8 2a.75.75 0 0 1 .75.75v8.69l1.22-1.22a.75.75 0 1 1 1.06 1.06l-2.5 2.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 0 1 1.06-1.06l1.22 1.22V2.75A.75.75 0 0 1 8 2Z" clipRule="evenodd" /></svg>
            </button>
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
                mobileCard={(c) => (
                  <div className="table-card cursor-pointer" onClick={() => router.push(`/manager/people/vendors/${c.id}`)}>
                    <p className="table-card-head">{c.name || "—"}</p>
                    <p className="table-card-sub">{c.specialty || "—"}{c.hourlyRate != null ? ` · CHF ${c.hourlyRate}/h` : ""}</p>
                    <div className="table-card-footer">
                      <span>{c.email || "—"}</span>
                      {c.phone && <span>{c.phone}</span>}
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
