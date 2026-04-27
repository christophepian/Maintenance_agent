import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField } from "../../../components/ui/FilterPanel";
import { authHeaders } from "../../../lib/api";
import { formatDate, formatChf } from "../../../lib/format";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { useTableSort, clientSort } from "../../../lib/tableUtils";
import Badge from "../../../components/ui/Badge";

const EXPENSE_CATEGORIES = [
  "MAINTENANCE", "UTILITIES", "CLEANING", "INSURANCE", "TAX", "ADMIN", "CAPEX", "OTHER",
];

const CATEGORY_VARIANT = {
  MAINTENANCE: "success",
  UTILITIES: "info",
  CLEANING: "brand",
  INSURANCE: "warning",
  TAX: "destructive",
  ADMIN: "muted",
  CAPEX: "info",
  OTHER: "default",
};

function CategoryBadge({ category }) {
  if (!category) return <span className="text-sm text-slate-400">Uncategorised</span>;
  return (
    <Badge variant={CATEGORY_VARIANT[category] || "default"} size="sm">
      {category}
    </Badge>
  );
}

const EXPENSE_SORT_FIELDS = ["invoiceNumber", "category", "amount", "date"];

function expenseFieldExtractor(inv, field) {
  switch (field) {
    case "invoiceNumber": return inv.invoiceNumber || "";
    case "category": return inv.expenseCategory || "";
    case "amount": return inv.totalAmount ?? 0;
    case "date": return inv.createdAt || "";
    default: return "";
  }
}

export default function ManagerExpensesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const { sortField, sortDir, handleSort } = useTableSort(router, EXPENSE_SORT_FIELDS, { defaultField: "date", defaultDir: "desc" });
  const sortedInvoices = useMemo(() => clientSort(invoices, sortField, sortDir, expenseFieldExtractor), [invoices, sortField, sortDir]);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [expenseTypeId, setExpenseTypeId] = useState("");
  const [accountId, setAccountId] = useState("");

  // COA lookups (feature-flagged: dropdowns only render when lists are non-empty)
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // Load buildings + COA lookups for dropdowns
  useEffect(() => {
    fetch("/api/buildings", { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setBuildings(data?.data || []))
      .catch(() => {});
    fetch("/api/coa/expense-types", { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setExpenseTypes(data?.data || []))
      .catch(() => {});
    fetch("/api/coa/accounts", { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setAccounts(data?.data || []))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ view: "summary" });
      if (categoryFilter) params.set("expenseCategory", categoryFilter);
      if (buildingId) params.set("buildingId", buildingId);
      if (expenseTypeId) params.set("expenseTypeId", expenseTypeId);
      if (accountId) params.set("accountId", accountId);

      const res = await fetch(`/api/invoices?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load expenses");
      // If no category filter, only show invoices that have an expenseCategory
      const all = data?.data || [];
      setInvoices(categoryFilter ? all : all.filter((inv) => inv.expenseCategory));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, buildingId, expenseTypeId, accountId]);

  useEffect(() => { loadData(); }, [loadData]);

  function clearFilters() {
    setCategoryFilter("");
    setBuildingId("");
    setExpenseTypeId("");
    setAccountId("");
  }

  async function setExpenseCategory(invoiceId, newCategory) {
    setActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/set-expense-category`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ expenseCategory: newCategory }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to set category");
      }
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setActionLoading(null);
    }
  }

  const hasFilters = categoryFilter || buildingId || expenseTypeId || accountId;
  const activeCount = [categoryFilter, buildingId, expenseTypeId, accountId].filter(Boolean).length;
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Expenses" />
        <PageContent>
          {error && (
            <Panel className="bg-red-50 border-red-200">
              <strong className="text-red-700">Error:</strong> {error}
              <button onClick={() => setError("")} className="action-btn-dismiss">Dismiss</button>
            </Panel>
          )}

          <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
          {filterOpen && (
            <FilterPanelBody>
              <FilterSection title="Category" first>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectField label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="">All categories</option>
                    {EXPENSE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSection title="Scope">
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Building" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
                    <option value="">All buildings</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.name || b.address}</option>)}
                  </SelectField>
                  {expenseTypes.length > 0 && (
                    <SelectField label="Expense Type" value={expenseTypeId} onChange={(e) => setExpenseTypeId(e.target.value)}>
                      <option value="">All expense types</option>
                      {expenseTypes.map((et) => <option key={et.id} value={et.id}>{et.code} — {et.name}</option>)}
                    </SelectField>
                  )}
                  {accounts.length > 0 && (
                    <SelectField label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                      <option value="">All accounts</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </SelectField>
                  )}
                </div>
              </FilterSection>
              <FilterSectionClear hasFilter={hasFilters} onClear={clearFilters} />
            </FilterPanelBody>
          )}

          {loading ? (
            <Panel><p className="m-0">Loading expenses...</p></Panel>
          ) : (
            <ConfigurableTable
                tableId="manager-expenses"
                columns={useMemo(() => [
                  {
                    id: "invoiceNumber",
                    label: "Invoice #",
                    sortable: true,
                    alwaysVisible: true,
                    render: (inv) => inv.invoiceNumber || inv.id.slice(0, 8),
                  },
                  {
                    id: "category",
                    label: "Category",
                    sortable: true,
                    defaultVisible: true,
                    render: (inv) => <CategoryBadge category={inv.expenseCategory} />,
                  },
                  {
                    id: "description",
                    label: "Description",
                    defaultVisible: true,
                    render: (inv) => inv.description || "\u2014",
                  },
                  {
                    id: "amount",
                    label: "Amount (CHF)",
                    sortable: true,
                    defaultVisible: true,
                    className: "text-right",
                    render: (inv) => <span className="tabular-nums cell-bold">{formatChf(inv.totalAmount)}</span>,
                  },
                  {
                    id: "date",
                    label: "Date",
                    sortable: true,
                    defaultVisible: true,
                    render: (inv) => formatDate(inv.createdAt),
                  },
                  {
                    id: "actions",
                    label: "Actions",
                    alwaysVisible: true,
                    render: (inv) => {
                      const isJobLinked = inv.jobId && inv.expenseCategory === "MAINTENANCE";
                      return isJobLinked ? (
                        <span className="text-xs text-slate-400">Auto (job-linked)</span>
                      ) : (
                        <select
                          value={inv.expenseCategory || ""}
                          onChange={(e) => setExpenseCategory(inv.id, e.target.value)}
                          disabled={actionLoading === inv.id}
                          className="edit-input cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="">Set category\u2026</option>
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      );
                    },
                  },
                ], [setExpenseCategory, actionLoading])}
                data={sortedInvoices}
                rowKey={(inv) => inv.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                emptyState={
                  <p className="px-4 py-8 text-center text-sm text-slate-400">No expenses found. Tag invoices with an expense category to track them here.</p>
                }
                mobileCard={(inv) => (
                  <div className="table-card">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs text-slate-500">{inv.invoiceNumber || inv.id?.slice(0, 8)}</span>
                      <CategoryBadge category={inv.expenseCategory} />
                    </div>
                    <p className="table-card-head mt-1">{inv.description || "—"}</p>
                    <div className="table-card-footer">
                      <span className="font-medium">{formatChf(inv.totalAmount)}</span>
                      <span>{formatDate(inv.createdAt)}</span>
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
