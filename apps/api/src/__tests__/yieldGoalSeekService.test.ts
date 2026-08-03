/**
 * Unit tests for the pure yield goal-seek. Numbers mirror the planning prototype
 * so the shipped math matches what was signed off.
 */
import {
  computeYieldGoalSeek,
  oblfAnnualUplift,
  YieldGoalSeekInput,
} from "../services/yieldGoalSeekService";

// Illustrative building: 2.69% current yield.
const BASE: YieldGoalSeekInput = {
  valueChf: 4_200_000,
  currentNoiChf: 113_000,
  rentRollChf: 210_000,
  occupancyRate: 0.94,
  targetYieldPct: 3.0,
  mgmtFeePct: 5,
  oblfPassthroughPct: 50,
  opportunities: [
    // Accretive: marginal yield 1000/24000 = 4.17% > 2.69%.
    { assetId: "a", unitId: "u1", label: "Bathroom — 2.03", costChf: 40_000, usefulLifeYears: 20, capitalizableFraction: 0.6 },
    // Dilutive: marginal yield 2000/90000 = 2.22% < 2.69%.
    { assetId: "b", unitId: null, label: "Façade insulation", costChf: 120_000, usefulLifeYears: 30, capitalizableFraction: 0.75 },
  ],
};

describe("oblfAnnualUplift (shared with the simulator)", () => {
  it("amortises passthrough over useful life", () => {
    expect(oblfAnnualUplift(40_000, 20, 50)).toBeCloseTo(1000, 6);
  });
  it("is zero for a non-positive life", () => {
    expect(oblfAnnualUplift(40_000, 0, 50)).toBe(0);
  });
});

describe("computeYieldGoalSeek", () => {
  const r = computeYieldGoalSeek(BASE);

  it("computes the current yield and the NOI gap", () => {
    expect(r.currentYieldPct).toBeCloseTo(2.69, 2);
    expect(r.requiredNoiChf).toBe(126_000);
    expect(r.gapChf).toBe(13_000);
    expect(r.met).toBe(false);
  });

  it("translates the gap into the rent lever", () => {
    expect(r.levers.rent.deltaMonthlyChf).toBeCloseTo(1083.33, 2);
    expect(r.levers.rent.pctOfRentRoll).toBeCloseTo(0.0619, 3);
  });

  it("computes a feasible occupancy target", () => {
    expect(r.levers.occupancy.requiredOccupancyRate).toBeCloseTo(0.9982, 3);
    expect(r.levers.occupancy.feasible).toBe(true);
  });

  it("reports the management fee as a share of the gap (neutral)", () => {
    expect(r.levers.mgmtFee.feeChf).toBe(10_500);
    expect(r.levers.mgmtFee.gapCoverPct).toBeCloseTo(0.8077, 3);
  });

  it("classifies renovations accretive vs dilutive and excludes dilutive from the ceiling", () => {
    const [a, b] = r.levers.renovation.lines;
    expect(a.accretive).toBe(true);
    expect(b.accretive).toBe(false); // NPV+ but yield-dilutive
    expect(r.levers.renovation.accretiveCount).toBe(1);
    // Ceiling uses only the accretive work, with ΔV in the denominator.
    expect(r.levers.renovation.capexChf).toBe(40_000);
    expect(r.levers.renovation.ceilingYieldPct).toBeCloseTo(2.7, 2);
    expect(r.levers.renovation.feasible).toBe(false); // works alone can't reach 3.0%
  });

  it("flags a target already met", () => {
    const met = computeYieldGoalSeek({ ...BASE, targetYieldPct: 2.5 });
    expect(met.met).toBe(true);
    expect(met.gapChf).toBeLessThanOrEqual(0);
  });

  it("marks occupancy infeasible when it would need > 100%", () => {
    const hard = computeYieldGoalSeek({ ...BASE, targetYieldPct: 4.5 });
    expect(hard.levers.occupancy.feasible).toBe(false);
  });
});

