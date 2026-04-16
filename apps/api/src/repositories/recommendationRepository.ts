/**
 * recommendationRepository.ts
 *
 * Canonical Prisma access for RecommendationResult.
 */

import { PrismaClient, Prisma, UserDecisionStatus } from "@prisma/client";

export const RECOMMENDATION_INCLUDE = {
  selectedOption: true,
  buildingProfile: {
    select: { id: true, primaryArchetype: true, secondaryArchetype: true },
  },
} as const;

export type RecommendationRow = Prisma.RecommendationResultGetPayload<{
  include: typeof RECOMMENDATION_INCLUDE;
}>;

export async function createRecommendation(
  prisma: PrismaClient,
  data: Prisma.RecommendationResultUncheckedCreateInput,
): Promise<RecommendationRow> {
  return prisma.recommendationResult.create({
    data,
    include: RECOMMENDATION_INCLUDE,
  });
}

export async function getRecommendationsByOpportunity(
  prisma: PrismaClient,
  opportunityId: string,
  orgId: string,
): Promise<RecommendationRow[]> {
  return prisma.recommendationResult.findMany({
    where: { opportunityId, orgId },
    include: RECOMMENDATION_INCLUDE,
    orderBy: { evaluatedAt: "desc" },
  });
}

export async function getRecommendationById(
  prisma: PrismaClient,
  id: string,
  orgId: string,
): Promise<RecommendationRow | null> {
  return prisma.recommendationResult.findFirst({
    where: { id, orgId },
    include: RECOMMENDATION_INCLUDE,
  });
}

export async function updateRecommendationDecision(
  prisma: PrismaClient,
  id: string,
  orgId: string,
  data: {
    userDecision: any;
    userDecidedAt: Date;
    userFeedback?: string | null;
  },
): Promise<RecommendationRow> {
  return prisma.recommendationResult.update({
    where: { id },
    data,
    include: RECOMMENDATION_INCLUDE,
  });
}
