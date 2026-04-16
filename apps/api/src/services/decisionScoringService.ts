/**
 * decisionScoringService.ts
 *
 * Feature extraction, option scoring, and hard-constraint logic for Phase 2.
 * All functions are pure — no DB calls. Orchestration lives in workflows.
 */

import { clampScore, reverseScore } from "./strategy/scoring";

// ─── Types ─────────────────────────────────────────────────────

export interface DecisionFeatures {
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

export interface DecisionOptionInput {
  id: string;
  optionType: string;
  estimatedCost: number;
  estimatedUsefulLifeYears: number;
  implementationMonths: number;
  tenantDisruptionScore: number;
  riskReductionScore: number;
  complianceCoverageScore: number;
  saleAttractivenessScore: number;
  rentUpliftScore: number;
  opexReductionScore: number;
  lifecycleExtensionScore: number;
  modernizationImpactScore: number;
  totalValueCreationScore: number;
  uncertaintyScore: number;
  taxProfileJson?: string | null;
  financialProjectionJson?: string | null;
}

export interface FinancialProjectionInput {
  analysisHorizonYearsBase: number;
  initialOutflow: number;
  annualCashflows: number[];
  residualValueImpact: number;
  npvBase: number;
  irrBase?: number;
  paybackYears?: number;
  cashflowYear1: number;
  cashflowYears1to3: number;
  cashflowYears1to5: number;
  totalValueCreation: number;
}

export interface TaxProfileInput {
  deductibleImmediatelyAmount: number;
  capitalizableAmount: number;
  annualDepreciationAmount: number;
  year1TaxShield: number;
  totalTaxShield: number;
  taxShieldTimingScore: number;
}

export interface HardConstraintResult {
  optionId: string;
  eligible: boolean;
  penalties: Array<{ code: string; points: number; reason: string }>;
}

export interface MaintenanceOpportunityInput {
  urgency: string;
  conditionState: string;
  complianceRisk: string;
}

// ─── Feature extraction (§9.1) ─────────────────────────────────

export function extractDecisionFeatures(
  option: DecisionOptionInput,
  projection: FinancialProjectionInput | null,
  context: { maxCostInSet: number; planningHorizonYears: number },
): DecisionFeatures {
  const proj = projection ?? defaultProjection(option.estimatedCost);
  const maxCost = context.maxCostInSet || 1;

  const shortTermCashflow = clampScore(
    reverseScore(clampScore((option.estimatedCost / maxCost) * 100)) * 0.6 +
      option.opexReductionScore * 0.4,
  );

  const mediumTermCashflow =
    proj.cashflowYears1to3 >= 0
      ? clampScore((proj.cashflowYears1to3 / (maxCost || 1)) * 100)
      : 0;

  const paybackFit =
    proj.paybackYears == null
      ? 50
      : clampScore(
          (1 - proj.paybackYears / (context.planningHorizonYears * 2)) * 100,
        );

  const taxProfile = option.taxProfileJson
    ? (JSON.parse(option.taxProfileJson) as TaxProfileInput)
    : null;

  return {
    complianceNeed: option.complianceCoverageScore,
    riskReduction: option.riskReductionScore,
    shortTermCashflow,
    mediumTermCashflow,
    totalValueCreation: clampScore(
      (proj.totalValueCreation / (maxCost || 1)) * 100,
    ),
    taxTimingBenefit: taxProfile?.taxShieldTimingScore ?? 0,
    taxTotalBenefit: taxProfile
      ? clampScore((taxProfile.totalTaxShield / (option.estimatedCost || 1)) * 100)
      : 0,
    paybackFit,
    lifecycleExtension: option.lifecycleExtensionScore,
    modernizationBenefit: option.modernizationImpactScore,
    saleAttractiveness: option.saleAttractivenessScore,
    incomeUplift: option.rentUpliftScore,
    stabilitySupport: reverseScore(option.riskReductionScore),
    upfrontCostPenalty: clampScore((option.estimatedCost / maxCost) * 100),
    disruptionPenalty: option.tenantDisruptionScore,
    uncertaintyPenalty: option.uncertaintyScore,
  };
}

function defaultProjection(estimatedCost: number): FinancialProjectionInput {
  return {
    analysisHorizonYearsBase: 10,
    initialOutflow: -estimatedCost,
    annualCashflows: [],
    residualValueImpact: 0,
    npvBase: -estimatedCost,
    paybackYears: undefined,
    cashflowYear1: -estimatedCost,
    cashflowYears1to3: -estimatedCost,
    cashflowYears1to5: -estimatedCost,
    totalValueCreation: 0,
  };
}

// ─── Option scoring (§9.4) ──────────────────────────────────────

import type { DecisionWeightVector } from "./strategy/weights";

const POSITIVE_FEATURE_KEYS: ReadonlyArray<keyof DecisionFeatures> = [
  "complianceNeed",
  "riskReduction",
  "shortTermCashflow",
  "mediumTermCashflow",
  "totalValueCreation",
  "taxTimingBenefit",
  "taxTotalBenefit",
  "paybackFit",
  "lifecycleExtension",
  "modernizationBenefit",
  "saleAttractiveness",
  "incomeUplift",
  "stabilitySupport",
];

const PENALTY_FEATURE_KEYS: ReadonlyArray<keyof DecisionFeatures> = [
  "upfrontCostPenalty",
  "disruptionPenalty",
  "uncertaintyPenalty",
];

export function scoreDecisionOption(
  features: DecisionFeatures,
  weights: DecisionWeightVector,
): number {
  let positiveSum = 0;
  let maxPositiveSum = 0;
  for (const key of POSITIVE_FEATURE_KEYS) {
    const w = weights[key as keyof DecisionWeightVector] as number;
    positiveSum += features[key] * w;
    maxPositiveSum += 100 * w;
  }

  let penaltySum = 0;
  let maxPenaltySum = 0;
  for (const key of PENALTY_FEATURE_KEYS) {
    const w = weights[key as keyof DecisionWeightVector] as number;
    penaltySum += features[key] * w;
    maxPenaltySum += 100 * w;
  }

  const normalizedPositive =
    maxPositiveSum > 0 ? (positiveSum / maxPositiveSum) * 100 : 0;
  const normalizedPenalty =
    maxPenaltySum > 0 ? (penaltySum / maxPenaltySum) * 100 : 0;

  return clampScore((normalizedPositive - normalizedPenalty + 100) / 2);
}

// ─── Hard constraints (§9.5) ────────────────────────────────────

export function applyHardConstraints(
  option: DecisionOptionInput,
  opportunity: MaintenanceOpportunityInput,
  context: {
    plannedSaleWithin12Months?: boolean;
    capexBudgetConstraint?: number;
  },
): HardConstraintResult {
  const penalties: HardConstraintResult["penalties"] = [];
  let eligible = true;

  // Compliance-critical: cannot defer
  if (
    opportunity.complianceRisk === "high" &&
    option.optionType === "defer"
  ) {
    eligible = false;
    penalties.push({
      code: "COMPLIANCE_DEFER_BLOCKED",
      points: 100,
      reason: "Cannot defer a compliance-critical issue",
    });
  }

  // Critical failure: cannot defer
  if (
    opportunity.conditionState === "failed" &&
    option.optionType === "defer"
  ) {
    eligible = false;
    penalties.push({
      code: "FAILED_DEFER_BLOCKED",
      points: 100,
      reason: "Cannot defer when asset has failed",
    });
  }

  // Poor condition: penalize defer
  if (
    opportunity.conditionState === "poor" &&
    option.optionType === "defer"
  ) {
    penalties.push({
      code: "POOR_CONDITION_DEFER_PENALTY",
      points: 30,
      reason: "Deferring a poor-condition asset carries risk",
    });
  }

  // Planned sale within 12 months: penalize long-payback
  if (context.plannedSaleWithin12Months) {
    const proj = option.financialProjectionJson
      ? (JSON.parse(option.financialProjectionJson) as FinancialProjectionInput)
      : null;
    if (proj?.paybackYears && proj.paybackYears > 3) {
      penalties.push({
        code: "SALE_PAYBACK_PENALTY",
        points: 25,
        reason: "Long payback project with planned sale within 12 months",
      });
    }
  }

  // Budget breach
  if (
    context.capexBudgetConstraint != null &&
    option.estimatedCost > context.capexBudgetConstraint
  ) {
    penalties.push({
      code: "BUDGET_BREACH",
      points: 40,
      reason: `Cost ${option.estimatedCost} exceeds budget constraint ${context.capexBudgetConstraint}`,
    });
  }

  return { optionId: option.id, eligible, penalties };
}

// ─── Condition state derivation (§7.3) ──────────────────────────

export function deriveConditionState(
  asset: { installedAt?: string | null },
  interventions: Array<{ interventionDate: string; type: string }>,
  usefulLifeYears: number,
): "good" | "fair" | "poor" | "failed" {
  const now = new Date();
  const lastReplacement = interventions
    .filter((i) => i.type === "REPLACEMENT")
    .sort((a, b) => b.interventionDate.localeCompare(a.interventionDate))[0];
  const origin = lastReplacement
    ? new Date(lastReplacement.interventionDate)
    : asset.installedAt
      ? new Date(asset.installedAt)
      : null;

  if (!origin) return "fair";

  const ageYears =
    (now.getTime() - origin.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const agePct = ageYears / usefulLifeYears;

  if (agePct < 0.4) return "good";
  if (agePct < 0.7) return "fair";
  if (agePct < 1.0) return "poor";
  return "failed";
}
