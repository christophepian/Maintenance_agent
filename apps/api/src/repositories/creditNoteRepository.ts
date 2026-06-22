/**
 * creditNoteRepository
 *
 * Canonical Prisma access for CreditNote (avoir / note de crédit) — the refund
 * document for charge-reconciliation overpayments. Org-scoped.
 */

import { PrismaClient, Prisma } from "@prisma/client";

export const CREDIT_NOTE_INCLUDE = {
  lineItems: { orderBy: { createdAt: "asc" } },
  lease: { select: { id: true, tenantName: true, unitId: true } },
  issuer: { select: { id: true, name: true } },
} as const satisfies Prisma.CreditNoteInclude;

export async function listCreditNotes(prisma: PrismaClient, orgId: string, leaseId?: string) {
  return prisma.creditNote.findMany({
    where: { orgId, ...(leaseId ? { leaseId } : {}) },
    include: CREDIT_NOTE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function findCreditNoteById(prisma: PrismaClient, id: string, orgId: string) {
  return prisma.creditNote.findFirst({ where: { id, orgId }, include: CREDIT_NOTE_INCLUDE });
}
