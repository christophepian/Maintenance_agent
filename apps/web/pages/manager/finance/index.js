import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Section from "../../../components/layout/Section";
import SortableHeader from "../../../components/SortableHeader";
import { useTableSort, clientSort } from "../../../lib/tableUtils";
import { formatChfCents, formatPercent } from "../../../lib/format";
import { authHeaders } from "../../../lib/api";
import { InvoicesContent } from "./invoices";
import BillingEntityManager from "../../../components/BillingEntityManager";

// ─── Helpers ────────────────────────────────────────────────────────────────

function defaultRange() {
  const now = new Date();
  return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) };
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function formatCurrencyWhole(amount) {
  if (typeof amount !== "number") return "—";
  return `CHF ${amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`;
}

function getInvoiceAmount(inv) {
  if (typeof inv.totalAmountCents === "number") return formatChfCents(inv.totalAmountCents);
  if (typeof inv.totalAmount === "number") return formatCurrencyWhole(inv.totalAmount);
  if (typeof inv.amount === "number") return formatCurrencyWhole(inv.amount);
  return "—";
}

// ─── Summary card ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent }) {
  const accentClass = accent === "green"
    ? "text-emerald-700"
    : accent === "red"
    ? "text-red-600"
    : accent === "amber"
    ? "text-amber-700"
    : "text-gray-900";
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xl font-bold ${accentClass}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

// ─── Health dot ─────────────────────────────────────────────────────────────

const HEALTH_COLOR = {
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
};

