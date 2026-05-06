/**
 * Rent Estimation Repository
 *
 * Centralizes all Prisma access for the RentEstimationConfig model.
 * G3/G9: canonical include constants live here.
 */

import { PrismaClient, Prisma } from "@prisma/client";

// ─── Query Functions ───────────────────────────────────────────

/**
 * Find a rent estimation config by org + canton composite key.
 */
export async function findRentEstimationConfigByCanton(
  prisma: PrismaClient,
  orgId: string,
  canton: string,
) {
  return prisma.rentEstimationConfig.findUnique({
    where: { orgId_canton: { orgId, canton } },
  });
}

/**
 * Find the org-default config (canton = null).
 */
export async function findDefaultRentEstimationConfig(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.rentEstimationConfig.findFirst({
    where: { orgId, canton: null },
  });
}

/**
 * Create a new rent estimation config record.
 */
export async function createRentEstimationConfig(
  prisma: PrismaClient,
  data: Prisma.RentEstimationConfigUncheckedCreateInput,
) {
  return prisma.rentEstimationConfig.create({ data });
}

/**
 * Upsert a rent estimation config for a non-null canton.
 */
export async function upsertRentEstimationConfigByCanton(
  prisma: PrismaClient,
  orgId: string,
  canton: string,
  create: Prisma.RentEstimationConfigUncheckedCreateInput,
  update: Prisma.RentEstimationConfigUncheckedUpdateInput,
) {
  return prisma.rentEstimationConfig.upsert({
    where: { orgId_canton: { orgId, canton } },
    create,
    update,
  });
}

/**
 * Find existing config by org + null canton (for manual upsert).
 */
export async function findRentEstimationConfigByOrgNullCanton(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.rentEstimationConfig.findFirst({
    where: { orgId, canton: null },
  });
}

/**
 * Update a rent estimation config by id.
 */
export async function updateRentEstimationConfig(
  prisma: PrismaClient,
  id: string,
  data: Prisma.RentEstimationConfigUncheckedUpdateInput,
) {
  return prisma.rentEstimationConfig.update({ where: { id }, data });
}
