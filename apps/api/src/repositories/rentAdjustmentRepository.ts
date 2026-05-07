import { PrismaClient, Prisma, RentAdjustmentStatus, RentAdjustmentType } from "@prisma/client";

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
    status?: RentAdjustmentStatus;
    leaseId?: string;
    adjustmentType?: RentAdjustmentType;
  } = {},
): Promise<RentAdjustmentWithLease[]> {
  const where: Prisma.RentAdjustmentWhereInput = { orgId };
  if (filters.status) where.status = filters.status;
  if (filters.leaseId) where.leaseId = filters.leaseId;
  if (filters.adjustmentType)
    where.adjustmentType = filters.adjustmentType;

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
    calculationDetails?: Prisma.JsonValue;
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

// ─── Lease lookup helpers for rent adjustment service ─────────

/** Find lease with billingSchedule for indexation computations. */
export async function findLeaseForAdjustmentWithSchedule(
  prisma: PrismaClient,
  leaseId: string,
  orgId: string,
) {
  return prisma.lease.findFirst({
    where: { id: leaseId, orgId },
    include: { billingSchedule: true },
  });
}

/** Find lease (bare) for manual adjustment current-rent read. */
export async function findLeaseForAdjustment(
  prisma: PrismaClient,
  leaseId: string,
  orgId: string,
) {
  return prisma.lease.findFirst({ where: { id: leaseId, orgId } });
}

/**
 * Apply rent adjustment in an atomic transaction:
 * 1. Update lease netRentChf + lastIndexationDate (+ initialNetRentChf if first)
 * 2. Update RecurringBillingSchedule.baseRentCents if ACTIVE
 * 3. Mark adjustment as APPLIED
 */
export async function applyAdjustmentTransaction(
  prisma: PrismaClient,
  adj: {
    id: string;
    leaseId: string;
    newRentCents: number;
    effectiveDate: Date;
    lease: { initialNetRentChf: number | null; netRentChf: number };
  },
) {
  const newRentChf = Math.round(adj.newRentCents / 100);
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.lease.update({
      where: { id: adj.leaseId },
      data: {
        netRentChf: newRentChf,
        lastIndexationDate: adj.effectiveDate,
        initialNetRentChf: adj.lease.initialNetRentChf ?? adj.lease.netRentChf,
      },
    });
    const schedule = await tx.recurringBillingSchedule.findUnique({
      where: { leaseId: adj.leaseId },
    });
    if (schedule && schedule.status === "ACTIVE") {
      await tx.recurringBillingSchedule.update({
        where: { id: schedule.id },
        data: { baseRentCents: adj.newRentCents },
      });
    }
    return tx.rentAdjustment.update({
      where: { id: adj.id },
      data: { status: "APPLIED", appliedAt: new Date() },
      include: RENT_ADJUSTMENT_INCLUDE,
    });
  });
}
