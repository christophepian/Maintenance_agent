/**
 * Unit tests for the renovation-aware NOI adjustments that keep the plan NPV
 * consistent with the simulator (pure function, no server).
 */
import { computeRenovationNoiAdjustments } from "../services/npvService";

const RENO = {
  assetId: "a1",
  capexYear: 2026,      // = fromYear → "Act Now"
  costChf: 20_000,
  rentUpliftChfPerMonth: 500,   // 6'000 / yr
  riskAvoidedChfPerYear: 1_200,
};

describe("computeRenovationNoiAdjustments", () => {
  const fromYear = 2026, toYear = 2030, deferYears = 3;

  it("Invest credits uplift after the work year, bears risk in the work year", () => {
    const { investNoiAdj } = computeRenovationNoiAdjustments([RENO], fromYear, toYear, deferYears);
    expect(investNoiAdj.get(2026)).toBe(-1_200); // work year → still bears risk
    expect(investNoiAdj.get(2027)).toBe(6_000);  // uplift active
    expect(investNoiAdj.get(2030)).toBe(6_000);
  });

  it("Defer bears risk through the deferred window, uplift only after", () => {
    const { deferNoiAdj } = computeRenovationNoiAdjustments([RENO], fromYear, toYear, deferYears);
    // deferYear = 2026 + 3 = 2029 → risk through 2029, uplift from 2030
    expect(deferNoiAdj.get(2027)).toBe(-1_200);
    expect(deferNoiAdj.get(2029)).toBe(-1_200);
    expect(deferNoiAdj.get(2030)).toBe(6_000);
  });

  it("Neglect bears the avoided risk every year and never gets uplift", () => {
    const { neglectNoiAdj } = computeRenovationNoiAdjustments([RENO], fromYear, toYear, deferYears);
    for (let y = 2026; y <= 2030; y++) expect(neglectNoiAdj.get(y)).toBe(-1_200);
  });

  it("Invest dominates Defer dominates Neglect on summed NOI adjustment", () => {
    const { investNoiAdj, deferNoiAdj, neglectNoiAdj } =
      computeRenovationNoiAdjustments([RENO], fromYear, toYear, deferYears);
    const sum = (m: Map<number, number>) => [...m.values()].reduce((s, v) => s + v, 0);
    expect(sum(investNoiAdj)).toBeGreaterThan(sum(deferNoiAdj));
    expect(sum(deferNoiAdj)).toBeGreaterThan(sum(neglectNoiAdj));
  });

  it("is empty when there are no renovations", () => {
    const { investNoiAdj, deferNoiAdj, neglectNoiAdj } =
      computeRenovationNoiAdjustments([], fromYear, toYear, deferYears);
    expect(investNoiAdj.size).toBe(0);
    expect(deferNoiAdj.size).toBe(0);
    expect(neglectNoiAdj.size).toBe(0);
  });

  it("vacancy adds a one-time lost-rent cost in the work year (Invest), pushed for Defer, none for Neglect", () => {
    const RENO_VAC = { ...RENO, unitId: "u1", vacancyMonths: 2, unitMonthlyRentChf: 2_000 }; // 4'000 vacancy
    const { investNoiAdj, deferNoiAdj, neglectNoiAdj } =
      computeRenovationNoiAdjustments([RENO_VAC], fromYear, toYear, deferYears);
    expect(investNoiAdj.get(2026)).toBe(-1_200 - 4_000); // risk + vacancy in work year
    expect(investNoiAdj.get(2027)).toBe(6_000);          // uplift unaffected
    expect(deferNoiAdj.get(2029)).toBe(-1_200 - 4_000);  // vacancy at the deferred work year (2029)
    for (let y = 2026; y <= 2030; y++) expect(neglectNoiAdj.get(y)).toBe(-1_200); // never any vacancy
  });

  it("vacancy is valued once per unit when multiple assets share a unit", () => {
    const a = { ...RENO, assetId: "a1", unitId: "u1", vacancyMonths: 2, unitMonthlyRentChf: 2_000 };
    const b = { ...RENO, assetId: "a2", unitId: "u1", vacancyMonths: 2, unitMonthlyRentChf: 2_000 };
    const { investNoiAdj } = computeRenovationNoiAdjustments([a, b], fromYear, toYear, deferYears);
    // two assets in one unit → risk doubles (-2'400) but vacancy counts once (-4'000), not twice
    expect(investNoiAdj.get(2026)).toBe(-2_400 - 4_000);
  });
});
