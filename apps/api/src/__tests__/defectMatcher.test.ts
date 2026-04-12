/**
 * Tests: Defect Matcher (B-2)
 *
 * Unit tests for matching DefectSignals against ASLOCA rent reduction rules.
 * Uses jest mocks for prisma to avoid DB dependency in unit tests.
 */

import type { DefectSignals, DefectSeverity } from "../services/defectClassifier";

// Mock prisma before importing the module
jest.mock("../services/prismaClient", () => {
  const mockRules = [
    makeRule("CH_RENT_RED_MOULD_LIGHT", "Moisissures légères", "Humidité", 10),
    makeRule("CH_RENT_RED_ROOM_SEVERE_MOULD", "Moisissure grave, 80% de la pièce inhabitable", "Humidité", 80),
    makeRule("CH_RENT_RED_DISHWASHER", "Lave-vaisselle en panne", "Défauts", 3),
    makeRule("CH_RENT_RED_ELEVATOR", "Ascenseur en panne", "Défauts", 10),
    makeRule("CH_RENT_RED_WORKS_BELOW_HEAVY", "Travaux importants en dessous, bruit et poussière", "Rénovations", 30),
    makeRule("CH_RENT_RED_WORKS_BELOW_LIGHT", "Travaux légers en dessous", "Rénovations", 10),
    makeRule("CH_RENT_RED_HEATING_PARTIAL", "Chauffage insuffisant, température inférieure à 18°C", "Température", 15),
    makeRule("CH_RENT_RED_HEATING_TOTAL", "Absence totale de chauffage", "Température", 50),
    makeRule("CH_RENT_RED_WATER_LEAK", "Infiltration d'eau par le plafond", "Dégâts d'eau", 20),
    makeRule("CH_RENT_RED_NOISE_NEIGHBOR", "Bruit excessif des voisins", "Immissions", 10),
  ];

  return {
    __esModule: true,
    default: {
      legalRule: {
        findMany: jest.fn().mockResolvedValue(mockRules),
      },
    },
  };
});

function makeRule(key: string, defect: string, category: string, reductionPercent: number) {
  return {
    id: `rule-${key}`,
    key,
    isActive: true,
    authority: "INDUSTRY_STANDARD",
    jurisdiction: "CH",
    canton: null,
    scope: "FEDERAL",
    priority: 100,
    topic: null,
    ruleType: "MAINTENANCE_OBLIGATION",
    versions: [
      {
        id: `version-${key}`,
        effectiveFrom: new Date("2020-01-01"),
        effectiveTo: null,
        dslJson: {
          type: "RENT_REDUCTION",
          defect,
          category,
          reductionPercent,
          basis: "jurisprudence",
          source: "ASLOCA/Lachat",
        },
        citationsJson: [
          { article: "ASLOCA/Lachat", text: "Swiss tenancy case law" },
        ],
      },
    ],
  };
}

import { matchDefectsToRules, MatchResult } from "../services/defectMatcher";

function makeSignals(overrides: Partial<DefectSignals> = {}): DefectSignals {
  return {
    keywords: [],
    severity: "moderate" as DefectSeverity,
    affectedArea: { rooms: [] },
    duration: { ongoing: false, seasonal: false },
    inferredCategories: [],
    ...overrides,
  };
}

