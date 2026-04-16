/**
 * decisionOptionRepository.ts
 *
 * Canonical Prisma access for MaintenanceDecisionOption.
 */

import { PrismaClient, Prisma } from "@prisma/client";

export const DECISION_OPTION_INCLUDE = {} as const;

export type DecisionOptionRow = Prisma.MaintenanceDecisionOptionGetPayload<{
  include: typeof DECISION_OPTION_INCLUDE;
}>;

export async function createDecisionOptions(
  prisma: PrismaClient,
  options: Array<Prisma.MaintenanceDecisionOptionCreateInput>,
): Promise<DecisionOptionRow[]> {
  const results: DecisionOptionRow[] = [];
  for (const data of options) {
    const row = await prisma.maintenanceDecisionOption.create({
      data,
      include: DECISION_OPTION_INCLUDE,
    });
    results.push(row);
  }
  return results;
}

export async function getDecisionOptionsByOpportunity(
  prisma: PrismaClient,
  opportunityId: string,
  orgId: string,
): Promise<DecisionOptionRow[]> {
  return prisma.maintenanceDecisionOption.findMany({
    where: { opportunityId, orgId },
    include: DECISION_OPTION_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
}

export async function getDecisionOptionById(
  prisma: PrismaClient,
  id: string,
  orgId: string,
): Promise<DecisionOptionRow | null> {
  return prisma.maintenanceDecisionOption.findFirst({
    where: { id, orgId },
    include: DECISION_OPTION_INCLUDE,
  });
}
