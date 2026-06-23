/**
 * Audit Log Repository
 *
 * Canonical Prisma access for the append-only AuditLog table.
 */
import { PrismaClient, Prisma } from "@prisma/client";

export interface AuditLogInput {
  orgId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function createAuditLog(prisma: PrismaClient, data: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      orgId: data.orgId ?? null,
      actorUserId: data.actorUserId ?? null,
      action: data.action,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      ip: data.ip ?? null,
      ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
    },
  });
}

export async function listAuditLogs(
  prisma: PrismaClient,
  filter: { orgId?: string; action?: string; entityType?: string; entityId?: string; limit?: number },
) {
  return prisma.auditLog.findMany({
    where: {
      ...(filter.orgId ? { orgId: filter.orgId } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.entityType ? { entityType: filter.entityType } : {}),
      ...(filter.entityId ? { entityId: filter.entityId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: filter.limit ?? 100,
  });
}
