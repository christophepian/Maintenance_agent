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

  /* ── Type-specific handlers (add below) ─────────────────── */

  // Example: auto-create job when request is approved
  // on("OWNER_APPROVED", async (event) => {
  //   await autoCreateJobIfNeeded(prisma, event.orgId, event.payload.requestId);
  // });

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
