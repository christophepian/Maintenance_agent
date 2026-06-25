/**
 * Fixed Asset Repository (accounting bridge WS-D)
 *
 * Persistence for the capitalized-asset register. Keeps Prisma out of the
 * service layer (G20).
 */

import { PrismaClient } from "@prisma/client";

export async function findBySourceInvoice(
  prisma: PrismaClient,
  orgId: string,
  sourceInvoiceId: string,
) {
  return prisma.fixedAsset.findFirst({ where: { orgId, sourceInvoiceId } });
}

export async function listAssets(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string,
) {
  return prisma.fixedAsset.findMany({
    where: { orgId, ...(buildingId ? { buildingId } : {}) },
    orderBy: { acquisitionDate: "desc" },
  });
}

/** Active assets not yet fully depreciated — candidates for a depreciation run. */
export async function listDepreciable(prisma: PrismaClient, orgId: string) {
  return prisma.fixedAsset.findMany({
    where: { orgId, status: "ACTIVE" },
  });
}

export async function createAsset(
  prisma: PrismaClient,
  data: {
    orgId: string;
    buildingId: string;
    unitId: string | null;
    name: string;
    sourceInvoiceId: string | null;
    acquisitionDate: Date;
    costCents: number;
    salvageCents: number;
    usefulLifeYears: number;
  },
) {
  return prisma.fixedAsset.create({ data });
}

export async function updateAsset(
  prisma: PrismaClient,
  id: string,
  data: { accumulatedDepreciationCents?: number; status?: string },
) {
  return prisma.fixedAsset.update({ where: { id }, data });
}
