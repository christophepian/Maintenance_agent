/**
 * Audit logging service (DSG/GDPR pre-GA requirement — CRITICAL_AUDIT_2026-06-23).
 *
 * Fire-and-forget structured audit trail for auth-sensitive and data-mutating
 * actions. Writes are best-effort: a logging failure must NEVER break the action
 * being audited, so every write is wrapped and swallowed (with a console.error).
 *
 * Usage (from a workflow/service that already has the prisma client):
 *   await writeAuditLog(prisma, { action: "STATEMENT_APPROVED", orgId, actorUserId, entityType: "ImportedStatement", entityId });
 */
import { PrismaClient } from "@prisma/client";
import { createAuditLog, AuditLogInput } from "../repositories/auditLogRepository";

export async function writeAuditLog(
  prisma: PrismaClient,
  entry: AuditLogInput,
): Promise<void> {
  try {
    await createAuditLog(prisma, entry);
  } catch (err) {
    // Never let an audit-write failure break the audited operation.
    console.error(`[AUDIT] failed to write audit log for action="${entry.action}":`, err);
  }
}
