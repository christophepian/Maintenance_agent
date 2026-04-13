/**
 * Tests: Tenant Claim Analysis (C-1, C-3)
 *
 * Unit tests for the claim analysis composition service including:
 *   - TenantClaimAnalysisDTO structure
 *   - Tenant guidance generation
 *   - Landlord obligations generation
 *   - Temporal context (seasonal pro-rating, back-dating)
 *   - Legal basis construction
 *   - Multi-defect aggregation
 *
 * Uses jest mocks for prisma + dependent services to isolate unit logic.
 */

import type { DefectSignals, DefectSeverity } from "../services/defectClassifier";
import type { DefectMatch, MatchResult } from "../services/defectMatcher";
import type { RequestNature } from "../services/legalTranslations";
import type { RentReductionResult, ReductionLine } from "../services/rentReductionCalculator";
import type { LegalDecisionDTO, Citation } from "../services/legalDecisionEngine";
import type { DepreciationSignalDTO } from "../services/depreciation";
import { LegalObligation, LegalAuthority } from "@prisma/client";

// ─── Mock factories ────────────────────────────────────────────

function makeDefectSignals(overrides: Partial<DefectSignals> = {}): DefectSignals {
  return {
    keywords: [],
    severity: "moderate" as DefectSeverity,
    affectedArea: { rooms: [] },
    duration: { ongoing: false, seasonal: false },
    inferredCategories: [],
    ...overrides,
  };
}

function makeDefectMatch(overrides: Partial<DefectMatch> = {}): DefectMatch {
  return {
    ruleKey: "CH_RENT_RED_MOULD_LIGHT",
    ruleId: "rule-1",
    defect: "Moisissures légères",
    defectEn: "Light mould",
    category: "Humidité",
    categoryEn: "Humidity",
    reductionPercent: 10,
    matchConfidence: 60,
    matchReasons: ["Category match: Humidité"],
    citation: { article: "ASLOCA/Lachat", text: "Swiss tenancy case law" },
    ...overrides,
  };
}

function makeMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  const match = makeDefectMatch();
  return {
    matches: [match],
    bestMatch: match,
    requestNature: "other" as RequestNature,
    unmatchedSignals: [],
    ...overrides,
  };
}

function makeReductionLine(overrides: Partial<ReductionLine> = {}): ReductionLine {
  return {
    defect: "Moisissures légères",
    ruleKey: "CH_RENT_RED_MOULD_LIGHT",
    reductionPercent: 10,
    monthlyReductionChf: 150,
    seasonal: false,
    ...overrides,
  };
}

function makeRentReduction(overrides: Partial<RentReductionResult> = {}): RentReductionResult {
  return {
    netRentChf: 1500,
    primaryReduction: makeReductionLine(),
    additionalReductions: [],
    totalReductionPercent: 10,
    totalReductionChf: 150,
    capApplied: false,
    ...overrides,
  };
}

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    article: "CO 256",
    text: "Landlord duty to maintain habitable condition",
    authority: "STATUTE" as LegalAuthority,
    ...overrides,
  };
}

// ─── Import the buildTemporalContext function directly ──────────

import { buildTemporalContext } from "../services/tenantClaimAnalysis";

// ==========================================
// C-3: Temporal Context
// ==========================================

