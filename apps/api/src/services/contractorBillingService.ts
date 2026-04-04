/**
 * Contractor Billing Service
 *
 * Manages recurring billing schedules for contractor services
 * (monthly cleaning, quarterly elevator maintenance, annual HVAC service, etc.)
 *
 * Invoice generation follows the same pattern as lease billing:
 *   1. Scheduler finds due schedules
 *   2. For each, creates an INCOMING invoice
 *   3. Advances the schedule to the next period
 *
 * Unlike lease billing, contractor invoices:
 *   - Are INCOMING (money flows out)
 *   - Linked directly to a contractor (not via job)
 *   - Support multiple frequencies (monthly, quarterly, semi-annual, annual)
 *   - Use the contractor's billing entity as issuer
 */
import { PrismaClient } from "@prisma/client";
import * as contractorBillingRepo from "../repositories/contractorBillingRepository";

// ─── Period Helpers ────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function getFrequencyMonths(
  frequency: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL",
): number {
  switch (frequency) {
    case "MONTHLY":
      return 1;
    case "QUARTERLY":
      return 3;
    case "SEMI_ANNUAL":
      return 6;
    case "ANNUAL":
      return 12;
  }
}

function getPeriodLabel(
  start: Date,
  frequency: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL",
): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const year = start.getFullYear();
  const monthIdx = start.getMonth();

  switch (frequency) {
    case "MONTHLY":
      return `${months[monthIdx]} ${year}`;
    case "QUARTERLY": {
      const qEnd = monthIdx + 2;
      return `${months[monthIdx]}–${months[qEnd]} ${year}`;
    }
    case "SEMI_ANNUAL": {
      const hEnd = monthIdx + 5;
      return `${months[monthIdx]}–${months[hEnd]} ${year}`;
    }
    case "ANNUAL":
      return `${year}`;
  }
}

// ─── CRUD ──────────────────────────────────────────────────────

export async function createSchedule(
  prisma: PrismaClient,
  orgId: string,
  input: {
    contractorId: string;
    description: string;
    frequency: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
    amountCents: number;
    vatRate?: number;
    anchorDay?: number;
    startDate: string; // ISO date
    buildingId?: string;
  },
) {
  // Validate contractor exists
  const contractor = await prisma.contractor.findFirst({
    where: { id: input.contractorId, orgId },
  });
  if (!contractor) throw new Error("Contractor not found");

  // Validate building if provided
  if (input.buildingId) {
    const building = await prisma.building.findFirst({
      where: { id: input.buildingId, orgId },
    });
    if (!building) throw new Error("Building not found");
  }

  return contractorBillingRepo.createSchedule(prisma, {
    orgId,
    contractorId: input.contractorId,
    description: input.description,
    frequency: input.frequency,
    amountCents: input.amountCents,
    vatRate: input.vatRate,
    anchorDay: input.anchorDay,
    nextPeriodStart: new Date(input.startDate),
    buildingId: input.buildingId,
  });
}

export async function updateSchedule(
  prisma: PrismaClient,
  scheduleId: string,
  orgId: string,
  input: {
    description?: string;
    amountCents?: number;
    vatRate?: number;
    frequency?: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
    buildingId?: string | null;
  },
) {
  const schedule = await contractorBillingRepo.findById(prisma, scheduleId, orgId);
  if (!schedule) throw new Error("Schedule not found");
  if (schedule.status === "COMPLETED") {
    throw new Error("Cannot update a completed schedule");
  }

  return contractorBillingRepo.updateSchedule(prisma, scheduleId, orgId, input);
}

export async function pauseSchedule(
  prisma: PrismaClient,
  scheduleId: string,
  orgId: string,
) {
  const schedule = await contractorBillingRepo.findById(prisma, scheduleId, orgId);
  if (!schedule) throw new Error("Schedule not found");
  if (schedule.status !== "ACTIVE") {
    throw new Error(`Cannot pause schedule in ${schedule.status} status`);
  }
  return contractorBillingRepo.pauseSchedule(prisma, scheduleId);
}

export async function resumeSchedule(
  prisma: PrismaClient,
  scheduleId: string,
  orgId: string,
) {
  const schedule = await contractorBillingRepo.findById(prisma, scheduleId, orgId);
  if (!schedule) throw new Error("Schedule not found");
  if (schedule.status !== "PAUSED") {
    throw new Error(`Cannot resume schedule in ${schedule.status} status`);
  }
  return contractorBillingRepo.resumeSchedule(prisma, scheduleId);
}

