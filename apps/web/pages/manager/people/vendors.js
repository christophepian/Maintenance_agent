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
    render: (c) => <span className="font-medium text-foreground">{c.name || "\u2014"}</span>,
  },
  {
    id: "phone",
    label: "Phone",
    sortable: true,
    defaultVisible: true,
    render: (c) => <span className="text-muted-text">{c.phone || "\u2014"}</span>,
  },
  {
    id: "email",
    label: "Email",
    sortable: true,
    defaultVisible: true,
    render: (c) => <span className="text-muted-text">{c.email || "\u2014"}</span>,
  },
  {
    id: "hourlyRate",
    label: "Rate",
    sortable: true,
    defaultVisible: true,
    render: (c) => <span className="text-muted-text">{c.hourlyRate != null ? `CHF ${c.hourlyRate}/h` : "\u2014"}</span>,
  },
  {
    id: "companyName",
    label: "Company",
    sortable: true,
    defaultVisible: false,
    render: (c) => <span className="text-muted-text">{c.companyName || "\u2014"}</span>,
  },
  {
    id: "specialty",
    label: "Specialty",
    sortable: true,
    defaultVisible: false,
    render: (c) => <span className="text-muted-text">{c.specialty || "\u2014"}</span>,
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
  const { t } = useTranslation("manager");
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

  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [sortOpen, setSortOpen] = useState(false);
  const handleSort = useCallback((field, dir) => {
    setSortField(field);
    setSortDir(dir !== undefined ? dir : (field === sortField ? (sortDir === "asc" ? "desc" : "asc") : "asc"));
  }, [sortField, sortDir]);
  const sortActive = sortField !== "name";
  const sortedVendors = useMemo(() => clientSort(filtered, sortField, sortDir, vendorFieldExtractor), [filtered, sortField, sortDir]);

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader
          title={t("manager:peopleVendors.title.contractors")}
          subtitle={`${contractors.length} contractor${contractors.length !== 1 ? "s" : ""}`}
        />
        <PageContent>
            {loading && <p className="text-sm text-muted">{t("manager:peopleVendors.text.loading")}</p>}
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
                toolbarSlot={
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="search"
                      placeholder={t("manager:peopleVendors.placeholder.searchByNameEmailOrPhone")}
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
                        <SortRow active={sortField === "specialty"} dir={sortField === "specialty" ? sortDir : "asc"} label="Specialty" ascLabel="A → Z" descLabel="Z → A" onSelect={(dir) => handleSort("specialty", dir)} />
                        <SortRow active={sortField === "hourlyRate"} dir={sortField === "hourlyRate" ? sortDir : "desc"} label="Hourly Rate" descLabel="High → Low" ascLabel="Low → High" onSelect={(dir) => handleSort("hourlyRate", dir)} />
                      </SortPanelBody>
                    )}
                  </>
                }
                data={sortedVendors}
                rowKey={(c) => c.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(c) => router.push(`/manager/people/vendors/${c.id}`)}
                emptyState={<p className="text-sm text-muted">{t("manager:peopleVendors.text.noContractorsFound")}</p>}
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

export const getStaticProps = withTranslations(["common","manager"]);
