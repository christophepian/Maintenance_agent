/**
 * Unit tests for computeUnitProfitability (pure, no server).
 * DIRECT COSTING:
 *   - each unit's NOI = its directly-attributed net income (no overhead spread)
 *   - shared building-level costs surfaced separately, reconciling to building NOI
 *   - NOI annualised; yield on intrinsic value
 *   - building value bottom-up (Σ intrinsic), NAV, value-share, ranking, sell flag
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

const INPUTS = [
  u("A", 100_000, 30_000, 10_000, 100, 5_000), // intrinsic 500k
  u("B", 80_000, 20_000, 5_000, 80, 5_000),    // intrinsic 400k
  u("C", 40_000, 10_000, 5_000, 60, 4_000),    // intrinsic 240k
];
// Σ unit direct NOI = 220_000. Building operating NOI = 190_000 →
// building-level (shared, non-unit) costs = 30_000.
const BUILDING = { operatingTotalCents: 90_000, recoverableAncillaryCents: 20_000, netOperatingIncomeCents: 190_000, ppeEstimateChf: 1_100_000, marketValueChf: 1_200_000, totalDebtChf: 400_000 };
const YEAR = 365;

describe("computeUnitProfitability", () => {
  it("uses direct costing — no overhead is spread across units", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, YEAR);
    expect(r.rows.every((x) => x.allocatedOverheadCents === 0)).toBe(true);
  });

  it("surfaces shared building-level costs separately and reconciles to building NOI", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, YEAR);
    expect(r.totalAnnualNoiCents).toBe(220_000); // Σ direct unit NOI
    expect(r.buildingOperatingNoiCents).toBe(190_000);
    expect(r.buildingLevelCostsCents).toBe(30_000); // 220_000 − 190_000
  });

  it("annualises each unit's DIRECT NOI and computes intrinsic yield", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, YEAR);
    const a = r.rows.find((x) => x.unitId === "A")!;
    expect(a.annualNoiCents).toBe(100_000); // direct, unannualised at YEAR
    expect(a.intrinsicValueChf).toBe(500_000);
    expect(a.netYieldOnIntrinsicPct).toBeCloseTo(0.2, 2); // 1000 / 500000
  });

  it("scales NOI to the period length", () => {
    const one = [u("A", 10_000, 0, 0, 100, 5_000)];
    const r = computeUnitProfitability(one, { operatingTotalCents: 0, recoverableAncillaryCents: 0, netOperatingIncomeCents: 0, ppeEstimateChf: null, marketValueChf: null, totalDebtChf: null }, 30);
    expect(r.rows[0].annualNoiCents).toBe(Math.round(10_000 * (365 / 30)));
  });

  it("computes building value bottom-up, NAV, and value shares", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, YEAR);
    expect(r.buildingIntrinsicValueChf).toBe(1_140_000); // 500k + 400k + 240k
    expect(r.navChf).toBe(740_000); // 1_140_000 - 400_000 debt
    expect(r.ppeEstimateChf).toBe(1_100_000); // passed through for reconciliation
    const a = r.rows.find((x) => x.unitId === "A")!;
    expect(a.valueSharePct).toBeCloseTo((500_000 / 1_140_000) * 100, 1);
    const shareSum = r.rows.reduce((s, x) => s + (x.valueSharePct ?? 0), 0);
    expect(shareSum).toBeCloseTo(100, 0);
  });

  it("ranks by intrinsic yield descending and flags sell candidates below building yield", () => {
    const r = computeUnitProfitability(INPUTS, BUILDING, YEAR);
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i - 1].netYieldOnIntrinsicPct ?? -Infinity).toBeGreaterThanOrEqual(r.rows[i].netYieldOnIntrinsicPct ?? -Infinity);
    }
    expect(r.buildingNetYieldPct).not.toBeNull();
    for (const row of r.rows) expect(typeof row.sellCandidate).toBe("boolean");
  });

  it("prices parking/garage units from the garage/parking value lines (no area × price/m²)", () => {
    // A garage carries its whole value in garageValueChf with null livingAreaSqm
    // and null intrinsicPricePerSqmChf — its yield must still compute.
    const garage: UnitProfitabilityInput[] = [{
      fin: { unitId: "9001", unitNumber: "9001", floor: null, tenantName: null, netIncomeCents: 120_000, expensesCents: 0, apportionedChargesCents: 0, occupancyRate: 1, monthlyRentChf: null },
      val: { livingAreaSqm: null, intrinsicPricePerSqmChf: null, vetustePct: 0, garageValueChf: 40_000 },
    }];
    const r = computeUnitProfitability(garage, { operatingTotalCents: 0, recoverableAncillaryCents: 0, netOperatingIncomeCents: 0, ppeEstimateChf: null, marketValueChf: null, totalDebtChf: null }, YEAR);
    expect(r.rows[0].intrinsicValueChf).toBe(40_000);
    expect(r.rows[0].netYieldOnIntrinsicPct).toBeCloseTo(3, 2); // 1200 / 40000
  });

  it("is graceful when units have no intrinsic inputs", () => {
    const noVal: UnitProfitabilityInput[] = [{
      fin: { unitId: "X", unitNumber: "X", floor: null, tenantName: null, netIncomeCents: 5_000, expensesCents: 0, apportionedChargesCents: 0, occupancyRate: 1, monthlyRentChf: null },
      val: null,
    }];
    const r = computeUnitProfitability(noVal, { operatingTotalCents: 0, recoverableAncillaryCents: 0, netOperatingIncomeCents: 0, ppeEstimateChf: null, marketValueChf: null, totalDebtChf: null }, YEAR);
    expect(r.buildingIntrinsicValueChf).toBeNull();
    expect(r.buildingNetYieldPct).toBeNull();
    expect(r.navChf).toBeNull();
    expect(r.rows[0].intrinsicValueChf).toBeNull();
    expect(r.rows[0].valueSharePct).toBeNull();
    expect(r.rows[0].sellCandidate).toBe(false);
  });
});
