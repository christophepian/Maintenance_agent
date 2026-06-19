import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import Panel from "./layout/Panel";
import Section from "./layout/Section";
import { authHeaders } from "../lib/api";
import { formatChfCents, formatPercent } from "../lib/format";
import { cn } from "../lib/utils";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, DateField } from "./ui/FilterPanel";
import KpiInlineGrid from "./ui/KpiInlineGrid";

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



/* ─── Tab keys ─── */
const TAB_KEYS = ["overview", "income", "expenses", "balances", "advanced"];

/* ─── KPI card ─── */

function KpiCard({ label, value, sub, accent, rag }) {
  const cls = accent === "green" ? "text-green-700"
    : accent === "red" ? "text-red-600"
    : accent === "amber" ? "text-amber-700"
    : "text-foreground";
  return (
    <div className="bg-surface rounded-lg border border-surface-border p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
      <span className={cn("text-xl font-bold", cls)}>{value}</span>
      {sub && <span className="text-xs text-foreground-dim">{sub}</span>}
      {rag && (
        <span className="text-xs font-medium text-muted-text mt-0.5">{rag.dot} {rag.label}</span>
      )}
    </div>
  );
}

/* ─── Simple stat row ─── */

function StatRow({ label, value, sub, accent }) {
  const cls = accent === "green" ? "text-green-700"
    : accent === "red" ? "text-red-600"
    : accent === "amber" ? "text-amber-700"
    : "text-foreground";
  return (
    <div className="flex items-center justify-between py-2 border-b border-surface-divider last:border-0">
      <div>
        <span className="text-sm text-muted-dark">{label}</span>
        {sub && <span className="text-xs text-foreground-dim ml-2">{sub}</span>}
      </div>
      <span className={cn("text-sm font-semibold font-mono", cls)}>{value}</span>
    </div>
  );
}

/* ─── Main component ─── */

