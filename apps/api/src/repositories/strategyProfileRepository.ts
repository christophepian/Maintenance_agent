/**
 * strategyProfileRepository
 *
 * Canonical Prisma access for OwnerStrategyProfile, BuildingStrategyProfile,
 * and StrategyQuestionnaireAnswer.
 *
 * All queries are org-scoped. Routes and workflows must not call Prisma directly.
 */

import { PrismaClient, Prisma } from "@prisma/client";

// ─── Canonical includes (G9) ───────────────────────────────────

export const OWNER_PROFILE_INCLUDE = {
  questionnaireAnswers: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

export const BUILDING_PROFILE_INCLUDE = {
  ownerProfile: true,
  building: {
    select: { id: true, name: true, yearBuilt: true, address: true, canton: true },
  },
} as const;

export type OwnerProfileWithRelations = Prisma.OwnerStrategyProfileGetPayload<{
  include: typeof OWNER_PROFILE_INCLUDE;
}>;

export type BuildingProfileWithRelations = Prisma.BuildingStrategyProfileGetPayload<{
  include: typeof BUILDING_PROFILE_INCLUDE;
}>;

// ─── Owner profile queries ─────────────────────────────────────

export async function getOwnerProfileByOwnerId(
  prisma: PrismaClient,
  ownerId: string,
  orgId: string,
): Promise<OwnerProfileWithRelations | null> {
  return prisma.ownerStrategyProfile.findFirst({
    where: { ownerId, orgId },
    include: OWNER_PROFILE_INCLUDE,
  });
}

export async function createOwnerProfile(
  prisma: PrismaClient,
  data: {
    orgId: string;
    ownerId: string;
    userFacingGoalLabel: string;
    dimensionsJson: string;
    archetypeScoresJson: string;
    primaryArchetype: any;
    secondaryArchetype?: any;
    confidence: string;
    contradictionScore: number;
    source?: any;
  },
): Promise<OwnerProfileWithRelations> {
  return prisma.ownerStrategyProfile.create({
    data: {
      orgId: data.orgId,
      ownerId: data.ownerId,
      userFacingGoalLabel: data.userFacingGoalLabel,
      dimensionsJson: data.dimensionsJson,
      archetypeScoresJson: data.archetypeScoresJson,
      primaryArchetype: data.primaryArchetype,
      secondaryArchetype: data.secondaryArchetype ?? null,
      confidence: data.confidence,
      contradictionScore: data.contradictionScore,
      source: data.source ?? "questionnaire",
    },
    include: OWNER_PROFILE_INCLUDE,
  });
}

export async function upsertOwnerProfile(
  prisma: PrismaClient,
  ownerId: string,
  orgId: string,
  data: {
    userFacingGoalLabel: string;
    dimensionsJson: string;
    archetypeScoresJson: string;
    primaryArchetype: any;
    secondaryArchetype?: any;
    confidence: string;
    contradictionScore: number;
  },
): Promise<OwnerProfileWithRelations> {
  return prisma.ownerStrategyProfile.upsert({
    where: { ownerId },
    create: {
      orgId,
      ownerId,
      ...data,
      secondaryArchetype: data.secondaryArchetype ?? null,
    },
    update: {
      ...data,
      secondaryArchetype: data.secondaryArchetype ?? null,
    },
    include: OWNER_PROFILE_INCLUDE,
  });
}

// ─── Building profile queries ──────────────────────────────────

export async function getBuildingProfileByBuildingId(
  prisma: PrismaClient,
  buildingId: string,
  orgId: string,
): Promise<BuildingProfileWithRelations | null> {
  return prisma.buildingStrategyProfile.findFirst({
    where: { buildingId, orgId },
    include: BUILDING_PROFILE_INCLUDE,
  });
}

export async function createBuildingProfile(
  prisma: PrismaClient,
  data: {
    orgId: string;
    buildingId: string;
    ownerProfileId: string;
    roleIntent?: any;
    buildingType?: string;
    approxUnits?: number;
    conditionRating?: any;
    buildingDimensionsJson?: string;
    effectiveDimensionsJson: string;
    archetypeScoresJson: string;
    primaryArchetype: any;
    secondaryArchetype?: any;
    confidence: string;
  },
): Promise<BuildingProfileWithRelations> {
  return prisma.buildingStrategyProfile.create({
    data: {
      orgId: data.orgId,
      buildingId: data.buildingId,
      ownerProfileId: data.ownerProfileId,
      roleIntent: data.roleIntent ?? "unspecified",
      buildingType: data.buildingType ?? null,
      approxUnits: data.approxUnits ?? null,
      conditionRating: data.conditionRating ?? null,
      buildingDimensionsJson: data.buildingDimensionsJson ?? null,
      effectiveDimensionsJson: data.effectiveDimensionsJson,
      archetypeScoresJson: data.archetypeScoresJson,
      primaryArchetype: data.primaryArchetype,
      secondaryArchetype: data.secondaryArchetype ?? null,
      confidence: data.confidence,
    },
    include: BUILDING_PROFILE_INCLUDE,
  });
}

export async function upsertBuildingProfile(
  prisma: PrismaClient,
  buildingId: string,
  orgId: string,
  data: {
    ownerProfileId: string;
    roleIntent?: any;
    buildingType?: string;
    approxUnits?: number;
    conditionRating?: any;
    buildingDimensionsJson?: string;
    effectiveDimensionsJson: string;
    archetypeScoresJson: string;
    primaryArchetype: any;
    secondaryArchetype?: any;
    confidence: string;
  },
): Promise<BuildingProfileWithRelations> {
  return prisma.buildingStrategyProfile.upsert({
    where: { buildingId },
    create: {
      orgId,
      buildingId,
      ...data,
      roleIntent: data.roleIntent ?? "unspecified",
      secondaryArchetype: data.secondaryArchetype ?? null,
    },
    update: {
      ...data,
      roleIntent: data.roleIntent ?? "unspecified",
      secondaryArchetype: data.secondaryArchetype ?? null,
    },
    include: BUILDING_PROFILE_INCLUDE,
  });
}

// ─── Questionnaire answers ─────────────────────────────────────

export async function createQuestionnaireAnswer(
  prisma: PrismaClient,
  data: {
    orgId: string;
    ownerProfileId: string;
    answersJson: string;
  },
) {
  return prisma.strategyQuestionnaireAnswer.create({
    data: {
      orgId: data.orgId,
      ownerProfileId: data.ownerProfileId,
      answersJson: data.answersJson,
    },
  });
}
