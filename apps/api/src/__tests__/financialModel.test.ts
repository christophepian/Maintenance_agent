import {
  computeNPV,
  computePaybackYears,
  computeTaxProfile,
  computeFinancialProjection,
} from "../services/financialModelService";

describe("computeNPV", () => {
  it("returns 0 for empty cashflows", () => {
    expect(computeNPV([], 0.05)).toBe(0);
  });

  it("discounts future cashflows correctly", () => {
    // 1000 in year 1 at 5% → 952.38
    const npv = computeNPV([1000], 0.05);
    expect(npv).toBeCloseTo(952.38, 0);
  });

  it("sums multiple years with discounting", () => {
    const npv = computeNPV([1000, 1000, 1000], 0.05);
    // PV = 1000/1.05 + 1000/1.05^2 + 1000/1.05^3 ≈ 2723.25
    expect(npv).toBeCloseTo(2723.25, 0);
  });
});

describe("computePaybackYears", () => {
  it("returns undefined when never pays back", () => {
    expect(computePaybackYears(-10000, [100, 100, 100])).toBeUndefined();
  });

  it("returns exact year when pays back at year boundary", () => {
    const result = computePaybackYears(-3000, [1000, 1000, 1000, 1000]);
    expect(result).toBe(3);
  });

  it("returns fractional year with interpolation", () => {
    const result = computePaybackYears(-5000, [2000, 2000, 2000]);
    // After year 2: -1000, after year 3: +1000 → payback at 2 + 1000/2000 = 2.5
    expect(result).toBe(2.5);
  });
});

describe("computeTaxProfile", () => {
  it("WERTERHALTEND: fully deductible immediately", () => {
    const tp = computeTaxProfile({
      totalCost: 10000,
      classification: "WERTERHALTEND",
      deductiblePct: 100,
      usefulLifeMonths: 120,
    });
    expect(tp.deductibleImmediatelyAmount).toBe(10000);
    expect(tp.capitalizableAmount).toBe(0);
    expect(tp.year1TaxShield).toBe(2500); // 10000 * 0.25
    expect(tp.totalTaxShield).toBe(2500);
    expect(tp.taxShieldTimingScore).toBe(100);
  });

  it("WERTVERMEHREND: fully capitalizable", () => {
    const tp = computeTaxProfile({
      totalCost: 10000,
      classification: "WERTVERMEHREND",
      deductiblePct: 0,
      usefulLifeMonths: 120,
    });
    expect(tp.deductibleImmediatelyAmount).toBe(0);
    expect(tp.capitalizableAmount).toBe(10000);
    expect(tp.annualDepreciationAmount).toBe(1000); // 10000 / 10 years
    expect(tp.year1TaxShield).toBe(250); // 1000 * 0.25
    expect(tp.totalTaxShield).toBe(2500);
    expect(tp.taxShieldTimingScore).toBe(10); // 250/2500 * 100
  });

  it("MIXED: partial split", () => {
    const tp = computeTaxProfile({
      totalCost: 10000,
      classification: "MIXED",
      deductiblePct: 60,
      usefulLifeMonths: 120,
    });
    expect(tp.deductibleImmediatelyAmount).toBe(6000);
    expect(tp.capitalizableAmount).toBe(4000);
    expect(tp.annualDepreciationAmount).toBe(400); // 4000 / 10
  });
});

describe("computeFinancialProjection", () => {
  it("computes basic projection", () => {
    const proj = computeFinancialProjection({
      estimatedCost: 10000,
      estimatedUsefulLifeYears: 10,
      opexReductionPerYear: 500,
      rentUpliftPerYear: 300,
      residualValueImpact: 2000,
      analysisHorizonYears: 10,
    });

    expect(proj.initialOutflow).toBe(-10000);
    expect(proj.annualCashflows).toHaveLength(10);
    expect(proj.annualCashflows[0]).toBe(800); // 500+300
    expect(proj.annualCashflows[9]).toBe(2800); // 800+2000 residual
    expect(proj.cashflowYear1).toBe(-9200); // -10000 + 800
    expect(proj.npvBase).toBeDefined();
    expect(proj.paybackYears).toBeDefined();
    expect(proj.uncertaintyScore).toBeGreaterThanOrEqual(0);
    expect(proj.uncertaintyScore).toBeLessThanOrEqual(100);
  });

  it("handles zero benefits", () => {
    const proj = computeFinancialProjection({
      estimatedCost: 5000,
      estimatedUsefulLifeYears: 5,
      opexReductionPerYear: 0,
      rentUpliftPerYear: 0,
      residualValueImpact: 0,
      analysisHorizonYears: 5,
    });
    expect(proj.paybackYears).toBeUndefined();
    expect(proj.totalValueCreation).toBe(-5000);
  });
});
