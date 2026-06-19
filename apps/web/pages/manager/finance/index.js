import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import SortableHeader from "../../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../../lib/tableUtils";
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
import ImportedStatementsPanel from "../../../components/ImportedStatementsPanel";
import BillingEntityManager from "../../../components/BillingEntityManager";
import { CapExSummaryBridge } from "../../../components/RenovationTaxPlanning";
import CashflowPlansList from "../../../components/CashflowPlansList";
import NOITrendPanel from "../../../components/NOITrendPanel";
import CapexSchedulePanel from "../../../components/CapexSchedulePanel";
import NPVScenariosPanel from "../../../components/NPVScenariosPanel";
import RenovationSimulatorDrawer from "../../../components/RenovationSimulatorDrawer";
import { cn } from "../../../lib/utils";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, DateField } from "../../../components/ui/FilterPanel";
import ScrollableTabs from "../../../components/mobile/ScrollableTabs";
import KpiInlineGrid from "../../../components/ui/KpiInlineGrid";
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

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
    "text-foreground";
  return (
    // mb-0 cancels the built-in mb-4 from .card so it plays nice inside grid gap
    <div className="card mb-0 flex flex-col gap-1">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
      <span className={cn("text-xl font-bold", accentClass)}>{value}</span>
      {sub && <span className="text-xs text-foreground-dim">{sub}</span>}
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

// ─── Renovation Opportunities Section ────────────────────────────────────────

const REC_STYLE = {
  REPLACE:          { badge: "bg-red-100 text-red-700",    label: "Replace" },
  PLAN_REPLACEMENT: { badge: "bg-orange-100 text-orange-700", label: "Plan Replacement" },
  MONITOR:          { badge: "bg-amber-100 text-amber-700", label: "Monitor" },
  REPAIR:           { badge: "bg-green-100 text-green-700", label: "Repair" },
};

const COND_STYLE = {
  GOOD:    "bg-green-100 text-green-700",
  FAIR:    "bg-amber-100 text-amber-700",
  POOR:    "bg-orange-100 text-orange-700",
  DAMAGED: "bg-red-100 text-red-700",
};

function DepBar({ pct }) {
  const capped = Math.min(100, pct ?? 0);
  const color = capped >= 100 ? "bg-red-500" : capped >= 85 ? "bg-orange-400" : capped >= 65 ? "bg-amber-400" : "bg-green-400";
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-surface-hover overflow-hidden min-w-[40px]">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${capped}%` }} />
      </div>
      <span className="text-xs tabular-nums text-foreground-dim w-7 text-right shrink-0">{pct ?? "—"}%</span>
    </div>
  );
}

