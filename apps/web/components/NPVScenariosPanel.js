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
 *
 * Each scenario card shows: NPV, total capex, total NOI, and a
 * year-by-year cumulative PV bar.
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { authHeaders } from "../lib/api";
import { formatChf } from "../lib/format";
import { cn } from "../lib/utils";
import Panel from "./layout/Panel";

// ─── Scenario colours ─────────────────────────────────────────

const SCENARIO_STYLES = {
  invest:  { bg: "bg-emerald-50",  border: "border-emerald-200", title: "text-emerald-800", value: "text-emerald-700", bar: "bg-emerald-500" },
  defer:   { bg: "bg-amber-50",    border: "border-amber-200",   title: "text-amber-800",   value: "text-amber-700",  bar: "bg-amber-400"  },
  neglect: { bg: "bg-red-50",      border: "border-red-200",     title: "text-red-800",     value: "text-red-700",    bar: "bg-red-400"    },
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

function ScenarioCard({ scenario, label, hint, data, style }) {
  if (!data) return null;
  const { npvChf, totalCapexChf, totalNoiChf, yearlyFlows } = data;

  return (
    <div className={cn("rounded-lg border p-4 space-y-2", style.bg, style.border)}>
      <div>
        <p className={cn("text-sm font-semibold", style.title)}>{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide">NPV</p>
        <p className={cn("text-xl font-bold font-mono", style.value)}>
          CHF {formatChf(npvChf)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
        <div>
          <span className="text-slate-400">Total NOI</span>
          <p className="font-mono font-medium">CHF {formatChf(totalNoiChf)}</p>
        </div>
        <div>
          <span className="text-slate-400">Capex</span>
          <p className="font-mono font-medium">CHF {formatChf(totalCapexChf)}</p>
        </div>
      </div>

      <CumulativeBars flows={yearlyFlows} color={style.bar} />

      <div className="flex justify-between text-xs text-slate-400 pt-0.5">
        <span>{yearlyFlows?.[0]?.year}</span>
        <span>{yearlyFlows?.[yearlyFlows.length - 1]?.year}</span>
      </div>
    </div>
  );
}

// ─── Slider control ───────────────────────────────────────────

function SliderRow({ label, value, min, max, step, onChange, format }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-slate-600 w-32 shrink-0">{label}</label>
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
  const [propertyValueChf, setPropertyValueChf] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchScenarios = useCallback(async (id, discount, growth, horizon, propertyValue) => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        discountRatePct: String(discount),
        incomeGrowthRatePct: String(growth),
        horizonYears: String(horizon),
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
      fetchScenarios(buildingId, discountRatePct, incomeGrowthRatePct, horizonYears, isFinite(parsed) ? parsed : 0);
    }
  }, [buildingId, discountRatePct, incomeGrowthRatePct, horizonYears, propertyValueChf, fetchScenarios]);

  const subtitle = data
    ? `${data.fromYear}–${data.toYear} · ${t("manager:npvScenarios.text.baseNoi")} CHF ${formatChf(data.baseAnnualNoiChf)}/yr`
    : undefined;

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
          />
          <SliderRow
            label={t("manager:npvScenarios.controls.incomeGrowth")}
            value={incomeGrowthRatePct}
            min={0} max={5} step={0.5}
            onChange={setIncomeGrowthRatePct}
            format={(v) => `${v}%`}
          />
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

        {/* Scenario cards */}
        {!loading && data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ScenarioCard
                scenario="invest"
                label={t("manager:npvScenarios.scenario.invest")}
                hint={t("manager:npvScenarios.scenario.investHint")}
                data={data.scenarios.invest}
                style={SCENARIO_STYLES.invest}
              />
              <ScenarioCard
                scenario="defer"
                label={t("manager:npvScenarios.scenario.defer", { years: data.deferYears })}
                hint={t("manager:npvScenarios.scenario.deferHint", { years: data.deferYears })}
                data={data.scenarios.defer}
                style={SCENARIO_STYLES.defer}
              />
              <div className="flex flex-col gap-1">
                <ScenarioCard
                  scenario="neglect"
                  label={t("manager:npvScenarios.scenario.neglect")}
                  hint={t("manager:npvScenarios.scenario.neglectHint")}
                  data={data.scenarios.neglect}
                  style={SCENARIO_STYLES.neglect}
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
