/**
 * Unit tests for the multi-owner strategy reconciliation (pure, no server) — the
 * subtle "owners diverge → cautious defer, never average/pick-a-winner" rule
 * that drives the owner-portfolio NPV verdict (CR-020).
 */
import { reconcileOwnerRecommendations } from "../routes/cashflowPlans";

describe("reconcileOwnerRecommendations", () => {
  it("single owner → that owner's scenario, singular rationale", () => {
    const r = reconcileOwnerRecommendations([
      { scenario: "invest", rationale: "yield-maximiser", archetype: "yield_maximizer" },
    ]);
    expect(r.recommendedScenario).toBe("invest");
    expect(r.divergent).toBe(false);
    expect(r.rationale).toContain("the owner's portfolio strategy");
  });

  it("unanimous owners → consensus scenario, agreement rationale", () => {
    const r = reconcileOwnerRecommendations([
      { scenario: "invest", rationale: "a", archetype: "value_builder" },
      { scenario: "invest", rationale: "b", archetype: "yield_maximizer" },
    ]);
    expect(r.recommendedScenario).toBe("invest");
    expect(r.divergent).toBe(false);
    expect(r.rationale).toContain("All owners' strategies agree");
  });

  it("divergent owners → cautious 'defer' (not averaged, not first-picked)", () => {
    const r = reconcileOwnerRecommendations([
      { scenario: "invest", rationale: "a", goalLabel: "Grow value" },
      { scenario: "neglect", rationale: "b", goalLabel: "Harvest cash" },
    ]);
    expect(r.recommendedScenario).toBe("defer");
    expect(r.divergent).toBe(true);
    expect(r.rationale).toContain("differing strategies");
    // Rationale names the competing goals for transparency
    expect(r.rationale).toContain("Grow value");
    expect(r.rationale).toContain("Harvest cash");
  });

  it("falls back to archetype labels when goalLabel is absent", () => {
    const r = reconcileOwnerRecommendations([
      { scenario: "invest", rationale: "a", archetype: "value_builder" },
      { scenario: "defer", rationale: "b", archetype: "exit_optimizer" },
    ]);
    expect(r.recommendedScenario).toBe("defer");
    expect(r.rationale).toContain("value_builder");
    expect(r.rationale).toContain("exit_optimizer");
  });
});
