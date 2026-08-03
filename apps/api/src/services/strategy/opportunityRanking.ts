/**
 * opportunityRanking — pure, archetype-aware ranking of renovation opportunities.
 *
 * P1 (no energy model, no per-item NPV): rank the EXISTING renovation opportunities for a
 * building by the owner's mandate, and attach a short "fit reason" per item. The heavy NPV /
 * terminal-value numbers stay in the simulator (opened via the card's "Simulate → Plan").
 *
 * Signals derivable from RepairReplaceItem today, combined into three orthogonal drivers:
 *   U — urgency        (recommendation tier + condition + remaining life)
 *   V — value / size   (normalised replacement cost + depreciation)  → long-term, grade, terminal
 *   Q — quick win      (inverse cost)                                → short payback, income
 *
 * Neutral case (no archetype AND no dims) reproduces the existing sort exactly
 * (recommendation priority, then depreciation desc) so nothing regresses.
 */
import type { RenovationOpportunity, RepairReplaceRecommendation } from "../assetInventory";

export interface RankedOpportunity extends RenovationOpportunity {
  score: number;
  fitReason: string;
  /** Illustrative OBLF Art. 14 rent-uplift preview, CHF/yr (see oblfUpliftPreview). */
  oblfUpliftPreviewChfPerYear: number;
}

const REC_PRIORITY: Record<RepairReplaceRecommendation, number> = {
  REPLACE: 3,
  PLAN_REPLACEMENT: 2,
  MONITOR: 1,
  REPAIR: 0,
};

const CONDITION_URGENCY: Record<string, number> = {
  DAMAGED: 1,
  POOR: 0.7,
  FAIR: 0.35,
  GOOD: 0.1,
};

// Default share of a value-adding investment eligible for OBLF Art. 14 pass-through,
// and the amortisation basis (matches the simulator's uplift formula shape).
const OBLF_PASSTHROUGH_PCT = 0.6;

type Weights = { u: number; v: number; q: number };

const ARCHETYPE_WEIGHTS: Record<string, Weights> = {
  capital_preserver: { u: 1.0, v: 0.5, q: 0.2 },
  value_builder: { u: 0.5, v: 1.0, q: 0.25 },
  yield_maximizer: { u: 0.4, v: 0.2, q: 1.0 },
  exit_optimizer: { u: 0.3, v: 0.2, q: 0.9 },
  opportunistic_repositioner: { u: 0.5, v: 1.0, q: 0.3 },
};
const NEUTRAL_WEIGHTS: Weights = { u: 1.0, v: 0.4, q: 0.3 };

/** Bounded nudge to [0,1.2] of the base weights from the 0–100 strategy dimensions. */
function weightsFromArchetypeAndDims(archetype: string | null, dims: Record<string, number> | null): Weights {
  const base = (archetype && ARCHETYPE_WEIGHTS[archetype]) || NEUTRAL_WEIGHTS;
  if (!dims) return { ...base };
  const d = (k: string) => (typeof dims[k] === "number" ? dims[k] : 50) / 100; // 0..1
  const clamp = (x: number) => Math.max(0, Math.min(1.2, x));
  return {
    u: clamp(base.u + 0.4 * (d("stabilityPreference") - 0.5)),
    v: clamp(base.v + 0.4 * (d("capexTolerance") - 0.5) + 0.3 * (d("appreciationPriority") - 0.5) + 0.3 * (d("modernizationPreference") - 0.5)),
    q: clamp(base.q + 0.4 * (d("liquiditySensitivity") - 0.5) + 0.3 * (d("saleReadiness") - 0.5) + 0.3 * (d("incomePriority") - 0.5)),
  };
}

function urgencySignal(item: RenovationOpportunity): number {
  const rec = REC_PRIORITY[item.recommendation] / 3; // 0..1
  const cond = item.lastConditionStatus ? (CONDITION_URGENCY[item.lastConditionStatus] ?? 0.35) : 0.3;
  // Less remaining life → more urgent. 240 months (20y) as the soft horizon.
  const rem = item.remainingLifeMonths == null ? 0.5 : Math.max(0, Math.min(1, 1 - item.remainingLifeMonths / 240));
  return 0.5 * rec + 0.3 * cond + 0.2 * rem;
}

