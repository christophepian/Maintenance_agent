import {
  extractDecisionFeatures,
  scoreDecisionOption,
  applyHardConstraints,
  deriveConditionState,
  type DecisionOptionInput,
  type FinancialProjectionInput,
} from "../services/decisionScoringService";
import {
  buildOptionExplanation,
  buildRecommendationExplanation,
} from "../services/explanationService";
import { DECISION_WEIGHTS } from "../services/strategy/weights";

// ── Helpers ────────────────────────────────────────────────────

function makeOption(overrides: Partial<DecisionOptionInput> = {}): DecisionOptionInput {
  return {
    id: "opt-1",
    optionType: "replace_full",
    estimatedCost: 10000,
    estimatedUsefulLifeYears: 15,
    implementationMonths: 2,
    tenantDisruptionScore: 30,
    riskReductionScore: 80,
    complianceCoverageScore: 70,
    saleAttractivenessScore: 60,
    rentUpliftScore: 40,
    opexReductionScore: 20,
    lifecycleExtensionScore: 90,
    modernizationImpactScore: 50,
    totalValueCreationScore: 75,
    uncertaintyScore: 15,
    ...overrides,
  };
}

function makeProjection(overrides: Partial<FinancialProjectionInput> = {}): FinancialProjectionInput {
  return {
    analysisHorizonYearsBase: 10,
    initialOutflow: -10000,
    annualCashflows: [500, 500, 500, 500, 500],
    residualValueImpact: 2000,
    npvBase: -5000,
    paybackYears: 6,
    cashflowYear1: -9500,
    cashflowYears1to3: -8500,
    cashflowYears1to5: -7500,
    totalValueCreation: 5000,
    ...overrides,
  };
}

// ── extractDecisionFeatures ────────────────────────────────────

