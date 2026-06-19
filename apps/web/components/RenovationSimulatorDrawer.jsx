import { useState, useMemo } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../lib/utils";

// ── NPV Engine (client-side) ──────────────────────────────────────────────────

function pvAnnuity(monthlyPmt, months, delayMonths, monthlyRate) {
  if (months <= 0 || monthlyPmt <= 0) return 0;
  const pv = monthlyRate === 0
    ? monthlyPmt * months
    : monthlyPmt * (1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate;
  return delayMonths > 0 ? pv / Math.pow(1 + monthlyRate, delayMonths) : pv;
}

function computeNpv({
  investmentCostChf,
  monthlyRentChf,
  passthroughPct,
  usefulLifeYears,
  discountRateAnnual,
  yearsHorizon,
  vacancyMonths,
  leaseRemainingMonths,
  capRatePct,
}) {
  const r       = discountRateAnnual / 100 / 12;
  const horizon = yearsHorizon * 12;

  const rentUpliftMonthly = usefulLifeYears > 0
    ? (investmentCostChf * passthroughPct / 100) / (usefulLifeYears * 12)
    : 0;
  const newRent = monthlyRentChf + rentUpliftMonthly;

  // Terminal value: capitalised rent uplift PV'd to end of horizon
  const terminalValueChf = capRatePct > 0 ? (rentUpliftMonthly * 12) / (capRatePct / 100) : 0;
  const pvTerminal = terminalValueChf > 0 ? terminalValueChf / Math.pow(1 + r, horizon) : 0;

  // A: Do Nothing
  const npvDoNothing = pvAnnuity(monthlyRentChf, horizon, 0, r);

  // B: Act Now
  const vacancyCost = monthlyRentChf * vacancyMonths;
  const npvActNow = -investmentCostChf - vacancyCost
    + pvAnnuity(newRent, Math.max(0, horizon - vacancyMonths), vacancyMonths, r)
    + pvTerminal;

  // Break-even for B vs A (month at which cumulative NPV_B catches up with NPV_A)
  let breakevenMonths = null;
  {
    let cumB = -investmentCostChf - vacancyCost;
    let cumA = 0;
    for (let t = 1; t <= horizon; t++) {
      const disc = Math.pow(1 + r, -t);
      cumA += monthlyRentChf * disc;
      cumB += (t > vacancyMonths ? newRent : 0) * disc;
      if (cumB >= cumA && breakevenMonths === null) { breakevenMonths = t; break; }
    }
  }

  // C: Wait for Turnover
  const lrm = leaseRemainingMonths ?? 24;
  const turnoverMonth     = Math.min(lrm, horizon);
  const renovationStart   = Math.min(turnoverMonth + vacancyMonths, horizon);
  const remainAfterReno   = Math.max(0, horizon - renovationStart);
  const npvWaitTurnover =
    pvAnnuity(monthlyRentChf, turnoverMonth, 0, r)
    - (investmentCostChf + monthlyRentChf * vacancyMonths) / Math.pow(1 + r, Math.max(1, turnoverMonth))
    + pvAnnuity(newRent, remainAfterReno, renovationStart, r)
    + pvTerminal;

  return { npvDoNothing, npvActNow, npvWaitTurnover, rentUpliftMonthly, breakevenMonths, terminalValueChf };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtChf(chf) {
  if (!Number.isFinite(chf)) return "—";
  const abs = Math.abs(chf);
  const sign = chf < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}CHF ${(abs / 1000).toFixed(1).replace(".", "'")}k`;
  return `${sign}CHF ${abs.toFixed(0)}`;
}

function DepBar({ pct }) {
  const capped = Math.min(100, pct ?? 0);
  const color = capped >= 100 ? "bg-red-500" : capped >= 85 ? "bg-orange-400" : capped >= 65 ? "bg-amber-400" : "bg-green-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-hover overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${capped}%` }} />
      </div>
      <span className="text-xs tabular-nums text-foreground-dim w-8 text-right">{pct ?? "—"}%</span>
    </div>
  );
}

const COND_COLORS = {
  GOOD:    { bg: "bg-green-100",  text: "text-green-700",  label: "Good" },
  FAIR:    { bg: "bg-amber-100",  text: "text-amber-700",  label: "Fair" },
  POOR:    { bg: "bg-orange-100", text: "text-orange-700", label: "Poor" },
  DAMAGED: { bg: "bg-red-100",    text: "text-red-700",    label: "Damaged" },
};

