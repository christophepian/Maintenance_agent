/**
 * Domain event handlers — registered at server startup.
 *
 * The audit/persist handler runs as a wildcard listener (first) so
 * every event is durably stored in the `Event` table.
 *
 * Additional type-specific handlers can be added below to trigger
 * side effects (notifications, job auto-creation, etc.) without
 * coupling route handlers to those concerns.
 */

import { PrismaClient } from "@prisma/client";
import { onAll, on } from "./bus";
import { DomainEvent } from "./types";
import { createNotification } from "../services/notifications";
import {
  createScheduleForLease,
  generateInvoiceForPeriod,
  stopScheduleForLease,
} from "../services/recurringBillingService";
import {
  findScheduleByLeaseId,
  advanceSchedule,
} from "../repositories/recurringBillingRepository";

// SA-20: Redact sensitive fields from event log output
function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE = ['token', 'password', 'secret', 'email', 'tenantId', 'iban', 'accountNumber'];
  return Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [
      k,
      SENSITIVE.some(s => k.toLowerCase().includes(s)) ? '[REDACTED]' : v
    ])
  );
}

/**
 * Register all event handlers.  Called once from `server.ts` at boot.
 */
export function registerEventHandlers(prisma: PrismaClient): void {
  /* ── Audit persist (wildcard — runs first for every event) ── */
  onAll(async (event: DomainEvent) => {
    try {
      await (prisma as any).event.create({
        data: {
          orgId: event.orgId,
          type: event.type,
          actorUserId: event.actorUserId || null,
          requestId: extractRequestId(event),
          payload: JSON.stringify(event.payload),
        },
      });
    } catch (err) {
      // Never let audit failure crash the request
      console.error("[EVENT PERSIST]", event.type, err);
    }
  });

  /* ── Type-specific handlers ─────────────────────────────── */

  /* Notify tenant when their repair job is marked complete */
  on("JOB_COMPLETED", async (event) => {
    try {
      const job = await prisma.job.findUnique({
        where: { id: event.payload.jobId },
        include: { request: { include: { tenant: true } } },
      });
      if (!job?.request?.tenant) return;

      await createNotification({
        orgId: event.orgId,
        userId: job.request.tenant.id,
        entityType: "JOB",
        entityId: job.id,
        eventType: "JOB_COMPLETED",
        message: "The contractor has marked the job as complete.",
      });
    } catch (err) {
      console.error("[EVENT HANDLER] JOB_COMPLETED notification failed", err);
    }
  });

  /* Notify tenant when an invoice is issued for their repair */
  on("INVOICE_ISSUED", async (event) => {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: event.payload.invoiceId },
        include: { job: { include: { request: { include: { tenant: true } } } } },
      });
      if (!invoice?.job?.request?.tenant) return;

      // NotificationEventType enum uses INVOICE_CREATED (no INVOICE_ISSUED value)
      await createNotification({
        orgId: event.orgId,
        userId: invoice.job.request.tenant.id,
        entityType: "INVOICE",
        entityId: invoice.id,
        eventType: "INVOICE_CREATED",
        message: "A new invoice has been issued for your repair request.",
      });
    } catch (err) {
      console.error("[EVENT HANDLER] INVOICE_ISSUED notification failed", err);
    }
  });

  /* ── Recurring billing: auto-create / stop billing schedule on lease lifecycle ── */
  on("LEASE_STATUS_CHANGED", async (event) => {
    const { leaseId, toStatus } = event.payload;

    // ── Lease activated → create billing schedule + first invoice ──
    if (toStatus === "ACTIVE") {
      try {
        // Check if a schedule already exists (idempotency — e.g. event replayed)
        const existingSchedule = await findScheduleByLeaseId(prisma, leaseId);
        if (existingSchedule) {
          console.log(
            `[BILLING] Schedule already exists for lease ${leaseId}, skipping creation`,
          );
          return;
        }

        // Fetch lease with expense items to compute charges
        const lease = await prisma.lease.findUnique({
          where: { id: leaseId },
          include: {
            expenseItems: { where: { isActive: true } },
          },
        });
        if (!lease) {
          console.error(`[BILLING] Lease ${leaseId} not found after activation`);
          return;
        }

        const activationDate = lease.activatedAt ?? new Date();

        // If this unit already has another lease with an active billing schedule,
        // stop the old one (lease replacement scenario — e.g. rent increase via new lease)
        if (lease.unitId) {
          const otherActiveLeases = await prisma.lease.findMany({
            where: {
              unitId: lease.unitId,
              id: { not: leaseId },
              billingSchedule: { status: { in: ["ACTIVE", "PAUSED"] } },
            },
            select: { id: true },
          });
          for (const oldLease of otherActiveLeases) {
            await stopScheduleForLease(prisma, oldLease.id, "REPLACED_BY_NEW_LEASE");
            console.log(
              `[BILLING] Stopped old schedule for lease ${oldLease.id} ` +
                `(replaced by ${leaseId} on unit ${lease.unitId})`,
            );
          }
        }

        const totalChargesChf = lease.expenseItems.reduce(
          (sum, item) => sum + (item.amountChf ?? 0),
          0,
        );

        // 1. Create the schedule
        const schedule = await createScheduleForLease(prisma, {
          orgId: event.orgId,
          leaseId,
          activationDate,
          netRentChf: lease.netRentChf ?? 0,
          totalChargesChf,
        });

        console.log(
          `[BILLING] Created schedule ${schedule.id} for lease ${leaseId} ` +
            `(rent=${lease.netRentChf} CHF, charges=${totalChargesChf} CHF, ` +
            `first period=${schedule.nextPeriodStart.toISOString()})`,
        );

        // 2. Generate the first invoice immediately
        //    Re-fetch the schedule with the full include (lease + expenseItems)
        const fullSchedule = await findScheduleByLeaseId(prisma, leaseId);
        if (fullSchedule) {
          try {
            const result = await generateInvoiceForPeriod(
              prisma,
              fullSchedule,
              new Date(fullSchedule.nextPeriodStart),
              { isBackfilled: false },
            );

            // Advance the schedule to the next period
            const nextStart = new Date(
              fullSchedule.nextPeriodStart.getFullYear(),
              fullSchedule.nextPeriodStart.getMonth() + 1,
              1,
            );

            await advanceSchedule(
              prisma,
              fullSchedule.id,
              fullSchedule.nextPeriodStart,
              nextStart,
            );

            console.log(
              `[BILLING] Generated first invoice ${result.invoiceId} for lease ${leaseId} ` +
                `(amount=${result.totalAmountCents} cents, pro-rata=${result.isProRata})`,
            );
          } catch (err) {
            console.error(
              `[BILLING] Failed to generate first invoice for lease ${leaseId}:`,
              err,
            );
          }
        }
      } catch (err) {
        console.error(
          `[BILLING] Failed to create billing schedule for lease ${leaseId}:`,
          err,
        );
      }
    }

    // ── Lease terminated → stop billing schedule ──────────────
    if (toStatus === "TERMINATED") {
      try {
        await stopScheduleForLease(prisma, leaseId, "LEASE_TERMINATED");
        console.log(`[BILLING] Stopped schedule for terminated lease ${leaseId}`);
      } catch (err) {
        console.error(
          `[BILLING] Failed to stop schedule for lease ${leaseId}:`,
          err,
        );
      }
    }
  });

  console.log("[EVENT BUS] Handlers registered");
}

/* ── Helpers ────────────────────────────────────────────────── */

/**
 * Extract a requestId from the event payload if present.
 * This allows the audit Event record to reference the request.
 */
function extractRequestId(event: DomainEvent): string | null {
  const payload = event.payload as any;
  return payload?.requestId ?? null;
}
