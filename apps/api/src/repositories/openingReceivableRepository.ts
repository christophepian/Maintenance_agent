/**
 * Opening Receivable Repository (accounting bridge WS-F)
 *
 * Per-tenant breakdown of the imported AR lump. Keeps Prisma out of the service
 * layer (G20).
 */

import { PrismaClient } from "@prisma/client";

export async function listByBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  return prisma.openingReceivable.findMany({
    where: { orgId, buildingId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

export async function findById(prisma: PrismaClient, orgId: string, id: string) {
  return prisma.openingReceivable.findFirst({ where: { id, orgId } });
}

export async function sumByBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  status?: string,
): Promise<number> {
  const agg = await prisma.openingReceivable.aggregate({
    where: { orgId, buildingId, ...(status ? { status } : {}) },
    _sum: { amountCents: true },
  });
  return agg._sum.amountCents ?? 0;
}

export async function createItem(
  prisma: PrismaClient,
  data: {
    orgId: string;
    buildingId: string;
    unitId: string | null;
    tenantName: string;
    amountCents: number;
    dueDate: Date | null;
  },
) {
  return prisma.openingReceivable.create({ data });
}

export async function updateItem(
  prisma: PrismaClient,
  id: string,
  data: { status?: string; settlementJournalId?: string | null; settledAt?: Date | null },
) {
  return prisma.openingReceivable.update({ where: { id }, data });
}
