/**
 * Unit tests for pure strategy scoring functions.
 *
 * Tests scoring.ts and weights.ts — zero DB dependency.
 * Includes the 5 questionnaire scenario snapshot tests from §16.3.
 */

import {
  normalize1to5,
  reverseScore,
  normalizeHoldPeriod,
  weightedAverage,
  clampScore,
  deriveStrategyDimensions,
  deriveArchetypeScores,
  selectArchetypes,
  deriveContradictionScore,
  combineDimensions,
  roleIntentToDimensions,
  StrategyQuestionnaireAnswers,
} from '../services/strategy/scoring';

import { DECISION_WEIGHTS, deriveEffectiveWeights } from '../services/strategy/weights';
import { ARCHETYPE_LABELS, ARCHETYPE_EXPLANATION_COPY, STRATEGY_ARCHETYPES } from '../services/strategy/archetypes';

// ── Normalization functions ────────────────────────────────────

describe('normalize1to5', () => {
  it('maps 1→0, 3→50, 5→100', () => {
    expect(normalize1to5(1)).toBe(0);
    expect(normalize1to5(3)).toBe(50);
    expect(normalize1to5(5)).toBe(100);
  });
});

describe('reverseScore', () => {
  it('returns 100 - score', () => {
    expect(reverseScore(0)).toBe(100);
    expect(reverseScore(75)).toBe(25);
  });
});

describe('normalizeHoldPeriod', () => {
  it('maps 1→0, 2→25, 3→70, 4→100', () => {
    expect(normalizeHoldPeriod(1)).toBe(0);
    expect(normalizeHoldPeriod(2)).toBe(25);
    expect(normalizeHoldPeriod(3)).toBe(70);
    expect(normalizeHoldPeriod(4)).toBe(100);
  });
});

describe('weightedAverage', () => {
  it('computes weighted average', () => {
    expect(weightedAverage([
      { value: 100, weight: 0.6 },
      { value: 0, weight: 0.4 },
    ])).toBe(60);
  });

  it('ignores NaN values', () => {
    expect(weightedAverage([
      { value: 100, weight: 0.5 },
      { value: NaN, weight: 0.5 },
    ])).toBe(100);
  });

  it('returns 0 for empty array', () => {
    expect(weightedAverage([])).toBe(0);
  });
});

describe('clampScore', () => {
  it('clamps and rounds', () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(55.7)).toBe(56);
  });
});

// ── Dimension derivation ───────────────────────────────────────

