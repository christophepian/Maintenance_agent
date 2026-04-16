/**
 * strategyProfileWorkflow
 *
 * Orchestrates strategy profile creation and updates.
 * Delegates to strategyProfileService for domain logic.
 * Emits domain events on profile creation/update.
 *
 * Workflows:
 *   1. createOwnerProfileWorkflow — validate input → score → persist → emit event
 *   2. updateOwnerProfileWorkflow — re-run scoring → upsert → emit event
 *   3. createBuildingProfileWorkflow — validate ownership → score → persist
 */

import { PrismaClient } from "@prisma/client";
import { emit } from "../events/bus";
import { StrategyQuestionnaireAnswers, RoleIntent } from "../services/strategy/scoring";
import {
  processQuestionnaire,
  processBuildingSetup,
  OwnerProfileDTO,
  BuildingProfileDTO,
} from "../services/strategyProfileService";

// ── Types ──────────────────────────────────────────────────────

export interface WorkflowContext {
  orgId: string;
  prisma: PrismaClient;
  actorUserId?: string;
}

export interface CreateOwnerProfileInput {
  ownerId: string;
  answers: StrategyQuestionnaireAnswers;
}

export interface CreateOwnerProfileResult {
  profile: OwnerProfileDTO;
}

export interface CreateBuildingProfileInput {
  buildingId: string;
  ownerProfileId: string;
  roleIntent: RoleIntent;
  buildingType?: string;
  approxUnits?: number;
  conditionRating?: string;
}

export interface CreateBuildingProfileResult {
  profile: BuildingProfileDTO;
}

// ── Workflows ──────────────────────────────────────────────────

/**
 * createOwnerProfileWorkflow
 *
 * Steps:
 *   1. Validate answers (required fields present)
 *   2. Call processQuestionnaire (scoring + persist)
 *   3. Emit STRATEGY_PROFILE_CREATED event
 *   4. Return OwnerProfileDTO
 */
export async function createOwnerProfileWorkflow(
  ctx: WorkflowContext,
  input: CreateOwnerProfileInput,
): Promise<CreateOwnerProfileResult> {
  const { answers, ownerId } = input;

  // Validate required fields
  if (!answers.mainGoal || !answers.holdPeriod || !answers.renovationAppetite ||
      !answers.cashSensitivity || !answers.disruptionTolerance) {
    throw new Error("Missing required questionnaire answers");
  }

  const profile = await processQuestionnaire(
    ctx.prisma,
    answers,
    ownerId,
    ctx.orgId,
  );

  await emit({
    type: "STRATEGY_PROFILE_CREATED",
    orgId: ctx.orgId,
    actorUserId: ctx.actorUserId,
    payload: {
      profileId: profile.id,
      ownerId: profile.ownerId,
      primaryArchetype: profile.primaryArchetype,
    },
  });

  return { profile };
}

/**
 * updateOwnerProfileWorkflow
 *
 * Steps:
 *   1. Validate answers
 *   2. Re-run scoring via processQuestionnaire (upserts)
 *   3. Emit STRATEGY_PROFILE_UPDATED event
 *   4. Return updated OwnerProfileDTO
 */
export async function updateOwnerProfileWorkflow(
  ctx: WorkflowContext,
  input: CreateOwnerProfileInput,
): Promise<CreateOwnerProfileResult> {
  const profile = await processQuestionnaire(
    ctx.prisma,
    input.answers,
    input.ownerId,
    ctx.orgId,
  );

  await emit({
    type: "STRATEGY_PROFILE_UPDATED",
    orgId: ctx.orgId,
    actorUserId: ctx.actorUserId,
    payload: {
      profileId: profile.id,
      ownerId: profile.ownerId,
      primaryArchetype: profile.primaryArchetype,
    },
  });

  return { profile };
}

/**
 * createBuildingProfileWorkflow
 *
 * Steps:
 *   1. Verify owner profile exists
 *   2. Verify building ownership via BuildingOwner
 *   3. Call processBuildingSetup (scoring + persist)
 *   4. Return BuildingProfileDTO
 */
export async function createBuildingProfileWorkflow(
  ctx: WorkflowContext,
  input: CreateBuildingProfileInput,
): Promise<CreateBuildingProfileResult> {
  // Step 1: load owner profile
  const ownerProfile = await ctx.prisma.ownerStrategyProfile.findUnique({
    where: { id: input.ownerProfileId },
  });
  if (!ownerProfile) {
    throw new Error("Owner strategy profile not found");
  }

  // Step 2: verify building ownership
  const ownership = await ctx.prisma.buildingOwner.findFirst({
    where: {
      buildingId: input.buildingId,
      userId: ownerProfile.ownerId,
    },
  });
  if (!ownership) {
    throw new Error("Owner does not have access to this building");
  }

  const ownerDimensions = JSON.parse(ownerProfile.dimensionsJson);

  const profile = await processBuildingSetup(
    ctx.prisma,
    input.buildingId,
    input.ownerProfileId,
    ctx.orgId,
    ownerDimensions,
    input.roleIntent,
    input.buildingType,
    input.approxUnits,
    input.conditionRating,
  );

  return { profile };
}