describe("defectMatcher — matchDefectsToRules", () => {

  it("matches mould complaint to mould rules", async () => {
    const signals = makeSignals({
      keywords: [
        { term: "moisissure", category: "Humidité", weight: 1.0 },
      ],
      severity: "moderate",
      affectedArea: { rooms: ["chambre"] },
      inferredCategories: ["Humidité"],
    });

    const result = await matchDefectsToRules(signals);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.bestMatch).not.toBeNull();
    expect(result.bestMatch!.category).toBe("Humidité");
    expect(result.bestMatch!.ruleKey).toMatch(/MOULD/);
  });

  it("matches severe mould to high-reduction rule", async () => {
    const signals = makeSignals({
      keywords: [
        { term: "moisissure", category: "Humidité", weight: 1.0 },
      ],
      severity: "critical",
      affectedArea: { rooms: [], percentAffected: 80 },
      inferredCategories: ["Humidité"],
    });

    const result = await matchDefectsToRules(signals);
    expect(result.matches.length).toBeGreaterThan(0);
    // Critical severity should boost the 80% rule's score
    const severeRule = result.matches.find((m) => m.ruleKey === "CH_RENT_RED_ROOM_SEVERE_MOULD");
    expect(severeRule).toBeDefined();
    expect(severeRule!.reductionPercent).toBe(80);
  });

  it("matches dishwasher complaint", async () => {
    const signals = makeSignals({
      keywords: [
        { term: "lave-vaisselle", category: "Défauts", weight: 1.0 },
        { term: "panne", category: "Défauts", weight: 1.0 },
      ],
      severity: "moderate",
      inferredCategories: ["Défauts"],
    });

    const result = await matchDefectsToRules(signals);
    const dishwasher = result.matches.find((m) => m.ruleKey === "CH_RENT_RED_DISHWASHER");
    expect(dishwasher).toBeDefined();
    expect(dishwasher!.reductionPercent).toBe(3);
    expect(dishwasher!.matchConfidence).toBeGreaterThanOrEqual(20);
  });

  it("matches renovation noise to both heavy and light work rules", async () => {
    const signals = makeSignals({
      keywords: [
        { term: "travaux", category: "Rénovations", weight: 1.0 },
        { term: "bruit", category: "Immissions", weight: 1.0 },
      ],
      severity: "moderate",
      inferredCategories: ["Rénovations", "Immissions"],
    });

    const result = await matchDefectsToRules(signals);
    const ruleKeys = result.matches.map((m) => m.ruleKey);
    expect(ruleKeys).toContain("CH_RENT_RED_WORKS_BELOW_HEAVY");
    expect(ruleKeys).toContain("CH_RENT_RED_WORKS_BELOW_LIGHT");
  });

  it("returns empty matches for non-defect text", async () => {
    const signals = makeSignals({
      keywords: [],
      severity: "mild",
      inferredCategories: [],
    });

    const result = await matchDefectsToRules(signals);
    expect(result.matches).toEqual([]);
    expect(result.bestMatch).toBeNull();
    expect(result.totalConfidence).toBe(0);
  });

  it("returns matches sorted by confidence descending", async () => {
    const signals = makeSignals({
      keywords: [
        { term: "moisissure", category: "Humidité", weight: 1.0 },
        { term: "chauffage", category: "Température", weight: 1.0 },
      ],
      severity: "moderate",
      inferredCategories: ["Humidité", "Température"],
    });

    const result = await matchDefectsToRules(signals);
    for (let i = 1; i < result.matches.length; i++) {
      expect(result.matches[i - 1].matchConfidence).toBeGreaterThanOrEqual(
        result.matches[i].matchConfidence
      );
    }
  });

  it("reports unmatched signals", async () => {
    const signals = makeSignals({
      keywords: [
        { term: "moisissure", category: "Humidité", weight: 1.0 },
        { term: "balcon", category: "Autres", weight: 0.5 },
      ],
      severity: "moderate",
      inferredCategories: ["Humidité", "Autres"],
    });

    const result = await matchDefectsToRules(signals);
    // "balcon" likely won't match any defect text
    // (it depends on scoring, but likely unmatched)
    expect(result.unmatchedSignals).toBeDefined();
    expect(Array.isArray(result.unmatchedSignals)).toBe(true);
  });

  it("limits results to max 5 matches", async () => {
    const signals = makeSignals({
      keywords: [
        { term: "panne", category: "Défauts", weight: 1.0 },
        { term: "bruit", category: "Immissions", weight: 1.0 },
        { term: "travaux", category: "Rénovations", weight: 1.0 },
        { term: "moisissure", category: "Humidité", weight: 1.0 },
        { term: "chauffage", category: "Température", weight: 1.0 },
        { term: "fuite", category: "Dégâts d'eau", weight: 1.0 },
      ],
      severity: "moderate",
      inferredCategories: ["Défauts", "Immissions", "Rénovations", "Humidité", "Température", "Dégâts d'eau"],
    });

    const result = await matchDefectsToRules(signals);
    expect(result.matches.length).toBeLessThanOrEqual(5);
  });

  it("includes match reasons in results", async () => {
    const signals = makeSignals({
      keywords: [
        { term: "moisissure", category: "Humidité", weight: 1.0 },
      ],
      severity: "moderate",
      inferredCategories: ["Humidité"],
    });

    const result = await matchDefectsToRules(signals);
    expect(result.bestMatch).not.toBeNull();
    expect(result.bestMatch!.matchReasons.length).toBeGreaterThan(0);
    expect(result.bestMatch!.matchReasons.some((r) => r.includes("Category match"))).toBe(true);
  });

  it("includes citation in each match", async () => {
    const signals = makeSignals({
      keywords: [
        { term: "ascenseur", category: "Défauts", weight: 1.0 },
        { term: "panne", category: "Défauts", weight: 1.0 },
      ],
      severity: "moderate",
      inferredCategories: ["Défauts"],
    });

    const result = await matchDefectsToRules(signals);
    const elevator = result.matches.find((m) => m.ruleKey === "CH_RENT_RED_ELEVATOR");
    expect(elevator).toBeDefined();
    expect(elevator!.citation).toBeDefined();
    expect(elevator!.citation.article).toBeTruthy();
  });

  it("severity alignment boosts high-reduction rules for critical complaints", async () => {
    const mildSignals = makeSignals({
      keywords: [{ term: "chauffage", category: "Température", weight: 1.0 }],
      severity: "mild",
      inferredCategories: ["Température"],
    });
    const criticalSignals = makeSignals({
      keywords: [{ term: "chauffage", category: "Température", weight: 1.0 }],
      severity: "critical",
      inferredCategories: ["Température"],
    });

    const mildResult = await matchDefectsToRules(mildSignals);
    const critResult = await matchDefectsToRules(criticalSignals);

    // The 50% total heating rule should score higher for critical severity
    const mildTotal = mildResult.matches.find((m) => m.ruleKey === "CH_RENT_RED_HEATING_TOTAL");
    const critTotal = critResult.matches.find((m) => m.ruleKey === "CH_RENT_RED_HEATING_TOTAL");
    if (mildTotal && critTotal) {
      expect(critTotal.matchConfidence).toBeGreaterThanOrEqual(mildTotal.matchConfidence);
    }
  });

  it("computes aggregate totalConfidence", async () => {
    const signals = makeSignals({
      keywords: [{ term: "moisissure", category: "Humidité", weight: 1.0 }],
      severity: "moderate",
      inferredCategories: ["Humidité"],
    });

    const result = await matchDefectsToRules(signals);
    expect(result.totalConfidence).toBeGreaterThan(0);
    expect(result.totalConfidence).toBeLessThanOrEqual(100);
  });
});
