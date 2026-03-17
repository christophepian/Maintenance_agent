/**
 * Scheduling Repository — canonical Prisma access for AppointmentSlot.
 *
 * Follows the repository pattern: routes/workflows never touch Prisma directly,
 * always go through these functions with the canonical include constants.
 */

import { PrismaClient, Prisma, SlotStatus } from "@prisma/client";

/* ── Canonical include constants ─────────────────────────────── */

export const SLOT_INCLUDE = {
  job: {
    select: {
      id: true,
      orgId: true,
      requestId: true,
      contractorId: true,
      status: true,
      schedulingExpiresAt: true,
      request: {
        select: {
          id: true,
          description: true,
          tenantId: true,
          unit: {
            select: {
              id: true,
              unitNumber: true,
              building: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  },
} as const;

export type SlotWithJob = Prisma.AppointmentSlotGetPayload<{
  include: typeof SLOT_INCLUDE;
}>;

/* ── Query functions ─────────────────────────────────────────── */

/** Find a single slot by ID with job context. */
export async function findSlotById(
  prisma: PrismaClient,
  slotId: string,
): Promise<SlotWithJob | null> {
  return prisma.appointmentSlot.findUnique({
    where: { id: slotId },
    include: SLOT_INCLUDE,
  });
}

/** Find all slots for a given job. */
export async function findSlotsByJobId(
  prisma: PrismaClient,
  jobId: string,
): Promise<SlotWithJob[]> {
  return prisma.appointmentSlot.findMany({
    where: { jobId },
    include: SLOT_INCLUDE,
    orderBy: { startTime: "asc" },
  });
}

/** Create one or more appointment slots for a job. */
export async function createSlots(
  prisma: PrismaClient,
  data: {
    orgId: string;
    jobId: string;
    slots: { startTime: Date; endTime: Date }[];
  },
): Promise<SlotWithJob[]> {
  const created = await prisma.$transaction(
    data.slots.map((s) =>
      prisma.appointmentSlot.create({
        data: {
          orgId: data.orgId,
          jobId: data.jobId,
          startTime: s.startTime,
          endTime: s.endTime,
          status: "PROPOSED",
        },
        include: SLOT_INCLUDE,
      }),
    ),
  );
  return created;
}

/** Update slot status (accept / decline). */
export async function updateSlotStatus(
  prisma: PrismaClient,
  slotId: string,
  status: SlotStatus,
): Promise<SlotWithJob> {
  return prisma.appointmentSlot.update({
    where: { id: slotId },
    data: {
      status,
      respondedAt: new Date(),
    },
    include: SLOT_INCLUDE,
  });
}

/** Decline all PROPOSED slots for a job (used when one is accepted). */
export async function declineOtherSlots(
  prisma: PrismaClient,
  jobId: string,
  exceptSlotId: string,
): Promise<number> {
  const result = await prisma.appointmentSlot.updateMany({
    where: {
      jobId,
      id: { not: exceptSlotId },
      status: "PROPOSED",
    },
    data: {
      status: "DECLINED",
      respondedAt: new Date(),
    },
  });
  return result.count;
}

/** Set schedulingExpiresAt on a Job (72h from now). */
export async function setSchedulingExpiry(
  prisma: PrismaClient,
  jobId: string,
  expiresAt: Date,
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { schedulingExpiresAt: expiresAt },
  });
}

/** Find jobs whose scheduling deadline has passed without an accepted slot. */
export async function findExpiredSchedulingJobs(
  prisma: PrismaClient,
): Promise<
  {
    id: string;
    orgId: string;
    requestId: string;
    contractorId: string;
    schedulingExpiresAt: Date;
  }[]
> {
  return prisma.job.findMany({
    where: {
      schedulingExpiresAt: { lte: new Date() },
      status: "PENDING",
      appointmentSlots: {
        none: { status: "ACCEPTED" },
      },
    },
    select: {
      id: true,
      orgId: true,
      requestId: true,
      contractorId: true,
      schedulingExpiresAt: true,
    },
  }) as any;
}

/** Clear the scheduling expiry (after escalation has been sent). */
export async function clearSchedulingExpiry(
  prisma: PrismaClient,
  jobId: string,
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { schedulingExpiresAt: null },
  });
}
