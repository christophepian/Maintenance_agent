/**
 * ValueCreationAgenda — the shared, archetype-aware "what should we do next" surface.
 *
 * Canonical per-building prescription (Reporting → Value creation sub-tab); also usable in
 * the Planning workspace. Renders a mandate switcher, an Invest/Defer/Neglect verdict, and a
 * ranked list of renovation opportunities. Each card's "Simulate → Plan" opens the EXISTING
 * RenovationSimulatorDrawer where the full NPV / cumulative curve lives.
 *
 * P1: no energy grade / per-item NPV yet — cards show capex + an OBLF uplift preview + the
 * recommendation, and the verdict/ranking come from the archetype bridge
 * (GET /buildings/:id/value-creation-agenda). The mandate switcher drives ?mandate= what-if.
 *
 * Consistent with RenovationAccordion / RenovationSimulatorDrawer, this planning-surface
 * component is not yet i18n'd; the reporting page supplies the i18n'd tab label + bridge copy.
 */

import { useState, useMemo } from "react";
import { cn } from "../../lib/utils";
import { formatChf } from "../../lib/format";
import { useDetailResource } from "../../lib/hooks/useDetailResource";
import RenovationSimulatorDrawer from "../RenovationSimulatorDrawer";
import HoverTip from "../HoverTip";

const MANDATES = [
  { key: "capital_preserver", label: "Keep things stable" },
  { key: "value_builder", label: "Improve long-term value" },
  { key: "yield_maximizer", label: "Maximise income" },
  { key: "exit_optimizer", label: "Prepare for sale" },
  { key: "opportunistic_repositioner", label: "Upgrade & reposition" },
];
const MANDATE_LABEL = Object.fromEntries(MANDATES.map((m) => [m.key, m.label]));

const VERDICT = {
  invest: { label: "Invest", border: "border-brand", bg: "bg-brand-light", tag: "text-brand" },
  defer: { label: "Defer", border: "border-warning", bg: "bg-warning-light", tag: "text-warning-text" },
  neglect: { label: "Hold", border: "border-destructive", bg: "bg-destructive-light", tag: "text-destructive-text" },
};

const REC_STYLE = {
  REPLACE: { badge: "bg-destructive-light text-destructive-text", label: "Replace" },
  PLAN_REPLACEMENT: { badge: "bg-orange-light text-orange-text", label: "Plan" },
  MONITOR: { badge: "bg-warning-light text-warning-text", label: "Monitor" },
  REPAIR: { badge: "bg-success-light text-success-text", label: "Repair" },
};
const COND_STYLE = {
  GOOD: "bg-success-light text-success-text",
  FAIR: "bg-warning-light text-warning-text",
  POOR: "bg-orange-light text-orange-text",
  DAMAGED: "bg-destructive-light text-destructive-text",
};

function dueYear(item) {
  if (item.remainingLifeMonths == null) return null;
  return new Date().getFullYear() + Math.ceil(item.remainingLifeMonths / 12);
}

