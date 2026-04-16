/**
 * recommendationWorkflow.ts
 *
 * Orchestrates the decision-scoring pipeline:
 *   1. evaluateRecommendation — score all options, rank, build explanation, persist
 *   2. recordUserDecision — update recommendation with user's choice
 *
 * Pure scoring logic lives in decisionScoringService / explanationService.
 */

import { PrismaClient } from "@prisma/client";
import { emit } from "../events/bus";
import {
  extractDecisionFeatures,
  scoreDecisionOption,
  applyHardConstraints,
  type DecisionOptionInput,
  type MaintenanceOpportunityInput,
} from "../services/decisionScoringService";
import { buildRecommendationExplanation } from "../services/explanationService";
import { deriveEffectiveWeights } from "../services/strategy/weights";
import type { StrategyArchetype } from "../services/strategy/archetypes";
import {
  getDecisionOptionsByOpportunity,
  type DecisionOptionRow,
} from "../repositories/decisionOptionRepository";
import {
  createRecommendation,
  updateRecommendationDecision,
  getRecommendationById,
  type RecommendationRow,
} from "../repositories/recommendationRepository";

// ── Types ──────────────────────────────────────────────────────

export interface RecommendationWorkflowContext {
  orgId: string;
  prisma: PrismaClient;
  actorUserId?: string;
}

export interface EvaluateRecommendationInput {
  opportunityId: string;
  buildingProfileId: string;
  primaryArchetype: StrategyArchetype;
  secondaryArchetype?: StrategyArchetype | null;
  secondaryMix?: number;
  opportunity: MaintenanceOpportunityInput;
  planningHorizonYears?: number;
  capexBudgetConstraint?: number;
  plannedSaleWithin12Months?: boolean;
}

export interface EvaluateRecommendationResult {
  recommendation: RecommendationRow;
}

export interface RecordDecisionInput {
  recommendationId: string;
  userDecision: "accepted" | "rejected" | "deferred";
  userFeedback?: string;
}

export interface RecordDecisionResult {
  recommendation: RecommendationRow;
}

// ── Evaluate recommendation ────────────────────────────────────

export async function evaluateRecommendationWorkflow(
  ctx: RecommendationWorkflowContext,
  input: EvaluateRecommendationInput,
): Promise<EvaluateRecommendationResult> {
  const { prisma, orgId } = ctx;

  // 1. Fetch decision options for this opportunity
  const optionRows = await getDecisionOptionsByOpportunity(
    prisma,
    input.opportunityId,
    orgId,
  );
  if (optionRows.length === 0) {
    throw new Error(`No decision options found for opportunity ${input.opportunityId}`);
  }

  // 2. Derive effective weights from archetype(s)
  const weights = deriveEffectiveWeights(
    input.primaryArchetype,
    (input.secondaryArchetype as StrategyArchetype) ?? undefined,
    input.secondaryMix,
  );

  // 3. Compute max cost for normalization
  const maxCost = Math.max(...optionRows.map((o) => o.estimatedCost), 1);
  const horizon = input.planningHorizonYears ?? 10;

  // 4. Score each option
  const scored = optionRows.map((row) => {
    const option = rowToInput(row);
    const projection = row.financialProjectionJson
      ? JSON.parse(row.financialProjectionJson)
      : null;

    const features = extractDecisionFeatures(option, projection, {
      maxCostInSet: maxCost,
      planningHorizonYears: horizon,
    });

    const rawScore = scoreDecisionOption(features, weights);

    // Apply hard constraints
    const constraints = applyHardConstraints(option, input.opportunity, {
      plannedSaleWithin12Months: input.plannedSaleWithin12Months,
      capexBudgetConstraint: input.capexBudgetConstraint,
    });

    const penaltyPoints = constraints.penalties.reduce((s, p) => s + p.points, 0);
    const finalScore = constraints.eligible
      ? Math.max(0, rawScore - penaltyPoints)
      : 0;

    return { option, features, finalScore, eligible: constraints.eligible, constraints };
  });

  // 5. Rank by final score descending, ineligible last
  scored.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.finalScore - a.finalScore;
  });

  // 6. Build explanation
  const explanation = buildRecommendationExplanation(
    scored.map((s) => ({ option: s.option, features: s.features, finalScore: s.finalScore })),
  );

  // 7. Persist
  const selectedOptionId = scored[0].option.id;
  const rankedOptionsJson = JSON.stringify(
    scored.map((s) => ({
      optionId: s.option.id,
      optionType: s.option.optionType,
      finalScore: Math.round(s.finalScore * 10) / 10,
      eligible: s.eligible,
      penalties: s.constraints.penalties,
    })),
  );

  const recommendation = await createRecommendation(prisma, {
    orgId,
    opportunityId: input.opportunityId,
    buildingProfileId: input.buildingProfileId,
    evaluatedAt: new Date(),
    selectedOptionId,
    rankedOptionsJson,
    explanationJson: JSON.stringify(explanation),
  });

  // 8. Emit event
  emit({
    type: "RECOMMENDATION_EVALUATED",
    payload: {
      recommendationId: recommendation.id,
      opportunityId: input.opportunityId,
      selectedOptionId,
      orgId,
    },
    orgId,
    actorUserId: ctx.actorUserId,
  });

  return { recommendation };
}

// ── Record user decision ───────────────────────────────────────

export async function recordUserDecisionWorkflow(
  ctx: RecommendationWorkflowContext,
  input: RecordDecisionInput,
): Promise<RecordDecisionResult> {
  const { prisma, orgId } = ctx;

  const existing = await getRecommendationById(prisma, input.recommendationId, orgId);
  if (!existing) {
    throw new Error(`Recommendation ${input.recommendationId} not found`);
  }

  const recommendation = await updateRecommendationDecision(
    prisma,
    input.recommendationId,
    orgId,
    {
      userDecision: input.userDecision,
      userDecidedAt: new Date(),
      userFeedback: input.userFeedback ?? null,
    },
  );

  emit({
    type: "RECOMMENDATION_DECISION_RECORDED",
    payload: {
      recommendationId: recommendation.id,
      userDecision: input.userDecision,
      orgId,
    },
    orgId,
    actorUserId: ctx.actorUserId,
  });

  return { recommendation };
}

// ── Helpers ────────────────────────────────────────────────────

function rowToInput(row: DecisionOptionRow): DecisionOptionInput {
  return {
    id: row.id,
    optionType: row.optionType,
    estimatedCost: row.estimatedCost,
    estimatedUsefulLifeYears: row.estimatedUsefulLifeYears,
    implementationMonths: row.implementationMonths,
    tenantDisruptionScore: row.tenantDisruptionScore,
    riskReductionScore: row.riskReductionScore,
    complianceCoverageScore: row.complianceCoverageScore,
    saleAttractivenessScore: row.saleAttractivenessScore,
    rentUpliftScore: row.rentUpliftScore,
    opexReductionScore: row.opexReductionScore,
    lifecycleExtensionScore: row.lifecycleExtensionScore,
    modernizationImpactScore: row.modernizationImpactScore,
    totalValueCreationScore: row.totalValueCreationScore,
    uncertaintyScore: row.uncertaintyScore,
    taxProfileJson: row.taxProfileJson,
    financialProjectionJson: row.financialProjectionJson,
  };
}
