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

// ─── Scenario colours ─────────────────────────────────────────

const SCENARIO_STYLES = {
  invest:  { bg: "bg-emerald-50",  border: "border-emerald-200", title: "text-emerald-800", value: "text-emerald-700", bar: "bg-emerald-500", ring: "ring-emerald-400" },
  defer:   { bg: "bg-amber-50",    border: "border-amber-200",   title: "text-amber-800",   value: "text-amber-700",  bar: "bg-amber-400",  ring: "ring-amber-400"   },
  neglect: { bg: "bg-red-50",      border: "border-red-200",     title: "text-red-800",     value: "text-red-700",    bar: "bg-red-400",    ring: "ring-red-400"     },
};

// ─── Mini cumulative-PV sparkbar ──────────────────────────────

function CumulativeBars({ flows, color }) {
  if (!flows || flows.length === 0) return null;
  const values = flows.map((f) => f.cumulativePvChf);
  const maxAbs = Math.max(...values.map(Math.abs), 1);

  return (
    <div className="flex items-end gap-px h-10 mt-2" aria-hidden="true">
      {flows.map((f) => {
        const pct = Math.round((Math.abs(f.cumulativePvChf) / maxAbs) * 100);
        const positive = f.cumulativePvChf >= 0;
        return (
          <div key={f.year} className="flex-1 flex flex-col justify-end" title={`${f.year}: CHF ${formatChf(f.cumulativePvChf)}`}>
            <div
              className={cn("rounded-sm", positive ? color : "bg-slate-300")}
              style={{ height: `${Math.max(pct, 4)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Single scenario card ─────────────────────────────────────

function ScenarioCard({ scenarioKey, label, hint, data, style, t, isRecommended, summary, identicalNotice }) {
  if (!data) return null;
  const { npvChf, totalCapexChf, totalTaxShieldChf, totalNoiChf, yearlyFlows } = data;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-2 relative",
        style.bg,
        style.border,
        isRecommended && `ring-2 ${style.ring}`,
      )}
    >
      {isRecommended && (
        <span className={cn(
          "absolute -top-2.5 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full",
          "bg-slate-800 text-white",
        )}>
          {t("manager:npvScenarios.recommendation.badge")}
        </span>
      )}

      <div>
        <p className={cn("text-sm font-semibold", style.title)}>{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
          NPV
          <Tooltip content={t("manager:npvScenarios.tooltip.npv")} />
        </p>
        <p className={cn("text-xl font-bold font-mono", style.value)}>
          CHF {formatChf(npvChf)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
        <div>
          <span className="text-slate-400 flex items-center gap-1">
            NOI
            <Tooltip content={t("manager:npvScenarios.tooltip.noi")} />
          </span>
          <p className="font-mono font-medium">CHF {formatChf(totalNoiChf)}</p>
        </div>
        <div>
          <span className="text-slate-400">Capex</span>
          <p className="font-mono font-medium">CHF {formatChf(totalCapexChf)}</p>
        </div>
      </div>

      {totalTaxShieldChf > 0 && (
        <div className="text-xs text-slate-600 border-t border-current border-opacity-10 pt-1.5 flex items-center gap-1">
          <div>
            <span className="text-slate-400 flex items-center gap-1">
              {t("manager:npvScenarios.text.taxShield")}
              <Tooltip content={t("manager:npvScenarios.tooltip.taxShield")} />
            </span>
            <p className="font-mono font-medium text-emerald-600">
              +CHF {formatChf(totalTaxShieldChf)}
            </p>
          </div>
        </div>
      )}

      <CumulativeBars flows={yearlyFlows} color={style.bar} />

      <div className="flex justify-between text-xs text-slate-400 pt-0.5">
        <span>{yearlyFlows?.[0]?.year}</span>
        <span>{yearlyFlows?.[yearlyFlows.length - 1]?.year}</span>
      </div>

      {/* Per-scenario plain-language summary */}
      {summary && (
        <p className={cn(
          "text-xs border-t pt-2 leading-relaxed",
          style.title,
          "border-current border-opacity-10",
        )}>
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
      <label className="text-xs text-slate-600 w-32 shrink-0 flex items-center gap-1">
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
      <span className="text-xs font-mono text-slate-700 w-10 text-right">{format(value)}</span>
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
    ? `${data.fromYear}–${data.toYear} · ${t("manager:npvScenarios.text.baseNoi")} CHF ${formatChf(data.baseAnnualNoiChf)}/yr`
    : undefined;

  const isIdenticalDeferInvest = data && Math.abs(data.scenarios.invest.npvChf - data.scenarios.defer.npvChf) /
    Math.max(Math.abs(data.scenarios.invest.npvChf), 1) < 0.005;

  const investNeglectDelta = data
    ? data.scenarios.invest.npvChf - data.scenarios.neglect.npvChf
    : 0;

  // Per-scenario plain-language summaries (client-side)
  function buildSummary(scenarioKey) {
    if (!data) return null;
    const { invest, defer, neglect } = data.scenarios;

    if (scenarioKey === "invest") {
      const vsNeglect = Math.abs(invest.npvChf - neglect.npvChf);
      return vsNeglect > 0
        ? t("manager:npvScenarios.summary.invest", { delta: formatChf(vsNeglect) })
        : t("manager:npvScenarios.summary.investNeutral");
    }
    if (scenarioKey === "defer") {
      if (isIdenticalDeferInvest) return null; // notice already shown
      const diff = Math.abs(invest.npvChf - defer.npvChf);
      return t("manager:npvScenarios.summary.defer", {
        years: data.deferYears,
        diff: formatChf(diff),
      });
    }
    if (scenarioKey === "neglect") {
      const delta = Math.abs(invest.npvChf - neglect.npvChf);
      return t("manager:npvScenarios.summary.neglect", { delta: formatChf(delta) });
    }
    return null;
  }

  const strategyContext = data?.strategyContext ?? null;
  const recommendedScenario = strategyContext?.recommendedScenario ?? null;

  return (
    <Panel title={t("manager:npvScenarios.title.npvScenarios")}>
      <div className="space-y-4">
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}

        {/* Controls */}
        <div className="space-y-2 p-3 bg-slate-50 rounded-md border border-slate-200">
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
            <label className="text-xs text-slate-600 w-32 shrink-0">
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
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-500",
                  )}
                >
                  {y}yr
                </button>
              ))}
            </div>
          </div>

          {/* Defer window */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-600 w-32 shrink-0 flex items-center gap-1">
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
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-500",
                  )}
                >
                  {y}yr
                </button>
              ))}
            </div>
          </div>

          {/* Property value */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-600 w-32 shrink-0">
              {t("manager:npvScenarios.controls.propertyValue")}
            </label>
            <div className="flex-1 flex items-center gap-1">
              <span className="text-xs text-slate-400">CHF</span>
              <input
                type="number"
                min={0}
                step={50000}
                value={propertyValueChf}
                onChange={(e) => setPropertyValueChf(e.target.value)}
                placeholder={t("manager:npvScenarios.controls.propertyValuePlaceholder")}
                className="flex-1 text-xs border border-slate-300 rounded px-2 py-0.5 font-mono text-slate-700 focus:outline-none focus:border-slate-500"
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
          <p className="text-sm text-slate-400">{t("manager:npvScenarios.text.selectBuilding")}</p>
        )}

        {/* FCI + tax rate context strip */}
        {!loading && data && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1">
                {t("manager:npvScenarios.text.fciLabel")}
                <Tooltip content={t("manager:npvScenarios.tooltip.fci")} />
              </span>
              <span className="flex items-center gap-1">
                <span className="text-slate-400">{t("manager:npvScenarios.text.fciCurrent")}</span>
                <span className={cn("font-mono font-semibold", fciColor(data.fciCurrentPct))}>
                  {data.fciCurrentPct.toFixed(1)}%
                </span>
              </span>
              <span className="text-slate-300">→</span>
              <span className="flex items-center gap-1">
                <span className="text-slate-400">
                  {t("manager:npvScenarios.text.fciAtHorizon", { year: data.toYear })}
                </span>
                <span className={cn("font-mono font-semibold", fciColor(data.fciNeglectHorizonPct))}>
                  {data.fciNeglectHorizonPct.toFixed(1)}%
                </span>
              </span>
            </div>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="text-slate-400 italic">
              {t("manager:npvScenarios.text.fciThresholds")}
            </span>
            <span className="ml-auto text-slate-400 shrink-0">
              {data.ownerTaxRateIsDefault
                ? t("manager:npvScenarios.text.taxShieldDefaultNote", { rate: data.ownerMarginalTaxRatePct })
                : t("manager:npvScenarios.text.taxShieldNote", { rate: data.ownerMarginalTaxRatePct })}
            </span>
          </div>
        )}

        {/* Scenario cards */}
        {!loading && data && (
          <>
            {/* Delta callout */}
            {investNeglectDelta !== 0 && (
              <div className={cn(
                "rounded-md border px-3 py-2 text-xs font-medium",
                investNeglectDelta > 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800",
              )}>
                {investNeglectDelta > 0
                  ? t("manager:npvScenarios.delta.investWins", {
                      delta: formatChf(Math.abs(investNeglectDelta)),
                      years: data.horizonYears,
                    })
                  : t("manager:npvScenarios.delta.neglectWins", {
                      delta: formatChf(Math.abs(investNeglectDelta)),
                      years: data.horizonYears,
                    })
                }
              </div>
            )}

            {/* Strategy recommendation strip */}
            {strategyContext?.hasProfile && strategyContext.rationale && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex items-start gap-2">
                <span className="shrink-0 mt-px text-slate-400">★</span>
                <span>{strategyContext.rationale}</span>
              </div>
            )}
            {!strategyContext?.hasProfile && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 flex items-center justify-between gap-2">
                <span>{t("manager:npvScenarios.strategy.noProfileHint")}</span>
                <a
                  href="/owner/strategy"
                  className="shrink-0 text-slate-700 font-medium underline hover:text-slate-900"
                >
                  {t("manager:npvScenarios.strategy.noProfileLink")}
                </a>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ScenarioCard
                scenarioKey="invest"
                label={t("manager:npvScenarios.scenario.invest")}
                hint={t("manager:npvScenarios.scenario.investHint")}
                data={data.scenarios.invest}
                style={SCENARIO_STYLES.invest}
                t={t}
                isRecommended={recommendedScenario === "invest"}
                summary={buildSummary("invest")}
              />
              <ScenarioCard
                scenarioKey="defer"
                label={t("manager:npvScenarios.scenario.defer", { years: data.deferYears })}
                hint={t("manager:npvScenarios.scenario.deferHint", { years: data.deferYears })}
                data={data.scenarios.defer}
                style={SCENARIO_STYLES.defer}
                t={t}
                isRecommended={recommendedScenario === "defer"}
                summary={buildSummary("defer")}
                identicalNotice={isIdenticalDeferInvest
                  ? t("manager:npvScenarios.notice.identicalScenarios", { years: data.deferYears })
                  : null
                }
              />
              <div className="flex flex-col gap-1">
                <ScenarioCard
                  scenarioKey="neglect"
                  label={t("manager:npvScenarios.scenario.neglect")}
                  hint={t("manager:npvScenarios.scenario.neglectHint")}
                  data={data.scenarios.neglect}
                  style={SCENARIO_STYLES.neglect}
                  t={t}
                  isRecommended={recommendedScenario === "neglect"}
                  summary={buildSummary("neglect")}
                />
                {!data.terminalValueModeled && (
                  <p className="text-xs text-slate-400 italic px-1">
                    {t("manager:npvScenarios.text.terminalValueMissing")}
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400">
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
