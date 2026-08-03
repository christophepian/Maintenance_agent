/**
 * statementDocRequestRepository
 *
 * Canonical Prisma access for StatementDocRequest (tenant document-inspection
 * requests against a charge statement). Org-scoped.
 */

import { PrismaClient } from "@prisma/client";

export async function createDocRequest(
  prisma: PrismaClient,
  data: { orgId: string; reconciliationId: string; note?: string | null },
) {
  return prisma.statementDocRequest.create({
    data: { orgId: data.orgId, reconciliationId: data.reconciliationId, note: data.note ?? null },
  });
}

export async function listByReconciliation(prisma: PrismaClient, orgId: string, reconciliationId: string) {
  return prisma.statementDocRequest.findMany({
    where: { orgId, reconciliationId },
    orderBy: { requestedAt: "desc" },
  });
}

export async function findDocRequestById(prisma: PrismaClient, id: string, orgId: string) {
  return prisma.statementDocRequest.findFirst({ where: { id, orgId } });
}

export async function markFulfilled(prisma: PrismaClient, id: string) {
  return prisma.statementDocRequest.update({
    where: { id },
    data: { status: "FULFILLED", fulfilledAt: new Date() },
  });
}
