/**
 * financialModelService.ts
 *
 * Phase 3a — Computes financial projections per decision option.
 * Reads TaxRuleVersion, DepreciationStandard, ReplacementBenchmark from DB.
 * Pure computation functions + thin DB-reading helpers.
 *
 * Outputs feed into DecisionOption.financialProjectionJson and taxProfileJson.
 */

import { PrismaClient } from "@prisma/client";
import { NPV_DISCOUNT_RATE_DEFAULT } from "./strategy/weights";

// ─── Types ─────────────────────────────────────────────────────

export interface FinancialProjection {
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
  opexReductionEstimate: number;
  rentUpliftEstimate: number;
  uncertaintyScore: number;
}

export interface TaxProfile {
  deductibleImmediatelyAmount: number;
  capitalizableAmount: number;
  annualDepreciationAmount: number;
  year1TaxShield: number;
  totalTaxShield: number;
  taxShieldTimingScore: number;
}

export interface FinancialModelInput {
  estimatedCost: number;
  estimatedUsefulLifeYears: number;
  opexReductionPerYear: number;
  rentUpliftPerYear: number;
  residualValueImpact: number;
  analysisHorizonYears: number;
  discountRate?: number;
}

export interface TaxModelInput {
  totalCost: number;
  classification: "WERTERHALTEND" | "WERTVERMEHREND" | "MIXED" | "ENERGY_ENVIRONMENT";
  deductiblePct: number;
  usefulLifeMonths: number;
  marginalTaxRate?: number;
}

// ─── Pure computation: NPV ─────────────────────────────────────

export function computeNPV(
  cashflows: number[],
  discountRate: number,
): number {
  let npv = 0;
  for (let t = 0; t < cashflows.length; t++) {
    npv += cashflows[t] / Math.pow(1 + discountRate, t + 1);
  }
  return Math.round(npv * 100) / 100;
}

// ─── Pure computation: Payback period ──────────────────────────

export function computePaybackYears(
  initialOutflow: number,
  annualCashflows: number[],
): number | undefined {
  let cumulative = initialOutflow; // negative
  for (let t = 0; t < annualCashflows.length; t++) {
    cumulative += annualCashflows[t];
    if (cumulative >= 0) {
      // Linear interpolation within the year
      const prevCumulative = cumulative - annualCashflows[t];
      const fraction = annualCashflows[t] > 0
        ? -prevCumulative / annualCashflows[t]
        : 1;
      return Math.round((t + fraction) * 10) / 10;
    }
  }
  return undefined; // never pays back within horizon
}

// ─── Pure computation: Tax profile ─────────────────────────────

export function computeTaxProfile(input: TaxModelInput): TaxProfile {
  const marginalRate = input.marginalTaxRate ?? 0.25; // Swiss marginal ~25%
  const deductiblePctNorm = input.deductiblePct / 100;

  let deductibleImmediatelyAmount: number;
  let capitalizableAmount: number;

  if (input.classification === "WERTERHALTEND") {
    deductibleImmediatelyAmount = input.totalCost;
    capitalizableAmount = 0;
  } else if (input.classification === "WERTVERMEHREND") {
    deductibleImmediatelyAmount = 0;
    capitalizableAmount = input.totalCost;
  } else {
    // MIXED or ENERGY_ENVIRONMENT
    deductibleImmediatelyAmount = Math.round(input.totalCost * deductiblePctNorm);
    capitalizableAmount = input.totalCost - deductibleImmediatelyAmount;
  }

  const usefulLifeYears = Math.max(1, Math.round(input.usefulLifeMonths / 12));
  const annualDepreciationAmount = capitalizableAmount > 0
    ? Math.round(capitalizableAmount / usefulLifeYears)
    : 0;

  const year1TaxShield = Math.round(
    (deductibleImmediatelyAmount + annualDepreciationAmount) * marginalRate,
  );

  const totalTaxShield = Math.round(
    (deductibleImmediatelyAmount + capitalizableAmount) * marginalRate,
  );

  const taxShieldTimingScore = totalTaxShield > 0
    ? Math.round((year1TaxShield / totalTaxShield) * 100)
    : 0;

  return {
    deductibleImmediatelyAmount,
    capitalizableAmount,
    annualDepreciationAmount,
    year1TaxShield,
    totalTaxShield,
    taxShieldTimingScore,
  };
}

// ─── Pure computation: Full financial projection ───────────────