describe('deriveStrategyDimensions', () => {
  it('returns all 10 dimensions', () => {
    const dims = deriveStrategyDimensions({
      mainGoal: 3, holdPeriod: 4, renovationAppetite: 4, cashSensitivity: 2, disruptionTolerance: 3,
    });
    expect(Object.keys(dims)).toHaveLength(10);
    for (const v of Object.values(dims)) {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('handles optional fields gracefully', () => {
    const dims = deriveStrategyDimensions({
      mainGoal: 1, holdPeriod: 1, renovationAppetite: 1, cashSensitivity: 5, disruptionTolerance: 1,
    });
    expect(dims.horizon).toBe(0);
  });
});

// ── Archetype scoring ──────────────────────────────────────────

describe('deriveArchetypeScores', () => {
  it('returns all 5 archetype scores', () => {
    const dims = deriveStrategyDimensions({
      mainGoal: 3, holdPeriod: 4, renovationAppetite: 4, cashSensitivity: 2, disruptionTolerance: 3,
    });
    const scores = deriveArchetypeScores(dims);
    expect(Object.keys(scores)).toHaveLength(5);
    for (const v of Object.values(scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('selectArchetypes', () => {
  it('selects primary and detects close secondary', () => {
    const result = selectArchetypes({
      exit_optimizer: 50,
      yield_maximizer: 45,
      value_builder: 80,
      capital_preserver: 30,
      opportunistic_repositioner: 72,
    });
    expect(result.primary).toBe('value_builder');
    expect(result.secondary).toBe('opportunistic_repositioner');
    expect(result.confidence).toBe('medium');
  });

  it('no secondary when gap > 10', () => {
    const result = selectArchetypes({
      exit_optimizer: 50,
      yield_maximizer: 45,
      value_builder: 80,
      capital_preserver: 30,
      opportunistic_repositioner: 60,
    });
    expect(result.primary).toBe('value_builder');
    expect(result.secondary).toBeUndefined();
    expect(result.confidence).toBe('high');
  });
});

// ── Contradiction scoring ──────────────────────────────────────

describe('deriveContradictionScore', () => {
  it('detects short horizon + high modernization', () => {
    const score = deriveContradictionScore({
      horizon: 0, incomePriority: 50, appreciationPriority: 50, capexTolerance: 50,
      volatilityTolerance: 50, liquiditySensitivity: 50, saleReadiness: 50,
      stabilityPreference: 50, modernizationPreference: 80, disruptionTolerance: 50,
    });
    expect(score).toBeGreaterThanOrEqual(8);
  });

  it('detects short horizon + high capex tolerance', () => {
    const score = deriveContradictionScore({
      horizon: 20, incomePriority: 50, appreciationPriority: 50, capexTolerance: 80,
      volatilityTolerance: 50, liquiditySensitivity: 50, saleReadiness: 50,
      stabilityPreference: 50, modernizationPreference: 50, disruptionTolerance: 50,
    });
    expect(score).toBeGreaterThanOrEqual(6);
  });

  it('detects high liquidity sensitivity + high capex tolerance', () => {
    const score = deriveContradictionScore({
      horizon: 50, incomePriority: 50, appreciationPriority: 50, capexTolerance: 80,
      volatilityTolerance: 50, liquiditySensitivity: 80, saleReadiness: 50,
      stabilityPreference: 50, modernizationPreference: 50, disruptionTolerance: 50,
    });
    expect(score).toBeGreaterThanOrEqual(8);
  });

  it('detects high stability + high disruption tolerance', () => {
    const score = deriveContradictionScore({
      horizon: 50, incomePriority: 50, appreciationPriority: 50, capexTolerance: 50,
      volatilityTolerance: 50, liquiditySensitivity: 50, saleReadiness: 50,
      stabilityPreference: 80, modernizationPreference: 50, disruptionTolerance: 80,
    });
    expect(score).toBeGreaterThanOrEqual(7);
  });

  it('detects high sale readiness + long horizon', () => {
    const score = deriveContradictionScore({
      horizon: 80, incomePriority: 50, appreciationPriority: 50, capexTolerance: 50,
      volatilityTolerance: 50, liquiditySensitivity: 50, saleReadiness: 80,
      stabilityPreference: 50, modernizationPreference: 50, disruptionTolerance: 50,
    });
    expect(score).toBeGreaterThanOrEqual(4);
  });

  it('returns 0 for non-contradictory profile', () => {
    const score = deriveContradictionScore({
      horizon: 50, incomePriority: 50, appreciationPriority: 50, capexTolerance: 50,
      volatilityTolerance: 50, liquiditySensitivity: 50, saleReadiness: 50,
      stabilityPreference: 50, modernizationPreference: 50, disruptionTolerance: 50,
    });
    expect(score).toBe(0);
  });
});

// ── Building-level combination ─────────────────────────────────

describe('roleIntentToDimensions', () => {
  it('returns partial dims for sell intent', () => {
    const d = roleIntentToDimensions('sell');
    expect(d.saleReadiness).toBe(100);
    expect(d.horizon).toBe(0);
  });

  it('returns empty for unspecified', () => {
    expect(Object.keys(roleIntentToDimensions('unspecified'))).toHaveLength(0);
  });
});

describe('combineDimensions', () => {
  it('blends owner and building dims', () => {
    const owner = deriveStrategyDimensions({
      mainGoal: 3, holdPeriod: 4, renovationAppetite: 4, cashSensitivity: 2, disruptionTolerance: 3,
    });
    const building = roleIntentToDimensions('sell');
    const combined = combineDimensions(owner, building);
    // saleReadiness should be pulled toward 100
    expect(combined.saleReadiness).toBeGreaterThan(owner.saleReadiness);
    // horizon should be pulled toward 0
    expect(combined.horizon).toBeLessThan(owner.horizon);
  });
});

// ── Weights ────────────────────────────────────────────────────

describe('DECISION_WEIGHTS', () => {
  it('defines weights for all 5 archetypes', () => {
    for (const arch of STRATEGY_ARCHETYPES) {
      expect(DECISION_WEIGHTS[arch]).toBeDefined();
      expect(typeof DECISION_WEIGHTS[arch].complianceNeed).toBe('number');
    }
  });
});

describe('deriveEffectiveWeights', () => {
  it('returns primary weights when no secondary', () => {
    const w = deriveEffectiveWeights('value_builder');
    expect(w).toEqual(DECISION_WEIGHTS.value_builder);
  });

  it('blends primary and secondary', () => {
    const w = deriveEffectiveWeights('value_builder', 'exit_optimizer', 0.25);
    expect(w.complianceNeed).toBe(
      DECISION_WEIGHTS.value_builder.complianceNeed * 0.75 +
      DECISION_WEIGHTS.exit_optimizer.complianceNeed * 0.25
    );
  });
});

// ── Archetypes constants ───────────────────────────────────────

describe('ARCHETYPE_LABELS', () => {
  it('has a label for every archetype', () => {
    for (const arch of STRATEGY_ARCHETYPES) {
      expect(typeof ARCHETYPE_LABELS[arch]).toBe('string');
      expect(ARCHETYPE_LABELS[arch].length).toBeGreaterThan(0);
    }
  });
});

describe('ARCHETYPE_EXPLANATION_COPY', () => {
  it('has explanation, 3 bullets, and deprioritize for every archetype', () => {
    for (const arch of STRATEGY_ARCHETYPES) {
      const copy = ARCHETYPE_EXPLANATION_COPY[arch];
      expect(typeof copy.explanation).toBe('string');
      expect(copy.bullets).toHaveLength(3);
      expect(typeof copy.deprioritize).toBe('string');
    }
  });
});

// ── Scenario snapshot tests (§16.3) ────────────────────────────

describe('Scenario snapshots', () => {
  it('Scenario 1: sell in 3 years — exit_optimizer', () => {
    const answers: StrategyQuestionnaireAnswers = {
      mainGoal: 1,       // Prepare for sale
      holdPeriod: 2,     // 3–5 years
      renovationAppetite: 2, // Only when necessary
      cashSensitivity: 4,   // Very important to avoid surprises
      disruptionTolerance: 2, // Low
    };
    const dims = deriveStrategyDimensions(answers);
    const scores = deriveArchetypeScores(dims);
    const result = selectArchetypes(scores);
    expect(result.primary).toBe('exit_optimizer');
  });

  it('Scenario 2: income-focused — yield_maximizer', () => {
    const answers: StrategyQuestionnaireAnswers = {
      mainGoal: 2,       // Maximize income
      holdPeriod: 3,     // 5–10 years
      renovationAppetite: 2, // Only when necessary
      cashSensitivity: 4,   // Very important
      disruptionTolerance: 2, // Low
    };
    const dims = deriveStrategyDimensions(answers);
    const scores = deriveArchetypeScores(dims);
    const result = selectArchetypes(scores);
    expect(result.primary).toBe('yield_maximizer');
  });

  it('Scenario 3: long-term value — value_builder', () => {
    const answers: StrategyQuestionnaireAnswers = {
      mainGoal: 3,       // Improve long-term value
      holdPeriod: 4,     // More than 10 years
      renovationAppetite: 4, // Comfortable with selective projects
      cashSensitivity: 2,   // Slightly important
      disruptionTolerance: 3, // Moderate
    };
    const dims = deriveStrategyDimensions(answers);
    const scores = deriveArchetypeScores(dims);
    const result = selectArchetypes(scores);
    expect(result.primary).toBe('value_builder');
  });

  it('Scenario 4: low-risk — capital_preserver', () => {
    const answers: StrategyQuestionnaireAnswers = {
      mainGoal: 4,       // Keep things stable
      holdPeriod: 3,     // 5–10 years
      renovationAppetite: 1, // Avoid whenever possible
      cashSensitivity: 5,   // Extremely important
      disruptionTolerance: 1, // Almost none
    };
    const dims = deriveStrategyDimensions(answers);
    const scores = deriveArchetypeScores(dims);
    const result = selectArchetypes(scores);
    expect(result.primary).toBe('capital_preserver');
  });

  it('Scenario 5: opportunistic — opportunistic_repositioner', () => {
    const answers: StrategyQuestionnaireAnswers = {
      mainGoal: 5,       // Upgrade and reposition
      holdPeriod: 3,     // 5–10 years (not maximum horizon — distinguishes from value_builder)
      renovationAppetite: 5, // Comfortable with major repositioning
      cashSensitivity: 1,   // Not a major concern
      disruptionTolerance: 5, // High
      modernizationPosture: 5, // High modernization
      vacancyRentTradeoff: 5,  // Will tolerate vacancy for rent uplift
    };
    const dims = deriveStrategyDimensions(answers);
    const scores = deriveArchetypeScores(dims);
    const result = selectArchetypes(scores);
    expect(result.primary).toBe('opportunistic_repositioner');
  });
});