export default function BuildingFinancialsView({ buildingId, variant = "page" }) {
  const { t } = useTranslation("manager");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [range, setRange] = useState(defaultRange);
  const [filterOpen, setFilterOpen] = useState(false);

  const fetchFinancials = useCallback(
    async (forceRefresh = false) => {
      if (!buildingId) return;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          from: range.from,
          to: range.to,
          groupByAccount: "true",
        });
        if (forceRefresh) params.set("forceRefresh", "true");
        const res = await fetch(`/api/buildings/${buildingId}/financial-summary?${params}`, {
          headers: authHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || t("buildingFinancials.failedToLoad", { defaultValue: "Failed to load financials" }));
        setData(json.data);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    },
    [buildingId, range],
  );

  useEffect(() => { fetchFinancials(); }, [fetchFinancials]);

  const d = data;



  /* ─── Date range controls ─── */
  return (
    <div>
      <div>
        <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={0} label={t("buildingFinancials.dateRange")} />
        {filterOpen && (
          <FilterPanelBody>
            <FilterSection title={t("buildingFinancials.dateRange")} first>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <DateField label={t("buildingFinancials.from")} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                <DateField label={t("buildingFinancials.to")} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                <div className="flex items-end">
                  <button onClick={() => fetchFinancials(true)} className="button-secondary text-sm h-9 px-3" title="Re-compute snapshots from source data">{t("buildingFinancials.refresh")}</button>
                </div>
              </div>
              {d && (
                <p className="text-xs text-foreground-dim mt-2">
                  {displayDate(d.from)} – {displayDate(d.to)} · {t("buildingFinancials.units", { count: d.activeUnitsCount })}
                </p>
              )}
            </FilterSection>
            <FilterSectionClear
              hasFilter={range.from !== defaultRange().from || range.to !== defaultRange().to}
              onClear={() => setRange(defaultRange())}
            />
          </FilterPanelBody>
        )}
      </div>

      {error && <div className="notice notice-err mb-4">{error}</div>}
      {loading && !d && <p className="loading-text">{t("buildingFinancials.loadingFinancials")}</p>}

      {d && (
        <>
          {/* ─── Tab / segmented control ─── */}
          {variant === "embedded" ? (
            <div className="inline-flex rounded-lg border border-surface-border bg-surface-hover p-0.5 gap-0.5 mt-4 mb-6 flex-wrap">
              {TAB_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={[
                    "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                    activeTab === key
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-muted hover:text-muted-dark",
                  ].join(" ")}
                >
                  {t(`buildingFinancials.tabs.${key}`)}
                </button>
              ))}
            </div>
          ) : (
            <div className="tab-strip mt-4">
              {TAB_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={activeTab === key ? "tab-btn-active" : "tab-btn"}
                >
                  {t(`buildingFinancials.tabs.${key}`)}
                </button>
              ))}
            </div>
          )}

          {/* ═══ Overview tab ═══ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <Section>
                {/* Mobile: compact inline grid */}
                <div className="sm:hidden">
                  <KpiInlineGrid
                    items={[
                      { label: t("buildingFinancials.kpi.earnedIncome"),  value: formatChfCents(d.earnedIncomeCents),        tone: "good" },
                      { label: t("buildingFinancials.kpi.totalExpenses"), value: formatChfCents(d.expensesTotalCents) },
                      { label: t("buildingFinancials.kpi.noi"),            value: formatChfCents(d.netOperatingIncomeCents),  tone: d.netOperatingIncomeCents >= 0 ? "good" : "warn" },
                      { label: t("buildingFinancials.kpi.collection"),     value: formatPercent(d.collectionRate),             tone: d.collectionRate >= 0.8 ? "good" : "warn" },
                      { label: t("buildingFinancials.kpi.maintenance"),    value: formatChfCents(d.maintenanceTotalCents) },
                      { label: t("buildingFinancials.kpi.maintRatio"),     value: formatPercent(d.maintenanceRatio),           tone: d.maintenanceRatio > 0.15 ? "warn" : "good" },
                      { label: t("buildingFinancials.kpi.capex"),          value: formatChfCents(d.capexTotalCents) },
                      { label: t("buildingFinancials.kpi.costPerUnit"),    value: formatChfCents(d.costPerUnitCents) },
                      ...(d.receivablesCents > 0 ? [{ label: t("buildingFinancials.kpi.receivables"), value: formatChfCents(d.receivablesCents), tone: "warn" }] : []),
                      ...(d.payablesCents > 0   ? [{ label: t("buildingFinancials.kpi.payables"),     value: formatChfCents(d.payablesCents),    tone: "warn" }] : []),
                    ]}
                  />
                </div>

                {/* Desktop: original KpiCard grids */}
                <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label={t("buildingFinancials.kpi.earnedIncome")} value={formatChfCents(d.earnedIncomeCents)} accent="green" />
                  <KpiCard label={t("buildingFinancials.kpi.totalExpenses")} value={formatChfCents(d.expensesTotalCents)} />
                  <KpiCard
                    label={t("buildingFinancials.kpi.noiLong")}
                    value={formatChfCents(d.netOperatingIncomeCents)}
                    accent={d.netOperatingIncomeCents >= 0 ? "green" : "red"}
                    sub={t("buildingFinancials.kpi.noiOpSub")}
                    rag={d.netOperatingIncomeCents > 0 ? { dot: "🟢", label: t("buildingFinancials.rag.profitable") } : d.netOperatingIncomeCents === 0 ? { dot: "🟡", label: t("buildingFinancials.rag.balanced") } : { dot: "🔴", label: t("buildingFinancials.rag.atRisk") }}
                  />
                  <KpiCard
                    label={t("buildingFinancials.kpi.collectionRate")}
                    value={formatPercent(d.collectionRate)}
                    accent={d.collectionRate >= 0.95 ? "green" : d.collectionRate >= 0.8 ? "amber" : "red"}
                    sub={t("buildingFinancials.kpi.collectionRateSub")}
                    rag={d.projectedIncomeCents === 0 ? { dot: "🟡", label: t("buildingFinancials.rag.noProjection") } : d.collectionRate >= 0.95 ? { dot: "🟢", label: t("buildingFinancials.rag.onTrack") } : d.collectionRate >= 0.8 ? { dot: "🟡", label: t("buildingFinancials.rag.watch") } : { dot: "🔴", label: t("buildingFinancials.rag.overdue") }}
                  />
                </div>
                <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <KpiCard label={t("buildingFinancials.kpi.maintenance")} value={formatChfCents(d.maintenanceTotalCents)} sub={t("buildingFinancials.kpi.maintSub")} />
                  <KpiCard
                    label={t("buildingFinancials.kpi.maintRatio")}
                    value={formatPercent(d.maintenanceRatio)}
                    accent={d.maintenanceRatio > 0.3 ? "red" : d.maintenanceRatio > 0.15 ? "amber" : "green"}
                    sub={t("buildingFinancials.kpi.maintRatioSub")}
                    rag={d.earnedIncomeCents === 0 && d.maintenanceTotalCents === 0 ? { dot: "🟡", label: t("buildingFinancials.rag.noData") } : d.maintenanceRatio <= 0.15 ? { dot: "🟢", label: t("buildingFinancials.rag.healthy") } : d.maintenanceRatio <= 0.3 ? { dot: "🟡", label: t("buildingFinancials.rag.monitor") } : { dot: "🔴", label: t("buildingFinancials.rag.high") }}
                  />
                  <KpiCard label={t("buildingFinancials.kpi.capex")} value={formatChfCents(d.capexTotalCents)} sub={t("buildingFinancials.kpi.capexSub")} />
                  <KpiCard
                    label={t("buildingFinancials.kpi.costPerUnit")}
                    value={formatChfCents(d.costPerUnitCents)}
                    sub={t("buildingFinancials.expenses.activeUnits", { count: d.activeUnitsCount })}
                  />
                </div>
                {(d.receivablesCents > 0 || d.payablesCents > 0) && (
                  <div className="hidden sm:grid grid-cols-2 gap-3 mt-3">
                    {d.receivablesCents > 0 && (
                      <KpiCard
                        label={t("buildingFinancials.kpi.receivables")}
                        value={formatChfCents(d.receivablesCents)}
                        accent="amber"
                        sub={t("buildingFinancials.kpi.unpaidRent")}
                      />
                    )}
                    {d.payablesCents > 0 && (
                      <KpiCard
                        label={t("buildingFinancials.kpi.payables")}
                        value={formatChfCents(d.payablesCents)}
                        accent="amber"
                        sub={t("buildingFinancials.kpi.unpaidSupplier")}
                        rag={{ dot: "🟡", label: t("buildingFinancials.rag.outstanding") }}
                      />
                    )}
                  </div>
                )}
              </Section>

              {d.topContractorsBySpend.length > 0 && (
                <Section title={t("buildingFinancials.section.topExpenseDrivers")}>
                  <Panel bodyClassName="p-0">
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>{t("buildingFinancials.col.contractor")}</th>
                          <th className="text-right">{t("buildingFinancials.col.totalSpend")}</th>
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
            </div>
          )}

          {/* ═══ Income tab ═══ */}
          {activeTab === "income" && (
            <Section title={t("buildingFinancials.section.incomeBreakdown")}>
              <Panel>
                <div className="space-y-0">
                  <StatRow
                    label={t("buildingFinancials.kpi.earnedIncome")}
                    value={formatChfCents(d.earnedIncomeCents)}
                    sub={t("buildingFinancials.kpi.earnedIncomeSub")}
                    accent="green"
                  />
                  <StatRow
                    label={t("buildingFinancials.kpi.projectedIncome")}
                    value={formatChfCents(d.projectedIncomeCents)}
                    sub={t("buildingFinancials.kpi.projectedIncomeSub")}
                  />
                  <div className="mt-3 mb-1 pt-3 border-t border-surface-border">
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("buildingFinancials.kpi.projectedBreakdown")}</span>
                  </div>
                  <StatRow
                    label={t("buildingFinancials.kpi.rentalIncome")}
                    value={formatChfCents(d.rentalIncomeCents)}
                    sub={t("buildingFinancials.kpi.rentalIncomeSub")}
                  />
                  <StatRow
                    label={t("buildingFinancials.kpi.serviceCharges")}
                    value={formatChfCents(d.serviceChargeIncomeCents)}
                    sub={t("buildingFinancials.kpi.serviceChargesSub")}
                  />
                  <div className="mt-3 mb-1 pt-3 border-t border-surface-border">
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("buildingFinancials.kpi.performance")}</span>
                  </div>
                  <StatRow
                    label={t("buildingFinancials.kpi.collectionRate")}
                    value={formatPercent(d.collectionRate)}
                    sub={t("buildingFinancials.kpi.collectionRateSub")}
                    accent={d.collectionRate >= 0.95 ? "green" : d.collectionRate >= 0.8 ? "amber" : "red"}
                  />
                  <StatRow
                    label={t("buildingFinancials.kpi.netIncome")}
                    value={formatChfCents(d.netIncomeCents)}
                    sub={t("buildingFinancials.kpi.netIncomeSub")}
                    accent={d.netIncomeCents >= 0 ? "green" : "red"}
                  />
                  <StatRow
                    label={t("buildingFinancials.kpi.noiLong")}
                    value={formatChfCents(d.netOperatingIncomeCents)}
                    sub={t("buildingFinancials.kpi.noiExclSub")}
                    accent={d.netOperatingIncomeCents >= 0 ? "green" : "red"}
                  />
                </div>
              </Panel>
            </Section>
          )}

          {/* ═══ Expenses tab ═══ */}
          {activeTab === "expenses" && (
            <Section title={t("buildingFinancials.section.expensesByCategory")}>
              <Panel>
                {d.expensesByCategory.length === 0 ? (
                  <p className="text-sm text-muted italic py-2">{t("buildingFinancials.expenses.noExpenses")}</p>
                ) : (
                  <div className="space-y-0">
                    {d.expensesByCategory.map((row) => (
                      <StatRow
                        key={row.category}
                        label={t(`buildingFinancials.category.${row.category}`, { defaultValue: row.category })}
                        value={formatChfCents(row.totalCents)}
                      />
                    ))}

                    {d.expensesByAccount && d.expensesByAccount.length > 0 && (
                      <>
                        <div className="mt-3 mb-1 pt-3 border-t border-surface-border">
                          <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("buildingFinancials.section.expensesByAccount")}</span>
                        </div>
                        {d.expensesByAccount.map((row) => (
                          <StatRow
                            key={row.accountId}
                            label={row.accountName}
                            sub={row.accountCode || undefined}
                            value={formatChfCents(row.totalCents)}
                          />
                        ))}
                      </>
                    )}

                    {d.topContractorsBySpend.length > 0 && (
                      <>
                        <div className="mt-3 mb-1 pt-3 border-t border-surface-border">
                          <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("buildingFinancials.section.expensesByContractor")}</span>
                        </div>
                        {d.topContractorsBySpend.map((row) => (
                          <StatRow
                            key={row.contractorId}
                            label={row.contractorName}
                            value={formatChfCents(row.totalCents)}
                          />
                        ))}
                      </>
                    )}

                    <div className="mt-3 pt-3 border-t-2 border-muted-ring">
                      <StatRow
                        label={t("buildingFinancials.col.total")}
                        value={formatChfCents(d.expensesTotalCents)}
                        accent="red"
                      />
                    </div>
                  </div>
                )}
              </Panel>
            </Section>
          )}

          {/* ═══ Receivables & Payables tab ═══ */}
          {activeTab === "balances" && (
            <Section title={t("buildingFinancials.section.outstandingBalances")}>
              <p className="text-xs text-muted mb-3">
                {t("buildingFinancials.balances.pointInTime")}
              </p>
              <Panel>
                <div className="space-y-0">
                  <StatRow
                    label={t("buildingFinancials.kpi.receivables")}
                    value={d.receivablesCents > 0 ? formatChfCents(d.receivablesCents) : t("buildingFinancials.kpi.noneOutstanding")}
                    sub={t("buildingFinancials.kpi.receivablesSub")}
                    accent={d.receivablesCents > 0 ? "amber" : "green"}
                  />
                  <StatRow
                    label={t("buildingFinancials.kpi.payables")}
                    value={d.payablesCents > 0 ? formatChfCents(d.payablesCents) : t("buildingFinancials.kpi.noneOutstanding")}
                    sub={t("buildingFinancials.kpi.payablesSub")}
                    accent={d.payablesCents > 0 ? "amber" : "green"}
                  />
                </div>
              </Panel>
              {d.receivablesCents === 0 && d.payablesCents === 0 && (
                <p className="text-sm text-green-700 font-medium mt-3">{t("buildingFinancials.balances.allSettled")}</p>
              )}
            </Section>
          )}

          {/* ═══ Advanced tab ═══ */}
          {activeTab === "advanced" && (
            <Section title={t("buildingFinancials.section.advancedAccounting")}>
              <p className="text-xs text-muted mb-4">
                {t("buildingFinancials.advanced.description")}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/manager/finance/ledger" className="button-secondary text-sm">
                  {t("buildingFinancials.advanced.generalLedger")}
                </Link>
                <Link href="/manager/finance/chart-of-accounts" className="button-secondary text-sm">
                  {t("buildingFinancials.advanced.chartOfAccounts")}
                </Link>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