export async function stopSchedule(
  prisma: PrismaClient,
  scheduleId: string,
  orgId: string,
  reason: string = "MANUAL_STOP",
) {
  const schedule = await contractorBillingRepo.findById(prisma, scheduleId, orgId);
  if (!schedule) throw new Error("Schedule not found");
  if (schedule.status === "COMPLETED") {
    throw new Error("Schedule is already completed");
  }
  return contractorBillingRepo.completeSchedule(prisma, scheduleId, reason);
}

export async function deleteSchedule(
  prisma: PrismaClient,
  scheduleId: string,
  orgId: string,
) {
  const schedule = await contractorBillingRepo.findById(prisma, scheduleId, orgId);
  if (!schedule) throw new Error("Schedule not found");
  return contractorBillingRepo.deleteSchedule(prisma, scheduleId);
}

// ─── Invoice Generation ───────────────────────────────────────

/**
 * Generate a single invoice for a contractor billing schedule.
 * Creates an INCOMING invoice and advances the schedule to the next period.
 */
export async function generateInvoiceForSchedule(
  prisma: PrismaClient,
  scheduleId: string,
  orgId: string,
) {
  const schedule = await contractorBillingRepo.findById(prisma, scheduleId, orgId);
  if (!schedule) throw new Error("Schedule not found");
  if (schedule.status !== "ACTIVE") {
    throw new Error(`Cannot generate invoice for ${schedule.status} schedule`);
  }

  const periodStart = schedule.nextPeriodStart;
  const freqMonths = getFrequencyMonths(schedule.frequency as any);
  const periodEnd = addMonths(periodStart, freqMonths);
  periodEnd.setDate(periodEnd.getDate() - 1); // Last day of period

  const periodLabel = getPeriodLabel(periodStart, schedule.frequency as any);
  const description = `${schedule.description} — ${periodLabel}`;

  // Calculate VAT
  const vatRate = schedule.vatRate ?? 7.7;
  const subtotalCents = schedule.amountCents;
  const vatCents = Math.round(subtotalCents * vatRate / 100);
  const totalCents = subtotalCents + vatCents;

  // Resolve contractor's billing entity (optional)
  const billingEntity = await prisma.billingEntity.findFirst({
    where: { contractorId: schedule.contractorId },
  });

  // Create the invoice
  const invoice = await prisma.invoice.create({
    data: {
      orgId,
      contractorId: schedule.contractorId,
      contractorBillingScheduleId: schedule.id,
      direction: "INCOMING",
      description,
      amount: Math.round(totalCents / 100), // amount in whole CHF
      subtotalAmount: subtotalCents,
      vatAmount: vatCents,
      totalAmount: totalCents,
      vatRate,
      currency: "CHF",
      recipientName: schedule.contractor.name,
      recipientAddressLine1: "",
      recipientPostalCode: "",
      recipientCity: "",
      recipientCountry: "CH",
      issuerBillingEntityId: billingEntity?.id || null,
      iban: schedule.contractor.iban || null,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      sourceChannel: "MANUAL",
      lineItems: {
        create: [
          {
            description: schedule.description,
            quantity: 1,
            unitPrice: subtotalCents,
            vatRate,
            lineTotal: subtotalCents,
          },
        ],
      },
    },
  });

  // Advance the schedule
  const nextPeriodStart = addMonths(periodStart, freqMonths);
  await contractorBillingRepo.advanceSchedule(
    prisma,
    schedule.id,
    periodStart,
    nextPeriodStart,
  );

  return { invoiceId: invoice.id, nextPeriodStart };
}

/**
 * Batch: generate invoices for all due contractor billing schedules.
 * Called by the background scheduler alongside lease billing.
 */
export async function generateDueContractorInvoices(
  prisma: PrismaClient,
  leadTimeDays: number = 20,
): Promise<{ generated: number; errors: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + leadTimeDays);

  const dueSchedules = await contractorBillingRepo.findDueSchedules(prisma, cutoff);
  let generated = 0;
  let errors = 0;

  for (const schedule of dueSchedules) {
    try {
      await generateInvoiceForSchedule(prisma, schedule.id, schedule.orgId);
      generated++;
    } catch (err) {
      console.error(
        `[CONTRACTOR-BILLING] Failed to generate invoice for schedule ${schedule.id}:`,
        err,
      );
      errors++;
    }
  }

  if (dueSchedules.length > 0) {
    console.log(
      `[CONTRACTOR-BILLING] Generated ${generated} invoices (${errors} errors) from ${dueSchedules.length} due schedules`,
    );
  }

  return { generated, errors };
}
