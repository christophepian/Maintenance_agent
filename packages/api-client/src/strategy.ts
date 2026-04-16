/**
 * Strategy Engine — API client DTO types
 *
 * Matches response shapes in STRATEGY_ENGINE_SCOPE.md §14.1–14.2.
 */

// ── Enums / literals ───────────────────────────────────────────

export type StrategyArchetype =
  | 'exit_optimizer'
  | 'yield_maximizer'
  | 'value_builder'
  | 'capital_preserver'
  | 'opportunistic_repositioner';

export type StrategySource = 'questionnaire' | 'advisor_set' | 'imported' | 'default';

export type RoleIntent = 'sell' | 'income' | 'long_term_quality' | 'reposition' | 'stable_hold' | 'unspecified';

export type BuildingConditionRating = 'poor' | 'fair' | 'good' | 'very_good';

// ── Dimension and score interfaces ─────────────────────────────

export interface StrategyDimensions {
  horizon: number;
  incomePriority: number;
  appreciationPriority: number;
  capexTolerance: number;
  volatilityTolerance: number;
  liquiditySensitivity: number;
  saleReadiness: number;
  stabilityPreference: number;
  modernizationPreference: number;
  disruptionTolerance: number;
}

export interface ArchetypeScores {
  exit_optimizer: number;
  yield_maximizer: number;
  value_builder: number;
  capital_preserver: number;
  opportunistic_repositioner: number;
}

// ── DTOs ───────────────────────────────────────────────────────

export interface OwnerProfileDTO {
  id: string;
  ownerId: string;
  primaryArchetype: StrategyArchetype;
  secondaryArchetype?: StrategyArchetype;
  confidence: 'low' | 'medium' | 'high';
  userFacingGoalLabel: string;
  dimensions: StrategyDimensions;
  archetypeScores: ArchetypeScores;
  contradictionScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface BuildingProfileDTO {
  id: string;
  buildingId: string;
  ownerProfileId: string;
  primaryArchetype: StrategyArchetype;
  secondaryArchetype?: StrategyArchetype;
  confidence: 'low' | 'medium' | 'high';
  roleIntent: RoleIntent;
  buildingType?: string | null;
  approxUnits?: number | null;
  conditionRating?: BuildingConditionRating | null;
  effectiveDimensions: StrategyDimensions;
  archetypeScores: ArchetypeScores;
  building?: { id: string; name: string; yearBuilt: number | null };
  createdAt: string;
  updatedAt: string;
}

// ── Request bodies ─────────────────────────────────────────────

export interface StrategyQuestionnaireAnswersDTO {
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

export interface CreateOwnerProfileRequest {
  ownerId?: string;
  answers: StrategyQuestionnaireAnswersDTO;
}

export interface CreateBuildingProfileRequest {
  buildingId: string;
  ownerProfileId: string;
  roleIntent?: RoleIntent;
  buildingType?: string;
  approxUnits?: number;
  conditionRating?: BuildingConditionRating;
}
