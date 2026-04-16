/**
 * Strategy scoring — pure functions for dimension derivation,
 * archetype scoring, contradiction detection, and dimension combination.
 *
 * Zero external imports (no Prisma, no framework). Fully unit-testable.
 *
 * Implements STRATEGY_ENGINE_SCOPE.md §5–7 exactly.
 */

import type { StrategyDimensions, ArchetypeScores, StrategyArchetype } from './archetypes';

// ── Questionnaire answer shape ─────────────────────────────────

export interface StrategyQuestionnaireAnswers {
  mainGoal: 1 | 2 | 3 | 4 | 5;
  holdPeriod: 1 | 2 | 3 | 4;
  renovationAppetite: 1 | 2 | 3 | 4 | 5;
  cashSensitivity: 1 | 2 | 3 | 4 | 5;
  disruptionTolerance: 1 | 2 | 3 | 4 | 5;
  vacancyRentTradeoff?: 1 | 2 | 3 | 4 | 5;
  modernizationPosture?: 1 | 2 | 3 | 4 | 5;
  saleReadinessImportance?: 1 | 2 | 3 | 4 | 5;
  downturnReaction?: 1 | 2 | 3 | 4 | 5;
  maintenancePhilosophy?: 1 | 2 | 3 | 4 | 5;
}

// ── RoleIntent type (matches Prisma enum) ──────────────────────

export type RoleIntent = 'sell' | 'income' | 'long_term_quality' | 'reposition' | 'stable_hold' | 'unspecified';

// ── Normalization functions (§5) ───────────────────────────────

export function normalize1to5(value: number): number {
  return ((value - 1) / 4) * 100;
}

export function reverseScore(score: number): number {
  return 100 - score;
}

export function normalizeHoldPeriod(value: 1 | 2 | 3 | 4): number {
  switch (value) {
    case 1: return 0;
    case 2: return 25;
    case 3: return 70;
    case 4: return 100;
  }
}

export function weightedAverage(items: Array<{ value: number; weight: number }>): number {
  const valid = items.filter(x => Number.isFinite(x.value));
  const totalWeight = valid.reduce((sum, x) => sum + x.weight, 0);
  if (!totalWeight) return 0;
  return valid.reduce((sum, x) => sum + x.value * x.weight, 0) / totalWeight;
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Dimension derivation (§6.2) ────────────────────────────────

export function deriveStrategyDimensions(a: StrategyQuestionnaireAnswers): StrategyDimensions {
  const hold = normalizeHoldPeriod(a.holdPeriod);
  const renovation = normalize1to5(a.renovationAppetite);
  const cash = normalize1to5(a.cashSensitivity);
  const disruption = normalize1to5(a.disruptionTolerance);
  const goal = a.mainGoal;

  const goalIncome = goal === 2 ? 100 : goal === 4 ? 40 : goal === 3 ? 60 : goal === 5 ? 50 : 30;
  const goalAppreciation = goal === 3 ? 100 : goal === 5 ? 85 : goal === 1 ? 70 : goal === 4 ? 30 : 40;
  const goalSale = goal === 1 ? 100 : goal === 2 ? 20 : goal === 3 ? 25 : goal === 4 ? 15 : 20;
  const goalStability = goal === 4 ? 100 : goal === 2 ? 70 : goal === 3 ? 45 : goal === 1 ? 25 : 20;

  const modernization = a.modernizationPosture ? normalize1to5(a.modernizationPosture) : (goal === 3 ? 70 : goal === 5 ? 80 : 40);
  const saleReadiness = a.saleReadinessImportance ? normalize1to5(a.saleReadinessImportance) : goalSale;
  const vacancyTradeoff = a.vacancyRentTradeoff ? normalize1to5(a.vacancyRentTradeoff) : 50;
  const downturn = a.downturnReaction ? normalize1to5(a.downturnReaction) : 50;
  const maintenance = a.maintenancePhilosophy ? normalize1to5(a.maintenancePhilosophy) : renovation;

  return {
    horizon: hold,
    incomePriority: weightedAverage([
      { value: goalIncome, weight: 0.6 },
      { value: reverseScore(vacancyTradeoff), weight: 0.25 },
      { value: reverseScore(renovation), weight: 0.15 },
    ]),
    appreciationPriority: weightedAverage([
      { value: goalAppreciation, weight: 0.5 },
      { value: modernization, weight: 0.25 },
      { value: renovation, weight: 0.25 },
    ]),
    capexTolerance: weightedAverage([
      { value: renovation, weight: 0.55 },
      { value: modernization, weight: 0.15 },
      { value: reverseScore(cash), weight: 0.30 },
    ]),
    volatilityTolerance: weightedAverage([
      { value: disruption, weight: 0.4 },
      { value: vacancyTradeoff, weight: 0.3 },
      { value: downturn, weight: 0.3 },
    ]),
    liquiditySensitivity: weightedAverage([
      { value: cash, weight: 0.7 },
      { value: reverseScore(renovation), weight: 0.15 },
      { value: reverseScore(downturn), weight: 0.15 },
    ]),
    saleReadiness,
    stabilityPreference: weightedAverage([
      { value: goalStability, weight: 0.5 },
      { value: reverseScore(vacancyTradeoff), weight: 0.3 },
      { value: reverseScore(disruption), weight: 0.2 },
    ]),
    modernizationPreference: modernization,
    disruptionTolerance: disruption,
  };
}

// ── Archetype scoring (§6.3) ───────────────────────────────────

export function deriveArchetypeScores(d: StrategyDimensions): ArchetypeScores {
  return {
    exit_optimizer: clampScore(
      0.30 * reverseScore(d.horizon) +
      0.20 * d.saleReadiness +
      0.15 * d.appreciationPriority +
      0.10 * d.capexTolerance +
      0.15 * reverseScore(d.liquiditySensitivity) +
      0.10 * reverseScore(d.stabilityPreference)
    ),
    yield_maximizer: clampScore(
      0.30 * d.incomePriority +
      0.20 * d.stabilityPreference +
      0.20 * d.liquiditySensitivity +
      0.15 * reverseScore(d.capexTolerance) +
      0.15 * reverseScore(d.disruptionTolerance)
    ),
    value_builder: clampScore(
      0.30 * d.horizon +
      0.25 * d.appreciationPriority +
      0.20 * d.capexTolerance +
      0.15 * d.modernizationPreference +
      0.10 * reverseScore(d.liquiditySensitivity)
    ),
    capital_preserver: clampScore(
      0.25 * d.horizon +
      0.25 * d.liquiditySensitivity +
      0.20 * d.stabilityPreference +
      0.15 * reverseScore(d.volatilityTolerance) +
      0.15 * reverseScore(d.disruptionTolerance)
    ),
    opportunistic_repositioner: clampScore(
      0.25 * d.capexTolerance +
      0.20 * d.appreciationPriority +
      0.20 * d.volatilityTolerance +
      0.15 * d.modernizationPreference +
      0.10 * reverseScore(d.liquiditySensitivity) +
      0.10 * d.disruptionTolerance
    ),
  };
}

// ── Primary and secondary archetypes (§6.4) ────────────────────

export function selectArchetypes(scores: ArchetypeScores): {
  primary: StrategyArchetype;
  secondary?: StrategyArchetype;
  confidence: 'low' | 'medium' | 'high';
} {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]) as Array<[StrategyArchetype, number]>;
  const [primaryKey, primaryScore] = entries[0];
  const [secondaryKey, secondaryScore] = entries[1];
  const gap = primaryScore - secondaryScore;

  return {
    primary: primaryKey,
    secondary: gap <= 10 ? secondaryKey : undefined,
    confidence: gap >= 13 ? 'high' : gap >= 6 ? 'medium' : 'low',
  };
}

