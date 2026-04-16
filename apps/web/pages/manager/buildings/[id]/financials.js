import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import Section from "../../../../components/layout/Section";
import { authHeaders } from "../../../../lib/api";
import { formatChfCents, formatPercent } from "../../../../lib/format";

import { cn } from "../../../../lib/utils";
/* ─── Helpers ─── */

function defaultRange() {
  const now = new Date();
  return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) };
}

function displayDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/* ─── RAG health bullet ─── */

function HealthBullet({ icon, text, color }) {
  const bg = { green: "bg-green-50", amber: "bg-amber-50", red: "bg-red-50" }[color] || "bg-slate-50";
  const border = { green: "border-green-200", amber: "border-amber-200", red: "border-red-200" }[color] || "border-slate-200";
  return (
    <div className={cn("flex items-start gap-2.5 px-4 py-3 rounded-lg border", bg, border)}>
      <span className="text-lg leading-none mt-0.5">{icon}</span>
      <span className="text-sm text-slate-800">{text}</span>
    </div>
  );
}

/* ─── Labels ─── */

const CATEGORY_LABELS = {
  MAINTENANCE: "Maintenance",
  UTILITIES:   "Utilities",
  CLEANING:    "Cleaning",
  INSURANCE:   "Insurance",
  TAX:         "Tax",
  ADMIN:       "Administration",
  CAPEX:       "Capital Expenditure",
  OTHER:       "Other",
};

/* ─── KPI card ─── */

function KpiCard({ label, value, sub, accent }) {
  const cls = accent === "green" ? "text-green-700"
    : accent === "red" ? "text-red-600"
    : accent === "amber" ? "text-amber-700"
    : "text-slate-900";
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={cn("text-xl font-bold", cls)}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

/* ─── Simple stat row ─── */

function StatRow({ label, value, sub, accent }) {
  const cls = accent === "green" ? "text-green-700"
    : accent === "red" ? "text-red-600"
    : accent === "amber" ? "text-amber-700"
    : "text-slate-900";
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <div>
        <span className="text-sm text-slate-700">{label}</span>
        {sub && <span className="text-xs text-slate-400 ml-2">{sub}</span>}
      </div>
      <span className={cn("text-sm font-semibold font-mono", cls)}>{value}</span>
    </div>
  );
}

/* ─── Tab definitions ─── */

const TABS = [
  { key: "overview",     label: "Overview" },
  { key: "income",       label: "Income" },
  { key: "expenses",     label: "Expenses" },
  { key: "balances",     label: "Receivables & Payables" },
  { key: "advanced",     label: "Advanced" },
];

/* ─── Main Page ─── */

