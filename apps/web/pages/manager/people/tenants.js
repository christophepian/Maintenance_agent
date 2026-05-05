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
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

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
  const { t } = useTranslation("manager");
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
          title={t("manager:peopleTenants.title.tenants")}
          subtitle={`${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`}
        />
        <PageContent>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="search"
              placeholder={t("manager:peopleTenants.placeholder.searchByNameEmailPhoneOrUnit")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="filter-input flex-1 min-w-0 mb-0"
            />
            <button
              type="button"
              aria-label={t("manager:peopleTenants.ariaLabel.sortTenants")}
              onClick={() => {
                const cycle = ["name", "building", "email"];
                const next = cycle[(cycle.indexOf(sortField) + 1) % cycle.length];
                handleSort(next);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path fillRule="evenodd" d="M2 3.75A.75.75 0 0 1 2.75 3h11.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 7.5a.75.75 0 0 1 .75-.75h7.508a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 7.5ZM14 7a.75.75 0 0 1 .75.75v6.59l1.95-2.1a.75.75 0 1 1 1.1 1.02l-3.25 3.5a.75.75 0 0 1-1.1 0l-3.25-3.5a.75.75 0 0 1 1.1-1.02l1.95 2.1V7.75A.75.75 0 0 1 14 7ZM2 11.25a.75.75 0 0 1 .75-.75h4.562a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
              <span className="hidden sm:inline capitalize">{sortField === "building" ? "Building" : sortField === "email" ? "Email" : "Name"}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={cn("w-3 h-3 transition-transform", sortDir === "desc" && "rotate-180")} aria-hidden="true"><path fillRule="evenodd" d="M8 2a.75.75 0 0 1 .75.75v8.69l1.22-1.22a.75.75 0 1 1 1.06 1.06l-2.5 2.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 0 1 1.06-1.06l1.22 1.22V2.75A.75.75 0 0 1 8 2Z" clipRule="evenodd" /></svg>
            </button>
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
                mobileCard={(t) => (
                  <div className="table-card cursor-pointer" onClick={() => router.push(`/manager/people/tenants/${t.id}`)}>
                    <p className="table-card-head">{t.name || "—"}</p>
                    <p className="table-card-sub">{t.unit?.building?.name || "—"}{t.unit?.unitNumber ? ` / ${t.unit.unitNumber}` : ""}</p>
                    <div className="table-card-footer">
                      <span>{t.email || "—"}</span>
                      {t.phone && <span>{t.phone}</span>}
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

export const getStaticProps = withTranslations(["common","manager"]);
