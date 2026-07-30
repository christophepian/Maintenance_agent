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
import { SWISS_RESIDENTIAL_NET_YIELD, classifyNetYield, yieldTrackPosition } from "../../lib/benchmarks/swissRentalYield";

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

// The net-yield track: this building's marker against the shaded Swiss residential
// "typical" band, plus a methodology disclosure. Rendered inline under the yield
// figure (no card of its own) — the verdict now shows as a chip beside the number.
function YieldTrack({ yieldPct, t }) {
  const b = SWISS_RESIDENTIAL_NET_YIELD;
  if (classifyNetYield(yieldPct) == null) return null;
  const markerLeft = yieldTrackPosition(yieldPct) * 100;
  const bandLeft = yieldTrackPosition(b.lowPct) * 100;
  const bandRight = yieldTrackPosition(b.highPct) * 100;
  return (
    <div>
      <div className="relative h-2 rounded-full bg-surface-hover">
        {/* national "typical" band */}
        <div className="absolute inset-y-0 rounded-full bg-success-light" style={{ left: `${bandLeft}%`, width: `${Math.max(0, bandRight - bandLeft)}%` /* no-token: benchmark band extent */ }} />
        {/* this building */}
        <div className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-foreground" style={{ left: `${markerLeft}%` /* no-token: dynamic marker position */ }} title={`${yieldPct.toFixed(1)}%`} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-foreground-dim">
        <span>{b.regionalLowPct}%</span>
        <span>{t("buildingsId.reporting.unitProfit.benchmark.typical", { low: b.lowPct, high: b.highPct })}</span>
        <span>{b.regionalHighPct}%</span>
      </div>
      <details className="mt-2 text-[11px] text-foreground-dim">
        <summary className="cursor-pointer select-none hover:text-foreground">{t("buildingsId.reporting.unitProfit.benchmark.methodology")}</summary>
        <p className="mt-1">{t("buildingsId.reporting.unitProfit.benchmark.basisNote")}</p>
        <p className="mt-1">
          {t("buildingsId.reporting.unitProfit.benchmark.sources")}:{" "}
          {b.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 ? " · " : ""}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand no-underline hover:underline">{s.name}</a>
            </span>
          ))}
        </p>
      </details>
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
  const yieldPct = data?.buildingNetYieldPct ?? null;
  const verdict = yieldPct != null ? classifyNetYield(yieldPct) : null; // below | inRange | above | null
  const hasBridge = data != null && data.buildingOperatingNoiCents != null;

  // Reconciliation deltas vs the bottom-up value.
  const recon = (appraisal) =>
    buildingValue && appraisal != null
      ? `${appraisal >= buildingValue ? "+" : ""}${(((appraisal - buildingValue) / buildingValue) * 100).toFixed(1)}%`
      : null;

  return (
    <div className="p-4 sm:p-5">
      {/* Header — a two-column summary: Value & yield · NOI bridge. */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{t("buildingsId.reporting.unitProfit.title")}</h3>
        <p className="text-xs text-foreground-dim">{t("buildingsId.reporting.unitProfit.subtitle")}</p>
      </div>
      <div className={cn("mb-4 grid gap-3", hasBridge ? "sm:grid-cols-2" : "grid-cols-1")}>
        {/* Value & yield — yield stated once, with its benchmark directly under it,
            then building value + a compact reconciliation line. */}
        <div className="rounded-xl border border-surface-border bg-surface-subtle p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.unitProfit.valueYield")}</p>
          {yieldPct != null ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{pct(yieldPct)}</span>
                {verdict && (
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", verdict === "below" ? "bg-warning-light text-warning-text" : "bg-success-light text-success-text")}>
                    {t(`buildingsId.reporting.unitProfit.verdict.${verdict}`)}
                  </span>
                )}
              </div>
              <div className="mt-3"><YieldTrack yieldPct={yieldPct} t={t} /></div>
            </>
          ) : (
            <span className="text-3xl font-bold text-foreground-dim">—</span>
          )}
          <div className="my-3 h-px bg-surface-divider" />
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted">{t("buildingsId.reporting.unitProfit.buildingValue")}</span>
            <span className="text-base font-semibold tabular-nums text-foreground">{chf(buildingValue)}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-dim">
            <span>{t("buildingsId.reporting.unitProfit.buildingValueSub")}</span>
            {data?.ppeEstimateChf != null && <span>{t("buildingsId.reporting.unitProfit.ppeEstimate")} {chf(data.ppeEstimateChf)}{recon(data.ppeEstimateChf) ? ` (${recon(data.ppeEstimateChf)})` : ""}</span>}
            {data?.marketValueChf != null && <span>{t("buildingsId.reporting.unitProfit.marketValue")} {chf(data.marketValueChf)}{recon(data.marketValueChf) ? ` (${recon(data.marketValueChf)})` : ""}</span>}
            {data?.navChf != null && <span>{t("buildingsId.reporting.unitProfit.nav")} {chf(data.navChf)}</span>}
          </div>
          <a href={`/manager/finance?tab=planning&buildingId=${buildingId}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand no-underline hover:underline">
            {t("buildingsId.reporting.unitProfit.modelYield", { defaultValue: "Model how to move this yield" })} →
          </a>
        </div>

        {/* NOI bridge — direct costing: units' direct NOI less shared building-level
            costs reconciles to the building operating NOI. */}
        {hasBridge && (
          <div className="rounded-xl border border-surface-border bg-surface-subtle p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.unitProfit.noiBreakdown")}</p>
            <div className="flex items-baseline justify-between gap-2 py-1 text-sm">
              <span className="text-muted">{t("buildingsId.reporting.unitProfit.unitsDirectNoi")}</span>
              <span className="font-semibold tabular-nums text-foreground">{formatChfCents(data.totalAnnualNoiCents)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 py-1 text-sm">
              <span className="text-muted">− {t("buildingsId.reporting.unitProfit.buildingLevelCosts")}</span>
              <span className="font-semibold tabular-nums text-foreground">{formatChfCents(data.buildingLevelCostsCents)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2 border-t-2 border-surface-border pt-2 text-sm">
              <span className="font-bold text-foreground">= {t("buildingsId.reporting.unitProfit.buildingNoi")}</span>
              <span className="font-bold tabular-nums text-foreground">{formatChfCents(data.buildingOperatingNoiCents)}</span>
            </div>
            <p className="mt-2 text-[11px] text-foreground-dim">{t("buildingsId.reporting.unitProfit.noiBreakdownNote")}</p>
          </div>
        )}
      </div>

      {data?.reconciliation && !data.reconciliation.reconciled && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-warning-light px-3 py-2 text-xs text-warning-text" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{t("buildingsId.reporting.unitProfit.reconcileWarn", {
            sum: formatChfCents(data.reconciliation.sumUnitIncomeCents),
            building: formatChfCents(data.reconciliation.buildingIncomeCents),
            delta: formatChfCents(Math.abs(data.reconciliation.incomeDeltaCents)),
          })}</span>
        </div>
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
              <tfoot>
                <tr className="border-t-2 border-surface-border font-semibold">
                  <td className="py-2 pr-3" colSpan={2}>{t("buildingsId.reporting.unitProfit.total")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatChfCents(data.totalAnnualNoiCents)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground-dim">100%</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{chf(buildingValue)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground-dim">{buildingValue ? "100%" : "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{pct(data?.buildingNetYieldPct)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Mobile total */}
          <div className="mt-2 flex items-center justify-between rounded-xl border-2 border-surface-border px-3 py-2 text-sm font-semibold sm:hidden">
            <span>{t("buildingsId.reporting.unitProfit.total")}</span>
            <span className="tabular-nums">{formatChfCents(data.totalAnnualNoiCents)} · {pct(data?.buildingNetYieldPct)}</span>
          </div>
          <p className="mt-3 text-xs text-foreground-dim">{t("buildingsId.reporting.unitProfit.footnote")}</p>
        </>
      )}
    </div>
  );
}
