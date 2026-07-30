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
