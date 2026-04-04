/**
 * recurringBillingService
 *
 * Core engine for recurring invoice generation from leases.
 *
 * Architecture: service layer — uses repositories, never calls Prisma directly.
 *
 * Key business rules:
 *  - Billing periods are calendar months (1st → last day).
 *  - First period is pro-rata temporis if activation is mid-month.
 *  - Due date = last day of M−1 for month M's rent.
 *  - Invoices are created as ISSUED (not DRAFT) and fire tenant notifications.
 *  - VAT rate = 0 for Swiss residential rent.
 *  - Each LeaseExpenseItem becomes a separate invoice line item.
 */

import { PrismaClient } from "@prisma/client";
import * as billingRepo from "../repositories/recurringBillingRepository";
import { issueInvoiceWorkflow } from "../workflows/issueInvoiceWorkflow";
import type { WorkflowContext } from "../workflows/context";

// ─── Address Parsing Helpers ───────────────────────────────────

/**
 * Parse a Swiss building address like "Teststrasse 1, 8000 Zürich"
 * into street / postal-code / city parts.
 */
function parseBuildingStreet(addr: string | undefined): string {
  if (!addr) return "";
  const commaIdx = addr.lastIndexOf(",");
  return commaIdx >= 0 ? addr.slice(0, commaIdx).trim() : addr.trim();
}

function parseBuildingPostalCode(addr: string | undefined): string {
  if (!addr) return "";
  const commaIdx = addr.lastIndexOf(",");
  const tail = commaIdx >= 0 ? addr.slice(commaIdx + 1).trim() : "";
  const match = tail.match(/^(\d{4})\b/);
  return match?.[1] ?? "";
}

function parseBuildingCity(addr: string | undefined): string {
  if (!addr) return "";
  const commaIdx = addr.lastIndexOf(",");
  const tail = commaIdx >= 0 ? addr.slice(commaIdx + 1).trim() : "";
  const match = tail.match(/^\d{4}\s+(.+)$/);
  return match?.[1]?.trim() ?? "";
}

// ─── Date Helpers ──────────────────────────────────────────────

/** Last day of a given month (e.g. 2026-02-28, 2026-03-31). */
function lastDayOfMonth(year: number, month: number): Date {
  // month is 1-based; new Date(year, month, 0) gives last day of previous JS month
  return new Date(year, month, 0);
}

/** First day of the next calendar month. */
function firstOfNextMonth(d: Date): Date {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based
  if (m === 11) return new Date(y + 1, 0, 1);
  return new Date(y, m + 1, 1);
}

/** First day of the given date's month. */
function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Number of days in a given month. */
function daysInMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate();
}

/**
 * Compute the due date for a billing period.
 * Rule: rent for month M is due on the last day of month M−1.
 * For the very first pro-rata invoice (activation mid-month), due date is
 * the activation date itself (immediate payment expected).
 */
function computeDueDate(periodStart: Date, isFirstProRata: boolean): Date {
  if (isFirstProRata) {
    // Due immediately — use the period start as the due date
    return periodStart;
  }
  const y = periodStart.getFullYear();
  const m = periodStart.getMonth(); // 0-based, this is the billing month
  // Last day of the previous month
  if (m === 0) return lastDayOfMonth(y - 1, 12);
  return lastDayOfMonth(y, m);
}

/**
 * Compute pro-rata fraction for a partial first month.
 * E.g. activation on the 15th of a 30-day month → 16/30 (15th through 30th inclusive).
 */
function proRataFraction(activationDate: Date): number {
  const day = activationDate.getDate(); // 1-based
  const totalDays = daysInMonth(activationDate.getFullYear(), activationDate.getMonth() + 1);
  const coveredDays = totalDays - day + 1; // from activation day through end of month
  return coveredDays / totalDays;
}

// ─── Schedule Creation ─────────────────────────────────────────