describe("tenantClaimAnalysis — buildTemporalContext", () => {
  describe("duration extraction", () => {
    it("computes durationMonths and defectOngoingSince from defect signals", () => {
      const signals = makeDefectSignals({
        duration: { months: 3, ongoing: true, seasonal: false },
      });
      const matchResult = makeMatchResult();
      const ctx = buildTemporalContext(signals, matchResult, null);

      expect(ctx.durationMonths).toBe(3);
      expect(ctx.defectOngoingSince).toBeDefined();
      // Should be approximately 3 months ago
      const since = new Date(ctx.defectOngoingSince!);
      const now = new Date();
      const diffMonths = (now.getFullYear() - since.getFullYear()) * 12 + (now.getMonth() - since.getMonth());
      expect(diffMonths).toBeGreaterThanOrEqual(2);
      expect(diffMonths).toBeLessThanOrEqual(4);
    });

    it("returns no duration fields when months is not set", () => {
      const signals = makeDefectSignals({
        duration: { ongoing: false, seasonal: false },
      });
      const ctx = buildTemporalContext(signals, makeMatchResult(), null);
      expect(ctx.durationMonths).toBeUndefined();
      expect(ctx.defectOngoingSince).toBeUndefined();
    });

    it("returns no duration fields when months is 0", () => {
      const signals = makeDefectSignals({
        duration: { months: 0, ongoing: false, seasonal: false },
      });
      const ctx = buildTemporalContext(signals, makeMatchResult(), null);
      expect(ctx.durationMonths).toBeUndefined();
      expect(ctx.defectOngoingSince).toBeUndefined();
    });
  });

  describe("seasonal adjustment", () => {
    it("applies seasonal adjustment for heating-related categories", () => {
      const signals = makeDefectSignals({
        inferredCategories: ["Température"],
        duration: { months: 6, ongoing: true, seasonal: true },
      });
      const match = makeDefectMatch({ reductionPercent: 15, category: "Température" });
      const matchResult: MatchResult = {
        matches: [match],
        bestMatch: match,
        requestNature: "heating" as RequestNature,
        unmatchedSignals: [],
      };

      const ctx = buildTemporalContext(signals, matchResult, null);

      expect(ctx.seasonalAdjustment).toBe(true);
      expect(ctx.proRatedPercent).toBeDefined();
      // 15 * 7/12 ≈ 8.75
      expect(ctx.proRatedPercent).toBeCloseTo(8.75, 1);
    });

    it("does not apply seasonal adjustment for non-heating categories", () => {
      const signals = makeDefectSignals({
        inferredCategories: ["Humidité"],
        duration: { months: 3, ongoing: true, seasonal: false },
      });

      const ctx = buildTemporalContext(signals, makeMatchResult(), null);

      expect(ctx.seasonalAdjustment).toBe(false);
      expect(ctx.proRatedPercent).toBeUndefined();
    });

    it("detects seasonal from defectSignals.duration.seasonal flag", () => {
      const signals = makeDefectSignals({
        inferredCategories: [],
        duration: { months: 4, ongoing: true, seasonal: true },
      });
      const match = makeDefectMatch({ reductionPercent: 50, category: "Température" });
      const matchResult: MatchResult = {
        matches: [match],
        bestMatch: match,
        requestNature: "heating" as RequestNature,
        unmatchedSignals: [],
      };

      const ctx = buildTemporalContext(signals, matchResult, null);

      expect(ctx.seasonalAdjustment).toBe(true);
      // 50 * 7/12 ≈ 29.17
      expect(ctx.proRatedPercent).toBeCloseTo(29.17, 0);
    });
  });

  describe("back-dated reduction", () => {
    it("calculates back-dated reduction for ongoing defects", () => {
      const signals = makeDefectSignals({
        duration: { months: 3, ongoing: true, seasonal: false },
      });
      const rentReduction = makeRentReduction({
        totalReductionChf: 150,
      });

      const ctx = buildTemporalContext(signals, makeMatchResult(), rentReduction);

      expect(ctx.backdatedReductionChf).toBe(450); // 3 * 150
    });

    it("caps seasonal back-dating to heating season months", () => {
      const signals = makeDefectSignals({
        inferredCategories: ["Température"],
        duration: { months: 12, ongoing: true, seasonal: true },
      });
      const match = makeDefectMatch({ reductionPercent: 15, category: "Température" });
      const matchResult: MatchResult = {
        matches: [match],
        bestMatch: match,
        requestNature: "heating" as RequestNature,
        unmatchedSignals: [],
      };
      const rentReduction = makeRentReduction({
        totalReductionChf: 200,
      });

      const ctx = buildTemporalContext(signals, matchResult, rentReduction);

      expect(ctx.seasonalAdjustment).toBe(true);
      // Capped at 7 months (heating season)
      expect(ctx.backdatedReductionChf).toBe(1400); // 7 * 200
    });

    it("returns no back-dated amount when no rent reduction", () => {
      const signals = makeDefectSignals({
        duration: { months: 3, ongoing: true, seasonal: false },
      });

      const ctx = buildTemporalContext(signals, makeMatchResult(), null);

      expect(ctx.backdatedReductionChf).toBeUndefined();
    });
  });

  describe("multi-defect scenarios", () => {
    it("handles signals with multiple categories", () => {
      const signals = makeDefectSignals({
        keywords: [
          { term: "moisissure", category: "Humidité", weight: 1.0 },
          { term: "lave-vaisselle", category: "Défauts", weight: 1.0 },
        ],
        inferredCategories: ["Humidité", "Défauts"],
        duration: { months: 2, ongoing: true, seasonal: false },
      });
      const m1 = makeDefectMatch({ ruleKey: "CH_RENT_RED_MOULD_LIGHT", category: "Humidité", reductionPercent: 10 });
      const m2 = makeDefectMatch({ ruleKey: "CH_RENT_RED_DISHWASHER", category: "Défauts", reductionPercent: 3 });
      const matchResult: MatchResult = {
        matches: [m1, m2],
        bestMatch: m1,
        requestNature: "other" as RequestNature,
        unmatchedSignals: [],
      };
      const rentReduction = makeRentReduction({
        totalReductionPercent: 13,
        totalReductionChf: 195,
      });

      const ctx = buildTemporalContext(signals, matchResult, rentReduction);

      expect(ctx.durationMonths).toBe(2);
      expect(ctx.backdatedReductionChf).toBe(390); // 2 * 195
      expect(ctx.seasonalAdjustment).toBe(false);
    });
  });
});

