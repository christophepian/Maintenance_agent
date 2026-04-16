/**
 * strategyAlignmentService.ts
 *
 * Phase 3b — Computes strategy alignment tags for cashflow plan items.
 * Tags are computed at page load, not persisted.
 *
 * Each capex item in a cashflow plan gets one of three tags:
 *   - aligned:      item scores > 60 against top 3 weighted dimensions
 *   - review:       item scores 40–60
 *   - low_priority: item scores < 40
 */

import { DECISION_WEIGHTS, deriveEffectiveWeights } from "./strategy/weights";
import type { DecisionWeightVector } from "./strategy/weights";
import type { StrategyArchetype } from "./strategy/archetypes";
import { clampScore } from "./strategy/scoring";

// ─── Types ─────────────────────────────────────────────────────

export type AlignmentTag = "aligned" | "review" | "low_priority";

export interface ItemAlignmentResult {
  assetId: string;
  assetName: string;
  tag: AlignmentTag;
  score: number;
  explanation: string;
  topDimensions: { name: string; label: string; itemScore: number; weight: number }[];
}

export interface StrategyOverlaySummary {
  archetypeLabel: string;
  primaryArchetype: string;
  secondaryArchetype?: string | null;
  alignedCount: number;
  reviewCount: number;
  lowPriorityCount: number;
  deprioritizationNote: string;
  items: ItemAlignmentResult[];
}

// ─── Archetype deprioritization notes (from §4.3) ──────────────

const DEPRIORITIZATION_NOTES: Record<string, string> = {
  exit_optimizer:
    "Projects with long payback periods or high disruption may not align with your sale timeline.",
  yield_maximizer:
    "Upgrades that don't directly improve rental income or reduce costs may be lower priority.",
  value_builder:
    "Minimal repairs without long-term value creation may not serve your appreciation goals.",
  capital_preserver:
    "Large capital outlays or high-disruption projects may conflict with your stability focus.",
  opportunistic_repositioner:
    "Status-quo maintenance without modernization potential may miss repositioning opportunities.",
};

// ─── Dimension labels for human-readable output ───────────────

const DIMENSION_LABELS: Record<string, string> = {
  complianceNeed: "Regulatory compliance",
  riskReduction: "Risk reduction",
  lifecycleExtension: "Lifecycle extension",
  modernizationBenefit: "Modernization",
  saleAttractiveness: "Sale attractiveness",
  incomeUplift: "Income uplift",
  totalValueCreation: "Long-term value",
  shortTermCashflow: "Short-term cashflow",
  mediumTermCashflow: "Medium-term cashflow",
  taxTimingBenefit: "Tax timing",
  taxTotalBenefit: "Tax benefit",
  paybackFit: "Payback fit",
  stabilitySupport: "Stability",
};

// ─── Estimate features from cashflow item ──────────────────────

interface CashflowCapexItem {
  assetId: string;
  assetName: string;
  estimatedCostCents: number;
  tradeGroup: string;
}

/**
 * Estimate a simplified feature vector from a cashflow plan capex item.
 * This is a lightweight approximation — not a full DecisionOption scoring.
 */
function estimateItemFeatures(
  item: CashflowCapexItem,
  maxCostInPlan: number,
): Partial<Record<keyof DecisionWeightVector, number>> {
  const costRatio = maxCostInPlan > 0 ? item.estimatedCostCents / maxCostInPlan : 0.5;
  const topic = item.tradeGroup.toLowerCase();

  // Heuristic feature estimation based on trade group
  const isStructural = /structure|foundation|roof|facade|wall|concrete|masonry/i.test(topic);
  const isMechanical = /hvac|heating|ventilation|cooling|plumbing|electrical|elevator|lift|transport|boiler|pump|sprinkler/i.test(topic);
  const isFinish = /interior|paint|floor|kitchen|bathroom|cabinet|tile|carpet/i.test(topic);
  const isEnergy = /energy|solar|insulation|window|photovoltaic|heat.?pump|geothermal/i.test(topic);

  return {
    complianceNeed: isStructural ? 70 : isMechanical ? 50 : 30,
    riskReduction: isStructural ? 80 : isMechanical ? 60 : 30,
    lifecycleExtension: isStructural ? 90 : isMechanical ? 70 : 40,
    modernizationBenefit: isEnergy ? 85 : isFinish ? 60 : 30,
    saleAttractiveness: isFinish ? 75 : isEnergy ? 65 : isStructural ? 50 : 35,
    incomeUplift: isFinish ? 60 : isEnergy ? 40 : 20,
    totalValueCreation: isStructural ? 70 : isEnergy ? 65 : isFinish ? 55 : 40,
    upfrontCostPenalty: clampScore(costRatio * 100),
    disruptionPenalty: isStructural ? 70 : isMechanical ? 50 : 25,
    uncertaintyPenalty: isStructural ? 40 : 25,
    shortTermCashflow: clampScore((1 - costRatio) * 80),
    mediumTermCashflow: isMechanical ? 50 : isEnergy ? 60 : 40,
    taxTimingBenefit: 50, // neutral default
    taxTotalBenefit: 50,
    paybackFit: isEnergy ? 60 : isFinish ? 50 : 40,
    stabilitySupport: isMechanical ? 70 : isStructural ? 60 : 40,
  };
}

