/**
 * RenovationSimulatorFullScreen
 * (exported as RenovationSimulatorDrawer for import compatibility)
 *
 * Full-screen NPV simulation tool for single or bundled assets.
 * Launched directly from the opportunity list (no intermediate drawer).
 *
 * Layout:
 *   Sticky top  — controls: Action / Timing / Horizon / key metrics
 *   Section 1   — cumulative NPV chart (Chart.js)
 *   Section 2   — recommendation card + delta callout
 *   Section 3   — per-asset breakdown (cost / uplift / Do Nothing risk)
 *   Footer      — 'Plan this work' → records AssetIntervention per asset
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Check, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";
import { authHeaders } from "../lib/api";
import { useTheme } from "../hooks/useTheme";
import Tooltip from "./Tooltip";

// Plain-language glosses for the jargon controls (novice hand-holding)
const HINTS = {
  oblf: "How much of the renovation cost Swiss law (OBLF Art. 14) lets you add to the rent — typically 50–70%.",
  discount: "Your yearly hurdle rate: future money is worth less today, so we shrink it by this % per year.",
  capRate: "Used to estimate resale value from rent: a lower cap rate implies a more valuable building.",
  vacancy: "Days the unit sits empty during the works (no rent collected). Use 0 when the work won't stop the unit being rented — e.g. swapping a dishwasher.",
  doNothingRisk: "Expected yearly cost of NOT renovating: likely breakdowns plus rent-reduction risk if the unit degrades.",
  rentUplift: "Extra monthly rent you can charge after the renovation, under OBLF Art. 14.",
};

// ── Failure-rate model ────────────────────────────────────────────────────────
// Base annual probability that the asset will need a repair if left as-is.
const BASE_FAILURE_RATE = {
  APPLIANCE:  0.08,
  SYSTEM:     0.06,
  FIXTURE:    0.03,
  FINISH:     0.01,
  STRUCTURAL: 0.005,
  OTHER:      0.04,
};

function depreciationMultiplier(pct) {
  if (pct >= 100) return 4.0;
  if (pct >= 85)  return 2.5;
  if (pct >= 65)  return 1.5;
  return 1.0;
}

// Expected annual repair cost if left as-is (Do Nothing failure risk).
function annualFailureCost(item) {
  const rate = BASE_FAILURE_RATE[item.assetType] ?? 0.04;
  const mult = depreciationMultiplier(item.depreciationPct ?? 0);
  return rate * mult * (item.estimatedReplacementCostChf ?? 0);
}

// CO Art. 259d probability-weighted rent reduction risk (annual).
const RENT_REDUCTION_PROB = { DAMAGED: 0.40, POOR: 0.20, FAIR: 0.05, GOOD: 0 };
const RENT_REDUCTION_PCT  = 0.10; // 10 % of monthly rent per at-risk asset

function annualRentReductionRisk(item, monthlyRentChf) {
  const prob = RENT_REDUCTION_PROB[item.lastConditionStatus] ?? 0;
  return prob * monthlyRentChf * RENT_REDUCTION_PCT * 12;
}

// ── NPV engine ────────────────────────────────────────────────────────────────

function computeSimulation({
  totalCostChf,
  totalMonthlyUplift,
  monthlyRentChf,
  monthlyDoNothingDeduction,
  discountRatePct,
  yearsHorizon,
  vacancyDays,
  leaseRemainingMonths,
  capRatePct,
}) {
  const r       = discountRatePct / 100 / 12;
  const horizon = yearsHorizon * 12;
  const lrm     = leaseRemainingMonths ?? 24;
  const newRent = monthlyRentChf + totalMonthlyUplift;
  // Vacancy is measured in days (works can be a matter of hours) → a one-time
  // lost-rent cost, not a whole-month gap. 0 = work doesn't stop the unit renting.
  const vacRentLoss = monthlyRentChf * ((vacancyDays ?? 0) / 30.44);

  const terminalChf = capRatePct > 0 ? (totalMonthlyUplift * 12) / (capRatePct / 100) : 0;
  const pvTerminal  = terminalChf > 0 ? terminalChf * Math.pow(1 + r, -horizon) : 0;

  let cumNow = -totalCostChf - vacRentLoss;
  let cumTur = 0;
  let cumNot = 0;
  let turInvested = false;
  let breakevenNow = null, breakevenTur = null;

  const nowYearly = [], turYearly = [], notYearly = [];

  for (let m = 1; m <= horizon; m++) {
    const d = r === 0 ? 1 : Math.pow(1 + r, -m);

    // Do Nothing: current rent minus expected failure/reduction costs
    cumNot += (monthlyRentChf - monthlyDoNothingDeduction) * d;

    // Act Now: new rent from month 1 (vacancy already deducted once above)
    cumNow += newRent * d;

    // At Turnover: current (minus risk) until lease ends, then invest + new rent
    if (m <= lrm) {
      cumTur += (monthlyRentChf - monthlyDoNothingDeduction) * d;
    } else {
      if (!turInvested) {
        const dAtTur = r === 0 ? 1 : Math.pow(1 + r, -lrm);
        cumTur -= (totalCostChf + vacRentLoss) * dAtTur;
        turInvested = true;
      }
      if (m > lrm) cumTur += newRent * d;
    }

    if (breakevenNow === null && cumNow >= cumNot) breakevenNow = m;
    if (breakevenTur === null && cumTur  >= cumNot) breakevenTur  = m;

    if (m % 12 === 0) {
      const y = m / 12;
      const tv = y === yearsHorizon ? pvTerminal : 0;
      nowYearly.push({ year: y, value: Math.round(cumNow + tv) });
      turYearly.push({ year: y, value: Math.round(cumTur + tv) });
      notYearly.push({ year: y, value: Math.round(cumNot) });
    }
  }

  return {
    npvNow: Math.round(cumNow + pvTerminal),
    npvTur: Math.round(cumTur + pvTerminal),
    npvNot: Math.round(cumNot),
    breakevenNow,
    breakevenTur,
    nowYearly,
    turYearly,
    notYearly,
    terminalChf: Math.round(terminalChf),
  };
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtChf(v) {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v), s = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${s}CHF ${(abs / 1_000_000).toFixed(2).replace(".", "'")}M`;
  if (abs >= 1_000)     return `${s}CHF ${(abs / 1_000).toFixed(1).replace(".", "'")}k`;
  return `${s}CHF ${abs.toFixed(0)}`;
}

function fmtMo(m) {
  if (m == null) return "—";
  return m < 12 ? `${m} mo` : `${(m / 12).toFixed(1)} yr`;
}

// ── Chart component ───────────────────────────────────────────────────────────

// Resolve the chart palette from the live CSS token layer so the canvas (which
// cannot consume Tailwind classes) tracks the same light/dark tokens as the
// rest of the app. `.dark` on <html> redefines these custom properties, so
// reading them at draw time is the single source of truth for either theme.
function readChartPalette() {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  const isDark = !!root && root.classList.contains("dark");
  const css = root ? getComputedStyle(root) : null;
  const tok = (name, fallback) => {
    const v = css?.getPropertyValue(name)?.trim();
    return v || fallback;
  };
  return {
    isDark,
    // Series colours — kept distinct and high-contrast against the surface in
    // both themes. "Act Now" is the hero line, so it tracks the foreground
    // token (slate-900 / white); the dark slate-800 it used before was nearly
    // invisible on the dark navy surface.
    actNow:    isDark ? "#f1f5f9" : "#1e293b",
    turnover:  tok("--color-warning-text", isDark ? "#fbbf24" : "#b45309"),
    doNothing: isDark ? "#94a3b8" : "#94a3b8",
    // Chrome — grid, axis ticks, legend text — all token-backed.
    grid: tok("--color-surface-divider", "#f1f5f9"),
    text: tok("--color-muted", "#64748b"),
  };
}

function NpvChart({ nowYearly, turYearly, notYearly }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    let alive = true;
    import("chart.js").then(({ Chart, registerables }) => {
      if (!alive || !canvasRef.current) return;
      Chart.register(...registerables);
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

      const c = readChartPalette();

      const datasets = [];
      datasets.push({
        label: "Act Now",
        data: nowYearly.map((d) => d.value),
        borderColor: c.actNow,
        backgroundColor: "transparent",
        borderWidth: 2.5,
        tension: 0.3,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
      });
      datasets.push({
        label: "At Turnover",
        data: turYearly.map((d) => d.value),
        borderColor: c.turnover,
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [6, 3],
        tension: 0.3,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
      });
      datasets.push({
        label: "Do Nothing",
        data: notYearly.map((d) => d.value),
        borderColor: c.doNothing,
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [3, 3],
        tension: 0.3,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 4,
      });

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: { labels: nowYearly.map((d) => `Yr ${d.year}`), datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { position: "top", labels: { color: c.text, font: { size: 11 }, boxWidth: 16, padding: 12 } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtChf(ctx.parsed.y)}` } },
          },
          scales: {
            x: { grid: { color: c.grid }, border: { color: c.grid }, ticks: { color: c.text, font: { size: 10 } } },
            y: {
              grid: { color: c.grid },
              border: { color: c.grid },
              ticks: { color: c.text, font: { size: 10 }, callback: (v) => fmtChf(v) },
            },
          },
        },
      });
    });
    return () => {
      alive = false;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [nowYearly, turYearly, notYearly, theme]);

  return <canvas ref={canvasRef} />;
}

// ── Scenario card ─────────────────────────────────────────────────────────────

function ScenarioCard({ label, hint, npv, summary, isBest, breakeven, selectable, selected, onSelect, dimmed, selectedLabel = "To plan" }) {
  const Comp = selectable ? "button" : "div";
  return (
    <Comp
      type={selectable ? "button" : undefined}
      onClick={selectable ? onSelect : undefined}
      className={cn(
        "relative w-full text-left rounded-xl p-4 space-y-2 transition-colors",
        selected
          ? "border-2 border-brand shadow-sm bg-surface ring-1 ring-brand-ring"
          : isBest
            ? "border border-brand-ring bg-surface"
            : "border border-surface-border bg-surface",
        selectable && !selected && "hover:border-brand-ring cursor-pointer",
        dimmed && !selected && "opacity-60",
      )}
    >
      {isBest && (
        <span className="absolute -top-2.5 left-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide shadow-sm">
          Best NPV
        </span>
      )}
      {selected && (
        <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
          <Check className="h-3 w-3" /> {selectedLabel}
        </span>
      )}
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-foreground-dim">{hint}</p>
      </div>
      <p className={cn("text-2xl font-bold font-mono tabular-nums", npv >= 0 ? "text-foreground" : "text-destructive-text")}>
        {fmtChf(npv)}
      </p>
      {breakeven != null && (
        <p className="text-xs text-foreground-dim">Break-even in <strong className="text-foreground">{fmtMo(breakeven)}</strong></p>
      )}
      {summary && (
        <p className="text-xs border-t border-surface-divider pt-2 leading-relaxed text-muted-text">{summary}</p>
      )}
    </Comp>
  );
}

// ── Inputs rail: helpers ──────────────────────────────────────────────────────

// Small uppercase section heading inside the inputs rail.
function RailSection({ title, children }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-foreground-dim uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

// Segmented toggle. Horizontal for short option sets, vertical for long labels.
function RailToggle({ label, options, value, onChange, vertical }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground-dim">{label}</span>
      <div className={cn(
        "flex rounded-lg border border-surface-border overflow-hidden",
        vertical ? "flex-col divide-y divide-surface-border" : "divide-x divide-surface-border",
      )}>
        {options.map(([k, l]) => (
          <button key={k} onClick={() => onChange(k)}
            className={cn(
              "px-2 py-1.5 text-xs font-medium transition-colors",
              vertical ? "text-left" : "flex-1 text-center whitespace-nowrap",
              value === k ? "bg-slate-800 text-white" : "bg-surface text-foreground-dim hover:bg-surface-hover",
            )}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// Labelled number field laid out as a justified row (label left, input right).
function RailNum({ label, value, onChange, suffix, min, step, hint }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-foreground-dim flex items-center gap-0.5">
        {label}
        {hint && <Tooltip content={hint} />}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number" min={min ?? 0} step={step ?? 1} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 rounded border border-surface-border px-2 py-1 text-xs tabular-nums text-right focus:border-blue-400 focus:outline-none"
        />
        {suffix && <span className="text-xs text-foreground-dim w-7 text-left">{suffix}</span>}
      </div>
    </div>
  );
}

// Read-only computed metric chip for the results summary strip.
function SummaryStat({ label, value, tone, hint }) {
  const toneClass = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-foreground-dim uppercase tracking-wide flex items-center gap-0.5">
        {label}
        {hint && <Tooltip content={hint} />}
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", toneClass)}>{value}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RenovationSimulatorDrawer({ items, onClose, buildingId, embedded = false, onPlanned }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Tracks whether the full-screen tool is still mounted, so the multi-step
  // "Plan this work" flow never calls setState after the user closes it (CR-007).
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // Dialog a11y (CR-016): Escape closes the full-screen overlay and the close
  // button takes initial focus so keyboard users aren't stranded behind it.
  const closeBtnRef = useRef(null);
  useEffect(() => {
    if (embedded || !onClose) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const focusTimer = setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => { document.removeEventListener("keydown", onKey); clearTimeout(focusTimer); };
  }, [embedded, onClose]);

  // ── Controls ────────────────────────────────────────────────────────────────
  const [action,        setAction]        = useState("replace");
  const [horizon,       setHorizon]       = useState(10);
  const [passthroughPct, setPassthrough]  = useState(50);
  const [discountRate,  setDiscount]      = useState(5);
  const [capRate,       setCapRate]       = useState(5);
  const [vacancyDays,   setVacancy]       = useState(0);

  // Per-asset cost overrides (assetId → CHF)
  const [costOverrides, setCostOverrides] = useState({});

  // Which scenario "Plan this work" will schedule ("now" | "turnover").
  // null → follow the recommended (best) path automatically.
  const [planPath, setPlanPath] = useState(null);

  // Plan state
  const [planAdding, setPlanAdding] = useState(false);
  const [planMsg,    setPlanMsg]    = useState("");
  const [planId,     setPlanId]     = useState(null);

  const safeItems = Array.isArray(items) && items.length > 0 ? items : [];

  // Monthly rent: sum of unique unit rents (for vacancy cost & risk baseline)
  const unitRents = useMemo(() => {
    const seen = new Set();
    let total = 0;
    for (const it of safeItems) {
      if (it.currentLease && !seen.has(it.unitId)) {
        seen.add(it.unitId);
        total += it.currentLease.netRentChf ?? 0;
      }
    }
    return total || (safeItems[0]?.currentLease?.netRentChf ?? 0);
  }, [safeItems]);

  // Lease remaining: minimum across all assets (soonest turnover opportunity)
  const minLeaseRemaining = useMemo(() => {
    const vals = safeItems.map((i) => i.currentLease?.remainingMonths).filter((v) => v != null);
    return vals.length > 0 ? Math.min(...vals) : null;
  }, [safeItems]);

  // Per-asset row computations
  const assetRows = useMemo(() => safeItems.map((item) => {
    const defaultCost = action === "replace"
      ? (item.estimatedReplacementCostChf ?? 5000)
      : (item.annualRepairRate ?? 2000);
    const costChf     = costOverrides[item.assetId] ?? defaultCost;
    const lifeYears   = item.usefulLifeMonths ? Math.max(1, Math.round(item.usefulLifeMonths / 12)) : 10;
    const monthlyUpl  = costChf * passthroughPct / 100 / (lifeYears * 12);
    const failCost    = annualFailureCost(item);
    const rentRisk    = annualRentReductionRisk(item, unitRents);
    return { ...item, costChf, lifeYears, monthlyUpl, failCost, rentRisk, totalRisk: failCost + rentRisk };
  }), [safeItems, action, costOverrides, passthroughPct, unitRents]);

  // Aggregated values
  const totalCostChf           = useMemo(() => assetRows.reduce((s, a) => s + a.costChf, 0), [assetRows]);
  const totalMonthlyUplift     = useMemo(() => assetRows.reduce((s, a) => s + a.monthlyUpl, 0), [assetRows]);
  const monthlyDoNothingDeduct = useMemo(() => assetRows.reduce((s, a) => s + a.totalRisk / 12, 0), [assetRows]);

  // Simulation
  const result = useMemo(() => computeSimulation({
    totalCostChf,
    totalMonthlyUplift,
    monthlyRentChf:           unitRents,
    monthlyDoNothingDeduction: monthlyDoNothingDeduct,
    discountRatePct:          discountRate,
    yearsHorizon:             horizon,
    vacancyDays,
    leaseRemainingMonths:     minLeaseRemaining,
    capRatePct:               capRate,
  }), [totalCostChf, totalMonthlyUplift, unitRents, monthlyDoNothingDeduct, discountRate, horizon, vacancyDays, minLeaseRemaining, capRate]);

  // Best scenario — compared across all three, always
  const { npvNow, npvTur, npvNot } = result;
  const bestKey = (() => {
    const best = Math.max(npvNow, npvTur);
    if (best <= npvNot) return "nothing";
    return npvNow >= npvTur ? "now" : "turnover";
  })();
  const bestNpv  = bestKey === "now" ? npvNow : bestKey === "turnover" ? npvTur : npvNot;
  const delta    = bestNpv - npvNot;
  const bestBreakeven = bestKey === "now" ? result.breakevenNow : bestKey === "turnover" ? result.breakevenTur : null;

  // Selected scenario. Defaults to the best-NPV one (incl. "nothing" = hold).
  // Only "now"/"turnover" are schedulable; "nothing" means hold (nothing to plan).
  const selectedPath  = planPath ?? bestKey; // "now" | "turnover" | "nothing"
  const isSchedulable = selectedPath === "now" || selectedPath === "turnover";
  const isSuboptimal  = selectedPath !== bestKey; // selected a worse-than-best scenario
  const holdIsBest    = bestKey === "nothing";
  const selectedLabel = selectedPath === "now" ? "Act Now" : selectedPath === "turnover" ? "At Turnover" : "Do Nothing";

  // Recommendation text
  const verdict = useMemo(() => {
    if (bestKey === "nothing") {
      return "Based on these assumptions, doing nothing preserves returns best over this horizon. Consider revisiting if costs or rent levels change.";
    }
    const when = bestKey === "now" ? "Acting now" : `Waiting for turnover (~${fmtMo(minLeaseRemaining)})`;
    const be   = bestBreakeven ? `breaks even in ${fmtMo(bestBreakeven)}` : "does not break even within this horizon";
    return `${when} yields the best return — ${fmtChf(delta)} more than doing nothing. The investment ${be}.`;
  }, [bestKey, delta, bestBreakeven, minLeaseRemaining]);

  // Schedule assets in an existing (or new) DRAFT cashflow plan for the building.
  const handleAddToPlan = useCallback(async () => {
    if (!buildingId || assetRows.length === 0) return;
    if (selectedPath !== "now" && selectedPath !== "turnover") return; // hold = nothing to schedule
    setPlanAdding(true); setPlanMsg("");
    try {
      // Determine the planned intervention year
      const d = new Date();
      if (selectedPath !== "now" && minLeaseRemaining != null) d.setMonth(d.getMonth() + minLeaseRemaining);
      const overriddenYear = d.getFullYear();

      // Fetch existing plans for this building
      const plansRes = await fetch(`/api/cashflow-plans?buildingId=${buildingId}`, {
        headers: authHeaders(),
      });
      const plansData = await plansRes.json();
      const plans = plansData?.data ?? [];

      // Use the first DRAFT plan, or create a new one
      let planId = plans.find((p) => p.status === "DRAFT")?.id ?? null;
      if (!planId) {
        const createRes = await fetch("/api/cashflow-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            name: `Renovation ${overriddenYear}`,
            buildingId,
            horizonMonths: 60,
            // Align the plan's NPV assumptions with the simulator so the two agree
            discountRatePct: discountRate,
            capRatePct: capRate,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData?.data?.id) {
          throw new Error(createData?.error?.message ?? "Failed to create cashflow plan");
        }
        planId = createData.data.id;
      }

      // Add an override for each asset: shift its projected replacement to the planned year.
      // There is no batch/transactional endpoint, so attempt every override and report
      // partial success honestly rather than surfacing a generic error that hides the
      // fact that some overrides did land (CR-007).
      const currentYear = new Date().getFullYear();
      const settled = await Promise.allSettled(assetRows.map(async (row) => {
        const remainingYears = row.remainingLifeMonths != null
          ? Math.ceil(row.remainingLifeMonths / 12)
          : 0;
        const originalYear = Math.max(currentYear, currentYear + remainingYears);
        const res = await fetch(`/api/cashflow-plans/${planId}/overrides`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            assetId: row.assetId,
            originalYear,
            overriddenYear,
            // Renovation economics so the plan NPV reproduces the simulator
            costChf: Math.round(row.costChf),
            rentUpliftChfPerMonth: Math.round(row.monthlyUpl),
            riskAvoidedChfPerYear: Math.round(row.totalRisk),
            vacancyDays,                   // one-time lost rent (valued per unit server-side)
            oblfPassthroughPct: passthroughPct, // audit / reproduction
          }),
        });
        if (!res.ok) throw new Error(`override for ${row.assetId} failed (${res.status})`);
      }));

      const failed = settled.filter((s) => s.status === "rejected").length;
      if (!aliveRef.current) return;
      setPlanId(planId);
      if (failed === 0) {
        setPlanMsg(`✓ Scheduled in cashflow plan`);
      } else {
        setPlanMsg(`⚠ Scheduled ${assetRows.length - failed} of ${assetRows.length} — ${failed} failed; re-run to retry`);
      }
      onPlanned?.(planId);
    } catch (e) {
      if (aliveRef.current) setPlanMsg(`Error: ${e.message}`);
    } finally {
      if (aliveRef.current) setPlanAdding(false);
    }
  }, [buildingId, assetRows, selectedPath, minLeaseRemaining, discountRate, capRate, vacancyDays, passthroughPct, onPlanned]);

  const title = safeItems.length === 1
    ? safeItems[0].assetName
    : `${safeItems.length} assets bundled`;

  if (!mounted || safeItems.length === 0) return null;

  const body = (
    <div
      className={cn("flex flex-col bg-surface", embedded ? "" : "fixed inset-0 z-50")}
      style={{ isolation: "isolate" }}
      {...(!embedded ? { role: "dialog", "aria-modal": true, "aria-label": title } : {})}
    >

      {/* ── Sticky title bar ── */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-b border-surface-border bg-surface-subtle">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
          <p className="text-xs text-foreground-dim">
            {safeItems.map((i) => `Unit ${i.unitNumber}`).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
          </p>
        </div>
        {onClose && (
          <button ref={closeBtnRef} onClick={onClose} aria-label="Close simulator" className="rounded-lg p-1.5 text-foreground-dim hover:bg-surface-hover transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Two-column workspace: inputs rail | results ── */}
      <div className={cn("flex flex-col lg:flex-row", embedded ? "" : "flex-1 overflow-hidden")}>

        {/* ── Inputs rail ── */}
        <aside className={cn(
          "w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-surface-border bg-surface-subtle px-5 py-5 space-y-6",
          embedded ? "" : "overflow-y-auto",
        )}>

          <RailSection title="Scenario">
            <RailToggle label="Action"
              options={[["replace", "Replace"], ["repair", "Repair"]]}
              value={action} onChange={(v) => { setAction(v); setCostOverrides({}); }}
            />
            <RailToggle label="Horizon"
              options={[["5", "5 yr"], ["10", "10 yr"], ["15", "15 yr"]]}
              value={String(horizon)} onChange={(v) => setHorizon(Number(v))}
            />
          </RailSection>

          <div className="border-t border-surface-divider" />

          <RailSection title="Assumptions">
            <RailNum label="OBLF passthrough" value={passthroughPct} onChange={setPassthrough} suffix="%" min={10} step={5} hint={HINTS.oblf} />
            <RailNum label="Discount rate"    value={discountRate}   onChange={setDiscount}    suffix="%" min={1}  step={0.5} hint={HINTS.discount} />
            <RailNum label="Cap rate"         value={capRate}        onChange={setCapRate}     suffix="%" min={2}  step={0.5} hint={HINTS.capRate} />
            <RailNum label="Vacancy"          value={vacancyDays}    onChange={setVacancy}     suffix="days" min={0} step={1} hint={HINTS.vacancy} />
          </RailSection>

          <div className="border-t border-surface-divider" />

          <RailSection title={`Asset cost${assetRows.length !== 1 ? "s" : ""} (CHF)`}>
            {assetRows.map((row) => (
              <div key={row.assetId} className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground truncate" title={row.assetName}>{row.assetName}</span>
                <input
                  type="number" min={0} step={100}
                  value={costOverrides[row.assetId] ?? row.costChf}
                  onChange={(e) => setCostOverrides((prev) => ({ ...prev, [row.assetId]: Number(e.target.value) }))}
                  className="w-24 shrink-0 rounded border border-surface-border px-2 py-1 text-xs tabular-nums text-right focus:border-blue-400 focus:outline-none"
                />
              </div>
            ))}
          </RailSection>
        </aside>

        {/* ── Results column ── */}
        <div className={cn("flex-1", embedded ? "" : "overflow-y-auto")}>
          <div className="mx-auto max-w-4xl px-5 py-6 space-y-6">

          {/* Computed summary strip */}
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-surface-border bg-surface px-4 py-3 shadow-sm">
            <SummaryStat label="Total investment" value={fmtChf(totalCostChf)} />
            <SummaryStat label="Rent uplift" value={`+CHF ${totalMonthlyUplift.toFixed(0)}/mo`} tone="green" hint={HINTS.rentUplift} />
            <SummaryStat label="Do Nothing risk" value={`${fmtChf(monthlyDoNothingDeduct * 12)}/yr`} tone="red" hint={HINTS.doNothingRisk} />
          </div>

          {/* Chart */}
          <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-medium text-foreground-dim uppercase tracking-wide mb-4">
              Cumulative NPV over {horizon} years
            </p>
            <div style={{ height: 280 }}>
              <NpvChart
                nowYearly={result.nowYearly}
                turYearly={result.turYearly}
                notYearly={result.notYearly}
              />
            </div>
            {/* Breakeven annotations */}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-foreground-dim">
              {result.breakevenNow != null && (
                <span>
                  <span className="inline-block h-0.5 w-3 rounded bg-foreground align-middle mr-1.5" />
                  Act Now breaks even at <strong className="text-foreground">{fmtMo(result.breakevenNow)}</strong>
                </span>
              )}
              {result.breakevenTur != null && (
                <span>
                  <span className="inline-block h-0.5 w-3 rounded bg-warning-text align-middle mr-1.5" />
                  At Turnover breaks even at <strong className="text-foreground">{fmtMo(result.breakevenTur)}</strong>
                </span>
              )}
              {monthlyDoNothingDeduct > 0 && (
                <span className="text-foreground-dim italic">
                  Do Nothing includes {fmtChf(monthlyDoNothingDeduct * 12)}/yr expected failure + rent-reduction risk (CO Art. 259d)
                </span>
              )}
            </div>
          </div>

          {/* Scenario cards — all three compared; pick the one to schedule */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ScenarioCard
                label="Act Now"
                hint="Renovate immediately"
                npv={npvNow}
                isBest={bestKey === "now"}
                breakeven={result.breakevenNow}
                selectable
                selected={selectedPath === "now"}
                dimmed={holdIsBest}
                onSelect={() => setPlanPath("now")}
                summary={
                  npvNow > npvNot
                    ? `${fmtChf(npvNow - npvNot)} better than doing nothing.`
                    : "Does not outperform doing nothing in this horizon."
                }
              />
              <ScenarioCard
                label="At Turnover"
                hint={minLeaseRemaining != null ? `In ~${fmtMo(minLeaseRemaining)}` : "When current lease ends"}
                npv={npvTur}
                isBest={bestKey === "turnover"}
                breakeven={result.breakevenTur}
                selectable
                selected={selectedPath === "turnover"}
                dimmed={holdIsBest}
                onSelect={() => setPlanPath("turnover")}
                summary={
                  npvTur > npvNot
                    ? `Avoids disrupting current tenant. ${fmtChf(npvTur - npvNot)} better than doing nothing.`
                    : "Does not outperform doing nothing in this horizon."
                }
              />
              <ScenarioCard
                label="Do Nothing"
                hint="Maintain as-is, risk-adjusted"
                npv={npvNot}
                isBest={bestKey === "nothing"}
                breakeven={null}
                selectable
                selected={selectedPath === "nothing"}
                selectedLabel="Holding"
                onSelect={() => setPlanPath("nothing")}
                summary={
                  delta > 0
                    ? `${fmtChf(delta)} less than the best renovation scenario.${monthlyDoNothingDeduct > 0 ? ` Includes ${fmtChf(monthlyDoNothingDeduct * 12)}/yr expected failure + tenant risk.` : ""}`
                    : "Returns best in this horizon — revisit if repair costs rise."
                }
              />
            </div>
            {isSuboptimal && (
              <div className="mt-2 rounded-lg border border-warning-ring bg-warning-light px-3 py-2">
                <p className="text-xs text-warning-text">
                  Heads up: <strong>{selectedLabel}</strong> doesn’t yield the best financial outcome
                  {selectedPath === "nothing" ? "" : " over this horizon"}. You can proceed at your own discretion.
                </p>
              </div>
            )}
          </div>

          {/* Recommendation strip */}
          <div className={cn("rounded-xl border px-4 py-3", delta > 0 && bestKey !== "nothing" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
            <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1", delta > 0 && bestKey !== "nothing" ? "text-emerald-700" : "text-amber-700")}>
              {delta > 0 && bestKey !== "nothing" ? `Recommendation: ${bestKey === "now" ? "Act Now" : "Wait for Turnover"}` : "Recommendation: Hold"}
            </p>
            <p className={cn("text-sm leading-relaxed", delta > 0 && bestKey !== "nothing" ? "text-emerald-900" : "text-amber-900")}>
              {verdict}
            </p>
            {result.terminalChf > 0 && (
              <p className={cn("text-xs mt-1.5", delta > 0 ? "text-emerald-700" : "text-amber-700")}>
                Includes terminal value {fmtChf(result.terminalChf)} (rent uplift capitalised at {capRate}% cap rate).
              </p>
            )}
          </div>

          {/* Asset breakdown */}
          <div className="rounded-2xl border border-surface-border bg-surface shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-divider">
              <p className="text-xs font-medium text-foreground-dim uppercase tracking-wide">Asset breakdown</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-divider bg-surface-subtle">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-foreground-dim">Asset</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-foreground-dim">Unit</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-foreground-dim">Cost (CHF)</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-foreground-dim">Rent uplift</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-foreground-dim">Failure risk/yr</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-foreground-dim">Rent risk/yr</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-foreground-dim">Total risk/yr</th>
                  </tr>
                </thead>
                <tbody>
                  {assetRows.map((row) => (
                    <tr key={row.assetId} className="border-b border-surface-divider last:border-0 hover:bg-surface-subtle">
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-foreground">{row.assetName}</p>
                        <p className="text-xs text-foreground-dim">{row.topic}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-foreground-dim">
                        {row.unitNumber}
                        {row.depreciationPct != null && <span className="block">{row.depreciationPct}% depr.</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-foreground font-medium">
                        {fmtChf(row.costChf)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-green-700 tabular-nums font-medium">
                        +CHF {row.monthlyUpl.toFixed(0)}/mo
                        <span className="block text-foreground-dim">{row.lifeYears}yr life</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                        <span className={row.failCost > 0 ? "text-red-600" : "text-foreground-dim"}>
                          {row.failCost > 0 ? fmtChf(row.failCost) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                        <span className={row.rentRisk > 0 ? "text-red-600" : "text-foreground-dim"}>
                          {row.rentRisk > 0 ? fmtChf(row.rentRisk) : "—"}
                        </span>
                        {row.lastConditionStatus && row.lastConditionStatus !== "GOOD" && (
                          <span className="block text-foreground-dim">{row.lastConditionStatus.toLowerCase()}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums">
                        <span className={row.totalRisk > 0 ? "text-red-600" : "text-foreground-dim"}>
                          {row.totalRisk > 0 ? fmtChf(row.totalRisk) : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-subtle border-t-2 border-surface-border">
                    <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-foreground">Total</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-foreground tabular-nums">{fmtChf(totalCostChf)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-green-700 tabular-nums">+CHF {totalMonthlyUplift.toFixed(0)}/mo</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-red-600 tabular-nums" colSpan={3}>
                      {fmtChf(monthlyDoNothingDeduct * 12)}/yr total risk
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-surface-divider bg-surface-subtle">
              <p className="text-xs text-foreground-dim leading-relaxed">
                <strong>Failure risk</strong> = base rate (by asset type) × depreciation multiplier × replacement cost.
                {" "}<strong>Rent risk</strong> = CO Art. 259d probability-weighted reduction (POOR: 20 %/yr, DAMAGED: 40 %/yr).
                {" "}<strong>OBLF Art. 14</strong> allows passing {passthroughPct}% of renovation cost to rent over the asset's useful life.
              </p>
            </div>
          </div>

          {/* Cashflow plan confirmation banner */}
          {planMsg.startsWith("✓") && planId && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
              <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800">Renovation scheduled in cashflow plan</p>
                <p className="text-xs text-green-700 mt-0.5">
                  {embedded
                    ? "These assets are now timed in your cashflow plan — review the NPV verdict, assumptions and approval below."
                    : "These assets are now timed in your cashflow plan. The Invest scenario reflects this capex automatically."}
                </p>
                {!embedded && (
                  <a
                    href={`/manager/cashflow/${planId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-green-800 underline underline-offset-2 mt-1.5 hover:text-green-900"
                  >
                    Open cashflow plan <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-wrap items-center gap-3 pb-2">
            {!planMsg.startsWith("✓") && (
              isSchedulable ? (
                <button
                  onClick={handleAddToPlan}
                  disabled={planAdding}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  <ArrowRight className="h-4 w-4" />
                  {planAdding ? "Scheduling…" : `Plan this work — ${selectedLabel} (${assetRows.length} asset${assetRows.length !== 1 ? "s" : ""})`}
                </button>
              ) : (
                <p className="text-sm text-foreground-dim">
                  Holding is best — nothing to schedule. Pick <strong className="text-foreground">Act Now</strong> or <strong className="text-foreground">At Turnover</strong> to plan work anyway.
                </p>
              )
            )}
            {planMsg && !planMsg.startsWith("✓") && (
              <p className="text-xs text-red-600">{planMsg}</p>
            )}
          </div>

          </div>
        </div>
      </div>
    </div>
  );

  return embedded ? body : createPortal(body, document.body);
}