const REC_COLORS = {
  REPLACE:          { bg: "bg-red-100",    text: "text-red-700" },
  PLAN_REPLACEMENT: { bg: "bg-orange-100", text: "text-orange-700" },
  MONITOR:          { bg: "bg-amber-100",  text: "text-amber-700" },
  REPAIR:           { bg: "bg-green-100",  text: "text-green-700" },
};

function NumberInput({ label, value, onChange, min = 0, step = 1, suffix = "" }) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground-dim mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number" min={min} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-surface-border px-2.5 py-1.5 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {suffix && <span className="text-xs text-foreground-dim shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RenovationSimulatorDrawer({ item, onClose }) {
  const [investmentType, setInvestmentType] = useState("replace");
  const [investmentCost, setInvestmentCost] = useState(
    item?.estimatedReplacementCostChf ?? 5000
  );
  const [monthlyRent, setMonthlyRent] = useState(
    item?.currentLease?.netRentChf ?? 0
  );
  const [passthroughPct, setPassthroughPct] = useState(50);
  const [usefulLifeYears, setUsefulLifeYears] = useState(
    item?.usefulLifeMonths ? Math.max(1, Math.round(item.usefulLifeMonths / 12)) : 10
  );
  const [vacancyMonths, setVacancyMonths] = useState(2);
  const [discountRate, setDiscountRate] = useState(5);
  const [yearsHorizon, setYearsHorizon] = useState(10);
  const [capRate, setCapRate] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const leaseRemainingMonths = item?.currentLease?.remainingMonths ?? null;

  const result = useMemo(() => computeNpv({
    investmentCostChf:   investmentCost,
    monthlyRentChf:      monthlyRent,
    passthroughPct,
    usefulLifeYears,
    discountRateAnnual:  discountRate,
    yearsHorizon,
    vacancyMonths,
    leaseRemainingMonths,
    capRatePct:          capRate,
  }), [investmentCost, monthlyRent, passthroughPct, usefulLifeYears, discountRate, yearsHorizon, vacancyMonths, leaseRemainingMonths, capRate]);

  const scenarios = [
    {
      key: "now",
      label: "Act Now",
      sub: "Renovate immediately",
      npv: result.npvActNow,
      detail: result.breakevenMonths
        ? `Break-even in ${result.breakevenMonths < 12 ? `${result.breakevenMonths} mo` : `${(result.breakevenMonths / 12).toFixed(1)} yr`}`
        : "Break-even not reached in horizon",
    },
    {
      key: "turnover",
      label: "At Turnover",
      sub: leaseRemainingMonths != null ? `In ~${leaseRemainingMonths} months` : "When current lease ends",
      npv: result.npvWaitTurnover,
      detail: "Avoids disrupting current tenant",
    },
    {
      key: "nothing",
      label: "Do Nothing",
      sub: "Keep current rent",
      npv: result.npvDoNothing,
      detail: "No renovation cost, no rent uplift",
    },
  ];

  const bestNpv = Math.max(...scenarios.map((s) => s.npv));

  const cond = item?.lastConditionStatus;
  const condStyle = cond ? COND_COLORS[cond] : null;
  const recStyle = item?.recommendation ? REC_COLORS[item.recommendation] : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-xl overflow-y-auto bg-surface shadow-2xl border-l border-surface-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-surface-border bg-surface px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground truncate">{item?.assetName ?? "Asset"}</h2>
            <p className="text-xs text-foreground-dim mt-0.5">{item?.topic} · Unit {item?.unitNumber}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground-dim hover:bg-surface-hover transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Asset status */}
          <div className="flex flex-wrap gap-2 items-center">
            <DepBar pct={item?.depreciationPct} />
            {recStyle && (
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", recStyle.bg, recStyle.text)}>
                {item.recommendation.replace("_", " ")}
              </span>
            )}
            {condStyle && (
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", condStyle.bg, condStyle.text)}>
                Condition: {condStyle.label}
              </span>
            )}
            {item?.remainingLifeMonths != null && (
              <span className="text-xs text-foreground-dim">
                {item.remainingLifeMonths < 12 ? `${item.remainingLifeMonths} mo left` : `${(item.remainingLifeMonths / 12).toFixed(1)} yr left`}
              </span>
            )}
          </div>

          {/* Investment type toggle */}
          <div>
            <label className="block text-xs font-medium text-foreground-dim mb-2">Investment type</label>
            <div className="flex rounded-lg border border-surface-border overflow-hidden">
              {[["replace", "Replace"], ["repair", "Repair"]].map(([k, l]) => (
                <button key={k} onClick={() => {
                  setInvestmentType(k);
                  if (k === "replace" && item?.estimatedReplacementCostChf) setInvestmentCost(item.estimatedReplacementCostChf);
                  if (k === "repair" && item?.annualRepairRate) setInvestmentCost(item.annualRepairRate);
                }} className={cn("flex-1 py-1.5 text-sm font-medium transition-colors", investmentType === k ? "bg-brand text-white" : "bg-surface text-foreground-dim hover:bg-surface-hover")}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Core inputs */}
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Investment cost (CHF)" value={investmentCost} onChange={setInvestmentCost} min={0} step={500} />
            <NumberInput label="Current monthly rent (CHF)" value={monthlyRent} onChange={setMonthlyRent} min={0} step={50} />
            <NumberInput label="OBLF passthrough (%)" value={passthroughPct} onChange={setPassthroughPct} min={0} step={5} suffix="%" />
            <NumberInput label="Asset useful life (yr)" value={usefulLifeYears} onChange={setUsefulLifeYears} min={1} step={1} />
          </div>

          {/* Allowable rent uplift */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-xs font-medium text-blue-700">Allowable monthly rent uplift (OBLF Art. 14)</p>
            <p className="text-lg font-bold text-blue-900 mt-0.5">CHF {result.rentUpliftMonthly.toFixed(0)}/mo</p>
            <p className="text-xs text-blue-600 mt-1">
              {passthroughPct}% of CHF {investmentCost.toLocaleString()} amortised over {usefulLifeYears} yr ÷ 12
            </p>
          </div>

          {/* Advanced inputs */}
          <div>
            <button onClick={() => setShowAdvanced(v => !v)} className="flex items-center gap-1 text-xs text-foreground-dim hover:text-foreground transition-colors">
              {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Advanced assumptions
            </button>
            {showAdvanced && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumberInput label="Vacancy on renovation (mo)" value={vacancyMonths} onChange={setVacancyMonths} min={0} step={1} />
                <NumberInput label="Discount rate (%)" value={discountRate} onChange={setDiscountRate} min={0} step={0.5} suffix="%" />
                <NumberInput label="Time horizon (yr)" value={yearsHorizon} onChange={setYearsHorizon} min={1} step={1} />
                <NumberInput label="Cap rate for terminal value (%)" value={capRate} onChange={setCapRate} min={0} step={0.5} suffix="%" />
              </div>
            )}
          </div>

          {/* Scenario results */}
          <div>
            <p className="text-xs font-medium text-foreground-dim uppercase tracking-wide mb-3">NPV over {yearsHorizon} yr horizon</p>
            <div className="space-y-2">
              {scenarios.map((s) => {
                const isBest = s.npv === bestNpv && s.npv > result.npvDoNothing;
                return (
                  <div key={s.key} className={cn("rounded-2xl border p-4 transition-colors", isBest ? "border-green-300 bg-green-50" : "border-surface-border bg-surface")}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{s.label}</span>
                          {isBest && <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">Best NPV</span>}
                        </div>
                        <p className="text-xs text-foreground-dim mt-0.5">{s.sub}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-xl font-bold tabular-nums", s.npv >= 0 ? "text-foreground" : "text-red-600")}>
                          {fmtChf(s.npv)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-foreground-dim">{s.detail}</p>
                    {s.key !== "nothing" && result.terminalValueChf > 0 && (
                      <p className="mt-1 text-xs text-foreground-dim">incl. terminal value {fmtChf(result.terminalValueChf)} @ {capRate}% cap rate</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legislative footnote */}
          <div className="rounded-xl border border-surface-border bg-surface-subtle px-4 py-3">
            <p className="text-xs text-foreground-dim leading-relaxed">
              <strong className="text-foreground">OBLF Art. 14</strong> — Swiss law permits landlords to increase annual rent by up to {passthroughPct}% of net renovation costs (value-adding works only), amortised over the asset's useful life. Passthrough rate may vary by canton and renovation type. Consult your legal sources for canton-specific rules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
