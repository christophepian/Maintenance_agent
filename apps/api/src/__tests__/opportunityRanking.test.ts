/**
 * Unit tests for opportunityRanking (pure, no server).
 *   - neutral (no archetype, no dims) reproduces the existing recommendation-priority sort
 *   - each mandate floats the expected item to the top
 *   - OBLF uplift preview is a positive number for costed items
 */
import { rankOpportunitiesForMandate, oblfUpliftPreview } from "../services/strategy/opportunityRanking";
import type { RenovationOpportunity } from "../services/assetInventory";

function opp(over: Partial<RenovationOpportunity> & { assetId: string }): RenovationOpportunity {
  return {
    assetId: over.assetId,
    assetName: over.assetName ?? over.assetId,
    applianceName: null,
    assetType: "SYSTEM",
    topic: "generic",
    installedAt: null,
    ageMonths: null,
    usefulLifeMonths: 480,
    depreciationPct: 0,
    residualPct: null,
    remainingLifeMonths: 120,
    cumulativeRepairCostChf: 0,
    estimatedReplacementCostChf: 0,
    replacementCostConfidence: null,
    repairToReplacementRatio: null,
    annualRepairRate: null,
    breakEvenMonths: null,
    warrantyOffsetMonths: 24,
    recommendation: "REPAIR",
    recommendationReason: "",
    lastConditionStatus: null,
    lastConditionAt: null,
    lastConditionReportType: null,
    lastConditionValidated: false,
    currentLease: null,
    unitId: "u1",
    unitNumber: "1",
    ...over,
  };
}

// Fixtures: a big urgent envelope move, a cheap quick win, a mid boiler, a monitor roof.
const facade = opp({ assetId: "facade", recommendation: "REPLACE", estimatedReplacementCostChf: 400_000, depreciationPct: 80, lastConditionStatus: "POOR", remainingLifeMonths: 6, usefulLifeMonths: 480 });
const boiler = opp({ assetId: "boiler", recommendation: "PLAN_REPLACEMENT", estimatedReplacementCostChf: 180_000, depreciationPct: 60, lastConditionStatus: "FAIR", remainingLifeMonths: 24, usefulLifeMonths: 240 });
const roof = opp({ assetId: "roof", recommendation: "MONITOR", estimatedReplacementCostChf: 70_000, depreciationPct: 40, lastConditionStatus: "GOOD", remainingLifeMonths: 120 });
const cheap = opp({ assetId: "cheap", recommendation: "REPAIR", estimatedReplacementCostChf: 30_000, depreciationPct: 20, lastConditionStatus: "GOOD", remainingLifeMonths: 200, usefulLifeMonths: 300 });

const ALL = [cheap, roof, boiler, facade]; // deliberately unsorted

const ids = (r: { assetId: string }[]) => r.map((x) => x.assetId);

describe("rankOpportunitiesForMandate", () => {
  it("neutral (no archetype, no dims) sorts by recommendation priority then depreciation", () => {
    const r = rankOpportunitiesForMandate(ALL, null, null);
    expect(ids(r)).toEqual(["facade", "boiler", "roof", "cheap"]); // REPLACE > PLAN_REPLACEMENT > MONITOR > REPAIR
  });

  it("capital_preserver floats the urgent replacement to the top", () => {
    const r = rankOpportunitiesForMandate(ALL, null, "capital_preserver");
    expect(r[0].assetId).toBe("facade");
    expect(r[0].fitReason.toLowerCase()).toContain("keep-things-stable");
  });

  it("value_builder ranks the large value-adding move first and the cheap one last", () => {
    const r = rankOpportunitiesForMandate(ALL, null, "value_builder");
    expect(r[0].assetId).toBe("facade");
    expect(r[r.length - 1].assetId).toBe("cheap");
  });

  it("yield_maximizer floats the cheap quick wins above the big-capex moves", () => {
    const r = rankOpportunitiesForMandate(ALL, null, "yield_maximizer");
    // both low-cost items outrank both high-capex items
    expect(ids(r).indexOf("cheap")).toBeLessThan(ids(r).indexOf("facade"));
    expect(ids(r).indexOf("roof")).toBeLessThan(ids(r).indexOf("boiler"));
    expect(["cheap", "roof"]).toContain(r[0].assetId);
  });

  it("attaches a positive OBLF uplift preview to costed items", () => {
    const r = rankOpportunitiesForMandate(ALL, null, "value_builder");
    for (const item of r) {
      if ((item.estimatedReplacementCostChf ?? 0) > 0) expect(item.oblfUpliftPreviewChfPerYear).toBeGreaterThan(0);
    }
  });

  it("dims can override the archetype base (high liquidity sensitivity favours quick wins)", () => {
    const base = rankOpportunitiesForMandate(ALL, null, "capital_preserver");
    const liquid = rankOpportunitiesForMandate(ALL, { liquiditySensitivity: 100, saleReadiness: 90, capexTolerance: 10 }, "capital_preserver");
    // the cheap quick-win should rank higher under the liquidity-sensitive dims than under the base preserver
    expect(ids(liquid).indexOf("cheap")).toBeLessThanOrEqual(ids(base).indexOf("cheap"));
  });
});

describe("oblfUpliftPreview", () => {
  it("= passthrough share amortised over useful life", () => {
    // 240k × 0.6 / (240/12) = 144k / 20 = 7200
    expect(oblfUpliftPreview(opp({ assetId: "x", estimatedReplacementCostChf: 240_000, usefulLifeMonths: 240 }))).toBe(7200);
  });
  it("returns 0 when there is no replacement cost", () => {
    expect(oblfUpliftPreview(opp({ assetId: "x", estimatedReplacementCostChf: null as unknown as number }))).toBe(0);
  });
});