function normalisedCost(item: RenovationOpportunity, maxCost: number): number {
  if (!item.estimatedReplacementCostChf || maxCost <= 0) return 0;
  return Math.max(0, Math.min(1, item.estimatedReplacementCostChf / maxCost));
}

/**
 * Illustrative OBLF Art. 14 rent-uplift preview, CHF/yr.
 * = passthrough-eligible share of the replacement cost, amortised over its useful life.
 * A preview only — the engine-exact figure comes from the simulator.
 */
export function oblfUpliftPreview(item: RenovationOpportunity, passthroughPct: number = OBLF_PASSTHROUGH_PCT): number {
  const cost = item.estimatedReplacementCostChf ?? 0;
  const lifeMonths = item.usefulLifeMonths && item.usefulLifeMonths > 0 ? item.usefulLifeMonths : 240;
  const perYear = (cost * passthroughPct) / (lifeMonths / 12);
  return Math.round(perYear);
}

const ARCHETYPE_LABEL: Record<string, string> = {
  capital_preserver: "keep-things-stable",
  value_builder: "improve-long-term-value",
  yield_maximizer: "maximise-income",
  exit_optimizer: "prepare-for-sale",
  opportunistic_repositioner: "upgrade-and-reposition",
};

function fitReason(archetype: string | null, item: RenovationOpportunity, rank: number, drivers: { u: number; v: number; q: number }): string {
  if (rank === 0) {
    return archetype ? `Top move for an ${ARCHETYPE_LABEL[archetype] ?? archetype} mandate.` : "Highest-priority move.";
  }
  const top = Math.max(drivers.u, drivers.v, drivers.q);
  if (top === drivers.u) {
    if (item.lastConditionStatus === "POOR" || item.lastConditionStatus === "DAMAGED") return "Condition is deteriorating — acting now limits risk.";
    return "Addresses a near-term condition risk.";
  }
  if (top === drivers.v) return "A larger, value-adding move — strong long-term contribution.";
  return "Cheaper, quicker payback.";
}

export function rankOpportunitiesForMandate(
  items: RenovationOpportunity[],
  dims: Record<string, number> | null,
  archetype: string | null,
): RankedOpportunity[] {
  const withPreview = (it: RenovationOpportunity, score: number, reason: string): RankedOpportunity => ({
    ...it,
    score,
    fitReason: reason,
    oblfUpliftPreviewChfPerYear: oblfUpliftPreview(it),
  });

  // Neutral: reproduce the existing recommendation-priority sort exactly (backward compatible).
  if (!archetype && !dims) {
    return [...items]
      .sort((a, b) => {
        const rp = REC_PRIORITY[b.recommendation] - REC_PRIORITY[a.recommendation];
        if (rp !== 0) return rp;
        return (b.depreciationPct ?? 0) - (a.depreciationPct ?? 0);
      })
      .map((it) => withPreview(it, 0, "Highest-priority move."));
  }

  const w = weightsFromArchetypeAndDims(archetype, dims);
  const maxCost = items.reduce((m, it) => Math.max(m, it.estimatedReplacementCostChf ?? 0), 0);

  const scored = items.map((it) => {
    const u = urgencySignal(it);
    const size = normalisedCost(it, maxCost);
    const depreciation = (it.depreciationPct ?? 0) / 100;
    const v = 0.7 * size + 0.3 * depreciation;
    const q = 1 - size; // cheaper → higher quick-win
    const drivers = { u: w.u * u, v: w.v * v, q: w.q * q };
    const score = drivers.u + drivers.v + drivers.q;
    return { it, score, drivers };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Stable, deterministic tie-break: recommendation priority, then depreciation.
    const rp = REC_PRIORITY[b.it.recommendation] - REC_PRIORITY[a.it.recommendation];
    if (rp !== 0) return rp;
    return (b.it.depreciationPct ?? 0) - (a.it.depreciationPct ?? 0);
  });

  return scored.map(({ it, score, drivers }, i) => withPreview(it, Math.round(score * 1000) / 1000, fitReason(archetype, it, i, drivers)));
}