export interface CreateScheduleInput {
  orgId: string;
  leaseId: string;
  /** Lease activation date — determines first billing period. */
  activationDate: Date;
  /** Net rent in whole CHF (from lease.netRentChf). */
  netRentChf: number;
  /** Sum of active LeaseExpenseItem amounts in whole CHF. */
  totalChargesChf: number;
}

/**
 * Create a RecurringBillingSchedule for a newly activated lease.
 *
 * Sets nextPeriodStart to the 1st of the activation month if activation
 * is on the 1st, otherwise to the activation date (for pro-rata).
 */
export async function createScheduleForLease(
  prisma: PrismaClient,
  input: CreateScheduleInput,
) {
  const { orgId, leaseId, activationDate, netRentChf, totalChargesChf } = input;

  // If activation is on the 1st, first period starts on that date.
  // Otherwise, first period starts on the activation date (pro-rata).
  // In both cases, nextPeriodStart = activationDate.
  const nextPeriodStart = activationDate;

  return billingRepo.createSchedule(prisma, {
    orgId,
    leaseId,
    anchorDay: 1,
    nextPeriodStart,
    baseRentCents: netRentChf * 100,
    totalChargesCents: totalChargesChf * 100,
  });
}

// ─── Invoice Generation ────────────────────────────────────────

export interface GeneratedInvoice {
  invoiceId: string;
  periodStart: Date;
  periodEnd: Date;
  totalAmountCents: number;
  isProRata: boolean;
  isBackfilled: boolean;
}

/**
 * Generate a single invoice for a billing period from a schedule.
 *
 * Creates the invoice with line items, then issues it via the
 * issueInvoiceWorkflow so that tenant notifications fire and
 * ledger entries are posted.
 */
