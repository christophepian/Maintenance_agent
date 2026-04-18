import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/Tabs";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Section from "../../../components/layout/Section";
import { formatChfCents, formatPercent } from "../../../lib/format";
import { authHeaders } from "../../../lib/api";
import { InvoicesContent } from "./invoices";
import BillingEntityManager from "../../../components/BillingEntityManager";
import RenovationTaxPlanning from "../../../components/RenovationTaxPlanning";

import { cn } from "../../../lib/utils";
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


// ─── Summary card ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent }) {
  const accentClass = accent === "green"
    ? "text-green-700"
    : accent === "red"
    ? "text-red-600"
    : accent === "amber"
    ? "text-amber-700"
    : "text-slate-900";
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={cn("text-xl font-bold", accentClass)}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

// ─── Health dot ─────────────────────────────────────────────────────────────

const HEALTH_DOT_CLASS = {
  green: "bg-green-600",
  amber: "bg-amber-600",
  red: "bg-red-600",
};

function HealthDot({ health }) {
  return (
    <span
      title={health}
      className={cn("inline-block w-2.5 h-2.5 rounded-full shrink-0", HEALTH_DOT_CLASS[health] || "bg-slate-400")}
    />
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const FINANCE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "invoices", label: "Invoices" },
  { key: "billing-entities", label: "Billing Entities" },
  { key: "accounting", label: "Accounting" },
  { key: "renovation-tax", label: "Renovation & Tax" },
  { key: "setup", label: "Setup" },
];

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ManagerFinanceHome() {
  const router = useRouter();

  // Tab state — top-level finance tabs
  const tabKeys = FINANCE_TABS.map((t) => t.key);
  const activeTabKey = router.isReady && tabKeys.includes(router.query.tab) ? router.query.tab : "overview";
  const setActiveTabKey = useCallback((key) => {
    router.push({ pathname: router.pathname, query: { ...router.query, tab: key } }, undefined, { shallow: true });
  }, [router]);

  // Date range for portfolio summary
  const [range, setRange] = useState(defaultRange);
  const [rangeInput, setRangeInput] = useState(defaultRange);

  // Portfolio summary state
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState("");

  // Detailed records state
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

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

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

          <Tabs value={activeTabKey} onValueChange={setActiveTabKey}>
            <TabsList>
              {FINANCE_TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>

            {/* ── Overview ── */}
            <TabsContent value="overview">
              <Panel>
                <div className="flex flex-wrap items-end gap-3">
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
                  {p && (
                    <span className="text-xs text-slate-400 self-end pb-0.5">
                      {p.buildingCount} building{p.buildingCount !== 1 ? "s" : ""} · {p.totalActiveUnits} unit{p.totalActiveUnits !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </Panel>

              {portfolioError && <div className="notice notice-err mb-4">{portfolioError}</div>}

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
                  <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    <span>Avg collection rate: <strong>{formatPercent(p.avgCollectionRate)}</strong></span>
                    {p.buildingsInRed > 0 && (
                      <span className="text-red-600 font-medium">{p.buildingsInRed} building{p.buildingsInRed !== 1 ? "s" : ""} need attention</span>
                    )}
                  </div>
                </Section>
              )}

              {p && p.buildings.length > 0 && (
                <Section title="Buildings">
                  <Panel bodyClassName="p-0">
                    <div className="overflow-x-auto">
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
                              <td className={cn("text-right font-mono font-semibold", b.netIncomeCents >= 0 ? "text-green-700" : "text-red-600")}>
                                {formatChfCents(b.netIncomeCents)}
                              </td>
                              <td className="text-right">{formatPercent(b.collectionRate)}</td>
                              <td className="text-right font-mono">
                                {b.receivablesCents > 0
                                  ? <span className="text-amber-700">{formatChfCents(b.receivablesCents)}</span>
                                  : <span className="text-slate-400">—</span>}
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                          className={cn("w-4 h-4 transition-transform duration-200", buildingsExpanded ? "rotate-180" : "")}
                        >
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                        {buildingsExpanded ? "Show less" : `Show all ${p.buildings.length} buildings`}
                      </div>
                    )}
                  </Panel>
                </Section>
              )}
            </TabsContent>

            {/* ── Invoices ── */}
            <TabsContent value="invoices">
              <InvoicesContent />
            </TabsContent>

            {/* ── Billing Entities ── */}
            <TabsContent value="billing-entities">
              <BillingEntityManager />
            </TabsContent>

            {/* ── Accounting ── */}
            <TabsContent value="accounting">
              <Panel>
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-600">
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
            </TabsContent>

            {/* ── Renovation & Tax ── */}
            <TabsContent value="renovation-tax">
              <RenovationTaxPlanning />
            </TabsContent>

            {/* ── Setup ── */}
            <TabsContent value="setup">
              <Panel>
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-slate-600">
                    Finance configuration options will appear here as they become available.
                  </p>
                  <p className="text-xs text-slate-400">
                    Coming soon: default payment terms, VAT presets, currency settings, and invoice templates.
                  </p>
                </div>
              </Panel>
            </TabsContent>
          </Tabs>

        </PageContent>
      </PageShell>
    </AppShell>
  );
}