function HealthDot({ health }) {
  return (
    <span
      title={health}
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: HEALTH_COLOR[health] || "#9ca3af",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Status badge for invoices ───────────────────────────────────────────────

const STATUS_COLORS = {
  DRAFT: "bg-gray-100 text-gray-600",
  ISSUED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  PAID: "bg-emerald-100 text-emerald-800",
  DISPUTED: "bg-red-100 text-red-800",
};

function StatusBadge({ status }) {
  return (
    <span className={"status-pill " + (STATUS_COLORS[status] || "bg-gray-100 text-gray-600")}>
      {status}
    </span>
  );
}

// ─── Table sort config ───────────────────────────────────────────────────────

const SORT_FIELDS = ["invoiceNumber", "description", "amount", "status", "createdAt", "expenseCategory", "tenantName", "unitNumber", "chargesTotalChf"];

function fieldExtractor(row, field) {
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

// ─── Tab definitions ─────────────────────────────────────────────────────────

const FINANCE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
  { key: "expenses", label: "Expenses" },
  { key: "charges", label: "Charges" },
  { key: "billing-entities", label: "Billing Entities" },
  { key: "accounting", label: "Accounting" },
  { key: "setup", label: "Setup" },
];

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ManagerFinanceHome() {
  const router = useRouter();

  // Tab state — top-level finance tabs
  const tabKeys = FINANCE_TABS.map((t) => t.key);
  const activeTab = router.isReady ? (Math.max(0, tabKeys.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback((i) => {
    router.push({ pathname: router.pathname, query: { ...router.query, tab: tabKeys[i] } }, undefined, { shallow: true });
  }, [router]);

  // Date range for portfolio summary
  const [range, setRange] = useState(defaultRange);
  const [rangeInput, setRangeInput] = useState(defaultRange);

  // Portfolio summary state
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState("");

  // Detailed records state
  const [invoices, setInvoices] = useState([]);
  const [leases, setLeases] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [buildingsExpanded, setBuildingsExpanded] = useState(false);

  // Fetch portfolio summary
  const fetchPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    setPortfolioError("");
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/financials/portfolio-summary?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load portfolio summary");
      setPortfolio(json.data);
    } catch (e) {
      setPortfolioError(String(e?.message || e));
    } finally {
      setPortfolioLoading(false);
    }
  }, [range]);

  // Fetch detailed records (invoices + leases)
  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError("");
    try {
      const [invRes, leaseRes] = await Promise.all([
        fetch("/api/invoices?view=summary&limit=200", { headers: authHeaders() }),
        fetch("/api/leases?status=ACTIVE&limit=200", { headers: authHeaders() }),
      ]);
      const invData = await invRes.json();
      const leaseData = await leaseRes.json();
      if (!invRes.ok) throw new Error(invData?.error?.message || "Failed to load invoices");
      setInvoices(invData?.data || []);
      setLeases(leaseData?.data || []);
    } catch (e) {
      setRecordsError(String(e?.message || e));
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Derived record lists
  const payments = useMemo(() => invoices.filter((i) => i.status === "PAID"), [invoices]);
  const expenses = useMemo(() => invoices.filter((i) => i.expenseCategory), [invoices]);
  const leasesWithCharges = useMemo(() => leases.filter((l) => l.chargesTotalChf || l.chargesItems?.length), [leases]);

  const { sortField, sortDir, handleSort } = useTableSort(router, SORT_FIELDS, { defaultField: "createdAt", defaultDir: "desc" });
  const sortedPayments = useMemo(() => clientSort(payments, sortField, sortDir, fieldExtractor), [payments, sortField, sortDir]);
  const sortedExpenses = useMemo(() => clientSort(expenses, sortField, sortDir, fieldExtractor), [expenses, sortField, sortDir]);
  const sortedCharges = useMemo(() => clientSort(leasesWithCharges, sortField, sortDir, fieldExtractor), [leasesWithCharges, sortField, sortDir]);
  const sortedInvoices = useMemo(() => clientSort(invoices, sortField, sortDir, fieldExtractor), [invoices, sortField, sortDir]);

  function applyRange() {
    setRange({ ...rangeInput });
  }

  const p = portfolio;
  const netAccent = p ? (p.totalNetIncomeCents > 0 ? "green" : p.totalNetIncomeCents < 0 ? "red" : "") : "";

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Finances" />
        <PageContent>

          {/* ── Top-level finance tab strip ── */}
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

          {/* ══════════════════════════════════════════════════════
              Tab 0 — Overview
             ══════════════════════════════════════════════════════ */}
          {activeTab === 0 && (
            <>
              {/* Date range controls */}
              <Panel>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">From</label>
                    <input
                      type="date"
                      value={rangeInput.from}
                      onChange={(e) => setRangeInput((r) => ({ ...r, from: e.target.value }))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">To</label>
                    <input
                      type="date"
                      value={rangeInput.to}
                      onChange={(e) => setRangeInput((r) => ({ ...r, to: e.target.value }))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    onClick={applyRange}
                    className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-blue-700 transition-colors"
                  >
                    Apply
                  </button>
                  {p && (
                    <span className="text-xs text-gray-400 self-end pb-0.5">
                      {p.buildingCount} building{p.buildingCount !== 1 ? "s" : ""} · {p.totalActiveUnits} unit{p.totalActiveUnits !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </Panel>

              {portfolioError && <div className="notice notice-err mb-4">{portfolioError}</div>}

              {/* Portfolio summary cards */}
              {portfolioLoading && !p ? (
                <p className="loading-text">Loading portfolio summary…</p>
              ) : p && (
                <Section title="Portfolio Overview">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <SummaryCard label="Earned Income" value={formatChfCents(p.totalEarnedIncomeCents)} accent="green" />
                    <SummaryCard label="Total Expenses" value={formatChfCents(p.totalExpensesCents)} />
                    <SummaryCard
                      label="Net Result"
                      value={formatChfCents(p.totalNetIncomeCents)}
                      accent={netAccent}
                      sub="Income − Expenses"
                    />
                    <SummaryCard
                      label="Receivables"
                      value={formatChfCents(p.totalReceivablesCents)}
                      accent={p.totalReceivablesCents > 0 ? "amber" : ""}
                      sub="Unpaid rent invoices"
                    />
                    <SummaryCard
                      label="Payables"
                      value={formatChfCents(p.totalPayablesCents)}
                      accent={p.totalPayablesCents > 0 ? "amber" : ""}
                      sub="Unpaid supplier invoices"
                    />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>Avg collection rate: <strong>{formatPercent(p.avgCollectionRate)}</strong></span>
                    {p.buildingsInRed > 0 && (
                      <span className="text-red-600 font-medium">{p.buildingsInRed} building{p.buildingsInRed !== 1 ? "s" : ""} need attention</span>
                    )}
                  </div>
                </Section>
              )}

              {/* Per-building table */}
              {p && p.buildings.length > 0 && (
                <Section title="Buildings">
                  <Panel bodyClassName="p-0">
                    <div style={{ overflowX: "auto" }}>
                      <table className="inline-table">
                        <thead>
                          <tr>
                            <th>Building</th>
                            <th className="text-right">Earned Income</th>
                            <th className="text-right">Expenses</th>
                            <th className="text-right">Net</th>
                            <th className="text-right">Collection</th>
                            <th className="text-right">Receivables</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(buildingsExpanded ? p.buildings : p.buildings.slice(0, 5)).map((b) => (
                            <tr key={b.buildingId}>
                              <td>
                                <span className="flex items-center gap-2">
                                  <HealthDot health={b.health} />
                                  <span className="cell-bold">{b.buildingName}</span>
                                </span>
                              </td>
                              <td className="text-right font-mono">{formatChfCents(b.earnedIncomeCents)}</td>
                              <td className="text-right font-mono">{formatChfCents(b.expensesTotalCents)}</td>
                              <td className={`text-right font-mono font-semibold ${b.netIncomeCents >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                {formatChfCents(b.netIncomeCents)}
                              </td>
                              <td className="text-right">{formatPercent(b.collectionRate)}</td>
                              <td className="text-right font-mono">
                                {b.receivablesCents > 0
                                  ? <span className="text-amber-700">{formatChfCents(b.receivablesCents)}</span>
                                  : <span className="text-gray-400">—</span>}
                              </td>
                              <td className="text-right">
                                <Link href={`/manager/buildings/${b.buildingId}/financials`} className="text-blue-600 hover:underline text-sm">
                                  Details →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {p.buildings.length > 5 && (
                      <div
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors text-sm text-slate-500 select-none"
                        onClick={() => setBuildingsExpanded((e) => !e)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className={`w-4 h-4 transition-transform duration-200 ${buildingsExpanded ? "rotate-180" : ""}`}
                        >
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                        {buildingsExpanded
                          ? "Show less"
                          : `Show all ${p.buildings.length} buildings`}
                      </div>
                    )}
                  </Panel>
                </Section>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════
              Tab 1 — Invoices
             ══════════════════════════════════════════════════════ */}
          {activeTab === 1 && <InvoicesContent />}

          {/* ══════════════════════════════════════════════════════
              Tab 2 — Payments
             ══════════════════════════════════════════════════════ */}
          {activeTab === 2 && (
            <>
              <span className="tab-panel-count">
                {`${payments.length} payment${payments.length !== 1 ? "s" : ""}`}
              </span>

              {recordsError && <div className="notice notice-err mb-2">{recordsError}</div>}

              <Panel bodyClassName="p-0">
                {recordsLoading ? <p className="loading-text">Loading…</p> : payments.length === 0 ? (
                  <div className="empty-state"><p className="empty-state-text">No paid invoices yet.</p></div>
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
                            <td>{getInvoiceAmount(inv)}</td>
                            <td>{formatDate(inv.paidAt || inv.updatedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </>
          )}

          {/* ══════════════════════════════════════════════════════
              Tab 3 — Expenses
             ══════════════════════════════════════════════════════ */}
          {activeTab === 3 && (
            <>
              <span className="tab-panel-count">
                {`${expenses.length} expense${expenses.length !== 1 ? "s" : ""}`}
              </span>

              {recordsError && <div className="notice notice-err mb-2">{recordsError}</div>}

              <Panel bodyClassName="p-0">
                {recordsLoading ? <p className="loading-text">Loading…</p> : expenses.length === 0 ? (
                  <div className="empty-state"><p className="empty-state-text">No categorised expenses yet.</p></div>
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
                            <td>{getInvoiceAmount(inv)}</td>
                            <td><StatusBadge status={inv.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </>
          )}

          {/* ══════════════════════════════════════════════════════
              Tab 4 — Charges
             ══════════════════════════════════════════════════════ */}
          {activeTab === 4 && (
            <>
              <span className="tab-panel-count">
                {`${leasesWithCharges.length} lease${leasesWithCharges.length !== 1 ? "s" : ""} with charges`}
              </span>

              {recordsError && <div className="notice notice-err mb-2">{recordsError}</div>}

              <Panel bodyClassName="p-0">
                {recordsLoading ? <p className="loading-text">Loading…</p> : leasesWithCharges.length === 0 ? (
                  <div className="empty-state"><p className="empty-state-text">No charge data on any active lease.</p></div>
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
              </Panel>
            </>
          )}

          {/* ══════════════════════════════════════════════════════
              Tab 5 — Billing Entities
             ══════════════════════════════════════════════════════ */}
          {activeTab === 5 && <BillingEntityManager />}

          {/* ══════════════════════════════════════════════════════
              Tab 6 — Accounting
             ══════════════════════════════════════════════════════ */}
          {activeTab === 6 && (
            <Panel>
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-600">
                  Double-entry ledger and account structure for your portfolio.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/manager/finance/ledger" className="button-secondary text-sm">
                    General Ledger
                  </Link>
                  <Link href="/manager/finance/chart-of-accounts" className="button-secondary text-sm">
                    Chart of Accounts
                  </Link>
                </div>
              </div>
            </Panel>
          )}

          {/* ══════════════════════════════════════════════════════
              Tab 7 — Setup
             ══════════════════════════════════════════════════════ */}
          {activeTab === 7 && (
            <Panel>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-600">
                  Finance configuration options will appear here as they become available.
                </p>
                <p className="text-xs text-gray-400">
                  Coming soon: default payment terms, VAT presets, currency settings, and invoice templates.
                </p>
              </div>
            </Panel>
          )}

        </PageContent>
      </PageShell>
    </AppShell>
  );
}
