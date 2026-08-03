/**
 * Unit tests for buildingStrategyResolver (pure, no server).
 * Pins the building → owner-portfolio → none precedence + dims parsing.
 */
import { resolveBuildingStrategy } from "../services/strategy/buildingStrategyResolver";

const dims = (o: Record<string, number>) => JSON.stringify(o);

describe("resolveBuildingStrategy", () => {
  it("prefers an explicit building profile (source 'building')", () => {
    const r = resolveBuildingStrategy(
      { primaryArchetype: "value_builder", roleIntent: "long_term_quality", effectiveDimensionsJson: dims({ capexTolerance: 70, saleReadiness: 10 }) },
      [{ primaryArchetype: "exit_optimizer", dimensionsJson: dims({ saleReadiness: 100 }), userFacingGoalLabel: "Sell" }],
    );
    expect(r.source).toBe("building");
    expect(r.hasProfile).toBe(true);
    expect(r.archetype).toBe("value_builder");
    expect(r.roleIntent).toBe("long_term_quality");
    expect(r.dims).toEqual({ capexTolerance: 70, saleReadiness: 10 });
  });

  it("falls back to owner portfolio when no building profile (source 'owner-portfolio')", () => {
    const r = resolveBuildingStrategy(null, [
      { primaryArchetype: "capital_preserver", dimensionsJson: dims({ stabilityPreference: 100 }), userFacingGoalLabel: "Keep stable" },
      { primaryArchetype: "yield_maximizer", dimensionsJson: dims({ incomePriority: 90 }), userFacingGoalLabel: "Income" },
    ]);
    expect(r.source).toBe("owner-portfolio");
    expect(r.archetype).toBe("capital_preserver"); // first owner = effective default
    expect(r.dims).toEqual({ stabilityPreference: 100 });
    expect(r.ownerProfileCount).toBe(2);
    expect(r.ownerProfiles).toHaveLength(2);
    expect(r.ownerProfiles?.[1].archetype).toBe("yield_maximizer");
  });

  it("returns source 'none' when there are no profiles at all", () => {
    const r = resolveBuildingStrategy(null, []);
    expect(r.source).toBe("none");
    expect(r.hasProfile).toBe(false);
    expect(r.archetype).toBeNull();
    expect(r.dims).toBeNull();
  });

  it("tolerates malformed dimensions JSON (dims → null, no throw)", () => {
    const r = resolveBuildingStrategy(
      { primaryArchetype: "value_builder", roleIntent: null, effectiveDimensionsJson: "{not json" },
      [],
    );
    expect(r.source).toBe("building");
    expect(r.dims).toBeNull();
    expect(r.roleIntent).toBeNull();
  });
});
