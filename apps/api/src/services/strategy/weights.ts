/**
 * Strategy decision weights — per-archetype weight vectors for
 * scoring decision options against a strategy profile.
 *
 * Implements STRATEGY_ENGINE_SCOPE.md §9.2–9.3.
 *
 * Zero external imports. Framework-agnostic.
 */

import type { StrategyArchetype } from './archetypes';

// ── Weight vector interface ────────────────────────────────────

export interface DecisionWeightVector {
  complianceNeed: number;
  riskReduction: number;
  shortTermCashflow: number;
  mediumTermCashflow: number;
  totalValueCreation: number;
  taxTimingBenefit: number;
  taxTotalBenefit: number;
  paybackFit: number;
  lifecycleExtension: number;
  modernizationBenefit: number;
  saleAttractiveness: number;
  incomeUplift: number;
  stabilitySupport: number;
  upfrontCostPenalty: number;
  disruptionPenalty: number;
  uncertaintyPenalty: number;
}

// ── Default discount rate (§8.1) ───────────────────────────────

export const NPV_DISCOUNT_RATE_DEFAULT = 0.05;

// ── Per-archetype weight matrix (§9.2) ─────────────────────────

export const DECISION_WEIGHTS: Record<StrategyArchetype, DecisionWeightVector> = {
  exit_optimizer: {
    complianceNeed: 1.0,
    riskReduction: 0.7,
    shortTermCashflow: 0.7,
    mediumTermCashflow: 0.4,
    totalValueCreation: 0.8,
    taxTimingBenefit: 0.7,
    taxTotalBenefit: 0.3,
    paybackFit: 1.0,
    lifecycleExtension: 0.2,
    modernizationBenefit: 0.4,
    saleAttractiveness: 1.0,
    incomeUplift: 0.4,
    stabilitySupport: 0.5,
    upfrontCostPenalty: 0.8,
    disruptionPenalty: 0.6,
    uncertaintyPenalty: 0.6,
  },
  yield_maximizer: {
    complianceNeed: 1.0,
    riskReduction: 0.8,
    shortTermCashflow: 1.0,
    mediumTermCashflow: 0.8,
    totalValueCreation: 0.6,
    taxTimingBenefit: 0.8,
    taxTotalBenefit: 0.5,
    paybackFit: 0.9,
    lifecycleExtension: 0.5,
    modernizationBenefit: 0.4,
    saleAttractiveness: 0.3,
    incomeUplift: 1.0,
    stabilitySupport: 0.8,
    upfrontCostPenalty: 1.0,
    disruptionPenalty: 0.8,
    uncertaintyPenalty: 0.7,
  },
  value_builder: {
    complianceNeed: 1.0,
    riskReduction: 0.9,
    shortTermCashflow: 0.4,
    mediumTermCashflow: 0.7,
    totalValueCreation: 1.0,
    taxTimingBenefit: 0.4,
    taxTotalBenefit: 0.7,
    paybackFit: 0.7,
    lifecycleExtension: 1.0,
    modernizationBenefit: 0.9,
    saleAttractiveness: 0.6,
    incomeUplift: 0.7,
    stabilitySupport: 0.6,
    upfrontCostPenalty: 0.5,
    disruptionPenalty: 0.5,
    uncertaintyPenalty: 0.5,
  },
  capital_preserver: {
    complianceNeed: 1.0,
    riskReduction: 1.0,
    shortTermCashflow: 0.6,
    mediumTermCashflow: 0.6,
    totalValueCreation: 0.5,
    taxTimingBenefit: 0.5,
    taxTotalBenefit: 0.4,
    paybackFit: 0.7,
    lifecycleExtension: 0.8,
    modernizationBenefit: 0.5,
    saleAttractiveness: 0.3,
    incomeUplift: 0.5,
    stabilitySupport: 1.0,
    upfrontCostPenalty: 0.8,
    disruptionPenalty: 1.0,
    uncertaintyPenalty: 1.0,
  },
  opportunistic_repositioner: {
    complianceNeed: 0.8,
    riskReduction: 0.7,
    shortTermCashflow: 0.3,
    mediumTermCashflow: 0.7,
    totalValueCreation: 1.0,
    taxTimingBenefit: 0.3,
    taxTotalBenefit: 0.6,
    paybackFit: 0.5,
    lifecycleExtension: 0.8,
    modernizationBenefit: 1.0,
    saleAttractiveness: 0.7,
    incomeUplift: 0.9,
    stabilitySupport: 0.2,
    upfrontCostPenalty: 0.3,
    disruptionPenalty: 0.2,
    uncertaintyPenalty: 0.3,
  },
};

// ── Blended profile weights (§9.3) ─────────────────────────────

export function deriveEffectiveWeights(
  primary: StrategyArchetype,
  secondary?: StrategyArchetype,
  secondaryMix = 0.25,
): DecisionWeightVector {
  if (!secondary) return DECISION_WEIGHTS[primary];

  const result = {} as DecisionWeightVector;
  const keys = Object.keys(DECISION_WEIGHTS[primary]) as Array<keyof DecisionWeightVector>;
  for (const key of keys) {
    result[key] = DECISION_WEIGHTS[primary][key] * (1 - secondaryMix)
      + DECISION_WEIGHTS[secondary][key] * secondaryMix;
  }
  return result;
}
