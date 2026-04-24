import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
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
import CashflowPlansList from "../../../components/CashflowPlansList";
import { cn } from "../../../lib/utils";
import { FilterToggle, FilterPanelBody, FilterSection, DateField } from "../../../components/ui/FilterPanel";

// ─── Helpers ────────────────────────────────────────────────────────────────

function defaultRange() {
  const now = new Date();
  return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) };
}

// ─── Summary card ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent }) {
  const accentClass =
    accent === "green" ? "text-success-text" :
    accent === "red"   ? "text-destructive-text" :
    accent === "amber" ? "text-amber-700" :
    "text-slate-900";
  return (
    // mb-0 cancels the built-in mb-4 from .card so it plays nice inside grid gap
    <div className="card mb-0 flex flex-col gap-1">
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
  red:   "bg-red-600",
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
  { key: "overview",         label: "Overview" },
  { key: "invoices",         label: "Invoices" },
  { key: "billing-entities", label: "Billing Entities" },
  { key: "accounting",       label: "Accounting" },
  { key: "planning",         label: "Planning" },
  { key: "renovation-tax",   label: "Renovation Guide" },
  { key: "setup",            label: "Setup" },
];

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ManagerFinanceHome() {
  const router = useRouter();
  const planListRef = useRef(null);

  const tabKeys = FINANCE_TABS.map((t) => t.key);
  const activeTabKey = router.isReady && tabKeys.includes(router.query.tab) ? router.query.tab : "overview";
  const setActiveTabKey = useCallback((key) => {
    router.push({ pathname: router.pathname, query: { ...router.query, tab: key } }, undefined, { shallow: true });
  }, [router]);

  const [range, setRange] = useState(defaultRange);
  const [rangeInput, setRangeInput] = useState(defaultRange);
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState("");
  const [buildingsExpanded, setBuildingsExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

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

  function applyRange() { setRange({ ...rangeInput }); }

  const p = portfolio;
  const netAccent = p ? (p.totalNetIncomeCents > 0 ? "green" : p.totalNetIncomeCents < 0 ? "red" : "") : "";

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Finances"
          actions={
            activeTabKey === "planning" ? (
              <button
                onClick={() => planListRef.current?.openModal()}
                className="button-primary text-sm"
              >
                New plan
              </button>
            ) : undefined
          }
        />
        <PageContent>

          {/*
            Tab navigation — strip + count are one PageContent child so
            space-y-6 fires once between nav and content, not twice.
          */}
          <div>
            <div className="tab-strip">
              {FINANCE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTabKey(tab.key)}
                  className={activeTabKey === tab.key ? "tab-btn-active" : "tab-btn"}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTabKey === "overview" && p && (
              <span className="tab-panel-count">
                {p.buildingCount} building{p.buildingCount !== 1 ? "s" : ""} · {p.totalActiveUnits} unit{p.totalActiveUnits !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* ── Overview ── */}
          {activeTabKey === "overview" && (
            // space-y-6 spaces: filter panel → error/loading → portfolio section → buildings section
            <div className="space-y-6">
              <div>
                <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={0} label="Date range" />
                {filterOpen && (
                  <FilterPanelBody>
                    <FilterSection title="Date range" first>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <DateField label="From" value={rangeInput.from} onChange={(e) => setRangeInput((r) => ({ ...r, from: e.target.value }))} />
                        <DateField label="To" value={rangeInput.to} onChange={(e) => setRangeInput((r) => ({ ...r, to: e.target.value }))} />
                        <div className="flex items-end">
                          <button onClick={() => { applyRange(); setFilterOpen(false); }} className="button-primary text-sm h-9 px-4">
                            Apply
                          </button>
                        </div>
                      </div>
                    </FilterSection>
                  </FilterPanelBody>
                )}
              </div>

              {portfolioError && <div className="notice notice-err">{portfolioError}</div>}

              {portfolioLoading && !p ? (
                <p className="loading-text">Loading portfolio summary…</p>
              ) : p && (
                <>
                  <Section title="Portfolio Overview">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <SummaryCard label="Earned Income"  value={formatChfCents(p.totalEarnedIncomeCents)} accent="green" />
                      <SummaryCard label="Total Expenses" value={formatChfCents(p.totalExpensesCents)} />
                      <SummaryCard label="Net Result"     value={formatChfCents(p.totalNetIncomeCents)} accent={netAccent} sub="Income − Expenses" />
                      <SummaryCard label="Receivables"    value={formatChfCents(p.totalReceivablesCents)} accent={p.totalReceivablesCents > 0 ? "amber" : ""} sub="Unpaid rent invoices" />
                      <SummaryCard label="Payables"       value={formatChfCents(p.totalPayablesCents)} accent={p.totalPayablesCents > 0 ? "amber" : ""} sub="Unpaid supplier invoices" />
                    </div>
                    {/* Stats row — no mt-* here; Section's space-y-3 handles the gap */}
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>Avg collection rate: <strong>{formatPercent(p.avgCollectionRate)}</strong></span>
                      {p.buildingsInRed > 0 && (
                        <span className="text-destructive-text font-medium">
                          {p.buildingsInRed} building{p.buildingsInRed !== 1 ? "s" : ""} need attention
                        </span>
                      )}
                    </div>
                  </Section>

                  <Section title="Buildings">
                    <Panel bodyClassName="p-0">
                      {p.buildings.length === 0 ? (
                        <div className="empty-state">
                          <p className="empty-state-text">No buildings in this portfolio yet.</p>
                        </div>
                      ) : (
                        <>
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
                                  <tr key={b.buildingId} className="cursor-pointer hover:bg-slate-50/80" onClick={() => router.push(`/manager/buildings/${b.buildingId}/financials`)}>
                                    <td>
                                      <span className="flex items-center gap-2">
                                        <HealthDot health={b.health} />
                                        <span className="cell-bold">{b.buildingName}</span>
                                      </span>
                                    </td>
                                    <td className="text-right font-mono">{formatChfCents(b.earnedIncomeCents)}</td>
                                    <td className="text-right font-mono">{formatChfCents(b.expensesTotalCents)}</td>
                                    <td className={cn("text-right font-mono font-semibold", b.netIncomeCents >= 0 ? "text-success-text" : "text-destructive-text")}>
                                      {formatChfCents(b.netIncomeCents)}
                                    </td>
                                    <td className="text-right">{formatPercent(b.collectionRate)}</td>
                                    <td className="text-right font-mono">
                                      {b.receivablesCents > 0
                                        ? <span className="text-amber-700">{formatChfCents(b.receivablesCents)}</span>
                                        : <span className="text-slate-400">—</span>}
                                    </td>
                                    <td className="text-right">
                                      <button
                                        aria-label="View building financials"
                                        onClick={(e) => { e.stopPropagation(); router.push(`/manager/buildings/${b.buildingId}/financials`); }}
                                        className="icon-btn"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {p.buildings.length > 5 && (
                            <div className="expand-footer" onClick={() => setBuildingsExpanded((v) => !v)}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                                className={cn("w-4 h-4 transition-transform duration-200", buildingsExpanded ? "rotate-180" : "")}
                              >
                                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                              </svg>
                              {buildingsExpanded ? "Show less" : `Show all ${p.buildings.length} buildings`}
                            </div>
                          )}
                        </>
                      )}
                    </Panel>
                  </Section>
                </>
              )}
            </div>
          )}

          {/* ── Invoices ── */}
          {activeTabKey === "invoices" && <InvoicesContent />}

          {/* ── Billing Entities ── */}
          {activeTabKey === "billing-entities" && <BillingEntityManager />}

          {/* ── Accounting ── */}
          {activeTabKey === "accounting" && (
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
          )}

          {/* ── Planning ── */}
          {activeTabKey === "planning" && (
            <Panel bodyClassName="p-0">
              <div className="px-4 py-4">
                <CashflowPlansList ref={planListRef} />
              </div>
            </Panel>
          )}

          {/* ── Renovation & Tax ── */}
          {activeTabKey === "renovation-tax" && <RenovationTaxPlanning />}

          {/* ── Setup ── */}
          {activeTabKey === "setup" && (
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
          )}

        </PageContent>
      </PageShell>
    </AppShell>
  );
}
