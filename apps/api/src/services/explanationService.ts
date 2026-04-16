/**
 * explanationService.ts
 *
 * Builds human-readable explanation objects for recommendation results (§11).
 * Pure functions — no DB calls.
 */

import type { DecisionFeatures, DecisionOptionInput } from "./decisionScoringService";

// ─── Types ─────────────────────────────────────────────────────

export interface OptionExplanation {
  optionId: string;
  title: string;
  optionType: string;
  finalScore: number;
  shortTermImpact: string;
  longTermImpact: string;
  topStrengths: string[];
  topWeaknesses: string[];
  whenToChoose: string;
}

export interface RecommendationExplanation {
  summary: string;
  selectedOptionId: string;
  selectedOptionTitle: string;
  options: OptionExplanation[];
}

// ─── Impact labels (§11 lookup tables) ─────────────────────────

const SHORT_TERM_IMPACT: Record<string, (f: DecisionFeatures) => string> = {
  replace_full: (f) =>
    f.upfrontCostPenalty > 60
      ? "Significant upfront investment with moderate disruption"
      : "Moderate upfront investment",
  replace_component: () => "Targeted investment with limited disruption",
  repair: () => "Low-cost intervention, minimal disruption",
  defer: (f) =>
    f.complianceNeed > 60
      ? "No immediate cost, but compliance risk increases"
      : "No immediate cost, risk may grow over time",
  upgrade: (f) =>
    f.upfrontCostPenalty > 50
      ? "Higher upfront investment, possible rent uplift soon"
      : "Moderate investment with modernization benefits",
};

const LONG_TERM_IMPACT: Record<string, (f: DecisionFeatures) => string> = {
  replace_full: (f) =>
    f.totalValueCreation > 60
      ? "Strong long-term value creation and lifecycle reset"
      : "Lifecycle reset, moderate long-term value",
  replace_component: () =>
    "Extends useful life without full replacement cost",
  repair: (f) =>
    f.lifecycleExtension > 40
      ? "Buys time; may need replacement within 5 years"
      : "Short-term fix; revisit likely within 2–3 years",
  defer: () =>
    "Costs may escalate; condition will deteriorate further",
  upgrade: (f) =>
    f.saleAttractiveness > 60
      ? "Boosts property value and attractiveness to buyers"
      : "Improves modernization score and tenant satisfaction",
};

// ─── Strength / weakness extraction ─────────────────────────────

const FEATURE_LABELS: Partial<Record<keyof DecisionFeatures, string>> = {
  complianceNeed: "Compliance coverage",
  riskReduction: "Risk reduction",
  shortTermCashflow: "Short-term cashflow",
  mediumTermCashflow: "Medium-term cashflow",
  totalValueCreation: "Total value creation",
  taxTimingBenefit: "Tax timing benefit",
  lifecycleExtension: "Lifecycle extension",
  modernizationBenefit: "Modernization benefit",
  saleAttractiveness: "Sale attractiveness",
  incomeUplift: "Rental income uplift",
  upfrontCostPenalty: "Upfront cost",
  disruptionPenalty: "Tenant disruption",
  uncertaintyPenalty: "Uncertainty",
};

function topN<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

function extractStrengths(features: DecisionFeatures): string[] {
  const positive: Array<{ key: keyof DecisionFeatures; val: number }> = [];
  for (const [k, label] of Object.entries(FEATURE_LABELS)) {
    const key = k as keyof DecisionFeatures;
    if (key.endsWith("Penalty")) continue;
    if (features[key] >= 60) {
      positive.push({ key, val: features[key] });
    }
  }
  positive.sort((a, b) => b.val - a.val);
  return topN(positive, 3).map(
    (p) => `${FEATURE_LABELS[p.key]}: ${Math.round(p.val)}/100`,
  );
}

function extractWeaknesses(features: DecisionFeatures): string[] {
  const weak: Array<{ key: keyof DecisionFeatures; val: number; label: string }> = [];
  // penalties are weaknesses when high
  for (const key of ["upfrontCostPenalty", "disruptionPenalty", "uncertaintyPenalty"] as const) {
    if (features[key] >= 40) {
      weak.push({ key, val: features[key], label: FEATURE_LABELS[key]! });
    }
  }
  // positive features are weaknesses when low
  for (const [k] of Object.entries(FEATURE_LABELS)) {
    const key = k as keyof DecisionFeatures;
    if (key.endsWith("Penalty")) continue;
    if (features[key] <= 30) {
      weak.push({ key, val: 100 - features[key], label: FEATURE_LABELS[key]! });
    }
  }
  weak.sort((a, b) => b.val - a.val);
  return topN(weak, 3).map((w) =>
    w.key.endsWith("Penalty")
      ? `High ${w.label.toLowerCase()}: ${Math.round(features[w.key])}/100`
      : `Low ${w.label.toLowerCase()}: ${Math.round(features[w.key])}/100`,
  );
}

// ─── When-to-choose generation (§11) ───────────────────────────

const WHEN_TO_CHOOSE: Record<string, string> = {
  replace_full:
    "Best when the asset is near end-of-life and you want a full lifecycle reset with maximum long-term value.",
  replace_component:
    "Best when one part is failing but the overall system is still sound — targeted and cost-effective.",
  repair:
    "Best for buying time with low upfront cost when a larger intervention isn't justified yet.",
  defer:
    "Best when the issue is low-risk, budget is constrained, and there's no compliance pressure.",
  upgrade:
    "Best when you want to improve modernization, rental attractiveness, or energy compliance beyond the current standard.",
};

// ─── Public API ─────────────────────────────────────────────────

export function buildOptionExplanation(
  option: DecisionOptionInput,
  features: DecisionFeatures,
  finalScore: number,
): OptionExplanation {
  const shortFn = SHORT_TERM_IMPACT[option.optionType] ?? (() => "Mixed short-term impact");
  const longFn = LONG_TERM_IMPACT[option.optionType] ?? (() => "Long-term impact varies");

  return {
    optionId: option.id,
    title: (option as any).title ?? option.optionType,
    optionType: option.optionType,
    finalScore: Math.round(finalScore * 10) / 10,
    shortTermImpact: shortFn(features),
    longTermImpact: longFn(features),
    topStrengths: extractStrengths(features),
    topWeaknesses: extractWeaknesses(features),
    whenToChoose:
      WHEN_TO_CHOOSE[option.optionType] ??
      "Consider this option based on your specific priorities.",
  };
}

export function buildRecommendationExplanation(
  rankedOptions: Array<{
    option: DecisionOptionInput;
    features: DecisionFeatures;
    finalScore: number;
  }>,
): RecommendationExplanation {
  const best = rankedOptions[0];
  const explanations = rankedOptions.map((r) =>
    buildOptionExplanation(r.option, r.features, r.finalScore),
  );

  const summary =
    rankedOptions.length === 1
      ? `Recommended: ${best.option.optionType} — score ${Math.round(best.finalScore)}/100.`
      : `Compared ${rankedOptions.length} options. Top recommendation: ${best.option.optionType} (score ${Math.round(best.finalScore)}/100) vs next-best ${rankedOptions[1].option.optionType} (score ${Math.round(rankedOptions[1].finalScore)}/100).`;

  return {
    summary,
    selectedOptionId: best.option.id,
    selectedOptionTitle: (best.option as any).title ?? best.option.optionType,
    options: explanations,
  };
}
