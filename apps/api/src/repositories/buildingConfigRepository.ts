/**
 * Building Config Repository
 *
 * Centralizes all Prisma access for BuildingConfig, OrgConfig, and Org
 * models used by the buildingConfig service.
 * G3/G9: canonical access patterns.
 */

import { PrismaClient, Prisma } from "@prisma/client";

// ─── Query Functions ───────────────────────────────────────────

/**
 * Find building config for a given org and building.
 */
export async function findBuildingConfig(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  return prisma.buildingConfig.findFirst({ where: { orgId, buildingId } });
}

/**
 * Find a building scoped to an org (for existence validation).
 */
export async function findBuildingForConfig(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  return prisma.building.findFirst({ where: { id: buildingId, orgId } });
}

/**
 * Upsert building config — create or update by buildingId unique key.
 */
export async function upsertBuildingConfigRecord(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  create: Prisma.BuildingConfigUncheckedCreateInput,
  update: Prisma.BuildingConfigUncheckedUpdateInput,
) {
  return prisma.buildingConfig.upsert({
    where: { buildingId },
    create,
    update,
  });
}

/**
 * Load org config and (optionally) building config in parallel.
 * Used by computeEffectiveConfig.
 */
export async function findEffectiveConfigData(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string,
) {
  const [orgConfig, buildingOverride, org] = await Promise.all([
    prisma.orgConfig.findUnique({ where: { orgId } }),
    buildingId
      ? prisma.buildingConfig.findFirst({ where: { orgId, buildingId } })
      : Promise.resolve(null),
    prisma.org.findUnique({ where: { id: orgId }, select: { mode: true } }),
  ]);
  return { orgConfig, buildingOverride, org };
}
