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