export default function BuildingFinancialsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [range, setRange] = useState(defaultRange);
  const [rangeInput, setRangeInput] = useState(defaultRange);

  const fetchFinancials = useCallback(
    async (forceRefresh = false) => {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          from: range.from,
          to: range.to,
          groupByAccount: "true",
        });
        if (forceRefresh) params.set("forceRefresh", "true");
        const res = await fetch(`/api/buildings/${id}/financial-summary?${params}`, {
          headers: authHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || "Failed to load financials");
        setData(json.data);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    },
    [id, range],
  );

  useEffect(() => { fetchFinancials(); }, [fetchFinancials]);

  function applyRange() { setRange({ ...rangeInput }); }

  const d = data;

  const healthBullets = useMemo(() => {
    if (!d) return [];
    const bullets = [];
    const net = d.netIncomeCents;
    if (net > 0)
      bullets.push({ icon: "🟢", color: "green", text: `Building is profitable — net income of ${formatChfCents(net)} for the period.` });
    else if (net === 0)
      bullets.push({ icon: "🟡", color: "amber", text: "Income and expenses are exactly balanced — no profit or loss." });
    else
      bullets.push({ icon: "🔴", color: "red", text: `Expenses exceed income by ${formatChfCents(Math.abs(net))} — review the breakdown below.` });
    const cr = d.collectionRate;
    if (cr >= 0.95)
      bullets.push({ icon: "🟢", color: "green", text: `Collection rate is ${formatPercent(cr)} — rent is being paid on time.` });
    else if (cr >= 0.80)
      bullets.push({ icon: "🟡", color: "amber", text: `Collection rate is ${formatPercent(cr)} — some rent payments are outstanding.` });
    else if (d.projectedIncomeCents > 0)
      bullets.push({ icon: "🔴", color: "red", text: `Collection rate is only ${formatPercent(cr)} — significant rent is overdue.` });
    else
      bullets.push({ icon: "🟡", color: "amber", text: "No projected income — collection rate cannot be assessed." });
    const mr = d.maintenanceRatio;
    if (d.earnedIncomeCents === 0 && d.maintenanceTotalCents === 0)
      bullets.push({ icon: "🟡", color: "amber", text: "No maintenance spend and no income recorded this period." });
    else if (mr <= 0.15)
      bullets.push({ icon: "🟢", color: "green", text: `Maintenance is ${formatPercent(mr)} of income — well within healthy range.` });
    else if (mr <= 0.30)
      bullets.push({ icon: "🟡", color: "amber", text: `Maintenance is ${formatPercent(mr)} of income — monitor for rising costs.` });
    else
      bullets.push({ icon: "🔴", color: "red", text: `Maintenance is ${formatPercent(mr)} of income — unusually high, investigate major repairs.` });
    if (d.payablesCents > 0)
      bullets.push({ icon: "🟡", color: "amber", text: `${formatChfCents(d.payablesCents)} in outstanding supplier invoices awaiting payment.` });
    return bullets;
  }, [d]);

  if (!id) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageHeader title="Building Financials" />
          <PageContent><p className="loading-text">Loading…</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title={d ? `${d.buildingName} — Financials` : "Building Financials"} />
        <PageContent>

          <Link href="/manager/finance" className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Back to Finance Dashboard
          </Link>

          {/* ─── Date range controls ─── */}
          <Panel>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">From</label>
                <input
                  type="date"
                  value={rangeInput.from}
                  onChange={(e) => setRangeInput((r) => ({ ...r, from: e.target.value }))}
                  className="border border-slate-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">To</label>
                <input
                  type="date"
                  value={rangeInput.to}
                  onChange={(e) => setRangeInput((r) => ({ ...r, to: e.target.value }))}
                  className="border border-slate-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <button
                onClick={applyRange}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => fetchFinancials(true)}
                className="bg-slate-100 text-slate-700 text-sm font-medium px-4 py-1.5 rounded border border-slate-300 hover:bg-slate-200 transition-colors"
                title="Re-compute snapshots from source data"
              >
                ↻ Refresh
              </button>
              {d && (
                <span className="text-xs text-slate-400 self-end pb-0.5">
                  {displayDate(d.from)} – {displayDate(d.to)} · {d.activeUnitsCount} unit{d.activeUnitsCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </Panel>

          {error && <div className="notice notice-err mb-4">{error}</div>}
          {loading && !d && <p className="loading-text">Loading financials…</p>}

          {d && (
            <>
              {/* ─── Tab bar ─── */}
              <div className="tab-strip mt-4">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={activeTab === t.key ? "tab-btn-active" : "tab-btn"}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ═══ Overview tab ═══ */}
              {activeTab === "overview" && (
                <>
                  {healthBullets.length > 0 && (
                    <Section title="Health Summary">
                      <div className="flex flex-col gap-2">
                        {healthBullets.map((b, i) => (
                          <HealthBullet key={i} icon={b.icon} text={b.text} color={b.color} />
                        ))}
                      </div>
                    </Section>
                  )}

                  <Section title="Financial Summary">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <KpiCard label="Earned Income" value={formatChfCents(d.earnedIncomeCents)} accent="green" />
                      <KpiCard label="Total Expenses" value={formatChfCents(d.expensesTotalCents)} />
                      <KpiCard
                        label="Net Operating Income"
                        value={formatChfCents(d.netOperatingIncomeCents)}
                        accent={d.netOperatingIncomeCents >= 0 ? "green" : "red"}
                        sub="Income − Operating Expenses"
                      />
                      <KpiCard
                        label="Collection Rate"
                        value={formatPercent(d.collectionRate)}
                        accent={d.collectionRate >= 0.95 ? "green" : d.collectionRate >= 0.8 ? "amber" : "red"}
                        sub="Earned ÷ Projected"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <KpiCard label="Maintenance" value={formatChfCents(d.maintenanceTotalCents)} sub="of total expenses" />
                      <KpiCard
                        label="Maintenance Ratio"
                        value={formatPercent(d.maintenanceRatio)}
                        accent={d.maintenanceRatio > 0.3 ? "red" : d.maintenanceRatio > 0.15 ? "amber" : "green"}
                        sub="Maintenance ÷ Income"
                      />
                      <KpiCard label="CapEx" value={formatChfCents(d.capexTotalCents)} sub="Capital expenditure" />
                      <KpiCard
                        label="Cost per Unit"
                        value={formatChfCents(d.costPerUnitCents)}
                        sub={`${d.activeUnitsCount} active unit${d.activeUnitsCount !== 1 ? "s" : ""}`}
                      />
                    </div>
                    {(d.receivablesCents > 0 || d.payablesCents > 0) && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {d.receivablesCents > 0 && (
                          <KpiCard
                            label="Receivables"
                            value={formatChfCents(d.receivablesCents)}
                            accent="amber"
                            sub="Unpaid rent invoices (now)"
                          />
                        )}
                        {d.payablesCents > 0 && (
                          <KpiCard
                            label="Payables"
                            value={formatChfCents(d.payablesCents)}
                            accent="amber"
                            sub="Unpaid supplier invoices (now)"
                          />
                        )}
                      </div>
                    )}
                  </Section>

                  {d.topContractorsBySpend.length > 0 && (
                    <Section title="Top Expense Drivers">
                      <Panel bodyClassName="p-0">
                        <table className="inline-table">
                          <thead>
                            <tr>
                              <th>Contractor</th>
                              <th className="text-right">Total Spend</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.topContractorsBySpend.map((row) => (
                              <tr key={row.contractorId}>
                                <td className="cell-bold">{row.contractorName}</td>
                                <td className="text-right font-mono">{formatChfCents(row.totalCents)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Panel>
                    </Section>
                  )}
                </>
              )}

              {/* ═══ Income tab ═══ */}
              {activeTab === "income" && (
                <Section title="Income Breakdown">
                  <Panel>
                    <div className="space-y-0">
                      <StatRow
                        label="Earned Income"
                        value={formatChfCents(d.earnedIncomeCents)}
                        sub="Cash received (paid invoices)"
                        accent="green"
                      />
                      <StatRow
                        label="Projected Income"
                        value={formatChfCents(d.projectedIncomeCents)}
                        sub="Expected from active leases, prorated"
                      />
                      <div className="mt-3 mb-1 pt-3 border-t border-slate-200">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Projected breakdown</span>
                      </div>
                      <StatRow
                        label="Rental Income"
                        value={formatChfCents(d.rentalIncomeCents)}
                        sub="Net rent + garage + other service"
                      />
                      <StatRow
                        label="Service Charges"
                        value={formatChfCents(d.serviceChargeIncomeCents)}
                        sub="Ancillary charges (utilities, etc.)"
                      />
                      <div className="mt-3 mb-1 pt-3 border-t border-slate-200">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Performance</span>
                      </div>
                      <StatRow
                        label="Collection Rate"
                        value={formatPercent(d.collectionRate)}
                        sub="Earned ÷ Projected"
                        accent={d.collectionRate >= 0.95 ? "green" : d.collectionRate >= 0.8 ? "amber" : "red"}
                      />
                      <StatRow
                        label="Net Income"
                        value={formatChfCents(d.netIncomeCents)}
                        sub="Earned Income − All Expenses"
                        accent={d.netIncomeCents >= 0 ? "green" : "red"}
                      />
                      <StatRow
                        label="Net Operating Income"
                        value={formatChfCents(d.netOperatingIncomeCents)}
                        sub="Earned Income − Operating Expenses (excl. CapEx)"
                        accent={d.netOperatingIncomeCents >= 0 ? "green" : "red"}
                      />
                    </div>
                  </Panel>
                </Section>
              )}

              {/* ═══ Expenses tab ═══ */}
              {activeTab === "expenses" && (
                <>
                  <Section title="Expenses by Category">
                    <Panel bodyClassName="p-0">
                      {d.expensesByCategory.length === 0 ? (
                        <div className="empty-state">
                          <p className="empty-state-text">No categorised expenses in this period.</p>
                        </div>
                      ) : (
                        <table className="inline-table">
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th className="text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.expensesByCategory.map((row) => (
                              <tr key={row.category}>
                                <td className="cell-bold">{CATEGORY_LABELS[row.category] || row.category}</td>
                                <td className="text-right font-mono">{formatChfCents(row.totalCents)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-slate-300 font-semibold">
                              <td>Total</td>
                              <td className="text-right font-mono">{formatChfCents(d.expensesTotalCents)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </Panel>
                  </Section>

                  {d.expensesByAccount && d.expensesByAccount.length > 0 && (
                    <Section title="Expenses by Account">
                      <Panel bodyClassName="p-0">
                        <table className="inline-table">
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Account</th>
                              <th className="text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.expensesByAccount.map((row) => (
                              <tr key={row.accountId}>
                                <td className="font-mono text-xs text-slate-500">{row.accountCode || "—"}</td>
                                <td className="cell-bold">{row.accountName}</td>
                                <td className="text-right font-mono">{formatChfCents(row.totalCents)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Panel>
                    </Section>
                  )}

                  {d.topContractorsBySpend.length > 0 && (
                    <Section title="Expenses by Contractor">
                      <Panel bodyClassName="p-0">
                        <table className="inline-table">
                          <thead>
                            <tr>
                              <th>Contractor</th>
                              <th className="text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.topContractorsBySpend.map((row) => (
                              <tr key={row.contractorId}>
                                <td className="cell-bold">{row.contractorName}</td>
                                <td className="text-right font-mono">{formatChfCents(row.totalCents)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Panel>
                    </Section>
                  )}
                </>
              )}

              {/* ═══ Receivables & Payables tab ═══ */}
              {activeTab === "balances" && (
                <Section title="Outstanding Balances">
                  <p className="text-xs text-slate-500 mb-3">
                    Point-in-time snapshot — shows invoices currently awaiting payment, regardless of the date range above.
                  </p>
                  <Panel>
                    <div className="space-y-0">
                      <StatRow
                        label="Receivables"
                        value={d.receivablesCents > 0 ? formatChfCents(d.receivablesCents) : "None outstanding"}
                        sub="ISSUED rent invoices not yet paid"
                        accent={d.receivablesCents > 0 ? "amber" : "green"}
                      />
                      <StatRow
                        label="Payables"
                        value={d.payablesCents > 0 ? formatChfCents(d.payablesCents) : "None outstanding"}
                        sub="ISSUED/APPROVED supplier invoices not yet paid"
                        accent={d.payablesCents > 0 ? "amber" : "green"}
                      />
                    </div>
                  </Panel>
                  {d.receivablesCents === 0 && d.payablesCents === 0 && (
                    <p className="text-sm text-green-700 font-medium mt-3">All invoices settled — no outstanding balances.</p>
                  )}
                </Section>
              )}

              {/* ═══ Advanced tab ═══ */}
              {activeTab === "advanced" && (
                <Section title="Advanced Accounting">
                  <p className="text-xs text-slate-500 mb-4">
                    The following tools show the raw double-entry ledger. Useful for auditing, but not required for day-to-day management.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/manager/finance/ledger" className="button-secondary text-sm">
                      General Ledger →
                    </Link>
                    <Link href="/manager/finance/chart-of-accounts" className="button-secondary text-sm">
                      Chart of Accounts →
                    </Link>
                  </div>
                </Section>
              )}
            </>
          )}

        </PageContent>
      </PageShell>
    </AppShell>
  );
}