describe("extractDecisionFeatures", () => {
  it("returns all 16 feature keys", () => {
    const features = extractDecisionFeatures(makeOption(), makeProjection(), {
      maxCostInSet: 20000,
      planningHorizonYears: 10,
    });
    expect(Object.keys(features)).toHaveLength(16);
    for (const val of Object.values(features)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("handles null projection gracefully", () => {
    const features = extractDecisionFeatures(makeOption(), null, {
      maxCostInSet: 10000,
      planningHorizonYears: 10,
    });
    expect(features.totalValueCreation).toBe(0);
  });

  it("parses taxProfileJson when present", () => {
    const tax = {
      deductibleImmediatelyAmount: 5000,
      capitalizableAmount: 5000,
      annualDepreciationAmount: 500,
      year1TaxShield: 1500,
      totalTaxShield: 3000,
      taxShieldTimingScore: 72,
    };
    const opt = makeOption({ taxProfileJson: JSON.stringify(tax) });
    const features = extractDecisionFeatures(opt, makeProjection(), {
      maxCostInSet: 10000,
      planningHorizonYears: 10,
    });
    expect(features.taxTimingBenefit).toBe(72);
    expect(features.taxTotalBenefit).toBeGreaterThan(0);
  });
});

// ── scoreDecisionOption ────────────────────────────────────────

describe("scoreDecisionOption", () => {
  it("returns a score between 0 and 100", () => {
    const features = extractDecisionFeatures(makeOption(), makeProjection(), {
      maxCostInSet: 20000,
      planningHorizonYears: 10,
    });
    const weights = DECISION_WEIGHTS["value_builder"];
    const score = scoreDecisionOption(features, weights);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("higher-value option scores higher for value_builder", () => {
    const ctx = { maxCostInSet: 20000, planningHorizonYears: 10 };
    const highValue = extractDecisionFeatures(
      makeOption({ totalValueCreationScore: 95, saleAttractivenessScore: 90 }),
      makeProjection({ totalValueCreation: 15000 }),
      ctx,
    );
    const lowValue = extractDecisionFeatures(
      makeOption({ totalValueCreationScore: 20, saleAttractivenessScore: 10 }),
      makeProjection({ totalValueCreation: 500 }),
      ctx,
    );
    const w = DECISION_WEIGHTS["value_builder"];
    expect(scoreDecisionOption(highValue, w)).toBeGreaterThan(
      scoreDecisionOption(lowValue, w),
    );
  });
});

// ── applyHardConstraints ───────────────────────────────────────

describe("applyHardConstraints", () => {
  it("blocks defer for compliance-critical", () => {
    const result = applyHardConstraints(
      makeOption({ optionType: "defer" }),
      { urgency: "critical", conditionState: "poor", complianceRisk: "high" },
      {},
    );
    expect(result.eligible).toBe(false);
    expect(result.penalties.some((p) => p.code === "COMPLIANCE_DEFER_BLOCKED")).toBe(true);
  });

  it("blocks defer for failed assets", () => {
    const result = applyHardConstraints(
      makeOption({ optionType: "defer" }),
      { urgency: "normal", conditionState: "failed", complianceRisk: "low" },
      {},
    );
    expect(result.eligible).toBe(false);
  });

  it("allows repair for compliance-critical", () => {
    const result = applyHardConstraints(
      makeOption({ optionType: "repair" }),
      { urgency: "critical", conditionState: "poor", complianceRisk: "high" },
      {},
    );
    expect(result.eligible).toBe(true);
  });

  it("penalizes budget breach", () => {
    const result = applyHardConstraints(
      makeOption({ estimatedCost: 50000 }),
      { urgency: "normal", conditionState: "fair", complianceRisk: "low" },
      { capexBudgetConstraint: 30000 },
    );
    expect(result.penalties.some((p) => p.code === "BUDGET_BREACH")).toBe(true);
  });
});

// ── deriveConditionState ───────────────────────────────────────

describe("deriveConditionState", () => {
  it("returns good for young assets", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    expect(
      deriveConditionState({ installedAt: twoYearsAgo.toISOString() }, [], 20),
    ).toBe("good");
  });

  it("returns failed for assets past useful life", () => {
    const twentyYearsAgo = new Date();
    twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 22);
    expect(
      deriveConditionState({ installedAt: twentyYearsAgo.toISOString() }, [], 20),
    ).toBe("failed");
  });

  it("returns fair when no info", () => {
    expect(deriveConditionState({}, [], 20)).toBe("fair");
  });
});

// ── Explanation service ────────────────────────────────────────

describe("buildOptionExplanation", () => {
  it("returns required fields", () => {
    const features = extractDecisionFeatures(makeOption(), makeProjection(), {
      maxCostInSet: 20000,
      planningHorizonYears: 10,
    });
    const expl = buildOptionExplanation(makeOption(), features, 72.5);
    expect(expl.optionId).toBe("opt-1");
    expect(expl.optionType).toBe("replace_full");
    expect(expl.finalScore).toBe(72.5);
    expect(expl.shortTermImpact).toBeTruthy();
    expect(expl.longTermImpact).toBeTruthy();
    expect(expl.whenToChoose).toBeTruthy();
  });
});

describe("buildRecommendationExplanation", () => {
  it("builds summary comparing options", () => {
    const ctx = { maxCostInSet: 20000, planningHorizonYears: 10 };
    const options = [
      { option: makeOption({ id: "a", optionType: "replace_full" }), features: extractDecisionFeatures(makeOption(), makeProjection(), ctx), finalScore: 80 },
      { option: makeOption({ id: "b", optionType: "defer" }), features: extractDecisionFeatures(makeOption({ optionType: "defer", estimatedCost: 0 }), null, ctx), finalScore: 40 },
    ];
    const expl = buildRecommendationExplanation(options);
    expect(expl.selectedOptionId).toBe("a");
    expect(expl.options).toHaveLength(2);
    expect(expl.summary).toContain("replace_full");
  });
});
