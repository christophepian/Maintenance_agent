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
    : "text-slate-900";
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={cn("text-xl font-bold", cls)}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
      {rag && (
        <span className="text-xs font-medium text-slate-600 mt-0.5">{rag.dot} {rag.label}</span>
      )}
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
                <p className="text-xs text-slate-400 mt-2">
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
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 gap-0.5 mt-4 mb-6 flex-wrap">
              {TAB_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={[
                    "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                    activeTab === key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
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
                  <div className="mt-3 mb-1 pt-3 border-t border-slate-200">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t("buildingFinancials.kpi.projectedBreakdown")}</span>
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
                  <div className="mt-3 mb-1 pt-3 border-t border-slate-200">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t("buildingFinancials.kpi.performance")}</span>
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
            <>
              <Section title={t("buildingFinancials.section.expensesByCategory")}>
                <Panel bodyClassName="p-0">
                  {d.expensesByCategory.length === 0 ? (
                    <div className="empty-state">
                      <p className="empty-state-text">{t("buildingFinancials.expenses.noExpenses")}</p>
                    </div>
                  ) : (
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>{t("buildingFinancials.col.category")}</th>
                          <th className="text-right">{t("buildingFinancials.col.amount")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.expensesByCategory.map((row) => (
                          <tr key={row.category}>
                            <td className="cell-bold">{t(`buildingFinancials.category.${row.category}`, { defaultValue: row.category })}</td>
                            <td className="text-right font-mono">{formatChfCents(row.totalCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 font-semibold">
                          <td>{t("buildingFinancials.col.total")}</td>
                          <td className="text-right font-mono">{formatChfCents(d.expensesTotalCents)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </Panel>
              </Section>

              {d.expensesByAccount && d.expensesByAccount.length > 0 && (
                <Section title={t("buildingFinancials.section.expensesByAccount")}>
                  <Panel bodyClassName="p-0">
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>{t("buildingFinancials.col.code")}</th>
                          <th>{t("buildingFinancials.col.account")}</th>
                          <th className="text-right">{t("buildingFinancials.col.amount")}</th>
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
                <Section title={t("buildingFinancials.section.expensesByContractor")}>
                  <Panel bodyClassName="p-0">
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>{t("buildingFinancials.col.contractor")}</th>
                          <th className="text-right">{t("buildingFinancials.col.total")}</th>
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
            <Section title={t("buildingFinancials.section.outstandingBalances")}>
              <p className="text-xs text-slate-500 mb-3">
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
              <p className="text-xs text-slate-500 mb-4">
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
