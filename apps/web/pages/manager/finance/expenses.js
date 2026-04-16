import { useEffect, useState, useMemo, useCallback } from "react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";
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

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatCurrency(amount) {
  if (typeof amount !== "number") return "—";
  const str = amount.toFixed(2);
  const [intPart, decPart] = str.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${formatted}.${decPart}`;
}

export default function ManagerExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

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

          {/* Filters */}
          <Panel>
            <div className="filter-row">
              <div>
                <label className="filter-label">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All categories</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="filter-label">Building</label>
                <select
                  value={buildingId}
                  onChange={(e) => setBuildingId(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All buildings</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name || b.address}</option>
                  ))}
                </select>
              </div>
              {expenseTypes.length > 0 && (
                <div>
                  <label className="filter-label">Expense Type</label>
                  <select
                    value={expenseTypeId}
                    onChange={(e) => setExpenseTypeId(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All expense types</option>
                    {expenseTypes.map((et) => (
                      <option key={et.id} value={et.id}>{et.code} — {et.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {accounts.length > 0 && (
                <div>
                  <label className="filter-label">Account</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All accounts</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="action-btn"
                >
                  Clear filters
                </button>
              )}
            </div>
          </Panel>

          {loading ? (
            <Panel><p className="m-0">Loading expenses...</p></Panel>
          ) : invoices.length === 0 ? (
            <Panel>
              <p className="m-0">No expenses found. Tag invoices with an expense category to track them here.</p>
            </Panel>
          ) : (
            <Panel bodyClassName="p-0">
            <table className="inline-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount (CHF)</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const isJobLinked = inv.jobId && inv.expenseCategory === "MAINTENANCE";
                    return (
                      <tr key={inv.id}>
                        <td>{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                        <td><CategoryBadge category={inv.expenseCategory} /></td>
                        <td>{inv.description || "—"}</td>
                        <td className="cell-bold">{formatCurrency(inv.totalAmount)}</td>
                        <td>{formatDate(inv.createdAt)}</td>
                        <td>
                          {isJobLinked ? (
                            <span className="text-xs text-slate-400">Auto (job-linked)</span>
                          ) : (
                            <select
                              value={inv.expenseCategory || ""}
                              onChange={(e) => setExpenseCategory(inv.id, e.target.value)}
                              disabled={actionLoading === inv.id}
                              className="edit-input cursor-pointer"
                            >
                              <option value="">Set category…</option>
                              {EXPENSE_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
