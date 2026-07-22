/**
 * NPVScenariosPanel — Phase 3 Financial Planning
 *
 * Displays a 3-scenario NPV comparison (Invest / Defer / Neglect) for a building.
 * Takes a buildingId prop (shared from the NOI panel selector).
 *
 * Controls:
 *   - Discount rate slider (1–10 %, default 4 %)
 *   - Income growth rate slider (0–5 %, default 2 %)
 *   - Horizon selector (5 / 10 / 15 years)
 *   - Defer window selector (2 / 3 / 5 / 7 years)
 *
 * Enhancements:
 *   - Identical-scenario notice when Invest ≈ Defer (no capex in defer window)
 *   - Per-scenario plain-language summaries
 *   - Delta callout: "Invest outperforms Neglect by CHF X"
 *   - Strategy recommendation badge + rationale from BuildingStrategyProfile
 *   - Tooltips on key financial labels
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { authHeaders } from "../lib/api";
import { formatChf } from "../lib/format";
import { cn } from "../lib/utils";
import Panel from "./layout/Panel";
import Tooltip from "./Tooltip";

// ─── FCI colour helper ─────────────────────────────────────────

function fciColor(pct) {
  if (pct < 5)  return "text-success-text";
  if (pct < 10) return "text-warning-text";
  if (pct < 30) return "text-orange-text";
  return "text-destructive-text";
}

// Traffic-light colour for loan-to-value: lower is safer.
function ltvColor(pct) {
  if (pct < 60) return "text-success-text";
  if (pct <= 80) return "text-warning-text";
  return "text-destructive-text";
}

// Traffic-light colour for DSCR: ≥1.5 comfortable, 1.2–1.5 ok, below tight.
function dscrColor(d) {
  if (d >= 1.5) return "text-success-text";
  if (d >= 1.2) return "text-warning-text";
  return "text-destructive-text";
}

// ─── Mini cumulative-PV sparkbar ──────────────────────────────

function CumulativeBars({ flows, highlighted }) {
  if (!flows || flows.length === 0) return null;
  const values = flows.map((f) => f.cumulativePvChf);
  const maxAbs = Math.max(...values.map(Math.abs), 1);

  return (
    <div className="flex items-end gap-px h-10 mt-2" aria-hidden="true">
      {flows.map((f) => {
        const pct = Math.round((Math.abs(f.cumulativePvChf) / maxAbs) * 100);
        const positive = f.cumulativePvChf >= 0;
        return (
          <div key={f.year} className="flex-1 flex flex-col justify-end" title={`${f.year}: ${formatChf(f.cumulativePvChf)}`}>
            <div
              className={cn(
                "rounded-sm",
                positive
                  ? (highlighted ? "bg-foreground" : "bg-muted")
                  : "bg-track",
              )}
              style={{ height: `${Math.max(pct, 4)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Debt stat (leverage strip) ───────────────────────────────

function DebtStat({ label, value, tooltip, valueClass }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-foreground-dim flex items-center gap-0.5">
        {label}
        {tooltip && <Tooltip content={tooltip} />}
      </span>
      <span className={cn("font-mono font-semibold tabular-nums", valueClass || "text-foreground")}>{value}</span>
    </span>
  );
}

// ─── Single scenario card ─────────────────────────────────────

function ScenarioCard({ label, hint, data, t, isHighlighted, isRecommended, summary, identicalNotice }) {
  if (!data) return null;
  const { npvChf, totalCapexChf, totalTaxShieldChf, totalNoiChf, yearlyFlows } = data;

  return (
    <div
      className={cn(
        "rounded-lg p-4 space-y-2 relative bg-surface",
        isHighlighted
          ? "border-2 border-brand shadow-sm ring-1 ring-brand-ring"
          : "border border-surface-border",
      )}
    >
      {/* Strategy recommendation badge */}
      {isRecommended && (
        <span className="absolute -top-2.5 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand text-white shadow-sm">
          {t("manager:npvScenarios.recommendation.badge")}
        </span>
      )}
      {/* Best-NPV chip (shown when highlighted by NPV alone, not strategy) */}
      {isHighlighted && !isRecommended && (
        <span className="absolute -top-2.5 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand text-white shadow-sm">
          {t("manager:npvScenarios.recommendation.bestNpv")}
        </span>
      )}

      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>

      <div>
        <p className="text-xs text-muted uppercase tracking-wide flex items-center gap-1">
          NPV
          <Tooltip content={t("manager:npvScenarios.tooltip.npv")} />
        </p>
        <p className="text-xl font-bold font-mono text-foreground">
          {formatChf(npvChf)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs text-muted-text">
        <div>
          <span className="text-foreground-dim flex items-center gap-1">
            NOI
            <Tooltip content={t("manager:npvScenarios.tooltip.noi")} />
          </span>
          <p className="font-mono font-medium">{formatChf(totalNoiChf)}</p>
        </div>
        <div>
          <span className="text-foreground-dim">Capex</span>
          <p className="font-mono font-medium">{formatChf(totalCapexChf)}</p>
        </div>
      </div>

      {totalTaxShieldChf > 0 && (
        <div className="text-xs text-muted-text border-t border-surface-divider pt-1.5">
          <span className="text-foreground-dim flex items-center gap-1">
            {t("manager:npvScenarios.text.taxShield")}
            <Tooltip content={t("manager:npvScenarios.tooltip.taxShield")} />
          </span>
          <p className="font-mono font-medium text-success-text">
            +{formatChf(totalTaxShieldChf)}
          </p>
        </div>
      )}

      {/* Levered (FCFE) metrics — shown when debt/value configured */}
      {data.levered && (data.levered.equityNpvChf != null || data.levered.minDscr != null) && (
        <div className="grid grid-cols-2 gap-1 text-xs border-t border-surface-divider pt-1.5">
          {data.levered.equityNpvChf != null && (
            <div>
              <span className="text-foreground-dim flex items-center gap-0.5">
                {t("manager:npvScenarios.debt.equityNpv")}
                <Tooltip content={t("manager:npvScenarios.tooltip.equityNpv")} />
              </span>
              <p className="font-mono font-medium">{formatChf(data.levered.equityNpvChf)}</p>
            </div>
          )}
          {data.levered.equityIrrPct != null && (
            <div>
              <span className="text-foreground-dim flex items-center gap-0.5">
                {t("manager:npvScenarios.debt.equityIrr")}
                <Tooltip content={t("manager:npvScenarios.tooltip.equityIrr")} />
              </span>
              <p className="font-mono font-medium tabular-nums">{data.levered.equityIrrPct}%</p>
            </div>
          )}
          {data.levered.minDscr != null && (
            <div>
              <span className="text-foreground-dim flex items-center gap-0.5">
                {t("manager:npvScenarios.debt.minDscr")}
                <Tooltip content={t("manager:npvScenarios.tooltip.dscr")} />
              </span>
              <p className={cn("font-mono font-medium tabular-nums", dscrColor(data.levered.minDscr))}>
                {data.levered.minDscr.toFixed(2)}×
              </p>
            </div>
          )}
        </div>
      )}

      <CumulativeBars flows={yearlyFlows} highlighted={isHighlighted} />

      <div className="flex justify-between text-xs text-foreground-dim pt-0.5">
        <span>{yearlyFlows?.[0]?.year}</span>
        <span>{yearlyFlows?.[yearlyFlows.length - 1]?.year}</span>
      </div>

      {/* Per-scenario plain-language summary */}
      {summary && (
        <p className="text-xs border-t border-surface-divider pt-2 leading-relaxed text-muted-text">
          {summary}
        </p>
      )}

      {/* Identical-scenario notice (Defer only) */}
      {identicalNotice && (
        <div className="rounded border border-warning-ring bg-warning-light px-2 py-1.5 text-xs text-warning-text">
          {identicalNotice}
        </div>
      )}
    </div>
  );
}

