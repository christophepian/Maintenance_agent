/**
 * Characterization test for computeRecommendation (pure function, no server).
 *
 * Purpose: pin the CURRENT verdict for the deterministic decision paths BEFORE the
 * P1 archetype-bridge enrichment, so the enrichment can only ADD resolution for
 * previously-underspecified inputs and can never silently flip an existing verdict.
 *
 * These cases return BEFORE the NPV tie-breaker, so their outcome is independent of
 * the scenario NPVs. The `opportunistic_repositioner` archetype is INTENTIONALLY not
 * pinned here — it currently falls through to the dimension/NPV logic and the
 * enrichment deliberately changes it (see computeRecommendation.enrichment.test.ts).
 */
import { computeRecommendation } from "../routes/forecasting";
import type { NPVScenarioResult } from "../services/npvService";

function sc(npvChf: number): NPVScenarioResult {
  return {
    npvChf,
    totalCapexChf: 0,
    totalTaxShieldChf: 0,
    totalNoiChf: 0,
    terminalValuePvChf: 0,
    yearlyFlows: [],
  };
}

// Neutral scenario set — invest highest, so any accidental fall-through to the
// tie-breaker would return "invest" (distinct from the "defer"/"neglect" we assert).
const NEUTRAL = { invest: sc(100), defer: sc(50), neglect: sc(10) };

describe("computeRecommendation — invariants (must survive P1 enrichment)", () => {
  it("FCI ≥ 30 forces invest regardless of archetype/dims", () => {
    const r = computeRecommendation("capital_preserver", { capexTolerance: 0, saleReadiness: 100 }, 30, NEUTRAL, 3);
    expect(r.scenario).toBe("invest");
    expect(r.rationale).toBeTruthy();
  });

  it("exit_optimizer with saleReadiness ≥ 65 → defer", () => {
    const r = computeRecommendation("exit_optimizer", { saleReadiness: 65, capexTolerance: 50 }, 5, NEUTRAL, 3);
    expect(r.scenario).toBe("defer");
  });

  it("yield_maximizer → invest", () => {
    const r = computeRecommendation("yield_maximizer", { saleReadiness: 90, capexTolerance: 10 }, 0, NEUTRAL, 3);
    expect(r.scenario).toBe("invest");
  });

  it("value_builder → invest", () => {
    const r = computeRecommendation("value_builder", { saleReadiness: 90, capexTolerance: 10 }, 0, NEUTRAL, 3);
    expect(r.scenario).toBe("invest");
  });

  it("capital_preserver with FCI ≥ 10 (and < 30) → invest", () => {
    const r = computeRecommendation("capital_preserver", { saleReadiness: 50, capexTolerance: 50 }, 15, NEUTRAL, 3);
    expect(r.scenario).toBe("invest");
  });

  it("capital_preserver with FCI < 10 → defer", () => {
    const r = computeRecommendation("capital_preserver", { saleReadiness: 50, capexTolerance: 50 }, 5, NEUTRAL, 3);
    expect(r.scenario).toBe("defer");
  });

  it("dimension fallback: high sale readiness + low capex appetite → defer", () => {
    const r = computeRecommendation(null, { saleReadiness: 75, capexTolerance: 30 }, 5, NEUTRAL, 3);
    expect(r.scenario).toBe("defer");
  });

  it("dimension fallback: strong capex tolerance + fair FCI → invest", () => {
    const r = computeRecommendation(null, { saleReadiness: 50, capexTolerance: 70 }, 15, NEUTRAL, 3);
    expect(r.scenario).toBe("invest");
  });

  describe("NPV tie-breaker (no archetype, neutral dims, FCI < 10)", () => {
    const neutralDims = { saleReadiness: 50, capexTolerance: 50 };
    it("picks the scenario with the highest NPV — invest", () => {
      const r = computeRecommendation(null, neutralDims, 5, { invest: sc(100), defer: sc(50), neglect: sc(10) }, 3);
      expect(r.scenario).toBe("invest");
    });
    it("picks the scenario with the highest NPV — defer", () => {
      const r = computeRecommendation(null, neutralDims, 5, { invest: sc(20), defer: sc(90), neglect: sc(10) }, 3);
      expect(r.scenario).toBe("defer");
    });
    it("picks the scenario with the highest NPV — neglect", () => {
      const r = computeRecommendation(null, neutralDims, 5, { invest: sc(20), defer: sc(30), neglect: sc(90) }, 3);
      expect(r.scenario).toBe("neglect");
    });
  });

  it("null dims defaults to capexTolerance=50 / saleReadiness=50 → tie-breaker", () => {
    const r = computeRecommendation(null, null, 5, { invest: sc(100), defer: sc(50), neglect: sc(10) }, 3);
    expect(r.scenario).toBe("invest");
  });
});