// ── Contradiction scoring (§6.5) ───────────────────────────────

export function deriveContradictionScore(d: StrategyDimensions): number {
  let points = 0;

  if (d.horizon < 25 && d.modernizationPreference > 75) points += 8;
  if (d.horizon < 25 && d.capexTolerance > 75) points += 6;
  if (d.liquiditySensitivity > 75 && d.capexTolerance > 75) points += 8;
  if (d.stabilityPreference > 75 && d.disruptionTolerance > 75) points += 7;
  if (d.saleReadiness > 75 && d.horizon > 75) points += 4;

  return points;
}

// ── Building-level combination (§7.1) ──────────────────────────

export function roleIntentToDimensions(
  roleIntent: RoleIntent,
): Partial<StrategyDimensions> {
  switch (roleIntent) {
    case 'sell':
      return { saleReadiness: 100, horizon: 0, stabilityPreference: 30 };
    case 'income':
      return { incomePriority: 100, stabilityPreference: 80, saleReadiness: 10 };
    case 'long_term_quality':
      return { horizon: 100, appreciationPriority: 80, capexTolerance: 70 };
    case 'reposition':
      return { modernizationPreference: 100, capexTolerance: 90, disruptionTolerance: 80 };
    case 'stable_hold':
      return { stabilityPreference: 100, liquiditySensitivity: 80, capexTolerance: 20 };
    case 'unspecified':
    default:
      return {};
  }
}

export function combineDimensions(
  owner: StrategyDimensions,
  building: Partial<StrategyDimensions>,
  ownerWeight = 0.65,
  buildingWeight = 0.35,
): StrategyDimensions {
  const keys = Object.keys(owner) as Array<keyof StrategyDimensions>;
  const result = {} as StrategyDimensions;
  for (const key of keys) {
    const buildingValue = building[key] ?? owner[key];
    result[key] = clampScore(owner[key] * ownerWeight + buildingValue * buildingWeight);
  }
  return result;
}
