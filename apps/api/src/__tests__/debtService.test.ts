/**
 * Unit tests for the levered-NPV finance engine (pure functions, no server).
 *   - debtService: amortization schedules, aggregation, cost of debt, WACC
 *   - financeMath: NPV / IRR
 */
import {
  buildAmortizationSchedule,
  aggregateDebtSchedule,
  weightedCostOfDebtPct,
  waccPct,
  type MortgageTerms,
} from "../services/debtService";
import { npvAtRate, irr } from "../services/financeMath";

describe("buildAmortizationSchedule", () => {
  it("INTEREST_ONLY keeps the balance flat and charges interest only", () => {
    const terms: MortgageTerms = {
      currentBalanceChf: 1_000_000,
      interestRatePct: 2,
      amortizationType: "INTEREST_ONLY",
    };
    const sched = buildAmortizationSchedule(terms, 3);
    expect(sched).toHaveLength(3);
    for (const f of sched) {
      expect(f.interestChf).toBe(20_000); // 2% of 1M
      expect(f.principalChf).toBe(0);
      expect(f.closingBalanceChf).toBe(1_000_000);
    }
  });

  it("LINEAR repays a fixed principal and interest declines on the falling balance", () => {
    const terms: MortgageTerms = {
      currentBalanceChf: 100_000,
      interestRatePct: 3,
      amortizationType: "LINEAR",
      annualAmortizationChf: 10_000,
    };
    const sched = buildAmortizationSchedule(terms, 2);
    expect(sched[0].principalChf).toBe(10_000);
    expect(sched[0].interestChf).toBe(3_000); // 3% of 100k
    expect(sched[0].closingBalanceChf).toBe(90_000);
    expect(sched[1].interestChf).toBe(2_700); // 3% of 90k
    expect(sched[1].closingBalanceChf).toBe(80_000);
  });

  it("ANNUITY holds total payment ~constant and amortizes to zero over the term", () => {
    const terms: MortgageTerms = {
      currentBalanceChf: 100_000,
      interestRatePct: 5,
      amortizationType: "ANNUITY",
      termYears: 10,
    };
    const sched = buildAmortizationSchedule(terms, 10);
    const payments = sched.map((f) => f.paymentChf);
    // Constant payment within rounding
    const min = Math.min(...payments), max = Math.max(...payments);
    expect(max - min).toBeLessThanOrEqual(2);
    // Fully amortized at the end of the term
    expect(sched[9].closingBalanceChf).toBeLessThanOrEqual(2);
    // Principal share grows over time
    expect(sched[9].principalChf).toBeGreaterThan(sched[0].principalChf);
  });

  it("never lets the balance go negative", () => {
    const terms: MortgageTerms = {
      currentBalanceChf: 5_000,
      interestRatePct: 1,
      amortizationType: "LINEAR",
      annualAmortizationChf: 4_000,
    };
    const sched = buildAmortizationSchedule(terms, 3);
    expect(sched[0].closingBalanceChf).toBe(1_000);
    expect(sched[1].principalChf).toBe(1_000); // capped at remaining balance
    expect(sched[1].closingBalanceChf).toBe(0);
    expect(sched[2].principalChf).toBe(0);
  });
});

describe("aggregateDebtSchedule", () => {
  it("returns a zero-filled schedule when there are no mortgages", () => {
    const sched = aggregateDebtSchedule([], 2);
    expect(sched).toHaveLength(2);
    expect(sched[0]).toMatchObject({ interestChf: 0, principalChf: 0, closingBalanceChf: 0 });
  });

  it("sums interest and principal across two mortgages", () => {
    const io: MortgageTerms = { currentBalanceChf: 1_000_000, interestRatePct: 2, amortizationType: "INTEREST_ONLY" };
    const lin: MortgageTerms = { currentBalanceChf: 100_000, interestRatePct: 3, amortizationType: "LINEAR", annualAmortizationChf: 10_000 };
    const agg = aggregateDebtSchedule([io, lin], 1);
    expect(agg[0].interestChf).toBe(20_000 + 3_000);
    expect(agg[0].principalChf).toBe(0 + 10_000);
    expect(agg[0].closingBalanceChf).toBe(1_000_000 + 90_000);
  });
});

describe("weightedCostOfDebtPct", () => {
  it("returns null when there is no debt", () => {
    expect(weightedCostOfDebtPct([])).toBeNull();
    expect(weightedCostOfDebtPct([{ currentBalanceChf: 0, interestRatePct: 3 }])).toBeNull();
  });

  it("weights rates by balance", () => {
    const r = weightedCostOfDebtPct([
      { currentBalanceChf: 1_000_000, interestRatePct: 2 },
      { currentBalanceChf: 1_000_000, interestRatePct: 4 },
    ]);
    expect(r).toBe(3); // equal balances → simple average
    const r2 = weightedCostOfDebtPct([
      { currentBalanceChf: 3_000_000, interestRatePct: 2 },
      { currentBalanceChf: 1_000_000, interestRatePct: 6 },
    ]);
    expect(r2).toBe(3); // (3*2 + 1*6) / 4
  });
});

describe("waccPct", () => {
  it("equals cost of equity when there is no debt", () => {
    expect(waccPct({ marketValueChf: 1_000_000, totalDebtChf: 0, costOfEquityPct: 6, costOfDebtPct: 2, taxRatePct: 25 })).toBe(6);
  });

  it("applies the after-tax debt weight", () => {
    // V=1,000,000  D=600,000  E=400,000  Re=6  Rd=2  tax=25%
    // wacc = 0.4*6 + 0.6*2*0.75 = 2.4 + 0.9 = 3.3
    expect(waccPct({ marketValueChf: 1_000_000, totalDebtChf: 600_000, costOfEquityPct: 6, costOfDebtPct: 2, taxRatePct: 25 })).toBe(3.3);
  });
});

describe("financeMath", () => {
  it("npvAtRate discounts each period from t0", () => {
    // [-1000, 1100] at 10% → -1000 + 1100/1.1 = 0
    expect(npvAtRate([-1000, 1100], 10)).toBeCloseTo(0, 5);
  });

  it("irr of a single-period doubling is the expected rate", () => {
    expect(irr([-1000, 1100])).toBeCloseTo(10, 1);
  });

  it("irr of a level annuity matches the textbook value", () => {
    // [-1000, 500, 500, 500] → ~23.38%
    const v = irr([-1000, 500, 500, 500]);
    expect(v).not.toBeNull();
    expect(v!).toBeCloseTo(23.38, 0);
  });

  it("returns null when there is no sign change", () => {
    expect(irr([100, 200, 300])).toBeNull();
    expect(irr([-100, -200])).toBeNull();
  });

  it("returns null for multi-sign-change (non-unique IRR) series (CR-021)", () => {
    // -,+,-,+ → two sign changes → ambiguous IRR
    expect(irr([-1000, 3000, -3000, 1500])).toBeNull();
  });

  it("still resolves a single-sign-change series with an interim zero", () => {
    // -,0,+,+ is a single sign change → unique IRR
    expect(irr([-1000, 0, 600, 700])).not.toBeNull();
  });
});
