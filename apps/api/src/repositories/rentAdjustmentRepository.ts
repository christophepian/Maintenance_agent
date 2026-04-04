import { PrismaClient, Prisma } from "@prisma/client";

// ─── Canonical include constant ────────────────────────────────

export const RENT_ADJUSTMENT_INCLUDE = {
  lease: {
    select: {
      id: true,
      tenantName: true,
      netRentChf: true,
      startDate: true,
      endDate: true,
      status: true,
      indexClauseType: true,
      cpiBaseIndex: true,
      initialNetRentChf: true,
      lastIndexationDate: true,
      referenceRatePercent: true,
      unitId: true,
    },
  },
} as const;

export type RentAdjustmentWithLease = Prisma.RentAdjustmentGetPayload<{
  include: typeof RENT_ADJUSTMENT_INCLUDE;
}>;

// ─── Queries ───────────────────────────────────────────────────

export async function findById(
  prisma: PrismaClient,
  id: string,
  orgId: string,
): Promise<RentAdjustmentWithLease | null> {
  return prisma.rentAdjustment.findFirst({
    where: { id, orgId },
    include: RENT_ADJUSTMENT_INCLUDE,
  });
}

export async function listRentAdjustments(
  prisma: PrismaClient,
  orgId: string,
  filters: {
    status?: string;
    leaseId?: string;
    adjustmentType?: string;
  } = {},
): Promise<RentAdjustmentWithLease[]> {
  const where: Prisma.RentAdjustmentWhereInput = { orgId };
  if (filters.status) where.status = filters.status as any;
  if (filters.leaseId) where.leaseId = filters.leaseId;
  if (filters.adjustmentType)
    where.adjustmentType = filters.adjustmentType as any;

  return prisma.rentAdjustment.findMany({
    where,
    include: RENT_ADJUSTMENT_INCLUDE,
    orderBy: { effectiveDate: "desc" },
  });
}

export async function findByLeaseId(
  prisma: PrismaClient,
  leaseId: string,
  orgId: string,
): Promise<RentAdjustmentWithLease[]> {
  return prisma.rentAdjustment.findMany({
    where: { leaseId, orgId },
    include: RENT_ADJUSTMENT_INCLUDE,
    orderBy: { effectiveDate: "desc" },
  });
}

// ─── Mutations ─────────────────────────────────────────────────

export async function createRentAdjustment(
  prisma: PrismaClient,
  data: {
    orgId: string;
    leaseId: string;
    adjustmentType: "CPI_INDEXATION" | "REFERENCE_RATE_CHANGE" | "MANUAL";
    effectiveDate: Date;
    previousRentCents: number;
    newRentCents: number;
    adjustmentCents: number;
    cpiOldIndex?: number;
    cpiNewIndex?: number;
    referenceRateOld?: string;
    referenceRateNew?: string;
    calculationDetails?: any;
  },
): Promise<RentAdjustmentWithLease> {
  return prisma.rentAdjustment.create({
    data: {
      orgId: data.orgId,
      leaseId: data.leaseId,
      adjustmentType: data.adjustmentType,
      effectiveDate: data.effectiveDate,
      previousRentCents: data.previousRentCents,
      newRentCents: data.newRentCents,
      adjustmentCents: data.adjustmentCents,
      cpiOldIndex: data.cpiOldIndex,
      cpiNewIndex: data.cpiNewIndex,
      referenceRateOld: data.referenceRateOld,
      referenceRateNew: data.referenceRateNew,
      calculationDetails: data.calculationDetails ?? Prisma.JsonNull,
    },
    include: RENT_ADJUSTMENT_INCLUDE,
  });
}

export async function approveAdjustment(
  prisma: PrismaClient,
  id: string,
  orgId: string,
): Promise<RentAdjustmentWithLease> {
  return prisma.rentAdjustment.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
    },
    include: RENT_ADJUSTMENT_INCLUDE,
  });
}

export async function applyAdjustment(
  prisma: PrismaClient,
  id: string,
  orgId: string,
): Promise<RentAdjustmentWithLease> {
  return prisma.rentAdjustment.update({
    where: { id },
    data: {
      status: "APPLIED",
      appliedAt: new Date(),
    },
    include: RENT_ADJUSTMENT_INCLUDE,
  });
}

export async function rejectAdjustment(
  prisma: PrismaClient,
  id: string,
  orgId: string,
  reason?: string,
): Promise<RentAdjustmentWithLease> {
  return prisma.rentAdjustment.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason || null,
    },
    include: RENT_ADJUSTMENT_INCLUDE,
  });
}

export async function deleteRentAdjustment(
  prisma: PrismaClient,
  id: string,
  orgId: string,
): Promise<void> {
  await prisma.rentAdjustment.delete({ where: { id } });
}
