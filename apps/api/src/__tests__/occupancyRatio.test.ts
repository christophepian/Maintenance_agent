/**
 * Guardrail test for occupancyRatio — occupancy can never exceed 100%.
 * (Root cause of a 131% reading — counting lease rows instead of distinct
 * units — was fixed in inventoryRepository.countLeasedUnitsByBuilding; this
 * clamp is the belt-and-suspenders guardrail.)
 */
import { occupancyRatio } from "../services/financials";

describe("occupancyRatio", () => {
  it("clamps an over-count to 1 (never > 100%)", () => {
    expect(occupancyRatio(17, 13)).toBe(1); // e.g. 17 leases / 13 units
  });
  it("computes a normal ratio", () => {
    expect(occupancyRatio(9, 12)).toBeCloseTo(0.75, 4);
  });
  it("returns 0 when there are no units", () => {
    expect(occupancyRatio(5, 0)).toBe(0);
  });
  it("handles full occupancy", () => {
    expect(occupancyRatio(12, 12)).toBe(1);
  });
});
