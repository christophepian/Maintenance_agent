/**
 * Tests: Rent Reduction Calculator (B-3)
 *
 * Unit tests for computing CHF rent reduction amounts from matched defects + lease.
 * Uses jest mocks for prisma to avoid DB dependency.
 */

import type { DefectMatch } from "../services/defectMatcher";

// Mock prisma
const mockLease = {
  id: "lease-1",
  status: "ACTIVE",
  netRentChf: 2000,
  startDate: new Date("2024-01-01"),
  endDate: null,
};

jest.mock("../services/prismaClient", () => ({
  __esModule: true,
  default: {
    lease: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === "lease-1") return Promise.resolve(mockLease);
        if (where.id === "lease-draft") return Promise.resolve({ ...mockLease, id: "lease-draft", status: "DRAFT" });
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        if (where.unitId === "unit-with-lease") return Promise.resolve({ id: "lease-1" });
        return Promise.resolve(null);
      }),
    },
  },
}));

import { calculateRentReduction, calculateRentReductionForUnit } from "../services/rentReductionCalculator";

function makeMatch(overrides: Partial<DefectMatch> = {}): DefectMatch {
  return {
    ruleKey: "CH_RENT_RED_DISHWASHER",
    ruleId: "rule-1",
    defect: "Lave-vaisselle en panne",
    defectEn: "Dishwasher broken",
    category: "Défauts",
    categoryEn: "Defects",
    reductionPercent: 3,
    matchConfidence: 75,
    matchReasons: ["Category match"],
    citation: { article: "ASLOCA/Lachat", text: "Swiss tenancy case law" },
    ...overrides,
  };
}

describe("rentReductionCalculator", () => {

  describe("calculateRentReduction", () => {

    it("computes basic reduction for dishwasher (3%)", async () => {
      const matches = [makeMatch({ reductionPercent: 3 })];
      const result = await calculateRentReduction(matches, "lease-1");

      expect(result).not.toBeNull();
      expect(result!.netRentChf).toBe(2000);
      expect(result!.primaryReduction.reductionPercent).toBe(3);
      expect(result!.primaryReduction.monthlyReductionChf).toBe(60); // 2000 * 3% = 60
      expect(result!.totalReductionPercent).toBe(3);
      expect(result!.totalReductionChf).toBe(60);
      expect(result!.capApplied).toBe(false);
    });

    it("computes reduction for severe mould (80%) with cap", async () => {
      const matches = [
        makeMatch({
          ruleKey: "CH_RENT_RED_ROOM_SEVERE_MOULD",
          defect: "Moisissure grave",
          category: "Humidité",
          reductionPercent: 80,
        }),
      ];
      const result = await calculateRentReduction(matches, "lease-1");

      expect(result).not.toBeNull();
      expect(result!.totalReductionPercent).toBe(70); // Capped at 70%
      expect(result!.totalReductionChf).toBe(1400); // 2000 * 70%
      expect(result!.capApplied).toBe(true);
      expect(result!.capNote).toContain("70%");
    });

    it("sums multi-defect reductions", async () => {
      const matches = [
        makeMatch({ ruleKey: "r1", reductionPercent: 3, defect: "Dishwasher" }),
        makeMatch({ ruleKey: "r2", reductionPercent: 10, defect: "Elevator", category: "Défauts" }),
      ];
      const result = await calculateRentReduction(matches, "lease-1");

      expect(result).not.toBeNull();
      expect(result!.totalReductionPercent).toBe(13); // 3 + 10
      expect(result!.totalReductionChf).toBe(260); // 2000 * 13%
      expect(result!.primaryReduction.reductionPercent).toBe(3);
      expect(result!.additionalReductions.length).toBe(1);
      expect(result!.additionalReductions[0].reductionPercent).toBe(10);
      expect(result!.capApplied).toBe(false);
    });

    it("caps multi-defect total at 70%", async () => {
      const matches = [
        makeMatch({ ruleKey: "r1", reductionPercent: 50, category: "Température" }),
        makeMatch({ ruleKey: "r2", reductionPercent: 30, category: "Humidité" }),
      ];
      const result = await calculateRentReduction(matches, "lease-1");

      expect(result).not.toBeNull();
      expect(result!.totalReductionPercent).toBe(70); // 50 + 30 = 80 → capped at 70
      expect(result!.totalReductionChf).toBe(1400);
      expect(result!.capApplied).toBe(true);
    });

    it("returns null for non-existent lease", async () => {
      const matches = [makeMatch()];
      const result = await calculateRentReduction(matches, "non-existent");
      expect(result).toBeNull();
    });

    it("returns null for draft lease", async () => {
      const matches = [makeMatch()];
      const result = await calculateRentReduction(matches, "lease-draft");
      expect(result).toBeNull();
    });

    it("returns null for empty matches", async () => {
      const result = await calculateRentReduction([], "lease-1");
      expect(result).toBeNull();
    });

    it("marks heating defects as seasonal", async () => {
      const matches = [
        makeMatch({
          ruleKey: "CH_RENT_RED_HEATING_PARTIAL",
          defect: "Chauffage insuffisant",
          category: "Température",
          reductionPercent: 15,
        }),
      ];
      const result = await calculateRentReduction(matches, "lease-1");

      expect(result).not.toBeNull();
      expect(result!.primaryReduction.seasonal).toBe(true);
      expect(result!.primaryReduction.seasonalNote).toContain("Oct–Apr");
    });

    it("non-heating defects are not seasonal", async () => {
      const matches = [makeMatch({ category: "Défauts" })];
      const result = await calculateRentReduction(matches, "lease-1");

      expect(result).not.toBeNull();
      expect(result!.primaryReduction.seasonal).toBe(false);
      expect(result!.primaryReduction.seasonalNote).toBeUndefined();
    });

    it("includes reductionMax when present", async () => {
      const matches = [
        makeMatch({
          reductionPercent: 10,
          reductionMax: 20,
        }),
      ];
      const result = await calculateRentReduction(matches, "lease-1");

      expect(result).not.toBeNull();
      expect(result!.primaryReduction.reductionMax).toBe(20);
      expect(result!.primaryReduction.monthlyReductionMaxChf).toBe(400); // 2000 * 20%
    });

    it("includes estimatedBackPayMonths from duration", async () => {
      const matches = [makeMatch()];
      const result = await calculateRentReduction(
        matches,
        "lease-1",
        { months: 6, ongoing: true, seasonal: false }
      );

      expect(result).not.toBeNull();
      expect(result!.estimatedBackPayMonths).toBe(6);
    });

    it("does not include back-pay when duration has no months", async () => {
      const matches = [makeMatch()];
      const result = await calculateRentReduction(
        matches,
        "lease-1",
        { ongoing: true, seasonal: false }
      );

      expect(result).not.toBeNull();
      expect(result!.estimatedBackPayMonths).toBeUndefined();
    });
  });

  describe("calculateRentReductionForUnit", () => {

    it("finds active lease and calculates reduction", async () => {
      const matches = [makeMatch({ reductionPercent: 10 })];
      const result = await calculateRentReductionForUnit(matches, "unit-with-lease");

      expect(result).not.toBeNull();
      expect(result!.netRentChf).toBe(2000);
      expect(result!.totalReductionPercent).toBe(10);
    });

    it("returns null for unit with no active lease", async () => {
      const matches = [makeMatch()];
      const result = await calculateRentReductionForUnit(matches, "unit-no-lease");
      expect(result).toBeNull();
    });

    it("returns null for empty matches", async () => {
      const result = await calculateRentReductionForUnit([], "unit-with-lease");
      expect(result).toBeNull();
    });
  });
});
