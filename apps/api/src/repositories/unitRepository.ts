import { PrismaClient } from "@prisma/client";

/**
 * Check if a unit exists and belongs to the given org.
 */
export async function findUnitByIdAndOrg(
  prisma: PrismaClient,
  id: string,
  orgId: string
) {
  return prisma.unit.findFirst({ where: { id, orgId } });
}
