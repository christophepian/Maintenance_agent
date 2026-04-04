import { PrismaClient, Prisma } from "@prisma/client";

// ─── Canonical include constant ────────────────────────────────

export const CONTRACTOR_BILLING_INCLUDE = {
  contractor: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      iban: true,
      vatNumber: true,
      defaultVatRate: true,
      isActive: true,
    },
  },
  building: {
    select: {
      id: true,
      name: true,
      address: true,
    },
  },
} as const;

export type ContractorBillingScheduleWithRelations =
  Prisma.ContractorBillingScheduleGetPayload<{
    include: typeof CONTRACTOR_BILLING_INCLUDE;
  }>;

// ─── Queries ───────────────────────────────────────────────────

export async function findById(
  prisma: PrismaClient,
  id: string,
  orgId: string,
): Promise<ContractorBillingScheduleWithRelations | null> {
  return prisma.contractorBillingSchedule.findFirst({
    where: { id, orgId },
    include: CONTRACTOR_BILLING_INCLUDE,
  });
}

export async function listSchedules(
  prisma: PrismaClient,
  orgId: string,
  filters: {
    status?: string;
    contractorId?: string;
    buildingId?: string;
    frequency?: string;
  } = {},
): Promise<ContractorBillingScheduleWithRelations[]> {
  const where: Prisma.ContractorBillingScheduleWhereInput = { orgId };
  if (filters.status) where.status = filters.status as any;
  if (filters.contractorId) where.contractorId = filters.contractorId;
  if (filters.buildingId) where.buildingId = filters.buildingId;
  if (filters.frequency) where.frequency = filters.frequency as any;

  return prisma.contractorBillingSchedule.findMany({
    where,
    include: CONTRACTOR_BILLING_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function findByContractorId(
  prisma: PrismaClient,
  contractorId: string,
  orgId: string,
): Promise<ContractorBillingScheduleWithRelations[]> {
  return prisma.contractorBillingSchedule.findMany({
    where: { contractorId, orgId },
    include: CONTRACTOR_BILLING_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Find ACTIVE schedules due for invoice generation.
 */
export async function findDueSchedules(
  prisma: PrismaClient,
  before: Date,
): Promise<ContractorBillingScheduleWithRelations[]> {
  return prisma.contractorBillingSchedule.findMany({
    where: {
      status: "ACTIVE",
      nextPeriodStart: { lte: before },
    },
    include: CONTRACTOR_BILLING_INCLUDE,
  });
}

// ─── Mutations ─────────────────────────────────────────────────

export async function createSchedule(
  prisma: PrismaClient,
  data: {
    orgId: string;
    contractorId: string;
    description: string;
    frequency: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
    amountCents: number;
    vatRate?: number;
    anchorDay?: number;
    nextPeriodStart: Date;
    buildingId?: string;
  },
): Promise<ContractorBillingScheduleWithRelations> {
  return prisma.contractorBillingSchedule.create({
    data: {
      orgId: data.orgId,
      contractorId: data.contractorId,
      description: data.description,
      frequency: data.frequency,
      amountCents: data.amountCents,
      vatRate: data.vatRate ?? 7.7,
      anchorDay: data.anchorDay ?? 1,
      nextPeriodStart: data.nextPeriodStart,
      buildingId: data.buildingId || null,
    },
    include: CONTRACTOR_BILLING_INCLUDE,
  });
}

export async function advanceSchedule(
  prisma: PrismaClient,
  id: string,
  lastGenerated: Date,
  nextPeriodStart: Date,
): Promise<ContractorBillingScheduleWithRelations> {
  return prisma.contractorBillingSchedule.update({
    where: { id },
    data: {
      lastGeneratedPeriod: lastGenerated,
      nextPeriodStart,
    },
    include: CONTRACTOR_BILLING_INCLUDE,
  });
}

export async function updateSchedule(
  prisma: PrismaClient,
  id: string,
  orgId: string,
  data: {
    description?: string;
    amountCents?: number;
    vatRate?: number;
    frequency?: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
    buildingId?: string | null;
  },
): Promise<ContractorBillingScheduleWithRelations> {
  return prisma.contractorBillingSchedule.update({
    where: { id },
    data,
    include: CONTRACTOR_BILLING_INCLUDE,
  });
}

export async function pauseSchedule(
  prisma: PrismaClient,
  id: string,
): Promise<ContractorBillingScheduleWithRelations> {
  return prisma.contractorBillingSchedule.update({
    where: { id },
    data: { status: "PAUSED" },
    include: CONTRACTOR_BILLING_INCLUDE,
  });
}

export async function resumeSchedule(
  prisma: PrismaClient,
  id: string,
): Promise<ContractorBillingScheduleWithRelations> {
  return prisma.contractorBillingSchedule.update({
    where: { id },
    data: { status: "ACTIVE" },
    include: CONTRACTOR_BILLING_INCLUDE,
  });
}

export async function completeSchedule(
  prisma: PrismaClient,
  id: string,
  reason: string,
): Promise<ContractorBillingScheduleWithRelations> {
  return prisma.contractorBillingSchedule.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completionReason: reason,
    },
    include: CONTRACTOR_BILLING_INCLUDE,
  });
}

export async function deleteSchedule(
  prisma: PrismaClient,
  id: string,
): Promise<void> {
  await prisma.contractorBillingSchedule.delete({ where: { id } });
}
