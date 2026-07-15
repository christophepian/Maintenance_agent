/**
 * P1 archetype-bridge enrichment tests for computeRecommendation.
 *
 * These pin the NEW resolution the enrichment adds on top of the invariants in
 * computeRecommendation.characterization.test.ts:
 *   - a dedicated `opportunistic_repositioner` branch (previously fell through), and
 *   - dimension signals (modernisation / appreciation+horizon / liquidity / income)
 *     that resolve previously-tie cases WITHOUT firing on neutral inputs.
 */
import { computeRecommendation } from "../routes/forecasting";
import type { NPVScenarioResult } from "../services/npvService";

function sc(npvChf: number): NPVScenarioResult {
  return { npvChf, totalCapexChf: 0, totalTaxShieldChf: 0, totalNoiChf: 0, terminalValuePvChf: 0, yearlyFlows: [] };
}
// neglect wins on raw NPV — so any assertion of invest/defer proves a rule fired
// BEFORE the tie-breaker rather than coincidentally matching it.
const NEGLECT_WINS = { invest: sc(10), defer: sc(20), neglect: sc(100) };

describe("computeRecommendation — opportunistic_repositioner branch", () => {
  it("invests when modernisation preference is high", () => {
    const r = computeRecommendation("opportunistic_repositioner", { modernizationPreference: 80, capexTolerance: 40, saleReadiness: 40 }, 5, NEGLECT_WINS, 3);
    expect(r.scenario).toBe("invest");
  });
  it("invests when capex tolerance is high even if modernisation is mid", () => {
    const r = computeRecommendation("opportunistic_repositioner", { modernizationPreference: 50, capexTolerance: 70, saleReadiness: 40 }, 5, NEGLECT_WINS, 3);
    expect(r.scenario).toBe("invest");
  });
  it("invests when facility condition is fair (FCI ≥ 10)", () => {
    const r = computeRecommendation("opportunistic_repositioner", { modernizationPreference: 40, capexTolerance: 40, saleReadiness: 40 }, 15, NEGLECT_WINS, 3);
    expect(r.scenario).toBe("invest");
  });
  it("falls through to the NPV tie-breaker when there is no appetite or condition trigger", () => {
    const r = computeRecommendation("opportunistic_repositioner", { modernizationPreference: 40, capexTolerance: 40, saleReadiness: 40 }, 5, NEGLECT_WINS, 3);
    expect(r.scenario).toBe("neglect"); // tie-breaker, since no rule fired
  });
});

describe("computeRecommendation — enriched dimension signals (no archetype)", () => {
  it("high liquidity sensitivity + low capex appetite → defer", () => {
    const r = computeRecommendation(null, { liquiditySensitivity: 80, capexTolerance: 30, saleReadiness: 40 }, 5, NEGLECT_WINS, 3);
    expect(r.scenario).toBe("defer");
  });
  it("long horizon + high appreciation priority + capex appetite → invest", () => {
    const r = computeRecommendation(null, { appreciationPriority: 80, horizon: 80, capexTolerance: 60, saleReadiness: 40 }, 5, NEGLECT_WINS, 3);
    expect(r.scenario).toBe("invest");
  });
  it("strong modernisation appetite → invest", () => {
    const r = computeRecommendation(null, { modernizationPreference: 80, capexTolerance: 60, saleReadiness: 40 }, 5, NEGLECT_WINS, 3);
    expect(r.scenario).toBe("invest");
  });
  it("income priority + fair condition → invest", () => {
    const r = computeRecommendation(null, { incomePriority: 80, capexTolerance: 40, saleReadiness: 40 }, 15, NEGLECT_WINS, 3);
    expect(r.scenario).toBe("invest");
  });
  it("neutral dims do NOT fire any enriched rule — still reaches the tie-breaker", () => {
    const r = computeRecommendation(null, { saleReadiness: 50, capexTolerance: 50 }, 5, NEGLECT_WINS, 3);
    expect(r.scenario).toBe("neglect");
  });
});
