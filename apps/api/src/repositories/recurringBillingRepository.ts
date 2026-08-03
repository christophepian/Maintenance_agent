/**
 * recurringBillingRepository
 *
 * Canonical Prisma access for RecurringBillingSchedule.
 * All queries are org-scoped. Routes and workflows must not call Prisma directly.
 *
 * G3/G9: canonical include constants live here.
 */

import { PrismaClient, BillingScheduleStatus } from "@prisma/client";

// ─── Canonical Include ─────────────────────────────────────────

export const BILLING_SCHEDULE_INCLUDE = {
  lease: {
    select: {
      id: true,
      tenantName: true,
      tenantAddress: true,
      tenantZipCity: true,
      tenantEmail: true,
      startDate: true,
      endDate: true,
      status: true,
      netRentChf: true,
      chargesTotalChf: true,
      paymentIban: true,
      unitId: true,
      // Unit context for parking co-billing (a co-billed parking lease is skipped;
      // a flat's invoice absorbs its linked same-tenant parking spots).
      unit: { select: { id: true, type: true, linkedFlatId: true, unitNumber: true, parkingKind: true } },
      expenseItems: {
        where: { isActive: true },
        select: {
          id: true,
          description: true,
          amountChf: true,
          mode: true,
          expenseTypeId: true,
          accountId: true,
          categoryId: true,
        },
      },
    },
  },
} as const;

// ─── Queries ───────────────────────────────────────────────────

/**
 * Find a single schedule by ID, scoped to org.
 */
export async function findScheduleById(
  prisma: PrismaClient,
  id: string,
  orgId: string,
) {
  return prisma.recurringBillingSchedule.findFirst({
    where: { id, orgId },
    include: BILLING_SCHEDULE_INCLUDE,
  });
}

/**
 * Find the schedule for a given lease.
 */
export async function findScheduleByLeaseId(
  prisma: PrismaClient,
  leaseId: string,
) {
  return prisma.recurringBillingSchedule.findUnique({
    where: { leaseId },
    include: BILLING_SCHEDULE_INCLUDE,
  });
}

// ─── Parking co-billing ────────────────────────────────────────

/**
 * Active parking-spot leases that ride on a flat's invoice: parking units linked
 * to `flatUnitId`, with an ACTIVE lease held by the same tenant (matched by name).
 */
export async function findActiveParkingLeasesForFlat(
  prisma: PrismaClient,
  flatUnitId: string,
  tenantName: string,
) {
  return prisma.lease.findMany({
    where: {
      status: "ACTIVE",
      tenantName,
      unit: { type: "PARKING", linkedFlatId: flatUnitId },
    },
    select: {
      id: true,
      netRentChf: true,
      unit: { select: { unitNumber: true, parkingKind: true } },
    },
    orderBy: { unit: { unitNumber: "asc" } },
  });
}

/**
 * Is there an ACTIVE flat lease that co-bills this parking spot? i.e. the spot's
 * linked flat has an active lease held by the same tenant. If so, the parking
 * lease must not self-bill (its rent is a line on the flat's invoice).
 */
export async function findActiveFlatLeaseForParking(
  prisma: PrismaClient,
  linkedFlatId: string,
  tenantName: string,
) {
  return prisma.lease.findFirst({
    where: { status: "ACTIVE", tenantName, unitId: linkedFlatId },
    select: { id: true },
  });
}

/**
 * List all schedules for an org, optionally filtered by status and/or leaseId.
 */
export async function listSchedules(
  prisma: PrismaClient,
  orgId: string,
  status?: BillingScheduleStatus,
  leaseId?: string,
) {
  return prisma.recurringBillingSchedule.findMany({
    where: {
      orgId,
      ...(status ? { status } : {}),
      ...(leaseId ? { leaseId } : {}),
    },
    include: BILLING_SCHEDULE_INCLUDE,
    orderBy: { nextPeriodStart: "asc" },
  });
}

/**
 * Find ACTIVE schedules whose next invoice is due for generation.
 *
 * An invoice should be generated when:
 *   dueDate − leadTimeDays ≤ today
 *
 * Since dueDate = last day of (nextPeriodStart.month − 1), we compute
 * the cutoff in the service layer and pass `generateBefore` here.
 *
 * This query simply finds ACTIVE schedules where nextPeriodStart ≤ generateBefore.
 */
export async function findDueSchedules(
  prisma: PrismaClient,
  generateBefore: Date,
) {
  return prisma.recurringBillingSchedule.findMany({
    where: {
      status: "ACTIVE",
      nextPeriodStart: { lte: generateBefore },
    },
    include: BILLING_SCHEDULE_INCLUDE,
    orderBy: { nextPeriodStart: "asc" },
  });
}

// ─── Mutations ─────────────────────────────────────────────────

/**
 * Create a new recurring billing schedule for a lease.
 */
export async function createSchedule(
  prisma: PrismaClient,
  data: {
    orgId: string;
    leaseId: string;
    anchorDay?: number;
    nextPeriodStart: Date;
    baseRentCents: number;
    totalChargesCents: number;
  },
) {
  return prisma.recurringBillingSchedule.create({
    data: {
      orgId: data.orgId,
      leaseId: data.leaseId,
      anchorDay: data.anchorDay ?? 1,
      nextPeriodStart: data.nextPeriodStart,
      baseRentCents: data.baseRentCents,
      totalChargesCents: data.totalChargesCents,
      status: "ACTIVE",
    },
    include: BILLING_SCHEDULE_INCLUDE,
  });
}

/**
 * Advance the schedule after generating an invoice for a period.
 */
export async function advanceSchedule(
  prisma: PrismaClient,
  scheduleId: string,
  lastGeneratedPeriod: Date,
  nextPeriodStart: Date,
) {
  return prisma.recurringBillingSchedule.update({
    where: { id: scheduleId },
    data: {
      lastGeneratedPeriod,
      nextPeriodStart,
    },
  });
}

/**
 * Complete (stop) a schedule — e.g. on lease termination.
 */
export async function completeSchedule(
  prisma: PrismaClient,
  scheduleId: string,
  reason: string,
) {
  return prisma.recurringBillingSchedule.update({
    where: { id: scheduleId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completionReason: reason,
    },
  });
}

/**
 * Pause a schedule.
 */
export async function pauseSchedule(
  prisma: PrismaClient,
  scheduleId: string,
) {
  return prisma.recurringBillingSchedule.update({
    where: { id: scheduleId },
    data: { status: "PAUSED" },
  });
}

/**
 * Resume a paused schedule.
 */
export async function resumeSchedule(
  prisma: PrismaClient,
  scheduleId: string,
) {
  return prisma.recurringBillingSchedule.update({
    where: { id: scheduleId },
    data: { status: "ACTIVE" },
  });
}

/**
 * Update the amounts snapshot on a schedule (e.g. when lease terms change).
 */
export async function updateScheduleAmounts(
  prisma: PrismaClient,
  scheduleId: string,
  baseRentCents: number,
  totalChargesCents: number,
) {
  return prisma.recurringBillingSchedule.update({
    where: { id: scheduleId },
    data: { baseRentCents, totalChargesCents },
  });
}