function OpportunityCard({ item, rank, onSimulate }) {
  const rec = REC_STYLE[item.recommendation] ?? REC_STYLE.REPAIR;
  const cond = item.lastConditionStatus ? COND_STYLE[item.lastConditionStatus] : null;
  const due = dueYear(item);
  const capex = item.estimatedReplacementCostChf;
  const oblf = item.oblfUpliftPreviewChfPerYear;

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-shadow hover:shadow-md",
      rank === 0 ? "border-brand/40" : "border-surface-border",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          rank === 0 ? "bg-brand text-white" : "bg-surface-subtle text-foreground-dim",
        )}>
          {rank + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{item.assetName}</p>
          <p className="text-xs text-foreground-dim">
            {item.topic}{item.unitNumber ? ` · unit ${item.unitNumber}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <HoverTip content={item.recommendationReason}>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", rec.badge)}>{rec.label}</span>
            </HoverTip>
            {cond && (
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", cond)}>
                {item.lastConditionStatus.charAt(0) + item.lastConditionStatus.slice(1).toLowerCase()}
              </span>
            )}
          </div>
          {item.fitReason && (
            <p className="mt-2 flex items-baseline gap-1.5 text-xs text-foreground-dim">
              <span className="text-brand">★</span><span>{item.fitReason}</span>
            </p>
          )}
        </div>
      </div>

      {/* KPI row — P1 shows capex + OBLF preview + due; full NPV lives in the simulator */}
      <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-surface-border bg-surface-border">
        <div className="bg-surface p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim">Capex</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{capex != null ? formatChf(capex) : "—"}</p>
        </div>
        <div className="bg-surface p-2.5">
          <HoverTip content="Illustrative OBLF Art. 14 rent uplift — the tenant-billed energy saving is excluded. Engine-exact figure in the simulator.">
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim">OBLF uplift/yr</p>
          </HoverTip>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{oblf ? formatChf(oblf) : "—"}</p>
        </div>
        <div className="bg-surface p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim">Due</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{due ?? "—"}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <button
          onClick={() => onSimulate([item])}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Simulate → Plan
        </button>
      </div>
    </div>
  );
}

export default function ValueCreationAgenda({ buildingId, onSimulate: externalOnSimulate, onPlanned }) {
  // null = use the building's resolved mandate; a value = what-if override.
  const [mandate, setMandate] = useState(null);
  const [simItems, setSimItems] = useState(null);

  const url = buildingId
    ? `/api/buildings/${buildingId}/value-creation-agenda${mandate ? `?mandate=${mandate}` : ""}`
    : null;
  // Default fetcher (fetchWithAuth) adds auth + unwraps json.data → { strategyContext, opportunities }.
  const { data, loading, error } = useDetailResource(url);

  const ctx = data?.strategyContext ?? {};
  const opportunities = data?.opportunities ?? [];
  // Highlight the effective mandate (what-if override, else resolved).
  const activeMandate = mandate ?? ctx.archetype ?? null;
  const verdict = ctx.recommendedScenario ? VERDICT[ctx.recommendedScenario] : null;

  const handleSimulate = (items) => {
    if (externalOnSimulate) externalOnSimulate(items, buildingId);
    else setSimItems(items);
  };

  const sourceNote = useMemo(() => {
    if (ctx.isWhatIf) return "What-if — exploring a different mandate than this building's set profile.";
    if (ctx.source === "owner-portfolio") return "Based on the owner's portfolio strategy (no building-specific mandate set).";
    if (ctx.source === "none") return "No strategy mandate set — showing a neutral ranking. Pick a mandate to tailor it.";
    return null;
  }, [ctx.isWhatIf, ctx.source]);

  return (
    <div className="p-4 sm:p-5">
      {/* Mandate switcher */}
      <div className="rounded-xl border border-surface-border bg-surface-subtle p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-foreground-dim">
          Owner mandate — the agenda below reframes to this profile
        </p>
        <div className="flex flex-wrap gap-1 rounded-lg bg-surface-hover p-1">
          {MANDATES.map((m) => {
            const on = activeMandate === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMandate(m.key)}
                aria-pressed={on}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
                  on ? "bg-surface text-brand shadow-sm" : "text-foreground-dim hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <p className="mt-4 text-sm text-foreground-dim">Loading…</p>}
      {error && <p className="mt-4 text-sm text-destructive-text" role="alert">Could not load the agenda.</p>}

      {!loading && !error && (
        <>
          {/* Verdict banner */}
          {verdict && (
            <div className={cn("mt-4 flex items-start gap-3 rounded-xl border border-surface-border border-l-4 p-4", verdict.border, verdict.bg)}>
              <span className={cn("shrink-0 rounded-md px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide", verdict.tag)}>
                {verdict.label}
              </span>
              <p className="text-sm text-foreground">{ctx.rationale}</p>
            </div>
          )}
          {sourceNote && <p className="mt-2 text-xs text-foreground-dim">{sourceNote}</p>}

          {/* Agenda */}
          <p className="mt-5 mb-3 text-[11px] font-bold uppercase tracking-wider text-foreground-dim">
            {activeMandate ? "Recommended moves — ranked for this mandate" : "Recommended moves"}
          </p>
          {opportunities.length === 0 ? (
            <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-foreground-dim">
              No renovation opportunities for this building yet — asset condition and depreciation
              feed this list as the inventory is captured.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {opportunities.map((item, i) => (
                <OpportunityCard key={item.assetId} item={item} rank={i} onSimulate={handleSimulate} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Local simulator host (only when no external handler is provided) */}
      {!externalOnSimulate && simItems && (
        <RenovationSimulatorDrawer
          items={simItems}
          buildingId={buildingId}
          onClose={() => setSimItems(null)}
          onPlanned={onPlanned}
        />
      )}
    </div>
  );
}