// Realism bands + strategy flags + tiered synthesis.
const REALISM: YieldGoalSeekInput = {
  ...BASE,
  targetYieldPct: 3.0,                          // gap = +13,000
  rentMarketGapAnnualChf: 8_000,                // rent ceiling below the gap
  controllableOpexChf: 30_000,
  controllableOpexBest3yrChf: 25_000,           // opex headroom = 5,000
  strategy: { source: "owner-portfolio", flags: { renovation: true, selfManage: true, rentAggressive: true } },
};

describe("realism bands", () => {
  const r = computeYieldGoalSeek(REALISM);

  it("greys out rent when the gap exceeds the as-is market gap", () => {
    expect(r.levers.rent.marketGapAnnualChf).toBe(8_000);
    expect(r.levers.rent.feasible).toBe(false); // needs 13k, market supports 8k
  });

  it("greys out opex when the gap exceeds the best-of-3-years floor", () => {
    expect(r.levers.opex.headroomChf).toBe(5_000);
    expect(r.levers.opex.feasible).toBe(false); // needs 13k, headroom 5k
  });

  it("keeps opex feasible when the gap is within the headroom", () => {
    const easy = computeYieldGoalSeek({ ...REALISM, targetYieldPct: 2.8 }); // gap 4,600 < 5,000
    expect(easy.levers.opex.feasible).toBe(true);
  });

  it("reframes the fee as self-manage below the floor", () => {
    const low = computeYieldGoalSeek({ ...REALISM, mgmtFeePct: 0.5 });
    expect(low.levers.mgmtFee.selfManage).toBe(true);
    const normal = computeYieldGoalSeek({ ...REALISM, mgmtFeePct: 5 });
    expect(normal.levers.mgmtFee.selfManage).toBe(false);
  });

  it("caps a renovation's OBLF uplift at what the market supports", () => {
    const capped = computeYieldGoalSeek({
      ...REALISM,
      opportunities: [{ assetId: "x", unitId: null, label: "Kitchen", costChf: 40_000, usefulLifeYears: 20, capitalizableFraction: 0.6, marketUpliftCeilingAnnualChf: 600 }],
    });
    // OBLF would be 40000*0.5/20 = 1000; market caps it at 600.
    expect(capped.levers.renovation.lines[0].annualUpliftChf).toBe(600);
  });
});

describe("strategy alignment", () => {
  const r = computeYieldGoalSeek(REALISM);

  it("flags off-strategy levers from the profile", () => {
    expect(r.levers.rent.offStrategy).toBe(true);        // aggressive + rentAggressive flag
    expect(r.levers.renovation.offStrategy).toBe(true);  // renovation-averse
    const low = computeYieldGoalSeek({ ...REALISM, mgmtFeePct: 0.5 });
    expect(low.levers.mgmtFee.offStrategy).toBe(true);   // self-manage + hands-off flag
  });

  it("drops the strategy axis when there is no profile", () => {
    const none = computeYieldGoalSeek({ ...REALISM, strategy: null });
    expect(none.strategySource).toBe("none");
    expect(none.levers.rent.offStrategy).toBe(false);
    expect(none.levers.renovation.offStrategy).toBe(false);
  });
});

describe("tiered synthesis", () => {
  it("computes monotonic within ≤ +renovation ≤ +self-manage tiers", () => {
    const r = computeYieldGoalSeek(REALISM);
    const s = r.synthesis;
    expect(s.withinStrategyYieldPct).toBeGreaterThanOrEqual(r.currentYieldPct);
    expect(s.withRenovationYieldPct).toBeGreaterThanOrEqual(s.withinStrategyYieldPct - 1e-9);
    expect(s.withSelfManageYieldPct).toBeGreaterThanOrEqual(s.withRenovationYieldPct - 1e-9);
  });

  it("excludes off-strategy levers (aggressive rent) from the within-strategy tier", () => {
    const off = computeYieldGoalSeek(REALISM); // rentAggressive → rent excluded from within
    const on = computeYieldGoalSeek({ ...REALISM, strategy: { source: "none", flags: {} } });
    // With rent on-strategy the within-strategy tier picks up the market gap → higher.
    expect(on.synthesis.withinStrategyYieldPct).toBeGreaterThan(off.synthesis.withinStrategyYieldPct);
  });
});