export async function generateInvoiceForPeriod(
  prisma: PrismaClient,
  schedule: Awaited<ReturnType<typeof billingRepo.findScheduleById>>,
  periodStart: Date,
  options: {
    isBackfilled?: boolean;
    /** The org's configured lead-time days — used to compute issue date. */
    leadTimeDays?: number;
  } = {},
): Promise<GeneratedInvoice> {
  if (!schedule || !schedule.lease) {
    throw new Error("Schedule or lease not found");
  }

  const lease = schedule.lease;
  const isFirstDay = periodStart.getDate() === 1;
  const isProRata = !isFirstDay;

  // Compute period boundaries
  const periodEnd = isProRata
    ? lastDayOfMonth(periodStart.getFullYear(), periodStart.getMonth() + 1)
    : lastDayOfMonth(periodStart.getFullYear(), periodStart.getMonth() + 1);

  const fraction = isProRata ? proRataFraction(periodStart) : 1;

  // Compute amounts
  const baseRentCents = Math.round(schedule.baseRentCents * fraction);
  const chargesCents = Math.round(schedule.totalChargesCents * fraction);
  const totalCents = baseRentCents + chargesCents;

  // Compute dates
  const dueDate = computeDueDate(periodStart, isProRata);
  const issueDate = new Date(); // generated now

  // Build line items
  const lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    lineTotal: number;
  }> = [];

  // Base rent line
  const rentDescription = isProRata
    ? `Loyer net (pro rata ${periodStart.getDate()}–${periodEnd.getDate()}/${periodStart.toLocaleString("fr-CH", { month: "long", year: "numeric" })})`
    : `Loyer net — ${periodStart.toLocaleString("fr-CH", { month: "long", year: "numeric" })}`;

  lineItems.push({
    description: rentDescription,
    quantity: 1,
    unitPrice: baseRentCents,
    vatRate: 0,
    lineTotal: baseRentCents,
  });

  // Expense item lines (each LeaseExpenseItem → separate line)
  for (const item of lease.expenseItems) {
    const itemCents = Math.round(item.amountChf * 100 * fraction);
    const modeLabel = item.mode === "ACOMPTE" ? "acompte" : "forfait";
    lineItems.push({
      description: isProRata
        ? `${item.description} (${modeLabel}, pro rata)`
        : `${item.description} (${modeLabel})`,
      quantity: 1,
      unitPrice: itemCents,
      vatRate: 0,
      lineTotal: itemCents,
    });
  }

  // Format billing period for description
  const monthYear = periodStart.toLocaleString("fr-CH", { month: "long", year: "numeric" });
  const description = isProRata
    ? `Loyer + charges — ${monthYear} (pro rata du ${periodStart.getDate()})`
    : `Loyer + charges — ${monthYear}`;

  // Resolve issuer billing entity (same logic as createLeaseInvoice)
  let issuerBillingEntityId: string | undefined;
  let buildingAddress: string | undefined;
  if (lease.unitId) {
    const unit = await prisma.unit.findUnique({
      where: { id: lease.unitId },
      select: {
        building: {
          select: {
            address: true,
            owners: {
              include: { user: { select: { billingEntity: { select: { id: true } } } } },
              take: 1,
            },
          },
        },
      },
    });
    issuerBillingEntityId = unit?.building?.owners?.[0]?.user?.billingEntity?.id ?? undefined;
    buildingAddress = unit?.building?.address ?? undefined;
  }
  if (!issuerBillingEntityId) {
    const orgBillingEntity = await prisma.billingEntity.findFirst({
      where: { orgId: schedule.orgId, type: "ORG" },
      select: { id: true },
    });
    issuerBillingEntityId = orgBillingEntity?.id;
  }

  // Create the invoice (DRAFT first — issueInvoiceWorkflow will transition to ISSUED)
  const invoice = await prisma.invoice.create({
    data: {
      orgId: schedule.orgId,
      leaseId: lease.id,
      billingScheduleId: schedule.id,
      description,
      subtotalAmount: totalCents,
      vatAmount: 0,
      totalAmount: totalCents,
      amount: Math.round(totalCents / 100),
      currency: "CHF",
      vatRate: 0,
      status: "DRAFT",
      direction: "OUTGOING",
      sourceChannel: "MANUAL", // system-generated but recorded as manual for now
      recipientName: lease.tenantName,
      recipientAddressLine1: lease.tenantAddress || parseBuildingStreet(buildingAddress) || "",
      recipientPostalCode: lease.tenantZipCity?.split(" ")[0] || parseBuildingPostalCode(buildingAddress) || "",
      recipientCity: lease.tenantZipCity?.split(" ").slice(1).join(" ") || parseBuildingCity(buildingAddress) || "",
      recipientCountry: "CH",
      iban: lease.paymentIban || null,
      issuerBillingEntityId: issuerBillingEntityId || null,
      isBackfilled: options.isBackfilled ?? false,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      lineItems: {
        create: lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          vatRate: li.vatRate,
          lineTotal: li.lineTotal,
        })),
      },
    },
  });

  // Issue the invoice via workflow (transitions DRAFT → ISSUED, sends notification, posts ledger)
  const ctx: WorkflowContext = {
    orgId: schedule.orgId,
    prisma,
    actorUserId: null, // system-generated
  };

  try {
    await issueInvoiceWorkflow(ctx, {
      invoiceId: invoice.id,
      issuerBillingEntityId,
      issueDate: issueDate,
      dueDate: dueDate,
    });
  } catch (err) {
    // If issuance fails, the invoice stays as DRAFT — log but don't crash the batch
    console.error(
      `[RECURRING-BILLING] Failed to issue invoice ${invoice.id} for schedule ${schedule.id}:`,
      err,
    );
  }

  return {
    invoiceId: invoice.id,
    periodStart,
    periodEnd,
    totalAmountCents: totalCents,
    isProRata,
    isBackfilled: options.isBackfilled ?? false,
  };
}

// ─── Batch Processing ──────────────────────────────────────────

