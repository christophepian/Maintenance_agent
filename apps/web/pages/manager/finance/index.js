import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import SortableHeader from "../../../components/SortableHeader";
import { useTableSort, clientSort } from "../../../lib/tableUtils";
import Link from "next/link";
import { authHeaders } from "../../../lib/api";

const FINANCE_SORT_FIELDS = ["invoiceNumber", "description", "amount", "status", "createdAt", "expenseCategory", "tenantName", "unitNumber", "chargesTotalChf"];

function financeFieldExtractor(row, field) {
  switch (field) {
    case "invoiceNumber": return row.invoiceNumber ?? "";
    case "description": return (row.description || "").toLowerCase();
    case "amount":
      if (typeof row.totalAmountCents === "number") return row.totalAmountCents;
      if (typeof row.totalAmount === "number") return row.totalAmount;
      if (typeof row.amount === "number") return row.amount;
      return -1;
    case "status": return row.status ?? "";
    case "createdAt": return row.createdAt || row.paidAt || row.updatedAt || "";
    case "expenseCategory": return (row.expenseCategory || "").toLowerCase();
    case "tenantName": return (row.tenantName || "").toLowerCase();
    case "unitNumber": return (row.unit?.unitNumber || "").toLowerCase();
    case "chargesTotalChf": return row.chargesTotalChf ?? -1;
    default: return "";
  }
}
const FINANCE_TABS = [
  { key: "PAYMENTS", label: "Payments" },
  { key: "EXPENSES", label: "Expenses" },
  { key: "CHARGES", label: "Charges" },
  { key: "INVOICES", label: "Invoices" },
];

const TAB_KEYS = ['payments', 'expenses', 'charges', 'invoices'];

const EXTRA_LINKS = [
  { href: "/manager/finance/billing-entities", label: "Billing Entities" },
  { href: "/manager/finance/ledger", label: "Ledger" },
];

const STATUS_COLORS = {
  DRAFT: { bg: "#f5f5f5", color: "#666", border: "#ccc" },
  ISSUED: { bg: "#e3f2fd", color: "#0b3a75", border: "#90caf9" },
  APPROVED: { bg: "#e8f5e9", color: "#1b5e20", border: "#a5d6a7" },
  PAID: { bg: "#e8f5e9", color: "#116b2b", border: "#66bb6a" },
  DISPUTED: { bg: "#fce4ec", color: "#b30000", border: "#ef9a9a" },
};

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