function RenovationOpportunitiesSection({ buildingId }) {
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [simItems,    setSimItems]    = useState(null); // null = closed

  useEffect(() => {
    setSelectedIds(new Set());
    if (!buildingId) { setItems([]); return; }
    setLoading(true); setErr("");
    fetch(`/api/buildings/${buildingId}/renovation-opportunities`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d?.data) setItems(d.data); else throw new Error(d?.error?.message || "Failed"); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [buildingId]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const openSim = useCallback((bundle) => { setSimItems(bundle); }, []);
  const closeSim = useCallback(() => { setSimItems(null); }, []);

  const selectedCount = selectedIds.size;
  const selectedBundle = items.filter((i) => selectedIds.has(i.assetId));

  if (!buildingId) return (
    <div className="rounded-2xl border border-surface-border bg-surface p-6 text-center">
      <p className="text-sm text-foreground-dim">Select a building above to see renovation opportunities.</p>
    </div>
  );
  if (loading) return <div className="rounded-2xl border border-surface-border bg-surface p-6 text-center text-sm text-foreground-dim">Analysing assets…</div>;
  if (err)     return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>;
  if (items.length === 0) return (
    <div className="rounded-2xl border border-surface-border bg-surface p-6 text-center">
      <p className="text-sm text-foreground-dim">No at-risk assets found for this building. All assets are in good repair.</p>
    </div>
  );

  return (
    <>
      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
          <p className="text-sm font-medium text-blue-900">{selectedCount} asset{selectedCount !== 1 ? "s" : ""} selected</p>
          <button
            onClick={() => openSim(selectedBundle)}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            Simulate {selectedCount} asset{selectedCount !== 1 ? "s" : ""} →
          </button>
        </div>
      )}

      {/* Asset list */}
      <div className="space-y-2">
        {items.map((item) => {
          const rec = REC_STYLE[item.recommendation] ?? REC_STYLE.REPAIR;
          const condCls = item.lastConditionStatus ? COND_STYLE[item.lastConditionStatus] : null;
          const isSelected = selectedIds.has(item.assetId);
          return (
            <div key={item.assetId}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                isSelected ? "border-blue-400 bg-blue-50" : "border-surface-border bg-surface hover:bg-surface-subtle"
              )}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(item.assetId)}
                className="h-4 w-4 shrink-0 rounded border-surface-border accent-slate-800 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />
              {/* Name + unit */}
              <div className="flex-1 min-w-[120px]">
                <p className="text-sm font-medium text-foreground truncate">{item.assetName}</p>
                <p className="text-xs text-foreground-dim">{item.topic} · Unit {item.unitNumber}</p>
              </div>
              {/* Depreciation bar */}
              <div className="w-24 shrink-0">
                <DepBar pct={item.depreciationPct} />
              </div>
              {/* Badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", rec.badge)}>{rec.label}</span>
                {condCls && (
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", condCls)}>
                    {item.lastConditionStatus.charAt(0) + item.lastConditionStatus.slice(1).toLowerCase()}
                  </span>
                )}
              </div>
              {/* Rent */}
              {item.currentLease && (
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-xs font-medium text-foreground">CHF {item.currentLease.netRentChf}/mo</p>
                  <p className="text-xs text-foreground-dim truncate max-w-[90px]">{item.currentLease.tenantName}</p>
                </div>
              )}
              {/* Single simulate */}
              <button
                onClick={() => openSim([item])}
                className="shrink-0 rounded-lg border border-surface-border px-2.5 py-1 text-xs font-medium text-foreground-dim hover:bg-surface-hover hover:text-foreground transition-colors"
              >
                Simulate →
              </button>
            </div>
          );
        })}
      </div>

      {simItems && (
        <RenovationSimulatorDrawer items={simItems} onClose={closeSim} />
      )}
    </>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const FINANCE_TABS = [
  { key: "overview" },
  { key: "invoices" },
  { key: "imports" },
  { key: "billing-entities" },
  { key: "accounting" },
  { key: "planning" },
  { key: "setup" },
];

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ManagerFinanceHome() {
  const { t } = useTranslation("manager");
  const router = useRouter();
const tabKeys = FINANCE_TABS.map((t) => t.key);
  const activeTabKey = router.isReady && tabKeys.includes(router.query.tab) ? router.query.tab : "overview";
  const setActiveTabKey = useCallback((key) => {
    router.push({ pathname: router.pathname, query: { ...router.query, tab: key } }, undefined, { shallow: true });
  }, [router]);

  const [planningBuildingId, setPlanningBuildingId] = useState("");
  const [range, setRange] = useState(defaultRange);
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

  const { sortField: bSortField, sortDir: bSortDir, handleSort: handleBuildingSort } = useLocalSort("name", "asc");
  const sortedBuildings = useMemo(() => {
    const buildings = portfolio?.buildings ?? [];
    return clientSort(buildings, bSortField, bSortDir, (b, f) => {
      if (f === "name") return (b.buildingName || "").toLowerCase();
      if (f === "net") return b.netIncomeCents ?? 0;
      if (f === "collection") return b.collectionRate ?? 0;
      if (f === "receivables") return b.receivablesCents ?? 0;
      if (f === "earned") return b.earnedIncomeCents ?? 0;
      if (f === "expenses") return b.expensesTotalCents ?? 0;
      return "";
    });
  }, [portfolio, bSortField, bSortDir]);

  const p = portfolio;
  const netAccent = p ? (p.totalNetIncomeCents > 0 ? "green" : p.totalNetIncomeCents < 0 ? "red" : "") : "";

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={t("manager:financeIndex.title.finances")}

        />
        <PageContent>

          {/*
            Tab navigation — strip + count are one PageContent child so
            space-y-6 fires once between nav and content, not twice.
          */}
          <div>
            <ScrollableTabs activeIndex={FINANCE_TABS.findIndex((t) => t.key === activeTabKey)}>
              {FINANCE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTabKey(tab.key)}
                  className={activeTabKey === tab.key ? "tab-btn-active" : "tab-btn"}
                >
                  {t(`manager:financeIndex.tabs.${tab.key.toLowerCase()}`)}
                </button>
              ))}
            </ScrollableTabs>
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
                <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={0} label={t("manager:financeIndex.title.dateRange")} />
                {filterOpen && (
                  <FilterPanelBody>
                    <FilterSection title={t("manager:financeIndex.title.dateRange")} first>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <DateField label={t("manager:financeIndex.prop.from")} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                        <DateField label={t("manager:financeIndex.prop.to")} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                      </div>
                    </FilterSection>
                    <FilterSectionClear
                      hasFilter={range.from !== defaultRange().from || range.to !== defaultRange().to}
                      onClear={() => setRange(defaultRange())}
                    />
                  </FilterPanelBody>
                )}
              </div>

              {portfolioError && <div className="notice notice-err">{portfolioError}</div>}

              {portfolioLoading && !p ? (
                <p className="loading-text">{t("manager:financeIndex.text.loadingPortfolioSummary")}</p>
              ) : p && (
                <>
                  <Section>
                    {/* Mobile: compact inline grid */}
                    <div className="sm:hidden mb-3">
                      <KpiInlineGrid
                        items={[
                          { label: "Earned Income",  value: formatChfCents(p.totalEarnedIncomeCents), tone: "good" },
                          { label: "Total Expenses", value: formatChfCents(p.totalExpensesCents) },
                          { label: "Net Result",     value: formatChfCents(p.totalNetIncomeCents), tone: p.totalNetIncomeCents >= 0 ? "good" : "warn" },
                          { label: "Receivables",    value: formatChfCents(p.totalReceivablesCents), tone: p.totalReceivablesCents > 0 ? "warn" : undefined },
                          { label: "Payables",       value: formatChfCents(p.totalPayablesCents), tone: p.totalPayablesCents > 0 ? "warn" : undefined },
                        ]}
                      />
                    </div>
                    {/* Desktop: card grid */}
                    <div className="hidden sm:grid grid-cols-2 md:grid-cols-5 gap-3">
                      <SummaryCard label={t("manager:financeIndex.prop.earnedIncome")}  value={formatChfCents(p.totalEarnedIncomeCents)} accent="green" />
                      <SummaryCard label={t("manager:financeIndex.prop.totalExpenses")} value={formatChfCents(p.totalExpensesCents)} />
                      <SummaryCard label={t("manager:financeIndex.prop.netResult")}     value={formatChfCents(p.totalNetIncomeCents)} accent={netAccent} sub="Income − Expenses" />
                      <SummaryCard label={t("manager:financeIndex.prop.receivables")}    value={formatChfCents(p.totalReceivablesCents)} accent={p.totalReceivablesCents > 0 ? "amber" : ""} sub="Unpaid rent invoices" />
                      <SummaryCard label={t("manager:financeIndex.prop.payables")}       value={formatChfCents(p.totalPayablesCents)} accent={p.totalPayablesCents > 0 ? "amber" : ""} sub="Unpaid supplier invoices" />
                    </div>
                  </Section>

                  <Section title={t("manager:financeIndex.title.buildings")}>
                    {/* Stats row */}
                    <div className="flex gap-4 text-xs text-muted">
                      <span>{t("manager:financeIndex.text.avgCollectionRate")} <strong>{formatPercent(p.avgCollectionRate)}</strong></span>
                      {p.buildingsInRed > 0 && (
                        <span className="text-destructive-text font-medium">
                          {p.buildingsInRed} building{p.buildingsInRed !== 1 ? "s" : ""} need attention
                        </span>
                      )}
                    </div>
                    <div>
                      {p.buildings.length === 0 ? (
                        <div className="empty-state">
                          <p className="empty-state-text">{t("manager:financeIndex.text.noBuildingsInThisPortfolioYet")}</p>
                        </div>
                      ) : (
                        <>
                          {/* Mobile card list — md:hidden (financial table needs more width) */}
                          <div className="md:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                            {(buildingsExpanded ? sortedBuildings : sortedBuildings.slice(0, 5)).map((b) => (
                              <div
                                key={b.buildingId}
                                className="table-card cursor-pointer hover:bg-surface-subtle/80 transition-colors"
                                onClick={() => router.push(`/manager/buildings/${b.buildingId}/financials`)}
                              >
                                <div className="flex items-center gap-2">
                                  <HealthDot health={b.health} />
                                  <span className="table-card-head">{b.buildingName}</span>
                                </div>
                                <div className="table-card-footer">
                                  <span className={cn("font-medium font-mono", b.netIncomeCents >= 0 ? "text-success-text" : "text-destructive-text")}>
                                    Net {formatChfCents(b.netIncomeCents)}
                                  </span>
                                  <span>Collection {formatPercent(b.collectionRate)}</span>
                                  {b.receivablesCents > 0 && (
                                    <span className="text-amber-700">{formatChfCents(b.receivablesCents)} recv.</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Wide table — hidden md:block */}
                          <div className="hidden md:block overflow-hidden rounded-lg border border-table-border">
                          <div className="overflow-x-auto">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <SortableHeader label={t("manager:financeIndex.prop.building")} field="name" sortField={bSortField} sortDir={bSortDir} onSort={handleBuildingSort} />
                                  <SortableHeader label={t("manager:financeIndex.prop.earnedIncome")} field="earned" sortField={bSortField} sortDir={bSortDir} onSort={handleBuildingSort} className="text-right" />
                                  <SortableHeader label={t("manager:financeIndex.prop.expenses")} field="expenses" sortField={bSortField} sortDir={bSortDir} onSort={handleBuildingSort} className="text-right" />
                                  <SortableHeader label={t("manager:financeIndex.prop.net")} field="net" sortField={bSortField} sortDir={bSortDir} onSort={handleBuildingSort} className="text-right" />
                                  <SortableHeader label={t("manager:financeIndex.prop.collection")} field="collection" sortField={bSortField} sortDir={bSortDir} onSort={handleBuildingSort} className="text-right" />
                                  <SortableHeader label={t("manager:financeIndex.prop.receivables")} field="receivables" sortField={bSortField} sortDir={bSortDir} onSort={handleBuildingSort} className="text-right" />
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {(buildingsExpanded ? sortedBuildings : sortedBuildings.slice(0, 5)).map((b) => (
                                  <tr key={b.buildingId} className="cursor-pointer hover:bg-surface-subtle/80" onClick={() => router.push(`/manager/buildings/${b.buildingId}/financials`)}>
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
                                        : <span className="text-foreground-dim">—</span>}
                                    </td>
                                    <td className="text-right">
                                      <button
                                        aria-label={t("manager:financeIndex.ariaLabel.viewBuildingFinancials")}
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
                    </div>
                  </Section>
                </>
              )}
            </div>
          )}

          {/* ── Invoices ── */}
          {activeTabKey === "invoices" && <InvoicesContent />}

          {/* ── Imports ── */}
          {activeTabKey === "imports" && <ImportedStatementsPanel />}

          {/* ── Billing Entities ── */}
          {activeTabKey === "billing-entities" && <BillingEntityManager />}

          {/* ── Accounting ── */}
          {activeTabKey === "accounting" && (
            <Panel>
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-text">
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <NOITrendPanel onBuildingChange={setPlanningBuildingId} />
                <CapexSchedulePanel buildingId={planningBuildingId} />
              </div>
              <NPVScenariosPanel buildingId={planningBuildingId} />
              <CapExSummaryBridge />
              <CashflowPlansList />
              {/* ── Renovation Simulator ── */}
              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Renovation Opportunities</h3>
                  <p className="text-xs text-foreground-dim mt-0.5">
                    Assets at risk of end-of-life or flagged in condition reports. Click any row to run an NPV simulation.
                  </p>
                </div>
                <RenovationOpportunitiesSection buildingId={planningBuildingId} />
              </div>
            </div>
          )}

          {/* ── Setup ── */}
          {activeTabKey === "setup" && (
            <Panel>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-text">
                  Finance configuration options will appear here as they become available.
                </p>
                <p className="text-xs text-foreground-dim">
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

export const getStaticProps = withTranslations(["common","manager"]);
