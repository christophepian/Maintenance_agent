/**
 * billingPeriodRepository
 *
 * Canonical Prisma access for the building cost pool: BillingPeriod + CostEntry,
 * plus the lease "participants" used to compute distribution-key shares.
 * All queries are org-scoped. Routes/services must not call Prisma directly.
 */

import { PrismaClient, Prisma } from "@prisma/client";

export const BILLING_PERIOD_INCLUDE = {
  costEntries: {
    include: {
      category: {
        select: { id: true, code: true, name: true, billability: true, defaultKey: true },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  building: { select: { id: true, name: true } },
} as const satisfies Prisma.BillingPeriodInclude;

export async function listBillingPeriods(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string,
) {
  return prisma.billingPeriod.findMany({
    where: { orgId, ...(buildingId ? { buildingId } : {}) },
    include: BILLING_PERIOD_INCLUDE,
    orderBy: { startDate: "desc" },
  });
}

export async function findBillingPeriodById(prisma: PrismaClient, id: string, orgId: string) {
  return prisma.billingPeriod.findFirst({ where: { id, orgId }, include: BILLING_PERIOD_INCLUDE });
}

export async function createBillingPeriod(
  prisma: PrismaClient,
  orgId: string,
  data: { buildingId: string; startDate: Date; endDate: Date; adminFeeRatePermille?: number },
) {
  return prisma.billingPeriod.create({
    data: {
      orgId,
      buildingId: data.buildingId,
      startDate: data.startDate,
      endDate: data.endDate,
      adminFeeRatePermille: data.adminFeeRatePermille ?? 0,
    },
    include: BILLING_PERIOD_INCLUDE,
  });
}

export async function updateBillingPeriod(
  prisma: PrismaClient,
  id: string,
  data: { status?: string; adminFeeRatePermille?: number },
) {
  return prisma.billingPeriod.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.adminFeeRatePermille !== undefined ? { adminFeeRatePermille: data.adminFeeRatePermille } : {}),
    },
    include: BILLING_PERIOD_INCLUDE,
  });
}

// ─── Cost entries ──────────────────────────────────────────────
export async function createCostEntry(
  prisma: PrismaClient,
  data: { billingPeriodId: string; categoryId: string; amountCents: number; sourceInvoiceId?: string | null; note?: string | null },
) {
  return prisma.costEntry.create({ data });
}

export async function findCostEntryById(prisma: PrismaClient, id: string) {
  return prisma.costEntry.findUnique({ where: { id } });
}

export async function updateCostEntry(
  prisma: PrismaClient,
  id: string,
  data: { amountCents?: number; categoryId?: string; sourceInvoiceId?: string | null; note?: string | null },
) {
  return prisma.costEntry.update({ where: { id }, data });
}

export async function deleteCostEntry(prisma: PrismaClient, id: string) {
  return prisma.costEntry.delete({ where: { id } });
}

// ─── Distribution participants ─────────────────────────────────
/**
 * Active, non-template leases on a building, with the inputs needed by every
 * distribution key (surface from the unit, occupant count + fixed share from
 * the lease). Vacant units simply don't appear → their share falls to the
 * landlord, which is the legally correct default.
 */
export async function findBuildingLeaseParticipants(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  const leases = await prisma.lease.findMany({
    where: {
      orgId,
      isTemplate: false,
      status: "ACTIVE",
      unit: { buildingId },
    },
    select: {
      id: true,
      occupantCount: true,
      fixedSharePermille: true,
      unitId: true,
      unit: { select: { id: true, unitNumber: true, livingAreaSqm: true } },
    },
  });
  return leases.map((l) => ({
    leaseId: l.id,
    unitId: l.unitId,
    unitNumber: l.unit?.unitNumber ?? null,
    areaSqm: l.unit?.livingAreaSqm ?? null,
    occupantCount: l.occupantCount ?? null,
    fixedSharePermille: l.fixedSharePermille ?? null,
  }));
}

export type LeaseParticipant = Awaited<ReturnType<typeof findBuildingLeaseParticipants>>[number];
