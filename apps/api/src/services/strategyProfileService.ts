/**
 * strategyProfileService
 *
 * Domain logic for processing questionnaire answers into strategy profiles.
 * No direct Prisma calls — delegates to strategyProfileRepository.
 */

import { PrismaClient } from "@prisma/client";
import {
  deriveStrategyDimensions,
  deriveArchetypeScores,
  selectArchetypes,
  deriveContradictionScore,
  roleIntentToDimensions,
  combineDimensions,
  StrategyQuestionnaireAnswers,
  RoleIntent,
} from "./strategy/scoring";
import { ARCHETYPE_LABELS, StrategyArchetype, StrategyDimensions, ArchetypeScores } from "./strategy/archetypes";
import {
  createOwnerProfile,
  upsertOwnerProfile,
  createQuestionnaireAnswer,
  createBuildingProfile,
  upsertBuildingProfile,
  OwnerProfileWithRelations,
  BuildingProfileWithRelations,
} from "../repositories/strategyProfileRepository";

// ── DTO mapping helpers ────────────────────────────────────────

export interface OwnerProfileDTO {
  id: string;
  ownerId: string;
  primaryArchetype: string;
  secondaryArchetype?: string;
  confidence: string;
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
  primaryArchetype: string;
  secondaryArchetype?: string;
  confidence: string;
  roleIntent: string;
  buildingType?: string | null;
  approxUnits?: number | null;
  conditionRating?: string | null;
  effectiveDimensions: StrategyDimensions;
  archetypeScores: ArchetypeScores;
  building?: { id: string; name: string; yearBuilt: number | null };
  createdAt: string;
  updatedAt: string;
}

function mapOwnerProfileToDTO(p: OwnerProfileWithRelations): OwnerProfileDTO {
  return {
    id: p.id,
    ownerId: p.ownerId,
    primaryArchetype: p.primaryArchetype,
    secondaryArchetype: p.secondaryArchetype ?? undefined,
    confidence: p.confidence,
    userFacingGoalLabel: p.userFacingGoalLabel,
    dimensions: JSON.parse(p.dimensionsJson),
    archetypeScores: JSON.parse(p.archetypeScoresJson),
    contradictionScore: p.contradictionScore,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function mapBuildingProfileToDTO(p: BuildingProfileWithRelations): BuildingProfileDTO {
  return {
    id: p.id,
    buildingId: p.buildingId,
    ownerProfileId: p.ownerProfileId,
    primaryArchetype: p.primaryArchetype,
    secondaryArchetype: p.secondaryArchetype ?? undefined,
    confidence: p.confidence,
    roleIntent: p.roleIntent,
    buildingType: p.buildingType,
    approxUnits: p.approxUnits,
    conditionRating: p.conditionRating,
    effectiveDimensions: JSON.parse(p.effectiveDimensionsJson),
    archetypeScores: JSON.parse(p.archetypeScoresJson),
    building: p.building ? { id: p.building.id, name: p.building.name, yearBuilt: p.building.yearBuilt } : undefined,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// ── Service functions ──────────────────────────────────────────

export async function processQuestionnaire(
  prisma: PrismaClient,
  answers: StrategyQuestionnaireAnswers,
  ownerId: string,
  orgId: string,
): Promise<OwnerProfileDTO> {
  const dimensions = deriveStrategyDimensions(answers);
  const scores = deriveArchetypeScores(dimensions);
  const { primary, secondary, confidence } = selectArchetypes(scores);
  const contradictionScore = deriveContradictionScore(dimensions);
  const userFacingGoalLabel = ARCHETYPE_LABELS[primary];

  const profile = await upsertOwnerProfile(prisma, ownerId, orgId, {
    userFacingGoalLabel,
    dimensionsJson: JSON.stringify(dimensions),
    archetypeScoresJson: JSON.stringify(scores),
    primaryArchetype: primary,
    secondaryArchetype: secondary,
    confidence,
    contradictionScore,
  });

  // Persist raw answers
  await createQuestionnaireAnswer(prisma, {
    orgId,
    ownerProfileId: profile.id,
    answersJson: JSON.stringify(answers),
  });

  return mapOwnerProfileToDTO(profile);
}

export async function processBuildingSetup(
  prisma: PrismaClient,
  buildingId: string,
  ownerProfileId: string,
  orgId: string,
  ownerDimensions: StrategyDimensions,
  roleIntent: RoleIntent,
  buildingType?: string,
  approxUnits?: number,
  conditionRating?: string,
): Promise<BuildingProfileDTO> {
  const buildingDims = roleIntentToDimensions(roleIntent);
  const effectiveDimensions = combineDimensions(ownerDimensions, buildingDims);
  const scores = deriveArchetypeScores(effectiveDimensions);
  const { primary, secondary, confidence } = selectArchetypes(scores);

  const profile = await upsertBuildingProfile(prisma, buildingId, orgId, {
    ownerProfileId,
    roleIntent: roleIntent as any,
    buildingType,
    approxUnits,
    conditionRating: conditionRating as any,
    buildingDimensionsJson: JSON.stringify(buildingDims),
    effectiveDimensionsJson: JSON.stringify(effectiveDimensions),
    archetypeScoresJson: JSON.stringify(scores),
    primaryArchetype: primary,
    secondaryArchetype: secondary,
    confidence,
  });

  return mapBuildingProfileToDTO(profile);
}