/**
 * Process all due recurring billing schedules.
 *
 * Called by the background job scheduler.
 *
 * Logic:
 *  1. Determine the generation cutoff date = today + leadTimeDays
 *  2. Find ACTIVE schedules where nextPeriodStart ≤ cutoff
 *  3. For each, generate invoice(s) — may backfill multiple missed periods
 *  4. Advance the schedule
 *
 * Returns the count of invoices generated.
 */
export async function processRecurringBilling(
  prisma: PrismaClient,
): Promise<number> {
  // Get org-level lead time config
  const orgConfig = await prisma.orgConfig.findFirst({
    select: { invoiceLeadTimeDays: true },
  });
  const leadTimeDays = orgConfig?.invoiceLeadTimeDays ?? 20;

  // Cutoff: we generate invoices for periods whose due date is within leadTimeDays from now.
  // Due date = last day of M−1 for month M.
  // So if leadTimeDays = 20 and today is March 11, we'd generate April's invoice
  // (due March 31, which is 20 days away).
  //
  // Simplified: generate invoices for any period where nextPeriodStart ≤ today + leadTimeDays + 31
  // (the +31 accounts for the worst case where due date is a full month before the period).
  // Actually, a simpler approach: find schedules where the due date for nextPeriodStart
  // is within leadTimeDays of today. Since due date ≈ end of previous month, and
  // nextPeriodStart is the 1st of the billing month:
  //   generateBefore = today + leadTimeDays days, shifted to the 1st of its month + 1 month
  //
  // Even simpler: just add leadTimeDays to today and use that as the cutoff for nextPeriodStart.
  // This works because:
  //   - nextPeriodStart is the 1st (or activation date) of the billing month
  //   - due date is ~1 month before that (end of previous month)
  //   - leadTimeDays adds buffer before the due date
  //   - So we want: dueDate − leadTimeDays ≤ today
  //   - dueDate ≈ nextPeriodStart − 1 day
  //   - So: nextPeriodStart − 1 − leadTimeDays ≤ today
  //   - So: nextPeriodStart ≤ today + leadTimeDays + 1
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + leadTimeDays + 1);

  const dueSchedules = await billingRepo.findDueSchedules(prisma, cutoff);

  let generated = 0;

  for (const schedule of dueSchedules) {
    // Generate invoices for all missed/due periods (backfill)
    let periodStart = new Date(schedule.nextPeriodStart);

    while (periodStart <= cutoff) {
      const isBackfilled =
        periodStart < firstOfMonth(now) &&
        schedule.lastGeneratedPeriod !== null;

      try {
        await generateInvoiceForPeriod(prisma, schedule, periodStart, {
          isBackfilled,
          leadTimeDays,
        });
        generated++;

        // Advance to next period
        const nextStart = periodStart.getDate() === 1
          ? firstOfNextMonth(periodStart)
          : firstOfNextMonth(periodStart); // after pro-rata, always go to 1st of next month

        await billingRepo.advanceSchedule(
          prisma,
          schedule.id,
          periodStart,
          nextStart,
        );

        periodStart = nextStart;
      } catch (err) {
        console.error(
          `[RECURRING-BILLING] Error generating invoice for schedule ${schedule.id}, period ${periodStart.toISOString()}:`,
          err,
        );
        break; // Don't keep retrying this schedule in this run
      }
    }
  }

  return generated;
}

// ─── Schedule Lifecycle ────────────────────────────────────────

/**
 * Stop a schedule and void any unissued DRAFT invoices.
 * Called when a lease is terminated.
 */
export async function stopScheduleForLease(
  prisma: PrismaClient,
  leaseId: string,
  reason: string,
): Promise<void> {
  const schedule = await billingRepo.findScheduleByLeaseId(prisma, leaseId);
  if (!schedule || schedule.status === "COMPLETED") return;

  // Complete the schedule
  await billingRepo.completeSchedule(prisma, schedule.id, reason);

  // Delete any DRAFT invoices linked to this schedule — they were never issued to the tenant
  await prisma.invoice.deleteMany({
    where: {
      billingScheduleId: schedule.id,
      status: "DRAFT",
    },
  });
}
