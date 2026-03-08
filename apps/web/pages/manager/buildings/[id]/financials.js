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

/* ─── Helpers ─── */

/** Format ISO date string as DD.MM.YYYY for display */
function displayDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** Get default date range: first day of current year → today (ISO strings) */
function defaultRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-01-01`;
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

/* ─── Category display labels ─── */
const CATEGORY_LABELS = {
  MAINTENANCE: "Maintenance",
  UTILITIES: "Utilities",
  CLEANING: "Cleaning",
  INSURANCE: "Insurance",
  TAX: "Tax",
  ADMIN: "Administration",
  CAPEX: "Capital Expenditure",
  OTHER: "Other",
};

/* ─── KPI Card ─── */
function KpiCard({ label, value, subtitle }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-gray-900">{value}</span>
      {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
    </div>
  );
}

/* ─── Main Page ─── */
export default function BuildingFinancialsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [range, setRange] = useState(defaultRange);

  const fetchFinancials = useCallback(
    async (forceRefresh = false) => {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ from: range.from, to: range.to });
        if (forceRefresh) params.set("forceRefresh", "true");
        const res = await fetch(`/api/buildings/${id}/financials?${params}`, {
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

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  /* ─── KPI definitions ─── */
  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Earned Income", value: formatChfCents(data.earnedIncomeCents) },
      { label: "Projected Income", value: formatChfCents(data.projectedIncomeCents) },
      { label: "Total Expenses", value: formatChfCents(data.expensesTotalCents) },
      { label: "Maintenance", value: formatChfCents(data.maintenanceTotalCents) },
      { label: "Operating", value: formatChfCents(data.operatingTotalCents) },
      { label: "Capex", value: formatChfCents(data.capexTotalCents) },
      { label: "Net Operating Income", value: formatChfCents(data.netOperatingIncomeCents) },
      { label: "Collection Rate", value: formatPercent(data.collectionRate) },
    ];
  }, [data]);

  /* ─── Loading state ─── */
  if (!id) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageHeader title="Building Financials" />
          <PageContent><p>Loading...</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title={data ? `${data.buildingName} — Financials` : "Building Financials"} />
        <PageContent>
          <Link href="/admin-inventory/buildings" className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to buildings
          </Link>
          {/* ─── Controls ─── */}
          <Panel>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">From</label>
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">To</label>
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <button
                onClick={() => fetchFinancials(false)}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => fetchFinancials(true)}
                className="bg-gray-100 text-gray-700 text-sm font-medium px-4 py-1.5 rounded border border-gray-300 hover:bg-gray-200 transition-colors"
                title="Re-compute snapshots from source data"
              >
                ↻ Refresh
              </button>
            </div>
            {data && (
              <p className="text-xs text-gray-400 mt-2">
                Period: {displayDate(data.from)} – {displayDate(data.to)} · {data.activeUnitsCount} active unit{data.activeUnitsCount !== 1 ? "s" : ""}
              </p>
            )}
          </Panel>

          {/* ─── Error ─── */}
          {error && (
            <Panel>
              <p className="text-red-600 font-medium">Error: {error}</p>
            </Panel>
          )}

          {/* ─── Loading ─── */}
          {loading && !data && <p className="text-gray-500 mt-4">Loading financials…</p>}

          {/* ─── KPI Cards ─── */}
          {data && (
            <>
              <Section title="Key Performance Indicators">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {kpis.map((kpi) => (
                    <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <KpiCard
                    label="Net Income"
                    value={formatChfCents(data.netIncomeCents)}
                    subtitle="Income − All Expenses"
                  />
                  <KpiCard
                    label="Maintenance Ratio"
                    value={formatPercent(data.maintenanceRatio)}
                    subtitle="Maintenance ÷ Income"
                  />
                  <KpiCard
                    label="Cost per Unit"
                    value={formatChfCents(data.costPerUnitCents)}
                    subtitle={`${data.activeUnitsCount} active unit${data.activeUnitsCount !== 1 ? "s" : ""}`}
                  />
                </div>
              </Section>

              {/* ─── Expenses by Category ─── */}
              <Section title="Expenses by Category">
                <Panel>
                  {data.expensesByCategory.length === 0 ? (
                    <p className="text-gray-400 text-sm">No categorised expenses in this period.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="py-2 font-medium text-gray-600">Category</th>
                          <th className="py-2 font-medium text-gray-600 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.expensesByCategory.map((row) => (
                          <tr key={row.category} className="border-b border-gray-100">
                            <td className="py-2 text-gray-800">
                              {CATEGORY_LABELS[row.category] || row.category}
                            </td>
                            <td className="py-2 text-gray-800 text-right font-mono">
                              {formatChfCents(row.totalCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
              </Section>

              {/* ─── Top Contractors by Spend ─── */}
              <Section title="Top Contractors by Spend">
                <Panel>
                  {data.topContractorsBySpend.length === 0 ? (
                    <p className="text-gray-400 text-sm">No contractor expenses in this period.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="py-2 font-medium text-gray-600">Contractor</th>
                          <th className="py-2 font-medium text-gray-600 text-right">Total Spend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topContractorsBySpend.map((row) => (
                          <tr key={row.contractorId} className="border-b border-gray-100">
                            <td className="py-2 text-gray-800">{row.contractorName}</td>
                            <td className="py-2 text-gray-800 text-right font-mono">
                              {formatChfCents(row.totalCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
              </Section>
            </>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
