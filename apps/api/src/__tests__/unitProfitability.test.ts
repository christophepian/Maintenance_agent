/**
 * Unit tests for computeUnitProfitability (pure, no server).
 *   - the overhead pool is allocated pro-rata by living area and conserved exactly
 *   - fully-loaded NOI is annualised; yields computed on both value bases
 *   - ranking by market yield desc; sell-candidate flag relative to the building avg
 *   - graceful when no market price exists
 */
import { computeUnitProfitability, type UnitProfitabilityInput } from "../services/unitProfitability";

function u(
  id: string,
  netIncomeCents: number,
  expensesCents: number,
  apportionedChargesCents: number,
  livingAreaSqm: number,
  intrinsicPricePerSqmChf: number,
): UnitProfitabilityInput {
  return {
    fin: { unitId: id, unitNumber: id, floor: null, tenantName: null, netIncomeCents, expensesCents, apportionedChargesCents, occupancyRate: 1, monthlyRentChf: null },
    val: { livingAreaSqm, intrinsicPricePerSqmChf, vetustePct: 0 },
  };
}

// ownerOpex = 90000 - 20000 = 70000; attributed non-recoverable = (30000-10000)+(20000-5000)+(10000-5000) = 40000
// → pool = 30000; areas 100/80/60 (total 240)
const INPUTS = [
  u("A", 100_000, 30_000, 10_000, 100, 5_000),
  u("B", 80_000, 20_000, 5_000, 80, 5_000),
  u("C", 40_000, 10_000, 5_000, 60, 4_000),
];
const BUILDING = { operatingTotalCents: 90_000, recoverableAncillaryCents: 20_000 };
const MARKET_PPSQM = 6_000; // CHF/m²
const YEAR = 365;

describe("computeUnitProfitability", () => {
  it("allocates the overhead pool pro-rata and conserves it exactly", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, MARKET_PPSQM, YEAR);
    expect(r.allocatedOverheadPoolCents).toBe(30_000);
    expect(r.allocationKey).toBe("livingAreaSqm");
    const sumAllocated = r.rows.reduce((s, x) => s + x.allocatedOverheadCents, 0);
    expect(sumAllocated).toBe(30_000); // conserved, no leakage
    const a = r.rows.find((x) => x.unitId === "A")!;
    expect(a.allocatedOverheadCents).toBe(12_500); // 30000 * 100/240
  });

  it("annualises fully-loaded NOI (period = full year → factor 1)", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, MARKET_PPSQM, YEAR);
    const a = r.rows.find((x) => x.unitId === "A")!;
    expect(a.annualNoiCents).toBe(87_500); // 100000 - 12500
  });

  it("scales NOI to the period length", () => {
    const one = [u("A", 10_000, 0, 0, 100, 5_000)];
    const r = computeUnitProfitability(one, { operatingTotalCents: 0, recoverableAncillaryCents: 0 }, null, 30);
    expect(r.rows[0].annualNoiCents).toBe(Math.round(10_000 * (365 / 30)));
  });

  it("computes yield on both value bases", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, MARKET_PPSQM, YEAR);
    const a = r.rows.find((x) => x.unitId === "A")!;
    expect(a.intrinsicValueChf).toBe(500_000); // 100 * 5000
    expect(a.marketValueChf).toBe(600_000); // 100 * 6000
    // 875 CHF NOI / 600000 * 100 = 0.15%
    expect(a.netYieldOnMarketPct).toBeCloseTo(0.15, 2);
    expect(a.netYieldOnIntrinsicPct).toBeCloseTo(0.18, 2); // 875 / 500000
  });

  it("ranks by market yield descending, unpriced last, and flags sell candidates", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, MARKET_PPSQM, YEAR);
    // non-increasing market yield
    for (let i = 1; i < r.rows.length; i++) {
      const prev = r.rows[i - 1].netYieldOnMarketPct ?? -Infinity;
      const cur = r.rows[i].netYieldOnMarketPct ?? -Infinity;
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
    // C is the low-yield/high-value laggard → sell candidate; A is not
    expect(r.rows.find((x) => x.unitId === "C")!.sellCandidate).toBe(true);
    expect(r.rows.find((x) => x.unitId === "A")!.sellCandidate).toBe(false);
    expect(r.avgNetYieldOnMarketPct).not.toBeNull();
  });

  it("is graceful when no market price exists", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, null, YEAR);
    expect(r.avgNetYieldOnMarketPct).toBeNull();
    for (const row of r.rows) {
      expect(row.marketValueChf).toBeNull();
      expect(row.netYieldOnMarketPct).toBeNull();
      expect(row.sellCandidate).toBe(false);
      expect(row.netYieldOnIntrinsicPct).not.toBeNull(); // intrinsic still computed
    }
  });

  it("noiContribution sums to ~100%", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, MARKET_PPSQM, YEAR);
    const sum = r.rows.reduce((s, x) => s + (x.noiContributionPct ?? 0), 0);
    expect(sum).toBeCloseTo(100, 0);
  });
});