function formatCurrencyWhole(amount) {
  if (typeof amount !== "number") return "—";
  const str = amount.toFixed(0);
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${formatted}`;
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.DRAFT;
  return (
    <span className="status-pill" style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

function getAmount(inv) {
  if (typeof inv.totalAmountCents === "number") return formatCurrency(inv.totalAmountCents / 100);
  if (typeof inv.totalAmount === "number") return formatCurrencyWhole(inv.totalAmount);
  if (typeof inv.amount === "number") return formatCurrencyWhole(inv.amount);
  return "—";
}

export default function ManagerFinanceHome() {
  const router = useRouter();
  const activeTab = router.isReady ? (Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true }
    );
  }, [router]);
  const [invoices, setInvoices] = useState([]);
  const [leases, setLeases] = useState([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [invRes, leaseRes] = await Promise.all([
        fetch("/api/invoices?view=summary&limit=200", { headers: authHeaders() }),
        fetch("/api/leases?status=ACTIVE&limit=200", { headers: authHeaders() }),
      ]);
      const invData = await invRes.json();
      const leaseData = await leaseRes.json();
      if (!invRes.ok) throw new Error(invData?.error?.message || "Failed to load invoices");
      setInvoices(invData?.data || []);
      setInvoicesTotal(invData?.total ?? invData?.data?.length ?? 0);
      setLeases(leaseData?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Payments = PAID invoices
  const payments = useMemo(() => invoices.filter((inv) => inv.status === "PAID"), [invoices]);

  // Expenses = invoices with expenseCategory
  const expenses = useMemo(() => invoices.filter((inv) => inv.expenseCategory), [invoices]);

  // Charges = leases with charges data
  const leasesWithCharges = useMemo(() => {
    return leases.filter((l) => l.chargesTotalChf || (l.chargesItems && l.chargesItems.length > 0));
  }, [leases]);

  // Shared sort hook (applies to whichever tab is active)
  const { sortField, sortDir, handleSort } = useTableSort(router, FINANCE_SORT_FIELDS, { defaultField: "createdAt", defaultDir: "desc" });
  const sortedPayments = useMemo(() => clientSort(payments, sortField, sortDir, financeFieldExtractor), [payments, sortField, sortDir]);
  const sortedExpenses = useMemo(() => clientSort(expenses, sortField, sortDir, financeFieldExtractor), [expenses, sortField, sortDir]);
  const sortedCharges = useMemo(() => clientSort(leasesWithCharges, sortField, sortDir, financeFieldExtractor), [leasesWithCharges, sortField, sortDir]);
  const sortedInvoices = useMemo(() => clientSort(invoices, sortField, sortDir, financeFieldExtractor), [invoices, sortField, sortDir]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Finances" />
        <PageContent>
          {error && <div className="error-banner">{error}</div>}

          {/* Tab strip */}
          <div className="tab-strip">
            {FINANCE_TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Count + full-view link — outside the Panel card */}
          <span className="tab-panel-count">
            {activeTab === 0 ? `${payments.length} payment${payments.length !== 1 ? "s" : ""}` : null}
            {activeTab === 1 ? `${expenses.length} expense${expenses.length !== 1 ? "s" : ""}` : null}
            {activeTab === 2 ? `${leasesWithCharges.length} lease${leasesWithCharges.length !== 1 ? "s" : ""} with charges` : null}
            {activeTab === 3 ? `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}` : null}
          </span>
          {activeTab === 3 && <Link href="/manager/finance/invoices" className="full-page-link">Full view →</Link>}

          <Panel bodyClassName="p-0">
          {/* Payments tab */}
          <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading payments…</p>
            ) : payments.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No paid invoices yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <SortableHeader label="Invoice #" field="invoiceNumber" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Description" field="description" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Amount" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Paid" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPayments.map((inv) => (
                      <tr key={inv.id}>
                        <td className="cell-bold">{inv.invoiceNumber || inv.id?.slice(0, 8)}</td>
                        <td>{inv.description || "—"}</td>
                        <td>{getAmount(inv)}</td>
                        <td>{formatDate(inv.paidAt || inv.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expenses tab */}
          <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading expenses…</p>
            ) : expenses.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No categorised expenses yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <SortableHeader label="Invoice #" field="invoiceNumber" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Category" field="expenseCategory" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Amount" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExpenses.map((inv) => (
                      <tr key={inv.id}>
                        <td className="cell-bold">{inv.invoiceNumber || inv.id?.slice(0, 8)}</td>
                        <td>{inv.expenseCategory || "—"}</td>
                        <td>{getAmount(inv)}</td>
                        <td><StatusBadge status={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Charges tab */}
          <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading charges…</p>
            ) : leasesWithCharges.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No charge data on any active lease.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <SortableHeader label="Tenant" field="tenantName" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Unit" field="unitNumber" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Total (CHF)" field="chargesTotalChf" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <th>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCharges.map((l) => (
                      <tr key={l.id}>
                        <td className="cell-bold">{l.tenantName || "—"}</td>
                        <td>{l.unit?.unitNumber || "—"}</td>
                        <td>{l.chargesTotalChf != null ? formatCurrencyWhole(l.chargesTotalChf) : "—"}</td>
                        <td>{l.chargesItems?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Invoices tab */}
          <div className={activeTab === 3 ? "tab-panel-active" : "tab-panel"}>
            {loading ? (
              <p className="loading-text">Loading invoices…</p>
            ) : invoices.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No invoices yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <SortableHeader label="Invoice #" field="invoiceNumber" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Description" field="description" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Amount" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Date" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="cell-bold">{inv.invoiceNumber || inv.id?.slice(0, 8)}</td>
                        <td>{inv.description || "—"}</td>
                        <td>{getAmount(inv)}</td>
                        <td><StatusBadge status={inv.status} /></td>
                        <td>{formatDate(inv.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </Panel>

          {/* Extra quick links */}
          <div style={{ display: "grid", gap: 12, maxWidth: 360, marginTop: 24 }}>
            {EXTRA_LINKS.map((link) => (
              <Link key={link.href} className="button-primary" href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
