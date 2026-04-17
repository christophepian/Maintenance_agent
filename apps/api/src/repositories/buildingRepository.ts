import { PrismaClient } from "@prisma/client";

/**
 * Check if a building exists and belongs to the given org.
 */
export async function findBuildingByIdAndOrg(
  prisma: PrismaClient,
  id: string,
  orgId: string
) {
  return prisma.building.findFirst({ where: { id, orgId } });
}
