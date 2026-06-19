/**
 * RenovationSimulatorDrawer
 *
 * Right-side drawer + full-screen chart overlay for the Asset Renovation Simulator.
 * Rendered via React portal to escape any parent overflow/transform constraints.
 *
 * Flow:
 *   1. Guided questions (single grouped form)
 *   2. Auto-computed OBLF Art. 14 rent uplift
 *   3. 3-scenario NPV cards (Act Now / At Turnover / Do Nothing)
 *   4. Verdict strip + "Expand chart" + "Plan this work" (→ intervention)
 *   5. Full-screen chart overlay (cumulative NPV + breakeven)
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, ChevronUp, Maximize2, Check, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";
import { authHeaders } from "../lib/api";

// ── NPV Engine ────────────────────────────────────────────────────────────────

function monthlyDiscount(annualRatePct, month) {
  const r = annualRatePct / 100 / 12;
  return r === 0 ? 1 : Math.pow(1 + r, -month);
}

function computeSimulation({
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
  const r      = discountRateAnnual / 100 / 12;
  const horizon = yearsHorizon * 12;
  const lrm    = leaseRemainingMonths ?? 24;

  const rentUplift = usefulLifeYears > 0
    ? (investmentCostChf * passthroughPct / 100) / (usefulLifeYears * 12)
    : 0;
  const newRent = monthlyRentChf + rentUplift;
  const vacancyCost = monthlyRentChf * vacancyMonths;

  // Terminal value (capitalised rent uplift, discounted to horizon end)
  const terminalChf = capRatePct > 0 ? (rentUplift * 12) / (capRatePct / 100) : 0;
  const pvTerminal  = terminalChf > 0 ? terminalChf * monthlyDiscount(discountRateAnnual, horizon) : 0;

  // Month-by-month cumulative NPV (used for both final values + chart)
  let cumNow      = -investmentCostChf - vacancyCost;
  let cumTurnover = 0;
  let cumNothing  = 0;
  let turnoverInvested = false;

  // Yearly samples for the chart
  const nowYearly      = [];
  const turnoverYearly = [];
  const nothingYearly  = [];

  let breakevenNow      = null;
  let breakevenTurnover = null;

  for (let m = 1; m <= horizon; m++) {
    const disc = r === 0 ? 1 : Math.pow(1 + r, -m);

    // Do Nothing
    cumNothing += monthlyRentChf * disc;

    // Act Now
    cumNow += (m > vacancyMonths ? newRent : 0) * disc;

    // At Turnover
    if (m <= lrm) {
      cumTurnover += monthlyRentChf * disc;
    } else {
      if (!turnoverInvested) {
        const discAtTurnover = r === 0 ? 1 : Math.pow(1 + r, -lrm);
        cumTurnover -= (investmentCostChf + vacancyCost) * discAtTurnover;
        turnoverInvested = true;
      }
      if (m > lrm + vacancyMonths) {
        cumTurnover += newRent * disc;
      }
    }

    // Breakeven detection
    if (breakevenNow === null && cumNow >= cumNothing) breakevenNow = m;
    if (breakevenTurnover === null && cumTurnover >= cumNothing) breakevenTurnover = m;

    // Year boundary sample
    if (m % 12 === 0) {
      const y = m / 12;
      const tv = y === yearsHorizon ? pvTerminal : 0;
      nowYearly.push({ year: y, value: cumNow + tv });
      turnoverYearly.push({ year: y, value: cumTurnover + tv });
      nothingYearly.push({ year: y, value: cumNothing });
    }
  }

  const npvNow      = cumNow + pvTerminal;
  const npvTurnover = cumTurnover + pvTerminal;
  const npvNothing  = cumNothing;

  return {
    npvNow, npvTurnover, npvNothing,
    rentUplift, terminalChf,
    breakevenNow, breakevenTurnover,
    nowYearly, turnoverYearly, nothingYearly,
  };
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtChf(chf) {
  if (!Number.isFinite(chf)) return "—";
  const abs = Math.abs(chf);
  const sign = chf < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}CHF ${(abs / 1_000_000).toFixed(2).replace(".", "'")}M`;
  if (abs >= 1000)      return `${sign}CHF ${(abs / 1000).toFixed(1).replace(".", "'")}k`;
  return `${sign}CHF ${abs.toFixed(0)}`;
}

function fmtMonths(m) {
  if (m == null) return "—";
  return m < 12 ? `${m} mo` : `${(m / 12).toFixed(1)} yr`;
}

// ── Micro sparkbar (mirrors CumulativeBars in NPVScenariosPanel) ──────────────

function Sparkbar({ data, highlighted }) {
  if (!data || data.length === 0) return null;
  const vals   = data.map((d) => d.value);
  const maxAbs = Math.max(...vals.map(Math.abs), 1);
  return (
    <div className="flex items-end gap-px h-10 mt-2" aria-hidden="true">
      {data.map((d) => {
        const pct = Math.round((Math.abs(d.value) / maxAbs) * 100);
        const pos = d.value >= 0;
        return (
          <div key={d.year} className="flex-1 flex flex-col justify-end" title={`${d.year}yr: ${fmtChf(d.value)}`}>
            <div
              className={cn("rounded-sm", pos
                ? (highlighted ? "bg-slate-700" : "bg-slate-400")
                : "bg-red-300")}
              style={{ height: `${Math.max(pct, 4)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Scenario card (mirrors ScenarioCard in NPVScenariosPanel) ─────────────────

function ScenarioCard({ label, hint, npv, sparkData, summary, isBest, isNone }) {
  return (
    <div className={cn(
      "rounded-lg p-4 space-y-2 relative bg-surface",
      isBest ? "border-2 border-slate-800 shadow-sm" : "border border-surface-border",
    )}>
      {isBest && (
        <span className="absolute -top-2.5 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-white">
          Best NPV
        </span>
      )}
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <div>
        <p className="text-xs text-muted uppercase tracking-wide">NPV</p>
        <p className={cn("text-xl font-bold font-mono", npv >= 0 ? "text-foreground" : "text-red-600")}>
          {fmtChf(npv)}
        </p>
      </div>
      <Sparkbar data={sparkData} highlighted={isBest} />
      <div className="flex justify-between text-xs text-foreground-dim pt-0.5">
        <span>Yr 1</span>
        <span>Yr {sparkData?.length ?? "—"}</span>
      </div>
      {summary && (
        <p className="text-xs border-t border-surface-divider pt-2 leading-relaxed text-muted-text">
          {summary}
        </p>
      )}
    </div>
  );
}

// ── Asset status strip ────────────────────────────────────────────────────────

const REC_STYLE = {
  REPLACE:          { cls: "bg-red-100 text-red-700",    label: "Replace" },
  PLAN_REPLACEMENT: { cls: "bg-orange-100 text-orange-700", label: "Plan Replacement" },
  MONITOR:          { cls: "bg-amber-100 text-amber-700", label: "Monitor" },
  REPAIR:           { cls: "bg-green-100 text-green-700", label: "Repair" },
};
const COND_STYLE = {
  GOOD:    "bg-green-100 text-green-700",
  FAIR:    "bg-amber-100 text-amber-700",
  POOR:    "bg-orange-100 text-orange-700",
  DAMAGED: "bg-red-100 text-red-700",
};

function DepBar({ pct }) {
  const c = Math.min(100, pct ?? 0);
  const fill = c >= 100 ? "bg-red-500" : c >= 85 ? "bg-orange-400" : c >= 65 ? "bg-amber-400" : "bg-green-400";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 rounded-full bg-surface-hover overflow-hidden">
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${c}%` }} />
      </div>
      <span className="text-xs tabular-nums text-foreground-dim w-8 text-right">{pct ?? "—"}%</span>
    </div>
  );
}

// ── Full-screen chart overlay ─────────────────────────────────────────────────

function ChartOverlay({ result, params, item, onClose }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    let mounted = true;
    import("chart.js").then(({ Chart, registerables }) => {
      if (!mounted || !canvasRef.current) return;
      Chart.register(...registerables);
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

      const labels = result.nowYearly.map((d) => `Yr ${d.year}`);
      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Act Now",
              data: result.nowYearly.map((d) => Math.round(d.value)),
              borderColor: "#1e293b",
              backgroundColor: "rgba(30,41,59,0.08)",
              borderWidth: 2.5,
              tension: 0.3,
              fill: false,
              pointRadius: 3,
            },
            {
              label: "At Turnover",
              data: result.turnoverYearly.map((d) => Math.round(d.value)),
              borderColor: "#d97706",
              backgroundColor: "rgba(217,119,6,0.06)",
              borderWidth: 2,
              borderDash: [6, 3],
              tension: 0.3,
              fill: false,
              pointRadius: 3,
            },
            {
              label: "Do Nothing",
              data: result.nothingYearly.map((d) => Math.round(d.value)),
              borderColor: "#94a3b8",
              backgroundColor: "transparent",
              borderWidth: 1.5,
              borderDash: [3, 3],
              tension: 0.3,
              fill: false,
              pointRadius: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { font: { size: 11 }, boxWidth: 16 } },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${fmtChf(ctx.parsed.y)}`,
              },
            },
          },
          scales: {
            x: { grid: { color: "#f1f5f9" }, ticks: { font: { size: 10 } } },
            y: {
              grid: { color: "#f1f5f9" },
              ticks: {
                font: { size: 10 },
                callback: (v) => fmtChf(v),
              },
            },
          },
        },
      });
    });
    return () => {
      mounted = false;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [result]);

  const best = result.npvNow >= result.npvTurnover ? "now" : "turnover";
  const bestNpv = Math.max(result.npvNow, result.npvTurnover);
  const delta = bestNpv - result.npvNothing;

  const verdictText = (() => {
    if (delta <= 0) return "Renovating does not improve returns over this horizon vs. doing nothing. Consider deferring or re-evaluating the cost estimate.";
    const when = best === "now" ? "acting now" : `waiting for turnover in ~${fmtMonths(params.leaseRemainingMonths)}`;
    const be = best === "now" ? result.breakevenNow : result.breakevenTurnover;
    const beStr = be ? `pays back in ${fmtMonths(be)}` : "does not break even within the horizon";
    return `${when === "acting now" ? "Acting now" : "Waiting for turnover"} yields the best return — ${fmtChf(delta)} more than doing nothing. It ${beStr}.`;
  })();

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-surface flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-surface-border shrink-0">
        <div>
          <h2 className="text-base font-semibold text-foreground">{item?.assetName} — NPV Analysis</h2>
          <p className="text-xs text-foreground-dim mt-0.5">
            {fmtChf(params.investmentCostChf)} investment · {fmtChf(result.rentUplift)}/mo rent uplift · {params.yearsHorizon}yr horizon · {params.discountRateAnnual}% discount rate
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-foreground-dim hover:bg-surface-hover transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Chart */}
        <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-medium text-foreground-dim uppercase tracking-wide mb-4">Cumulative NPV over time</p>
          <div style={{ height: 300 }}>
            <canvas ref={canvasRef} />
          </div>
          {/* Breakeven callouts */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-foreground-dim">
            {result.breakevenNow && (
              <span>
                <span className="inline-block w-3 h-0.5 bg-slate-700 rounded mr-1.5 align-middle" />
                Act Now breaks even at <strong className="text-foreground">{fmtMonths(result.breakevenNow)}</strong>
              </span>
            )}
            {result.breakevenTurnover && (
              <span>
                <span className="inline-block w-3 h-0.5 bg-amber-500 rounded mr-1.5 align-middle" style={{ borderTop: "2px dashed" }} />
                At Turnover breaks even at <strong className="text-foreground">{fmtMonths(result.breakevenTurnover)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Rent impact panel */}
        <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-medium text-foreground-dim uppercase tracking-wide mb-4">Rent impact</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-foreground-dim mb-1">Current rent</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">CHF {params.monthlyRentChf}</p>
              <p className="text-xs text-foreground-dim">/month</p>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs text-foreground-dim mb-1">OBLF uplift</p>
                <p className="text-xl font-bold text-blue-600 tabular-nums">+CHF {result.rentUplift.toFixed(0)}</p>
                <p className="text-xs text-foreground-dim">/month</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-foreground-dim mb-1">Post-renovation</p>
              <p className="text-2xl font-bold text-green-700 tabular-nums">CHF {(params.monthlyRentChf + result.rentUplift).toFixed(0)}</p>
              <p className="text-xs text-foreground-dim">/month</p>
            </div>
          </div>
          {result.terminalChf > 0 && (
            <p className="mt-4 text-xs text-foreground-dim text-center">
              Terminal value uplift: <strong className="text-foreground">{fmtChf(result.terminalChf)}</strong> (rent uplift capitalised at {params.capRatePct}% cap rate)
            </p>
          )}
        </div>

        {/* Verdict */}
        <div className={cn("rounded-2xl border p-5", delta > 0 ? "border-emerald-300 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
          <p className={cn("text-xs font-semibold uppercase tracking-wide mb-2", delta > 0 ? "text-emerald-700" : "text-amber-700")}>
            {delta > 0 ? "Recommendation: Renovate" : "Recommendation: Reconsider"}
          </p>
          <p className={cn("text-sm leading-relaxed", delta > 0 ? "text-emerald-900" : "text-amber-900")}>{verdictText}</p>
          {delta > 0 && (
            <p className="mt-2 text-xs text-emerald-700">
              {best === "now" ? "Acting now" : "Waiting for turnover"} outperforms doing nothing by <strong>{fmtChf(delta)}</strong> over {params.yearsHorizon} years.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export default function RenovationSimulatorDrawer({ item, onClose }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Guided question inputs ──────────────────────────────────────────────────
  const [action, setAction]   = useState("replace"); // "repair" | "replace"
  const [costChf, setCostChf] = useState(() =>
    action === "replace"
      ? (item?.estimatedReplacementCostChf ?? 5000)
      : (item?.annualRepairRate ?? 2000)
  );
  const [timing, setTiming]   = useState(
    (item?.currentLease?.remainingMonths ?? 99) > 3 ? "undecided" : "now"
  );
  // Advanced
  const [passthroughPct, setPassthrough] = useState(50);
  const [discountRate, setDiscount]      = useState(5);
  const [yearsHorizon, setHorizon]       = useState(10);
  const [capRate, setCapRate]            = useState(5);
  const [advOpen, setAdvOpen]            = useState(false);

  // Chart overlay + approve state
  const [chartOpen, setChartOpen]       = useState(false);
  const [approving, setApproving]       = useState(false);
  const [approveMsg, setApproveMsg]     = useState("");

  const monthlyRent         = item?.currentLease?.netRentChf ?? 0;
  const leaseRemainingMonths = item?.currentLease?.remainingMonths ?? null;
  const usefulLifeYears     = item?.usefulLifeMonths ? Math.max(1, Math.round(item.usefulLifeMonths / 12)) : 10;

  // When action changes, reset cost to the relevant estimate
  const handleActionChange = (a) => {
    setAction(a);
    if (a === "replace" && item?.estimatedReplacementCostChf) setCostChf(item.estimatedReplacementCostChf);
    if (a === "repair"  && item?.annualRepairRate)             setCostChf(item.annualRepairRate);
  };

  const simParams = useMemo(() => ({
    investmentCostChf:   costChf,
    monthlyRentChf:      monthlyRent,
    passthroughPct,
    usefulLifeYears,
    discountRateAnnual:  discountRate,
    yearsHorizon,
    vacancyMonths:       2,
    leaseRemainingMonths: timing === "now" ? 0 : leaseRemainingMonths,
    capRatePct:          capRate,
  }), [costChf, monthlyRent, passthroughPct, usefulLifeYears, discountRate, yearsHorizon, timing, leaseRemainingMonths, capRate]);

  const result = useMemo(() => computeSimulation(simParams), [simParams]);

  // ── Scenario configuration ──────────────────────────────────────────────────
  const scenarios = useMemo(() => {
    const nowSummary = (() => {
      const delta = result.npvNow - result.npvNothing;
      if (delta <= 0) return "Renovating now does not improve your return over doing nothing in this horizon.";
      const be = result.breakevenNow ? `Breaks even in ${fmtMonths(result.breakevenNow)}.` : "";
      return `${fmtChf(delta)} better than doing nothing. ${be}`;
    })();
    const turnoverSummary = (() => {
      if (leaseRemainingMonths == null) return "Requires knowing when the current lease ends.";
      const delta = result.npvTurnover - result.npvNothing;
      if (delta <= 0) return "Even at turnover, renovation doesn't improve returns in this horizon.";
      const be = result.breakevenTurnover ? `Breaks even in ${fmtMonths(result.breakevenTurnover)}.` : "";
      return `Avoids disrupting the current tenant. ${fmtChf(delta)} better than doing nothing. ${be}`;
    })();
    const nothingSummary = (() => {
      const best = Math.max(result.npvNow, result.npvTurnover);
      const delta = best - result.npvNothing;
      if (delta <= 0) return "No renovation preserves current returns — consider if the asset can still serve its life.";
      return `${fmtChf(delta)} less than the best renovation scenario over ${yearsHorizon} years.`;
    })();

    return [
      { key: "now",      label: "Act Now",       hint: "Renovate immediately (2 mo vacancy)",   npv: result.npvNow,      spark: result.nowYearly,      summary: nowSummary },
      { key: "turnover", label: "At Turnover",   hint: leaseRemainingMonths != null ? `In ~${fmtMonths(leaseRemainingMonths)}` : "When current lease ends", npv: result.npvTurnover, spark: result.turnoverYearly, summary: turnoverSummary },
      { key: "nothing",  label: "Do Nothing",    hint: "Maintain current rent, no investment",  npv: result.npvNothing,  spark: result.nothingYearly,  summary: nothingSummary },
    ];
  }, [result, leaseRemainingMonths, yearsHorizon]);

  const bestNpv = Math.max(result.npvNow, result.npvTurnover);
  const bestKey = bestNpv > result.npvNothing
    ? (result.npvNow >= result.npvTurnover ? "now" : "turnover")
    : "nothing";
  const delta = bestNpv - result.npvNothing;

  // ── Approve: record intervention ────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    if (!item?.assetId) return;
    setApproving(true); setApproveMsg("");
    try {
      const interventionType = action === "replace" ? "REPLACEMENT" : "REPAIR";
      const plannedDate = timing === "now"
        ? new Date().toISOString()
        : (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + (leaseRemainingMonths ?? 0));
            return d.toISOString();
          })();
      const res = await fetch(`/api/assets/${item.assetId}/interventions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          type: interventionType,
          interventionDate: plannedDate,
          costChf,
          notes: `Renovation simulator decision — ${action} at ${timing === "now" ? "next opportunity" : "tenant turnover"}. NPV: ${fmtChf(result.npvNow)}.`,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error?.message || "Failed to record");
      }
      setApproveMsg("✓ Intervention recorded successfully");
    } catch (e) {
      setApproveMsg(`Error: ${e.message}`);
    } finally {
      setApproving(false);
    }
  }, [item, action, timing, costChf, leaseRemainingMonths, result.npvNow]);

  const rec = item?.recommendation ? REC_STYLE[item.recommendation] : null;
  const condCls = item?.lastConditionStatus ? COND_STYLE[item.lastConditionStatus] : null;

  if (!mounted) return null;

  const drawerContent = (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ isolation: "isolate" }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Panel */}
      <div
        className="relative z-10 h-full w-full max-w-xl overflow-y-auto bg-surface shadow-2xl border-l border-surface-border flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-surface-border bg-surface px-5 py-4 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground truncate">{item?.assetName ?? "Asset"}</h2>
            <p className="text-xs text-foreground-dim mt-0.5">{item?.topic} · Unit {item?.unitNumber}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground-dim hover:bg-surface-hover transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-6 flex-1">
          {/* ── Asset status strip ── */}
          <div className="space-y-2">
            <DepBar pct={item?.depreciationPct} />
            <div className="flex flex-wrap items-center gap-2">
              {rec && (
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", rec.cls)}>{rec.label}</span>
              )}
              {condCls && (
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", condCls)}>
                  Condition: {item.lastConditionStatus.charAt(0) + item.lastConditionStatus.slice(1).toLowerCase()}
                </span>
              )}
              {item?.remainingLifeMonths != null && (
                <span className="text-xs text-foreground-dim">{fmtMonths(item.remainingLifeMonths)} useful life remaining</span>
              )}
            </div>
          </div>

          {/* ── Guided questions ── */}
          <div className="rounded-2xl border border-surface-border bg-surface-subtle p-4 space-y-5">
            <p className="text-xs font-semibold text-foreground-dim uppercase tracking-wide">Configure your scenario</p>

            {/* Q1: What are you planning? */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">What are you planning?</label>
              <div className="flex rounded-lg border border-surface-border overflow-hidden">
                {[
                  ["replace", `Full replacement${item?.estimatedReplacementCostChf ? ` (est. CHF ${item.estimatedReplacementCostChf.toLocaleString()})` : ""}`],
                  ["repair",  `Repair${item?.annualRepairRate ? ` (avg CHF ${item.annualRepairRate.toLocaleString()}/yr)` : ""}`],
                ].map(([k, l]) => (
                  <button key={k} onClick={() => handleActionChange(k)}
                    className={cn("flex-1 py-2 px-3 text-sm font-medium transition-colors text-left", action === k ? "bg-brand text-white" : "bg-surface text-foreground-dim hover:bg-surface-hover")}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Investment cost */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                How much will it cost?
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-dim shrink-0">CHF</span>
                <input
                  type="number" min={0} step={500} value={costChf}
                  onChange={(e) => setCostChf(Number(e.target.value))}
                  className="flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              {item?.estimatedReplacementCostChf && action === "repair" && (
                <button onClick={() => setCostChf(item.estimatedReplacementCostChf)}
                  className="text-xs text-blue-600 hover:text-blue-800">
                  Use replacement estimate (CHF {item.estimatedReplacementCostChf.toLocaleString()}) instead →
                </button>
              )}
              <p className="text-xs text-foreground-dim">
                Allowable monthly rent uplift (OBLF Art. 14, {passthroughPct}% passthrough, {usefulLifeYears}yr life):
                {" "}<strong className="text-foreground">CHF {result.rentUplift.toFixed(0)}/mo</strong>
              </p>
            </div>

            {/* Q3: When? */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">When do you want to act?</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["now",       "As soon as possible"],
                  ["turnover",  leaseRemainingMonths != null ? `At turnover (in ~${fmtMonths(leaseRemainingMonths)})` : "At next turnover"],
                  ["undecided", "Compare both"],
                ].map(([k, l]) => (
                  <button key={k} onClick={() => setTiming(k)}
                    className={cn("rounded-lg border py-2 px-2 text-xs font-medium transition-colors text-center leading-snug", timing === k ? "bg-brand border-brand text-white" : "border-surface-border text-foreground-dim hover:bg-surface-hover")}>
                    {l}
                  </button>
                ))}
              </div>
              {!item?.currentLease && (
                <p className="text-xs text-amber-700">⚠ No active lease found — rent uplift will show as CHF 0/mo. Add a lease to this unit to run a meaningful simulation.</p>
              )}
            </div>

            {/* Advanced assumptions */}
            <div>
              <button onClick={() => setAdvOpen(v => !v)}
                className="flex items-center gap-1 text-xs text-foreground-dim hover:text-foreground transition-colors">
                {advOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Advanced assumptions (OBLF passthrough, discount rate, time horizon)
              </button>
              {advOpen && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    { label: "OBLF passthrough %", value: passthroughPct, onChange: setPassthrough, min: 10, max: 100, step: 5, suffix: "%" },
                    { label: "Asset useful life (yr)", value: usefulLifeYears, onChange: () => {}, min: 1, max: 30, step: 1, disabled: true, hint: `from asset (${usefulLifeYears}yr)` },
                    { label: "Discount rate %", value: discountRate, onChange: setDiscount, min: 1, max: 15, step: 0.5, suffix: "%" },
                    { label: "Time horizon (yr)", value: yearsHorizon, onChange: setHorizon, min: 5, max: 30, step: 5 },
                    { label: "Cap rate for terminal value %", value: capRate, onChange: setCapRate, min: 2, max: 10, step: 0.5, suffix: "%" },
                  ].map(({ label, value, onChange, min, max, step, suffix, disabled, hint }) => (
                    <div key={label}>
                      <label className="block text-xs font-medium text-foreground-dim mb-1">{label}</label>
                      {disabled ? (
                        <p className="text-sm text-foreground-dim">{hint}</p>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={min} max={max} step={step} value={value}
                            onChange={(e) => onChange(Number(e.target.value))}
                            className="w-full rounded-lg border border-surface-border px-2.5 py-1.5 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          {suffix && <span className="text-xs text-foreground-dim shrink-0">{suffix}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Scenario cards (NPV panel style) ── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground-dim uppercase tracking-wide">NPV over {yearsHorizon} yr horizon</p>
            <div className="grid grid-cols-1 gap-3">
              {scenarios
                .filter((s) => timing === "undecided" || s.key === timing || s.key === "nothing")
                .map((s) => (
                  <ScenarioCard
                    key={s.key}
                    label={s.label}
                    hint={s.hint}
                    npv={s.npv}
                    sparkData={s.spark}
                    summary={s.summary}
                    isBest={s.key === bestKey && bestKey !== "nothing"}
                  />
                ))}
              {timing !== "undecided" && (
                <ScenarioCard
                  label="Do Nothing"
                  hint="Maintain current rent, no investment"
                  npv={result.npvNothing}
                  sparkData={result.nothingYearly}
                  summary={scenarios.find((s) => s.key === "nothing")?.summary}
                  isBest={bestKey === "nothing"}
                />
              )}
            </div>
          </div>

          {/* ── Verdict + delta callout ── */}
          {delta > 0 && bestKey !== "nothing" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-emerald-800">
                {bestKey === "now" ? "Act Now" : "At Turnover"} outperforms doing nothing by {fmtChf(delta)} over {yearsHorizon} years
              </p>
              <p className="text-xs text-emerald-700">
                {result.rentUplift > 0 && `Rent uplift: CHF ${result.rentUplift.toFixed(0)}/mo · `}
                {(bestKey === "now" ? result.breakevenNow : result.breakevenTurnover) != null
                  ? `Break-even: ${fmtMonths(bestKey === "now" ? result.breakevenNow : result.breakevenTurnover)}`
                  : "Break-even not reached in horizon"}
              </p>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setChartOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Expand chart
            </button>
            <button
              onClick={handleApprove}
              disabled={approving || !!approveMsg}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                approveMsg?.startsWith("✓")
                  ? "bg-green-100 text-green-700 border border-green-200 cursor-default"
                  : "bg-brand text-white hover:bg-brand-dark disabled:opacity-50"
              )}
            >
              {approveMsg?.startsWith("✓") ? (
                <><Check className="h-3.5 w-3.5" />{approveMsg}</>
              ) : (
                <><ArrowRight className="h-3.5 w-3.5" />{approving ? "Recording…" : "Plan this work"}</>
              )}
            </button>
            {approveMsg && !approveMsg.startsWith("✓") && (
              <p className="text-xs text-red-600">{approveMsg}</p>
            )}
          </div>

          {/* ── Legislative footnote ── */}
          <p className="text-xs text-foreground-dim leading-relaxed border-t border-surface-divider pt-4">
            <strong>OBLF Art. 14</strong> — Swiss law permits landlords to increase annual rent by up to {passthroughPct}% of net renovation costs (value-adding works only), amortised over the asset's useful life ({usefulLifeYears}yr). Passthrough rate may vary by canton and work type.
          </p>
        </div>
      </div>

      {/* Full-screen chart overlay */}
      {chartOpen && (
        <ChartOverlay
          result={result}
          params={simParams}
          item={item}
          onClose={() => setChartOpen(false)}
        />
      )}
    </div>
  );

  return createPortal(drawerContent, document.body);
}