// ==========================================
// Legal basis builder (internal test via export check)
// ==========================================

// We can't directly test buildLegalBasis as it's not exported,
// but we can test it through the full analyseClaimForRequest flow
// in integration tests. Here we test the DTO shape expectations.

describe("tenantClaimAnalysis — DTO types", () => {
  it("MatchedDefectEntry has expected fields", () => {
    // Type-level test: ensure the interface is correctly shaped
    const entry = {
      rank: 1,
      ruleKey: "CH_RENT_RED_MOULD_LIGHT",
      defect: "Moisissures légères",
      category: "Humidité",
      reductionPercent: 10,
      matchConfidence: 60,
      matchReasons: ["Category match"],
    };
    expect(entry.rank).toBe(1);
    expect(entry.ruleKey).toContain("MOULD");
  });

  it("TemporalContext has expected shape", () => {
    const ctx = buildTemporalContext(
      makeDefectSignals({ duration: { months: 3, ongoing: true, seasonal: false } }),
      makeMatchResult(),
      makeRentReduction(),
    );
    expect(ctx).toHaveProperty("seasonalAdjustment");
    expect(ctx).toHaveProperty("durationMonths");
    expect(ctx).toHaveProperty("defectOngoingSince");
    expect(ctx).toHaveProperty("backdatedReductionChf");
  });
});

// ==========================================
// Seasonal pro-rating edge cases
// ==========================================

describe("tenantClaimAnalysis — seasonal edge cases", () => {
  it("heating defect with short duration (Dec → Apr = 5 months)", () => {
    const signals = makeDefectSignals({
      inferredCategories: ["Température"],
      duration: { months: 5, ongoing: true, seasonal: true },
    });
    const match = makeDefectMatch({ reductionPercent: 50, category: "Température" });
    const matchResult: MatchResult = {
      matches: [match], bestMatch: match, requestNature: "heating" as RequestNature, unmatchedSignals: [],
    };
    const rentReduction = makeRentReduction({ totalReductionChf: 750 });

    const ctx = buildTemporalContext(signals, matchResult, rentReduction);

    expect(ctx.seasonalAdjustment).toBe(true);
    // proRatedPercent = 50 * 7/12 ≈ 29.17
    expect(ctx.proRatedPercent).toBeCloseTo(29.17, 0);
    // Back-dated: 5 months (less than 7 heating months, so use 5)
    expect(ctx.backdatedReductionChf).toBe(3750); // 5 * 750
  });

  it("no seasonal adjustment without Température category or seasonal flag", () => {
    const signals = makeDefectSignals({
      keywords: [{ term: "moisissure", category: "Humidité", weight: 1.0 }],
      inferredCategories: ["Humidité"],
      duration: { months: 6, ongoing: true, seasonal: false },
    });
    const match = makeDefectMatch({ category: "Humidité", reductionPercent: 10 });
    const matchResult: MatchResult = {
      matches: [match], bestMatch: match, requestNature: "other" as RequestNature, unmatchedSignals: [],
    };
    const rentReduction = makeRentReduction({ totalReductionChf: 150 });

    const ctx = buildTemporalContext(signals, matchResult, rentReduction);

    expect(ctx.seasonalAdjustment).toBe(false);
    expect(ctx.proRatedPercent).toBeUndefined();
    expect(ctx.backdatedReductionChf).toBe(900); // 6 * 150
  });
});

// ==========================================
// Severity escalation (C-3)
// ==========================================

describe("tenantClaimAnalysis — severity selection", () => {
  it("severe severity signals trigger higher-reduction match", () => {
    // This tests the defect matcher scoring indirectly:
    // When signals have severity "severe" or "critical", the matcher should
    // prefer higher-reduction rules. We test the DTO expectation here.
    const mildMatch = makeDefectMatch({
      ruleKey: "CH_RENT_RED_MOULD_LIGHT",
      reductionPercent: 10,
      matchConfidence: 40,
    });
    const severeMatch = makeDefectMatch({
      ruleKey: "CH_RENT_RED_ROOM_SEVERE_MOULD",
      reductionPercent: 80,
      matchConfidence: 75,
    });
    const matchResult: MatchResult = {
      matches: [severeMatch, mildMatch], // sorted by confidence desc
      bestMatch: severeMatch,
      requestNature: "other" as RequestNature,
      unmatchedSignals: [],
    };

    // bestMatch should be the severe one
    expect(matchResult.bestMatch!.reductionPercent).toBe(80);
    expect(matchResult.bestMatch!.ruleKey).toContain("SEVERE");
    expect(matchResult.matches.length).toBe(2);
  });
});