// ─── Score item against weight vector ──────────────────────────

function scoreItemAlignment(
  features: Partial<Record<keyof DecisionWeightVector, number>>,
  weights: DecisionWeightVector,
): number {
  // Use top 3 weighted positive dimensions
  const positiveKeys = Object.keys(weights)
    .filter((k) => !k.endsWith("Penalty"))
    .sort((a, b) => weights[b as keyof DecisionWeightVector] - weights[a as keyof DecisionWeightVector])
    .slice(0, 3) as Array<keyof DecisionWeightVector>;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const key of positiveKeys) {
    const w = weights[key];
    const f = features[key] ?? 50;
    weightedSum += f * w;
    totalWeight += 100 * w;
  }

  return totalWeight > 0 ? clampScore((weightedSum / totalWeight) * 100) : 50;
}

function tagFromScore(score: number): AlignmentTag {
  if (score > 60) return "aligned";
  if (score >= 40) return "review";
  return "low_priority";
}

// ─── Public API ────────────────────────────────────────────────

export function computeItemAlignment(
  item: CashflowCapexItem,
  maxCostInPlan: number,
  weights: DecisionWeightVector,
  archetypeLabel: string,
): ItemAlignmentResult {
  const features = estimateItemFeatures(item, maxCostInPlan);
  const score = scoreItemAlignment(features, weights);
  const tag = tagFromScore(score);

  // Top 3 weighted positive dimensions for this archetype
  const positiveKeys = Object.keys(weights)
    .filter((k) => !k.endsWith("Penalty"))
    .sort((a, b) => weights[b as keyof DecisionWeightVector] - weights[a as keyof DecisionWeightVector])
    .slice(0, 3) as Array<keyof DecisionWeightVector>;

  const topDimensions = positiveKeys.map((key) => ({
    name: key,
    label: DIMENSION_LABELS[key] ?? key,
    itemScore: features[key] ?? 50,
    weight: weights[key],
  }));

  // Build dimension-aware explanation
  const dimSummary = topDimensions
    .map((d) => `${d.label} ${d.itemScore >= 60 ? "✓" : d.itemScore >= 40 ? "~" : "✗"}`)
    .join(", ");

  const explanation =
    tag === "aligned"
      ? `Strong fit for your ${archetypeLabel} strategy. Scores well on: ${dimSummary}.`
      : tag === "review"
        ? `Mixed alignment with your ${archetypeLabel} strategy. ${dimSummary}. Worth reviewing whether this fits your priorities.`
        : `Low alignment with your ${archetypeLabel} priorities. ${dimSummary}. Consider deferring or finding alternatives.`;

  return { assetId: item.assetId, assetName: item.assetName, tag, score, explanation, topDimensions };
}

export function computeStrategyOverlay(
  capexItems: CashflowCapexItem[],
  profile: {
    primaryArchetype: string;
    secondaryArchetype?: string | null;
    secondaryMix?: number;
  },
): StrategyOverlaySummary {
  const primary = profile.primaryArchetype as StrategyArchetype;
  const secondary = profile.secondaryArchetype as StrategyArchetype | undefined;
  const weights = deriveEffectiveWeights(primary, secondary, profile.secondaryMix);

  const ARCHETYPE_LABELS: Record<string, string> = {
    exit_optimizer: "Exit Optimizer",
    yield_maximizer: "Yield Maximizer",
    value_builder: "Value Builder",
    capital_preserver: "Capital Preserver",
    opportunistic_repositioner: "Opportunistic Repositioner",
  };

  const maxCost = Math.max(...capexItems.map((i) => i.estimatedCostCents), 1);
  const archetypeLabel = ARCHETYPE_LABELS[primary] ?? primary;

  const items = capexItems.map((item) =>
    computeItemAlignment(item, maxCost, weights, archetypeLabel),
  );

  return {
    archetypeLabel,
    primaryArchetype: primary,
    secondaryArchetype: profile.secondaryArchetype,
    alignedCount: items.filter((i) => i.tag === "aligned").length,
    reviewCount: items.filter((i) => i.tag === "review").length,
    lowPriorityCount: items.filter((i) => i.tag === "low_priority").length,
    deprioritizationNote: DEPRIORITIZATION_NOTES[primary] ?? "",
    items,
  };
}
