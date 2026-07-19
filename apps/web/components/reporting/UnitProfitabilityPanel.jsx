/**
 * UnitProfitabilityPanel — building profitability, broken down by unit
 * (Reporting → "Profitability" sub-tab).
 *
 * Header: building value computed bottom-up (Σ unit intrinsic), reconciled against
 * the stored PPE / market appraisals, plus building net yield and NAV. Table:
 * per-unit fully-loaded annualised NOI, intrinsic value, % of building value, and
 * yield-on-intrinsic — ranked by yield, low-yield/high-value units flagged as
 * sell / PPE candidates. Dual render so it never scrolls the page horizontally.
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

function SellFlag({ t }) {
  return (
    <span className="rounded-full bg-orange-light px-2 py-0.5 text-xs font-semibold text-orange-text">
      {t("buildingsId.reporting.unitProfit.sellCandidate")}
    </span>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim">{label}</p>
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-foreground-dim">{sub}</p>}
    </div>
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
  const buildingValue = data?.buildingIntrinsicValueChf;

  // Reconciliation deltas vs the bottom-up value.
  const recon = (appraisal) =>
    buildingValue && appraisal != null
      ? `${appraisal >= buildingValue ? "+" : ""}${(((appraisal - buildingValue) / buildingValue) * 100).toFixed(1)}%`
      : null;

  return (
    <div className="p-4 sm:p-5">
      {/* Building header */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">{t("buildingsId.reporting.unitProfit.title")}</h3>
        <p className="text-xs text-foreground-dim">{t("buildingsId.reporting.unitProfit.subtitle")}</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-surface-border bg-surface-subtle p-4">
        <Stat
          label={t("buildingsId.reporting.unitProfit.buildingValue")}
          value={chf(buildingValue)}
          sub={t("buildingsId.reporting.unitProfit.buildingValueSub")}
        />
        <Stat label={t("buildingsId.reporting.unitProfit.buildingYield")} value={pct(data?.buildingNetYieldPct)} />
        <Stat
          label={t("buildingsId.reporting.unitProfit.ppeEstimate")}
          value={chf(data?.ppeEstimateChf)}
          sub={recon(data?.ppeEstimateChf) ? t("buildingsId.reporting.unitProfit.vsBottomUp", { delta: recon(data?.ppeEstimateChf) }) : undefined}
        />
        <Stat
          label={t("buildingsId.reporting.unitProfit.marketValue")}
          value={chf(data?.marketValueChf)}
          sub={recon(data?.marketValueChf) ? t("buildingsId.reporting.unitProfit.vsBottomUp", { delta: recon(data?.marketValueChf) }) : undefined}
        />
        {data?.navChf != null && (
          <Stat
            label={t("buildingsId.reporting.unitProfit.nav")}
            value={chf(data.navChf)}
            sub={t("buildingsId.reporting.unitProfit.navSub")}
          />
        )}
      </div>

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
                  <div><span className="text-foreground-dim">{t("buildingsId.reporting.unitProfit.yieldIntrinsic")}: </span><span className="font-semibold tabular-nums">{pct(r.netYieldOnIntrinsicPct)}</span></div>
                  <div><span className="text-foreground-dim">{t("buildingsId.reporting.unitProfit.intrinsicValue")}: </span><span className="tabular-nums">{chf(r.intrinsicValueChf)}</span></div>
                  <div><span className="text-foreground-dim">{t("buildingsId.reporting.unitProfit.valueShare")}: </span><span className="tabular-nums">{pct(r.valueSharePct)}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-foreground-dim">
                  <th className="py-2 pr-3 font-semibold">{t("buildingsId.reporting.unitProfit.unit")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("buildingsId.reporting.unitProfit.tenant")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.annualNoi")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.noiShare")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.intrinsicValue")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.valueShare")}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t("buildingsId.reporting.unitProfit.yieldIntrinsic")}</th>
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
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground-dim">{pct(r.valueSharePct)}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums">{pct(r.netYieldOnIntrinsicPct)}</td>
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
