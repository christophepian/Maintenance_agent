/**
 * UnitProfitabilityPanel — the "which units are most profitable" table for the
 * building Reporting → Unit profitability sub-tab.
 *
 * Fully-loaded (overhead pro-rata by area), annualised, accrual-basis NOI, with
 * yield-on-value against BOTH the intrinsic worksheet and the per-zip market
 * estimate. Ranked by market yield descending; low-yield / high-value units are
 * flagged as sell / PPE candidates (the disposition signal). Dual render (mobile
 * cards + desktop table) so it never scrolls the page horizontally.
 */
import { useTranslation } from "next-i18next";
import { cn } from "../../lib/utils";
import { formatChf, formatChfCents } from "../../lib/format";
import { useDetailResource } from "../../lib/hooks/useDetailResource";

function pct(v) {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}
function chf(v) {
  return v == null ? "—" : formatChf(v);
}

function YieldCell({ value }) {
  return <span className="tabular-nums">{pct(value)}</span>;
}

function SellFlag({ t }) {
  return (
    <span className="rounded-full bg-orange-light px-2 py-0.5 text-xs font-semibold text-orange-text">
      {t("buildingsId.reporting.unitProfit.sellCandidate")}
    </span>
  );
}

export default function UnitProfitabilityPanel({ buildingId, from, to }) {
  const { t } = useTranslation("manager");
  const url = buildingId && from && to
    ? `/api/buildings/${buildingId}/unit-profitability?from=${from}&to=${to}`
    : null;
  const { data, loading, error } = useDetailResource(url);

  if (loading) return <p className="p-5 text-sm text-foreground-dim">{t("common:loading", "Loading…")}</p>;
  if (error) return <p className="p-5 text-sm text-destructive-text" role="alert">{t("buildingsId.reporting.unitProfit.error")}</p>;

  const rows = data?.rows ?? [];
  const avg = data?.avgNetYieldOnMarketPct;
  const noMarket = data?.marketPricePerSqmChf == null;

  return (
    <div className="p-4 sm:p-5">
      {/* Header strip */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("buildingsId.reporting.unitProfit.title")}</h3>
          <p className="text-xs text-foreground-dim">{t("buildingsId.reporting.unitProfit.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-right">
          {avg != null && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.unitProfit.avgYield")}</p>
              <p className="text-lg font-bold tabular-nums text-foreground">{pct(avg)}</p>
            </div>
          )}
          {data?.allocatedOverheadPoolCents != null && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.unitProfit.overheadPool")}</p>
              <p className="text-lg font-bold tabular-nums text-foreground">{formatChfCents(data.allocatedOverheadPoolCents)}</p>
            </div>
          )}
        </div>
      </div>

      {noMarket && (
        <p className="mb-3 rounded-lg bg-warning-light px-3 py-2 text-xs text-warning-text">
          {t("buildingsId.reporting.unitProfit.noMarketPrice")}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-foreground-dim">
          {t("buildingsId.reporting.unitProfit.empty")}
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-2 sm:hidden">
            {rows.map((r) => (
              <div key={r.unitId} className={cn("rounded-xl border p-3", r.sellCandidate ? "border-orange/40 bg-orange-light/30" : "border-surface-border")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t("buildingsId.reporting.unitProfit.unit")} {r.unitNumber}</p>
                    <p className="truncate text-xs text-foreground-dim">{r.tenantName || t("buildingsId.reporting.unitProfit.vacant")}</p>
                  </div>
                  {r.sellCandidate && <SellFlag t={t} />}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-foreground-dim">{t("buildingsId.reporting.unitProfit.annualNoi")}: </span><span className="font-semibold tabular-nums">{formatChfCents(r.annualNoiCents)}</span></div>
                  <div><span className="text-foreground-dim">{t("buildingsId.reporting.unitProfit.yieldMarket")}: </span><span className="font-semibold tabular-nums">{pct(r.netYieldOnMarketPct)}</span></div>
                  <div><span className="text-foreground-dim">{t("buildingsId.reporting.unitProfit.marketValue")}: </span><span className="tabular-nums">{chf(r.marketValueChf)}</span></div>
                  <div><span className="text-foreground-dim">{t("buildingsId.reporting.unitProfit.yieldIntrinsic")}: </span><span className="tabular-nums">{pct(r.netYieldOnIntrinsicPct)}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-foreground-dim">
                  <th className="py-2 pr-3 font-semibold">{t("buildingsId.reporting.unitProfit.unit")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("buildingsId.reporting.unitProfit.tenant")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.annualNoi")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.noiShare")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.intrinsicValue")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.yieldIntrinsic")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.marketValue")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.yieldMarket")}</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.unitId} className={cn("border-b border-surface-divider last:border-0", r.sellCandidate && "bg-orange-light/25")}>
                    <td className="py-2 pr-3 font-medium text-foreground">{r.unitNumber}</td>
                    <td className="py-2 pr-3 text-foreground-dim">{r.tenantName || <span className="italic">{t("buildingsId.reporting.unitProfit.vacant")}</span>}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums">{formatChfCents(r.annualNoiCents)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground-dim">{pct(r.noiContributionPct)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{chf(r.intrinsicValueChf)}</td>
                    <td className="py-2 pr-3 text-right"><YieldCell value={r.netYieldOnIntrinsicPct} /></td>
                    <td className="py-2 pr-3 text-right tabular-nums">{chf(r.marketValueChf)}</td>
                    <td className="py-2 pr-3 text-right font-semibold"><YieldCell value={r.netYieldOnMarketPct} /></td>
                    <td className="py-2 text-right">{r.sellCandidate && <SellFlag t={t} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-foreground-dim">{t("buildingsId.reporting.unitProfit.footnote")}</p>
        </>
      )}
    </div>
  );
}