export function computeFinancialProjection(
  input: FinancialModelInput,
): FinancialProjection {
  const discountRate = input.discountRate ?? NPV_DISCOUNT_RATE_DEFAULT;
  const horizon = input.analysisHorizonYears;
  const initialOutflow = -input.estimatedCost;

  // Annual net benefit = opex savings + rent uplift
  const annualBenefit = input.opexReductionPerYear + input.rentUpliftPerYear;
  const annualCashflows: number[] = [];
  for (let t = 0; t < horizon; t++) {
    annualCashflows.push(annualBenefit);
  }
  // Add residual value in last year
  if (input.residualValueImpact > 0 && annualCashflows.length > 0) {
    annualCashflows[annualCashflows.length - 1] += input.residualValueImpact;
  }

  // Full cashflow array for NPV (includes initial outflow)
  const fullCashflows = [initialOutflow, ...annualCashflows];
  const npvBase = computeNPV(fullCashflows.slice(1), discountRate) + initialOutflow;
  const paybackYears = computePaybackYears(initialOutflow, annualCashflows);

  const cashflowYear1 = initialOutflow + (annualCashflows[0] ?? 0);
  const cashflowYears1to3 = initialOutflow + annualCashflows.slice(0, 3).reduce((s, v) => s + v, 0);
  const cashflowYears1to5 = initialOutflow + annualCashflows.slice(0, 5).reduce((s, v) => s + v, 0);
  const totalValueCreation = annualCashflows.reduce((s, v) => s + v, 0) + initialOutflow;

  // Uncertainty: higher cost + longer horizon = more uncertain
  const uncertaintyScore = Math.min(
    100,
    Math.round(
      (input.estimatedCost / 100000) * 20 + // cost component
      (horizon / 20) * 30 + // horizon component
      (paybackYears === undefined ? 30 : 0), // no payback = uncertain
    ),
  );

  return {
    analysisHorizonYearsBase: horizon,
    initialOutflow,
    annualCashflows,
    residualValueImpact: input.residualValueImpact,
    npvBase,
    paybackYears,
    cashflowYear1,
    cashflowYears1to3,
    cashflowYears1to5,
    totalValueCreation,
    opexReductionEstimate: input.opexReductionPerYear,
    rentUpliftEstimate: input.rentUpliftPerYear,
    uncertaintyScore,
  };
}

// ─── DB readers ────────────────────────────────────────────────

export async function lookupTaxRule(
  prisma: PrismaClient,
  assetType: string,
  topic: string,
  canton?: string | null,
): Promise<{ classification: string; deductiblePct: number; usefulLifeMonths: number } | null> {
  // Find matching TaxRule
  const rule = await (prisma as any).taxRule.findFirst({
    where: {
      assetType,
      topic,
      isActive: true,
      ...(canton ? { OR: [{ canton }, { canton: null }] } : {}),
    },
    include: {
      versions: {
        where: {
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
    orderBy: [
      // Prefer canton-specific over federal
      { canton: "desc" },
    ],
  });

  if (!rule || !rule.versions || rule.versions.length === 0) return null;

  const version = rule.versions[0];

  // Also look up depreciation standard for useful life
  const depStd = await (prisma as any).depreciationStandard.findFirst({
    where: { assetType, topic },
  });

  return {
    classification: version.classification,
    deductiblePct: version.deductiblePct,
    usefulLifeMonths: depStd?.usefulLifeMonths ?? 240, // default 20 years
  };
}

export async function lookupReplacementBenchmark(
  prisma: PrismaClient,
  assetType: string,
  topic: string,
): Promise<{ lowChf: number; medianChf: number; highChf: number } | null> {
  const benchmark = await (prisma as any).replacementBenchmark.findFirst({
    where: { assetType, topic, isActive: true },
  });
  if (!benchmark) return null;
  return {
    lowChf: benchmark.lowChf,
    medianChf: benchmark.medianChf,
    highChf: benchmark.highChf,
  };
}

/**
 * High-level: build full financial projection + tax profile for an option.
 * Used by the recommendation workflow to populate financialProjectionJson and taxProfileJson.
 */
export async function buildOptionFinancials(
  prisma: PrismaClient,
  option: {
    estimatedCost: number;
    estimatedUsefulLifeYears: number;
    opexReductionScore: number;
    rentUpliftScore: number;
    saleAttractivenessScore: number;
  },
  context: {
    assetType: string;
    topic: string;
    canton?: string | null;
    analysisHorizonYears?: number;
  },
): Promise<{ projection: FinancialProjection; taxProfile: TaxProfile }> {
  // Estimate annual benefit from scores (rough: score/100 * 5% of cost)
  const opexReductionPerYear = Math.round(
    (option.opexReductionScore / 100) * option.estimatedCost * 0.05,
  );
  const rentUpliftPerYear = Math.round(
    (option.rentUpliftScore / 100) * option.estimatedCost * 0.03,
  );
  const residualValueImpact = Math.round(
    (option.saleAttractivenessScore / 100) * option.estimatedCost * 0.15,
  );

  const projection = computeFinancialProjection({
    estimatedCost: option.estimatedCost,
    estimatedUsefulLifeYears: option.estimatedUsefulLifeYears,
    opexReductionPerYear,
    rentUpliftPerYear,
    residualValueImpact,
    analysisHorizonYears: context.analysisHorizonYears ?? 10,
  });

  // Tax profile from DB or defaults
  const taxData = await lookupTaxRule(
    prisma,
    context.assetType,
    context.topic,
    context.canton,
  );

  const taxProfile = computeTaxProfile({
    totalCost: option.estimatedCost,
    classification: (taxData?.classification as TaxModelInput["classification"]) ?? "MIXED",
    deductiblePct: taxData?.deductiblePct ?? 50,
    usefulLifeMonths: taxData?.usefulLifeMonths ?? option.estimatedUsefulLifeYears * 12,
  });

  return { projection, taxProfile };
}
