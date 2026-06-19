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
  vacancyMonths,
  leaseRemainingMonths,
  capRatePct,
}) {
  const r       = discountRatePct / 100 / 12;
  const horizon = yearsHorizon * 12;
  const lrm     = leaseRemainingMonths ?? 24;
  const newRent = monthlyRentChf + totalMonthlyUplift;

  const terminalChf = capRatePct > 0 ? (totalMonthlyUplift * 12) / (capRatePct / 100) : 0;
  const pvTerminal  = terminalChf > 0 ? terminalChf * Math.pow(1 + r, -horizon) : 0;

  let cumNow = -totalCostChf - monthlyRentChf * vacancyMonths;
  let cumTur = 0;
  let cumNot = 0;
  let turInvested = false;
  let breakevenNow = null, breakevenTur = null;

  const nowYearly = [], turYearly = [], notYearly = [];

  for (let m = 1; m <= horizon; m++) {
    const d = r === 0 ? 1 : Math.pow(1 + r, -m);

    // Do Nothing: current rent minus expected failure/reduction costs
    cumNot += (monthlyRentChf - monthlyDoNothingDeduction) * d;

    // Act Now: vacancy then new rent
    cumNow += (m > vacancyMonths ? newRent : 0) * d;

    // At Turnover: current (minus risk) until lease ends, then invest + new rent
    if (m <= lrm) {
      cumTur += (monthlyRentChf - monthlyDoNothingDeduction) * d;
    } else {
      if (!turInvested) {
        const dAtTur = r === 0 ? 1 : Math.pow(1 + r, -lrm);
        cumTur -= (totalCostChf + monthlyRentChf * vacancyMonths) * dAtTur;
        turInvested = true;
      }
      if (m > lrm + vacancyMonths) cumTur += newRent * d;
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

function NpvChart({ nowYearly, turYearly, notYearly, timing }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    let alive = true;
    import("chart.js").then(({ Chart, registerables }) => {
      if (!alive || !canvasRef.current) return;
      Chart.register(...registerables);
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

      const datasets = [];
      if (timing !== "turnover") {
        datasets.push({
          label: "Act Now",
          data: nowYearly.map((d) => d.value),
          borderColor: "#1e293b",
          backgroundColor: "rgba(30,41,59,0.06)",
          borderWidth: 2.5,
          tension: 0.3,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
        });
      }
      if (timing !== "now") {
        datasets.push({
          label: "At Turnover",
          data: turYearly.map((d) => d.value),
          borderColor: "#d97706",
          backgroundColor: "rgba(217,119,6,0.06)",
          borderWidth: 2,
          borderDash: [6, 3],
          tension: 0.3,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
        });
      }
      datasets.push({
        label: "Do Nothing",
        data: notYearly.map((d) => d.value),
        borderColor: "#94a3b8",
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
            legend: { position: "top", labels: { font: { size: 11 }, boxWidth: 16, padding: 12 } },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtChf(c.parsed.y)}` } },
          },
          scales: {
            x: { grid: { color: "#f1f5f9" }, ticks: { font: { size: 10 } } },
            y: {
              grid: { color: "#f1f5f9" },
              ticks: { font: { size: 10 }, callback: (v) => fmtChf(v) },
            },
          },
        },
      });
    });
    return () => {
      alive = false;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [nowYearly, turYearly, notYearly, timing]);

  return <canvas ref={canvasRef} />;
}

// ── Scenario card ─────────────────────────────────────────────────────────────

function ScenarioCard({ label, hint, npv, summary, isBest, breakeven }) {
  return (
    <div className={cn(
      "relative rounded-xl p-4 space-y-2",
      isBest ? "border-2 border-slate-800 shadow-sm bg-surface" : "border border-surface-border bg-surface",
    )}>
      {isBest && (
        <span className="absolute -top-2.5 left-3 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
          Best NPV
        </span>
      )}
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-foreground-dim">{hint}</p>
      </div>
      <p className={cn("text-2xl font-bold font-mono tabular-nums", npv >= 0 ? "text-foreground" : "text-red-600")}>
        {fmtChf(npv)}
      </p>
      {breakeven != null && (
        <p className="text-xs text-foreground-dim">Break-even in <strong className="text-foreground">{fmtMo(breakeven)}</strong></p>
      )}
      {summary && (
        <p className="text-xs border-t border-surface-divider pt-2 leading-relaxed text-muted-text">{summary}</p>
      )}
    </div>
  );
}

// ── Controls: compact toggle button ──────────────────────────────────────────

function ToggleGroup({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-foreground-dim shrink-0">{label}</span>
      <div className="flex rounded-lg border border-surface-border overflow-hidden">
        {options.map(([k, l]) => (
          <button key={k} onClick={() => onChange(k)}
            className={cn("px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
              value === k ? "bg-slate-800 text-white" : "bg-surface text-foreground-dim hover:bg-surface-hover")}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, suffix, min, step }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-foreground-dim shrink-0">{label}</span>
      <div className="flex items-center gap-0.5">
        <input
          type="number" min={min ?? 0} step={step ?? 1} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-14 rounded border border-surface-border px-1.5 py-1 text-xs tabular-nums text-center focus:border-blue-400 focus:outline-none"
        />
        {suffix && <span className="text-xs text-foreground-dim">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RenovationSimulatorDrawer({ items, onClose, buildingId }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Controls ────────────────────────────────────────────────────────────────
  const [action,        setAction]        = useState("replace");
  const [timing,        setTiming]        = useState("both");
  const [horizon,       setHorizon]       = useState(10);
  const [passthroughPct, setPassthrough]  = useState(50);
  const [discountRate,  setDiscount]      = useState(5);
  const [capRate,       setCapRate]       = useState(5);
  const [vacancyMonths, setVacancy]       = useState(2);

  // Per-asset cost overrides (assetId → CHF)
  const [costOverrides, setCostOverrides] = useState({});

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
    vacancyMonths,
    leaseRemainingMonths:     minLeaseRemaining,
    capRatePct:               capRate,
  }), [totalCostChf, totalMonthlyUplift, unitRents, monthlyDoNothingDeduct, discountRate, horizon, vacancyMonths, minLeaseRemaining, capRate]);

  // Best scenario
  const { npvNow, npvTur, npvNot } = result;
  const bestKey = (() => {
    if (timing === "now")      return npvNow > npvNot ? "now"      : "nothing";
    if (timing === "turnover") return npvTur > npvNot ? "turnover" : "nothing";
    const best = Math.max(npvNow, npvTur);
    if (best <= npvNot)        return "nothing";
    return npvNow >= npvTur    ? "now" : "turnover";
  })();
  const bestNpv  = bestKey === "now" ? npvNow : bestKey === "turnover" ? npvTur : npvNot;
  const delta    = bestNpv - npvNot;
  const bestBreakeven = bestKey === "now" ? result.breakevenNow : bestKey === "turnover" ? result.breakevenTur : null;

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
    setPlanAdding(true); setPlanMsg("");
    try {
      // Determine the planned intervention year
      const d = new Date();
      if (timing !== "now" && minLeaseRemaining != null) d.setMonth(d.getMonth() + minLeaseRemaining);
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
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData?.data?.id) {
          throw new Error(createData?.error?.message ?? "Failed to create cashflow plan");
        }
        planId = createData.data.id;
      }

      // Add an override for each asset: shift its projected replacement to the planned year
      const currentYear = new Date().getFullYear();
      await Promise.all(assetRows.map((row) => {
        const remainingYears = row.remainingLifeMonths != null
          ? Math.ceil(row.remainingLifeMonths / 12)
          : 0;
        const originalYear = Math.max(currentYear, currentYear + remainingYears);
        return fetch(`/api/cashflow-plans/${planId}/overrides`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ assetId: row.assetId, originalYear, overriddenYear }),
        });
      }));

      setPlanId(planId);
      setPlanMsg(`✓ Scheduled in cashflow plan`);
    } catch (e) {
      setPlanMsg(`Error: ${e.message}`);
    } finally {
      setPlanAdding(false);
    }
  }, [buildingId, assetRows, timing, minLeaseRemaining]);

  const title = safeItems.length === 1
    ? safeItems[0].assetName
    : `${safeItems.length} assets bundled`;

  if (!mounted || safeItems.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-surface" style={{ isolation: "isolate" }}>

      {/* ── Sticky header + controls ── */}
      <div className="shrink-0 border-b border-surface-border bg-surface-subtle">

        {/* Title row */}
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
            <p className="text-xs text-foreground-dim">
              {safeItems.map((i) => `Unit ${i.unitNumber}`).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground-dim hover:bg-surface-hover transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Controls row 1: scenario toggles */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 pb-3">
          <ToggleGroup label="Action"
            options={[["replace", "Replace"], ["repair", "Repair"]]}
            value={action} onChange={(v) => { setAction(v); setCostOverrides({}); }}
          />
          <ToggleGroup label="Timing"
            options={[
              ["now",      "Act Now"],
              ["turnover", minLeaseRemaining != null ? `At Turnover (~${fmtMo(minLeaseRemaining)})` : "At Turnover"],
              ["both",     "Compare Both"],
            ]}
            value={timing} onChange={setTiming}
          />
          <ToggleGroup label="Horizon"
            options={[["5", "5 yr"], ["10", "10 yr"], ["15", "15 yr"]]}
            value={String(horizon)} onChange={(v) => setHorizon(Number(v))}
          />
        </div>

        {/* Controls row 2: key metrics + overrideable params */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 pb-3 border-t border-surface-divider pt-2.5">
          {/* Auto-computed (read-only) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-foreground-dim">Total investment</span>
            <span className="text-xs font-semibold text-foreground tabular-nums">{fmtChf(totalCostChf)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-foreground-dim">Rent uplift</span>
            <span className="text-xs font-semibold text-green-700 tabular-nums">+CHF {totalMonthlyUplift.toFixed(0)}/mo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-foreground-dim">Do Nothing risk</span>
            <span className="text-xs font-semibold text-red-600 tabular-nums">{fmtChf(monthlyDoNothingDeduct * 12)}/yr</span>
          </div>
          {/* Overrideable */}
          <NumInput label="OBLF %" value={passthroughPct} onChange={setPassthrough} suffix="%" min={10} step={5} />
          <NumInput label="Discount" value={discountRate} onChange={setDiscount} suffix="%" min={1} step={0.5} />
          <NumInput label="Cap rate" value={capRate} onChange={setCapRate} suffix="%" min={2} step={0.5} />
          <NumInput label="Vacancy" value={vacancyMonths} onChange={setVacancy} suffix=" mo" min={0} step={1} />
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 py-6 space-y-6">

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
                timing={timing}
              />
            </div>
            {/* Breakeven annotations */}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-foreground-dim">
              {timing !== "turnover" && result.breakevenNow != null && (
                <span>
                  <span className="inline-block h-0.5 w-3 rounded bg-slate-700 align-middle mr-1.5" />
                  Act Now breaks even at <strong className="text-foreground">{fmtMo(result.breakevenNow)}</strong>
                </span>
              )}
              {timing !== "now" && result.breakevenTur != null && (
                <span>
                  <span className="inline-block h-0.5 w-3 rounded bg-amber-500 align-middle mr-1.5" />
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

          {/* Scenario cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(timing === "now" || timing === "both") && (
              <ScenarioCard
                label="Act Now"
                hint="Renovate immediately"
                npv={npvNow}
                isBest={bestKey === "now"}
                breakeven={result.breakevenNow}
                summary={
                  npvNow > npvNot
                    ? `${fmtChf(npvNow - npvNot)} better than doing nothing.`
                    : "Does not outperform doing nothing in this horizon."
                }
              />
            )}
            {(timing === "turnover" || timing === "both") && (
              <ScenarioCard
                label="At Turnover"
                hint={minLeaseRemaining != null ? `In ~${fmtMo(minLeaseRemaining)}` : "When current lease ends"}
                npv={npvTur}
                isBest={bestKey === "turnover"}
                breakeven={result.breakevenTur}
                summary={
                  npvTur > npvNot
                    ? `Avoids disrupting current tenant. ${fmtChf(npvTur - npvNot)} better than doing nothing.`
                    : "Does not outperform doing nothing in this horizon."
                }
              />
            )}
            <ScenarioCard
              label="Do Nothing"
              hint="Maintain as-is, risk-adjusted"
              npv={npvNot}
              isBest={bestKey === "nothing"}
              breakeven={null}
              summary={
                delta > 0
                  ? `${fmtChf(delta)} less than the best renovation scenario.${monthlyDoNothingDeduct > 0 ? ` Includes ${fmtChf(monthlyDoNothingDeduct * 12)}/yr expected failure + tenant risk.` : ""}`
                  : "Returns best in this horizon — revisit if repair costs rise."
              }
            />
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
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number" min={0} step={100}
                          value={costOverrides[row.assetId] ?? row.costChf}
                          onChange={(e) => setCostOverrides((prev) => ({ ...prev, [row.assetId]: Number(e.target.value) }))}
                          className="w-24 rounded border border-surface-border px-2 py-1 text-xs tabular-nums text-right focus:border-blue-400 focus:outline-none"
                        />
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
                  These assets are now timed in your cashflow plan. The <strong>Invest</strong> scenario in the NPV panel below will reflect this capex automatically.
                </p>
                <a
                  href={`/manager/cashflow/${planId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-green-800 underline underline-offset-2 mt-1.5 hover:text-green-900"
                >
                  Open cashflow plan <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-wrap items-center gap-3 pb-2">
            {!planMsg.startsWith("✓") && (
              <button
                onClick={handleAddToPlan}
                disabled={planAdding}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
              >
                <ArrowRight className="h-4 w-4" />
                {planAdding ? "Scheduling…" : `Plan this work (${assetRows.length} asset${assetRows.length !== 1 ? "s" : ""})`}
              </button>
            )}
            {planMsg && !planMsg.startsWith("✓") && (
              <p className="text-xs text-red-600">{planMsg}</p>
            )}
            <button onClick={onClose} className="text-sm text-foreground-dim hover:text-foreground transition-colors">
              Back to planning
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
