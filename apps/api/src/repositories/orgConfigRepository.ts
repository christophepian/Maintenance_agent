/**
 * Org Config Repository
 *
 * Centralizes all Prisma access for Org and OrgConfig models
 * needed by the orgConfig service.
 * G3/G9: canonical access patterns.
 */

import { PrismaClient, OrgMode, Prisma } from "@prisma/client";

// ─── Query Functions ───────────────────────────────────────────

/**
 * Find org by id.
 */
export async function findOrgById(prisma: PrismaClient, id: string) {
  return prisma.org.findUnique({ where: { id } });
}

/**
 * Create a new org record.
 */
export async function createOrgRecord(
  prisma: PrismaClient,
  data: Prisma.OrgUncheckedCreateInput,
) {
  return prisma.org.create({ data });
}

/**
 * Find org config by orgId.
 */
export async function findOrgConfig(prisma: PrismaClient, orgId: string) {
  return prisma.orgConfig.findUnique({ where: { orgId } });
}

/**
 * Create a new org config record.
 */
export async function createOrgConfigRecord(
  prisma: PrismaClient,
  data: Prisma.OrgConfigUncheckedCreateInput,
) {
  return prisma.orgConfig.create({ data });
}

/**
 * Get org config + org mode in a single parallel call.
 */
export async function findOrgConfigWithMode(
  prisma: PrismaClient,
  orgId: string,
) {
  const [config, org] = await Promise.all([
    prisma.orgConfig.findUnique({ where: { orgId } }),
    prisma.org.findUnique({ where: { id: orgId }, select: { mode: true } }),
  ]);
  return { config, org };
}

/**
 * Update org config fields.
 */
export async function updateOrgConfigRecord(
  prisma: PrismaClient,
  orgId: string,
  data: Prisma.OrgConfigUncheckedUpdateInput,
) {
  return prisma.orgConfig.update({ where: { orgId }, data });
}

/**
 * Update org mode.
 */
export async function updateOrgMode(
  prisma: PrismaClient,
  orgId: string,
  mode: OrgMode,
) {
  return prisma.org.update({ where: { id: orgId }, data: { mode } });
}

/**
 * Get org mode only.
 */
export async function findOrgMode(prisma: PrismaClient, orgId: string) {
  return prisma.org.findUnique({ where: { id: orgId }, select: { mode: true } });
}