// ─── Slider control ───────────────────────────────────────────

function SliderRow({ label, value, min, max, step, onChange, format, tooltip }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-muted-text w-32 shrink-0 flex items-center gap-1">
        {label}
        {tooltip && <Tooltip content={tooltip} />}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-slate-600"
      />
      <span className="text-xs font-mono text-muted-dark w-10 text-right">{format(value)}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

// mode="interactive": building endpoint, sliders visible (default, used on Planning tab)
// mode="plan":        plan endpoint via fetchUrl, sliders hidden, manual recalculate button
export default function NPVScenariosPanel({ buildingId, fetchUrl, mode = "interactive" }) {
  const { t } = useTranslation("manager");
  const isPlanMode = mode === "plan";

  const [discountRatePct, setDiscountRatePct] = useState(4);
  const [incomeGrowthRatePct, setIncomeGrowthRatePct] = useState(2);
  const [horizonYears, setHorizonYears] = useState(10);
  const [deferYears, setDeferYears] = useState(3);
  const [propertyValueChf, setPropertyValueChf] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchScenarios = useCallback(async (id, discount, growth, horizon, deferYrs, propertyValue, signal) => {
    if (!id && !fetchUrl) return;
    setLoading(true);
    setError("");
    try {
      let url;
      if (isPlanMode && fetchUrl) {
        url = fetchUrl;
      } else {
        const qs = new URLSearchParams({
          discountRatePct: String(discount),
          incomeGrowthRatePct: String(growth),
          horizonYears: String(horizon),
          deferYears: String(deferYrs),
          ...(propertyValue > 0 ? { propertyValueChf: String(propertyValue) } : {}),
        }).toString();
        url = `/api/buildings/${id}/npv-scenarios?${qs}`;
      }
      const res = await fetch(url, { headers: authHeaders(), signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load NPV scenarios");
      setData(json.data);
    } catch (e) {
      if (e?.name === "AbortError") return; // superseded by a newer request
      setError(String(e?.message || e));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [isPlanMode, fetchUrl]);

  // Re-fetch whenever building or any control changes (interactive mode).
  // In plan mode the sliders are hidden and never change, so a fixed-shape
  // dependency array is safe: only buildingId/fetchUrl/fetchScenarios actually
  // move. Keeping the array length constant across renders avoids React's
  // "dependency array changed size" hazard (CR-006).
  //
  // Slider drags fire many changes; debounce the refetch and abort the previous
  // in-flight request so out-of-order responses can't overwrite the newest
  // result (last-write-wins race) (CR-013).
  useEffect(() => {
    const ctrl = new AbortController();
    const DEBOUNCE_MS = 250;
    const timer = setTimeout(() => {
      if (isPlanMode && fetchUrl) {
        setData(null);
        fetchScenarios(null, discountRatePct, incomeGrowthRatePct, horizonYears, deferYears, 0, ctrl.signal);
      } else if (!isPlanMode && buildingId) {
        setData(null);
        const parsed = Number(propertyValueChf);
        fetchScenarios(buildingId, discountRatePct, incomeGrowthRatePct, horizonYears, deferYears, Number.isFinite(parsed) ? parsed : 0, ctrl.signal);
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [
    isPlanMode, buildingId, fetchUrl, fetchScenarios,
    discountRatePct, incomeGrowthRatePct, horizonYears, deferYears, propertyValueChf,
  ]);

  // ── Derived values ────────────────────────────────────────────

  const subtitle = data
    ? `${data.fromYear}–${data.toYear} · ${t("manager:npvScenarios.text.baseNoi")} ${formatChf(data.baseAnnualNoiChf)}/yr`
    : undefined;

  const isIdenticalDeferInvest = data && Math.abs(data.scenarios.invest.npvChf - data.scenarios.defer.npvChf) /
    Math.max(Math.abs(data.scenarios.invest.npvChf), 1) < 0.005;

  // Determine the actual best scenario by NPV
  const bestScenarioKey = data
    ? (["invest", "defer", "neglect"]).reduce((best, key) =>
        data.scenarios[key].npvChf > data.scenarios[best].npvChf ? key : best, "invest")
    : null;
  const bestScenario = bestScenarioKey && data ? data.scenarios[bestScenarioKey] : null;
  const bestVsNeglectDelta = (bestScenario && data)
    ? bestScenario.npvChf - data.scenarios.neglect.npvChf
    : 0;

  // Breakdown: decompose the invest-vs-neglect NPV delta into its three drivers
  // (all in discounted PV terms), computed from the yearly cash flows.
  const investVsNeglect = (() => {
    if (!data) return null;
    const inv = data.scenarios.invest.yearlyFlows;
    const neg = data.scenarios.neglect.yearlyFlows;
    if (!inv || !neg || inv.length !== neg.length) return null;
    let pvNoi = 0, pvCapex = 0, pvTax = 0;
    for (let i = 0; i < inv.length; i++) {
      pvNoi   += Math.round((inv[i].projectedNoiChf - neg[i].projectedNoiChf) * inv[i].discountFactor);
      pvCapex += Math.round((inv[i].capexChf - neg[i].capexChf) * inv[i].discountFactor);
      pvTax   += Math.round(inv[i].taxShieldChf * inv[i].discountFactor);
    }
    return { pvNoi, pvCapex, pvTax };
  })();

  // Per-scenario plain-language summaries (client-side, direction-aware)
  function buildSummary(scenarioKey) {
    if (!data) return null;
    const { invest, defer, neglect } = data.scenarios;

    if (scenarioKey === "invest") {
      const vsDeferDiff = invest.npvChf - defer.npvChf;
      if (vsDeferDiff < 0) {
        // Defer is actually better — note the NPV gap
        return t("manager:npvScenarios.summary.investDeferBetter", {
          years: data.deferYears,
          diff: formatChf(Math.abs(vsDeferDiff)),
        });
      }
      const vsNeglect = invest.npvChf - neglect.npvChf;
      return vsNeglect > 0
        ? t("manager:npvScenarios.summary.invest", { delta: formatChf(vsNeglect) })
        : t("manager:npvScenarios.summary.investNeutral");
    }
    if (scenarioKey === "defer") {
      if (isIdenticalDeferInvest) return null; // notice already shown
      const diff = defer.npvChf - invest.npvChf; // positive = defer beats invest
      if (diff > 0) {
        return t("manager:npvScenarios.summary.deferWins", {
          years: data.deferYears,
          diff: formatChf(diff),
        });
      }
      return t("manager:npvScenarios.summary.defer", {
        years: data.deferYears,
        diff: formatChf(Math.abs(diff)),
      });
    }
    if (scenarioKey === "neglect") {
      // Compare against best scenario, not always invest
      const bestNpv = bestScenario?.npvChf ?? invest.npvChf;
      const delta = bestNpv - neglect.npvChf;
      return delta > 0
        ? t("manager:npvScenarios.summary.neglect", { delta: formatChf(delta) })
        : t("manager:npvScenarios.summary.neglectNeutral");
    }
    return null;
  }

  const strategyContext = data?.strategyContext ?? null;
  const recommendedScenario = strategyContext?.recommendedScenario ?? null;
  // Highlighted = strategy recommendation when profile exists, best NPV otherwise
  const highlightedScenario = strategyContext?.hasProfile ? recommendedScenario : bestScenarioKey;

  // ── Plain-language verdict (novice hand-holding) ──────────────
  const plainVerdict = (() => {
    if (!data) return "";
    if (bestScenarioKey === "invest") {
      return t("manager:npvScenarios.plain.verdictInvest", { delta: formatChf(Math.abs(bestVsNeglectDelta)) });
    }
    if (bestScenarioKey === "defer") {
      const vsInvest = data.scenarios.defer.npvChf - data.scenarios.invest.npvChf;
      return t("manager:npvScenarios.plain.verdictDefer", { years: data.deferYears, delta: formatChf(Math.abs(vsInvest)) });
    }
    return t("manager:npvScenarios.plain.verdictNeglect");
  })();

  const bestLevered = bestScenario?.levered ?? null;
  const coverageLine = (() => {
    if (!data?.debt) return null;
    if (data.debt.totalDebtChf <= 0) return t("manager:npvScenarios.plain.noDebt");
    const dscr = bestLevered?.minDscr;
    if (dscr == null) return null;
    const key = dscr >= 1.5 ? "coverageComfortable" : dscr >= 1.2 ? "coverageOk" : "coverageTight";
    let line = t(`manager:npvScenarios.plain.${key}`, { dscr: dscr.toFixed(2) });
    if (bestLevered?.equityIrrPct != null) {
      line += " " + t("manager:npvScenarios.plain.returnNote", { irr: bestLevered.equityIrrPct });
    }
    return line;
  })();

  return (
    <Panel title={t("manager:npvScenarios.title.npvScenarios")}>
      <div className="space-y-4">
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}

        {/* Plan mode: recalculate button (assumptions live in Assumptions panel above) */}
        {isPlanMode && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchScenarios(null, discountRatePct, incomeGrowthRatePct, horizonYears, deferYears, 0)}
              disabled={loading}
              className="text-xs font-medium text-brand-dark hover:underline disabled:opacity-50"
            >
              {loading ? "Computing…" : "↻ Recalculate"}
            </button>
            <span className="text-xs text-foreground-dim">Assumptions are set in the panel above.</span>
          </div>
        )}

        {/* Controls (interactive mode only) */}
        {!isPlanMode && <div className="space-y-2 p-3 bg-surface-subtle rounded-md border border-surface-border">
          <SliderRow
            label={t("manager:npvScenarios.controls.discountRate")}
            value={discountRatePct}
            min={1} max={10} step={0.5}
            onChange={setDiscountRatePct}
            format={(v) => `${v}%`}
            tooltip={t("manager:npvScenarios.tooltip.discountRate")}
          />
          <SliderRow
            label={t("manager:npvScenarios.controls.incomeGrowth")}
            value={incomeGrowthRatePct}
            min={0} max={5} step={0.5}
            onChange={setIncomeGrowthRatePct}
            format={(v) => `${v}%`}
            tooltip={t("manager:npvScenarios.tooltip.incomeGrowth")}
          />

          {/* Horizon */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-text w-32 shrink-0">
              {t("manager:npvScenarios.controls.horizon")}
            </label>
            <div className="flex gap-2">
              {[5, 10, 15].map((y) => (
                <button
                  key={y}
                  onClick={() => setHorizonYears(y)}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium border",
                    horizonYears === y
                      ? "bg-brand text-white border-brand"
                      : "bg-surface text-muted-text border-muted-ring hover:border-brand-ring",
                  )}
                >
                  {y}yr
                </button>
              ))}
            </div>
          </div>

          {/* Defer window */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-text w-32 shrink-0 flex items-center gap-1">
              {t("manager:npvScenarios.controls.deferWindow")}
              <Tooltip content={t("manager:npvScenarios.tooltip.deferWindow")} />
            </label>
            <div className="flex gap-2">
              {[2, 3, 5, 7].map((y) => (
                <button
                  key={y}
                  onClick={() => setDeferYears(y)}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium border",
                    deferYears === y
                      ? "bg-warning text-white border-warning"
                      : "bg-surface text-muted-text border-muted-ring hover:border-brand-ring",
                  )}
                >
                  {y}yr
                </button>
              ))}
            </div>
          </div>

          {/* Property value */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-text w-32 shrink-0">
              {t("manager:npvScenarios.controls.propertyValue")}
            </label>
            <div className="flex-1 flex items-center gap-1">
              <span className="text-xs text-foreground-dim">CHF</span>
              <input
                type="number"
                min={0}
                step={50000}
                value={propertyValueChf}
                onChange={(e) => setPropertyValueChf(e.target.value)}
                placeholder={t("manager:npvScenarios.controls.propertyValuePlaceholder")}
                className="flex-1 text-xs border border-muted-ring rounded px-2 py-0.5 font-mono text-muted-dark focus:outline-none focus:border-brand-ring"
              />
            </div>
          </div>
        </div>}

        {/* Error */}
        {error && <div className="notice notice-err">{error}</div>}

        {/* No income data warning */}
        {!loading && data?.noIncomeData && (
          <div className="flex items-start gap-2 rounded-md border border-warning-ring bg-warning-light px-3 py-2 text-xs text-warning-text">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>
              No income history found for this building — NOI is shown as CHF 0.
              Compute a financial snapshot in the <strong>Historical NOI</strong> panel above to populate real figures.
            </span>
          </div>
        )}

        {/* NOI estimated from gross rent (no snapshot history) — flag the overstatement */}
        {!loading && !data?.noIncomeData && data?.noiEstimatedFromRent && (
          <div className="flex items-start gap-2 rounded-md border border-warning-ring bg-warning-light px-3 py-2 text-xs text-warning-text">
            <span className="mt-0.5 shrink-0">ⓘ</span>
            <span>
              NOI is estimated from <strong>gross lease rent</strong> (no operating costs deducted),
              as no financial-snapshot history exists yet — treat it as an upper bound.
              Compute a snapshot in the <strong>Historical NOI</strong> panel for accurate figures.
            </span>
          </div>
        )}

        {/* Loading */}
        {loading && <p className="loading-text">{t("manager:npvScenarios.text.loading")}</p>}

        {/* Empty — no building selected (interactive mode only) */}
        {!isPlanMode && !buildingId && !loading && (
          <p className="text-sm text-foreground-dim">{t("manager:npvScenarios.text.selectBuilding")}</p>
        )}

        {/* FCI + tax rate context strip */}
        {!loading && data && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-surface-border bg-surface-subtle px-3 py-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-muted font-medium shrink-0 flex items-center gap-1">
                {t("manager:npvScenarios.text.fciLabel")}
                <Tooltip content={t("manager:npvScenarios.tooltip.fci")} />
              </span>
              <span className="flex items-center gap-1">
                <span className="text-foreground-dim">{t("manager:npvScenarios.text.fciCurrent")}</span>
                <span className={cn("font-mono font-semibold", fciColor(data.fciCurrentPct))}>
                  {data.fciCurrentPct.toFixed(1)}%
                </span>
              </span>
              <span className="text-foreground-dim">→</span>
              <span className="flex items-center gap-1">
                <span className="text-foreground-dim">
                  {t("manager:npvScenarios.text.fciAtHorizon", { year: data.toYear })}
                </span>
                <span className={cn("font-mono font-semibold", fciColor(data.fciNeglectHorizonPct))}>
                  {data.fciNeglectHorizonPct.toFixed(1)}%
                </span>
              </span>
            </div>
            <span className="text-foreground-dim hidden sm:inline">·</span>
            <span className="text-foreground-dim italic">
              {t("manager:npvScenarios.text.fciThresholds")}
            </span>
            <span className="ml-auto text-foreground-dim shrink-0">
              {data.ownerTaxRateIsDefault
                ? t("manager:npvScenarios.text.taxShieldDefaultNote", { rate: data.ownerMarginalTaxRatePct })
                : t("manager:npvScenarios.text.taxShieldNote", { rate: data.ownerMarginalTaxRatePct })}
            </span>
          </div>
        )}

        {/* Leverage strip — building-level debt summary */}
        {!loading && data?.debt && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-md border border-surface-border bg-surface-subtle px-3 py-2 text-xs">
            <span className="text-muted font-medium shrink-0">{t("manager:npvScenarios.debt.title")}</span>
            <DebtStat label={t("manager:npvScenarios.debt.totalDebt")} value={formatChf(data.debt.totalDebtChf)} tooltip={t("manager:npvScenarios.tooltip.totalDebt")} />
            {data.debt.ltvPct != null && <DebtStat label={t("manager:npvScenarios.debt.ltv")} value={`${data.debt.ltvPct}%`} tooltip={t("manager:npvScenarios.tooltip.ltv")} valueClass={ltvColor(data.debt.ltvPct)} />}
            {data.debt.weightedCostOfDebtPct != null && <DebtStat label={t("manager:npvScenarios.debt.costOfDebt")} value={`${data.debt.weightedCostOfDebtPct}%`} tooltip={t("manager:npvScenarios.tooltip.costOfDebt")} />}
            {data.debt.waccPct != null && <DebtStat label={t("manager:npvScenarios.debt.wacc")} value={`${data.debt.waccPct}%`} tooltip={t("manager:npvScenarios.tooltip.wacc")} />}
            {data.debt.currentEquityChf != null && <DebtStat label={t("manager:npvScenarios.debt.equity")} value={formatChf(data.debt.currentEquityChf)} tooltip={t("manager:npvScenarios.tooltip.equity")} />}
          </div>
        )}

        {/* Scenario cards */}
        {!loading && data && (
          <>
            {/* Plain-language verdict — what this means & what to do */}
            <div className="rounded-md border border-surface-border bg-surface-subtle px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">
                {t("manager:npvScenarios.plain.whatThisMeans")}
              </p>
              <p className="text-sm text-foreground leading-relaxed">{plainVerdict}</p>
              {coverageLine && <p className="text-xs text-muted-text mt-1 leading-relaxed">{coverageLine}</p>}
            </div>

            {/* Delta callout with breakdown */}
            {bestVsNeglectDelta !== 0 && bestScenarioKey !== "neglect" && (
              <div className={cn(
                "rounded-md border px-3 py-2 space-y-1.5",
                bestVsNeglectDelta > 0
                  ? "border-success-ring bg-success-light text-success-text"
                  : "border-destructive-ring bg-destructive-light text-destructive-text",
              )}>
                <p className="text-xs font-semibold">
                  {t(`manager:npvScenarios.delta.${bestScenarioKey}Wins`, {
                    delta: formatChf(Math.abs(bestVsNeglectDelta)),
                    years: data.horizonYears,
                    deferYears: data.deferYears,
                  })}
                </p>
                {investVsNeglect && (
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs opacity-80 font-mono">
                    {investVsNeglect.pvNoi !== 0 && (
                      <span>
                        {t("manager:npvScenarios.delta.breakdown.noi")}
                        {" "}
                        <span className="font-semibold">
                          {investVsNeglect.pvNoi > 0 ? "+" : ""}{formatChf(investVsNeglect.pvNoi)}
                        </span>
                      </span>
                    )}
                    {investVsNeglect.pvTax > 0 && (
                      <span>
                        {t("manager:npvScenarios.delta.breakdown.taxShield")}
                        {" "}
                        <span className="font-semibold">+{formatChf(investVsNeglect.pvTax)}</span>
                      </span>
                    )}
                    {investVsNeglect.pvCapex !== 0 && (
                      <span>
                        {t("manager:npvScenarios.delta.breakdown.capex")}
                        {" "}
                        <span className="font-semibold">
                          {investVsNeglect.pvCapex > 0 ? "+" : ""}{formatChf(-investVsNeglect.pvCapex)}
                          {investVsNeglect.pvCapex > 0 ? " ↑earlier" : " ↓later"}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Strategy recommendation strip — owner-portfolio fallback (a default, not building-specific) */}
            {strategyContext?.hasProfile && strategyContext.source === "owner-portfolio" && strategyContext.rationale && (
              <div className="rounded-md border border-surface-border bg-surface-subtle px-3 py-2 text-xs text-muted flex items-start justify-between gap-2">
                <span className="flex items-start gap-2 min-w-0">
                  <span className="shrink-0 mt-px text-foreground-dim">ⓘ</span>
                  <span>{strategyContext.rationale}</span>
                </span>
                <a
                  href="/owner/strategy"
                  className="shrink-0 text-muted-dark font-medium underline hover:text-foreground"
                >
                  {t("manager:npvScenarios.strategy.setBuildingLink")}
                </a>
              </div>
            )}
            {/* Strategy recommendation strip — authoritative building profile */}
            {strategyContext?.hasProfile && strategyContext.source !== "owner-portfolio" && strategyContext.rationale && (
              <div className="rounded-md border border-surface-border bg-surface-subtle px-3 py-2 text-xs text-muted-dark flex items-start gap-2">
                <span className="shrink-0 mt-px text-foreground-dim">★</span>
                <span>{strategyContext.rationale}</span>
              </div>
            )}
            {!strategyContext?.hasProfile && (
              <div className="rounded-md border border-surface-border bg-surface-subtle px-3 py-2 text-xs text-muted flex items-center justify-between gap-2">
                <span>{t("manager:npvScenarios.strategy.noProfileHint")}</span>
                <a
                  href="/owner/strategy"
                  className="shrink-0 text-muted-dark font-medium underline hover:text-foreground"
                >
                  {t("manager:npvScenarios.strategy.noProfileLink")}
                </a>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ScenarioCard
                label={t("manager:npvScenarios.scenario.invest")}
                hint={t("manager:npvScenarios.scenario.investHint")}
                data={data.scenarios.invest}
                t={t}
                isHighlighted={highlightedScenario === "invest"}
                isRecommended={strategyContext?.hasProfile && recommendedScenario === "invest"}
                summary={buildSummary("invest")}
              />
              <ScenarioCard
                label={t("manager:npvScenarios.scenario.defer", { years: data.deferYears })}
                hint={t("manager:npvScenarios.scenario.deferHint", { years: data.deferYears })}
                data={data.scenarios.defer}
                t={t}
                isHighlighted={highlightedScenario === "defer"}
                isRecommended={strategyContext?.hasProfile && recommendedScenario === "defer"}
                summary={buildSummary("defer")}
                identicalNotice={isIdenticalDeferInvest
                  ? t("manager:npvScenarios.notice.identicalScenarios", { years: data.deferYears })
                  : null
                }
              />
              <div className="flex flex-col gap-1">
                <ScenarioCard
                  label={t("manager:npvScenarios.scenario.neglect")}
                  hint={t("manager:npvScenarios.scenario.neglectHint")}
                  data={data.scenarios.neglect}
                  t={t}
                  isHighlighted={highlightedScenario === "neglect"}
                  isRecommended={strategyContext?.hasProfile && recommendedScenario === "neglect"}
                  summary={buildSummary("neglect")}
                />
                {!data.terminalValueModeled && (
                  <p className="text-xs text-foreground-dim italic px-1">
                    {t("manager:npvScenarios.text.terminalValueMissing")}
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-foreground-dim">
              {t("manager:npvScenarios.text.footnote", {
                discount: data.discountRatePct,
                growth: data.incomeGrowthRatePct,
              })}
              {" · "}
              {t("manager:npvScenarios.text.neglectErosion", {
                rate: data.neglectNoiErosionRatePct,
                offset: data.deferYears,
              })}
            </p>

          </>
        )}
      </div>
    </Panel>
  );
}
