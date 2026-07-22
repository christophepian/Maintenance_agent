/**
 * Unit tests for computeDepreciation (pure, no server/DB).
 * Focus: the non-positive useful-life guard (CR-002) that prevents a
 * divide-by-zero NaN from poisoning depreciationPct → the capex schedule/NPV.
 */
import { computeDepreciation } from "../services/assetInventory";

const installed = (isoDate: string) => ({ installedAt: new Date(isoDate), replacedAt: null });

describe("computeDepreciation — non-positive useful life guard (CR-002)", () => {
  it("returns null when usefulLifeMonths is 0 (no NaN leaks out)", () => {
    const dep = computeDepreciation(installed("2000-01-01"), {
      usefulLifeMonths: 0,
      standardId: null,
      source: "ASSET_OVERRIDE",
    });
    expect(dep).toBeNull();
  });

  it("returns null when usefulLifeMonths is negative", () => {
    const dep = computeDepreciation(installed("2000-01-01"), {
      usefulLifeMonths: -12,
      standardId: null,
      source: "ASSET_MODEL",
    });
    expect(dep).toBeNull();
  });

  it("computes finite, bounded values for a valid useful life", () => {
    const dep = computeDepreciation(installed("2000-01-01"), {
      usefulLifeMonths: 120,
      standardId: null,
      source: "STANDARD_NATIONAL",
    });
    expect(dep).not.toBeNull();
    expect(Number.isFinite(dep!.depreciationPct)).toBe(true);
    expect(dep!.depreciationPct).toBeGreaterThanOrEqual(0);
    expect(dep!.depreciationPct).toBeLessThanOrEqual(100);
    expect(dep!.residualPct).toBe(100 - dep!.depreciationPct);
  });

  it("returns null when there is no install/replace clock start", () => {
    const dep = computeDepreciation({ installedAt: null, replacedAt: null }, {
      usefulLifeMonths: 120,
      standardId: null,
      source: "STANDARD_NATIONAL",
    });
    expect(dep).toBeNull();
  });
});
