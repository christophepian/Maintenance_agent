import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { clientSort } from "../../../lib/tableUtils";
import { SortToggle, SortPanelBody, SortRow } from "../../../components/ui/FilterPanel";
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
    render: (t) => <span className="font-medium text-foreground">{t.name || "\u2014"}</span>,
  },
  {
    id: "phone",
    label: "Phone",
    sortable: true,
    defaultVisible: true,
    render: (t) => <span className="text-muted-text">{t.phone || "\u2014"}</span>,
  },
  {
    id: "email",
    label: "Email",
    sortable: true,
    defaultVisible: true,
    render: (t) => <span className="text-muted-text">{t.email || "\u2014"}</span>,
  },
  {
    id: "unit",
    label: "Unit",
    sortable: true,
    defaultVisible: true,
    render: (t) => (
      <span className="text-muted-text">
        {t.unit ? `${t.unit.unitNumber}${t.unit.floor ? ` (Floor ${t.unit.floor})` : ""}` : "\u2014"}
      </span>
    ),
  },
  {
    id: "building",
    label: "Building",
    sortable: true,
    defaultVisible: false,
    render: (t) => <span className="text-muted-text">{t.unit?.building?.name || "\u2014"}</span>,
  },
  {
    id: "floor",
    label: "Floor",
    sortable: true,
    defaultVisible: false,
    render: (t) => <span className="text-muted-text">{t.unit?.floor ?? "\u2014"}</span>,
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

  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [sortOpen, setSortOpen] = useState(false);
  const handleSort = useCallback((field, dir) => {
    setSortField(field);
    setSortDir(dir !== undefined ? dir : (field === sortField ? (sortDir === "asc" ? "desc" : "asc") : "asc"));
  }, [sortField, sortDir]);
  const sortActive = sortField !== "name";
  const sortedTenants = useMemo(() => clientSort(filtered, sortField, sortDir, tenantFieldExtractor), [filtered, sortField, sortDir]);

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader
          title={t("manager:peopleTenants.title.tenants")}
          subtitle={`${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`}
        />
        <PageContent>
            {loading && <p className="text-sm text-muted">{t("manager:peopleTenants.text.loading")}</p>}
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
                toolbarSlot={
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="search"
                      placeholder={t("manager:peopleTenants.placeholder.searchByNameEmailPhoneOrUnit")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="filter-input flex-1 min-w-0 mb-0"
                    />
                    <SortToggle open={sortOpen} onToggle={() => setSortOpen((v) => !v)} active={sortActive} />
                  </div>
                }
                toolbarPanel={
                  <>
                    {sortOpen && (
                      <SortPanelBody>
                        <SortRow active={sortField === "name"} dir={sortField === "name" ? sortDir : "asc"} label="Name" ascLabel="A → Z" descLabel="Z → A" onSelect={(dir) => handleSort("name", dir)} />
                        <SortRow active={sortField === "building"} dir={sortField === "building" ? sortDir : "asc"} label="Building" ascLabel="A → Z" descLabel="Z → A" onSelect={(dir) => handleSort("building", dir)} />
                        <SortRow active={sortField === "email"} dir={sortField === "email" ? sortDir : "asc"} label="Email" ascLabel="A → Z" descLabel="Z → A" onSelect={(dir) => handleSort("email", dir)} />
                      </SortPanelBody>
                    )}
                  </>
                }
                data={sortedTenants}
                rowKey={(t) => t.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(t) => router.push(`/manager/people/tenants/${t.id}`)}
                emptyState={<p className="text-sm text-muted">{t("manager:peopleTenants.text.noTenantsFound")}</p>}
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
