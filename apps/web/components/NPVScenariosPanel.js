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
  if (pct < 5)  return "text-emerald-700";
  if (pct < 10) return "text-amber-600";
  if (pct < 30) return "text-orange-600";
  return "text-red-700";
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
                  ? (highlighted ? "bg-slate-700" : "bg-slate-400")
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

// ─── Single scenario card ─────────────────────────────────────

function ScenarioCard({ label, hint, data, t, isHighlighted, isRecommended, summary, identicalNotice }) {
  if (!data) return null;
  const { npvChf, totalCapexChf, totalTaxShieldChf, totalNoiChf, yearlyFlows } = data;

  return (
    <div
      className={cn(
        "rounded-lg p-4 space-y-2 relative bg-surface",
        isHighlighted
          ? "border-2 border-slate-800 shadow-sm"
          : "border border-surface-border",
      )}
    >
      {/* Strategy recommendation badge */}
      {isRecommended && (
        <span className="absolute -top-2.5 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-white">
          {t("manager:npvScenarios.recommendation.badge")}
        </span>
      )}
      {/* Best-NPV chip (shown when highlighted by NPV alone, not strategy) */}
      {isHighlighted && !isRecommended && (
        <span className="absolute -top-2.5 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-white">
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
          <p className="font-mono font-medium text-emerald-600">
            +{formatChf(totalTaxShieldChf)}
          </p>
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
        <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
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

export default function NPVScenariosPanel({ buildingId }) {
  const { t } = useTranslation("manager");

  const [discountRatePct, setDiscountRatePct] = useState(4);
  const [incomeGrowthRatePct, setIncomeGrowthRatePct] = useState(2);
  const [horizonYears, setHorizonYears] = useState(10);
  const [deferYears, setDeferYears] = useState(3);
  const [propertyValueChf, setPropertyValueChf] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchScenarios = useCallback(async (id, discount, growth, horizon, deferYrs, propertyValue) => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        discountRatePct: String(discount),
        incomeGrowthRatePct: String(growth),
        horizonYears: String(horizon),
        deferYears: String(deferYrs),
        ...(propertyValue > 0 ? { propertyValueChf: String(propertyValue) } : {}),
      }).toString();
      const res = await fetch(`/api/buildings/${id}/npv-scenarios?${qs}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load NPV scenarios");
      setData(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever building or any control changes
  useEffect(() => {
    if (buildingId) {
      setData(null);
      const parsed = Number(propertyValueChf);
      fetchScenarios(buildingId, discountRatePct, incomeGrowthRatePct, horizonYears, deferYears, isFinite(parsed) ? parsed : 0);
    }
  }, [buildingId, discountRatePct, incomeGrowthRatePct, horizonYears, deferYears, propertyValueChf, fetchScenarios]);

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

  return (
    <Panel title={t("manager:npvScenarios.title.npvScenarios")}>
      <div className="space-y-4">
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}

        {/* Controls */}
        <div className="space-y-2 p-3 bg-surface-subtle rounded-md border border-surface-border">
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
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-surface text-muted-text border-muted-ring hover:border-slate-500",
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
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-surface text-muted-text border-muted-ring hover:border-slate-500",
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
                className="flex-1 text-xs border border-muted-ring rounded px-2 py-0.5 font-mono text-muted-dark focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <div className="notice notice-err">{error}</div>}

        {/* No income data warning */}
        {!loading && data?.noIncomeData && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>
              No income history found for this building — NOI is shown as CHF 0.
              Compute a financial snapshot in the <strong>Historical NOI</strong> panel above to populate real figures.
            </span>
          </div>
        )}

        {/* Loading */}
        {loading && <p className="loading-text">{t("manager:npvScenarios.text.loading")}</p>}

        {/* Empty — no building selected */}
        {!buildingId && !loading && (
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

        {/* Scenario cards */}
        {!loading && data && (
          <>
            {/* Delta callout with breakdown */}
            {bestVsNeglectDelta !== 0 && bestScenarioKey !== "neglect" && (
              <div className={cn(
                "rounded-md border px-3 py-2 space-y-1.5",
                bestVsNeglectDelta > 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800",
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

            {/* Strategy recommendation strip */}
            {strategyContext?.hasProfile && strategyContext.rationale && (
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
