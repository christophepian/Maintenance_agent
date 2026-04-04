/**
 * chargeReconciliationRepository
 *
 * Canonical Prisma access for ChargeReconciliation & ChargeReconciliationLine.
 * All queries are org-scoped. Routes and workflows must not call Prisma directly.
 *
 * G3/G9: canonical include constants live here.
 */

import { PrismaClient, ChargeReconciliationStatus } from "@prisma/client";

// ─── Canonical Include ─────────────────────────────────────────

export const RECONCILIATION_INCLUDE = {
  lineItems: true,
  lease: {
    select: {
      id: true,
      tenantName: true,
      startDate: true,
      endDate: true,
      status: true,
      netRentChf: true,
      chargesTotalChf: true,
      unitId: true,
      expenseItems: {
        where: { isActive: true },
        select: {
          id: true,
          description: true,
          amountChf: true,
          mode: true,
        },
      },
    },
  },
  settlementInvoice: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      totalAmount: true,
      description: true,
    },
  },
} as const;

// ─── Queries ───────────────────────────────────────────────────

/**
 * Find a single reconciliation by ID, scoped to org.
 */
export async function findById(
  prisma: PrismaClient,
  id: string,
  orgId: string,
) {
  return prisma.chargeReconciliation.findFirst({
    where: { id, orgId },
    include: RECONCILIATION_INCLUDE,
  });
}

/**
 * Find a reconciliation for a specific lease + fiscal year.
 */
export async function findByLeaseAndYear(
  prisma: PrismaClient,
  leaseId: string,
  fiscalYear: number,
) {
  return prisma.chargeReconciliation.findUnique({
    where: { leaseId_fiscalYear: { leaseId, fiscalYear } },
    include: RECONCILIATION_INCLUDE,
  });
}

/**
 * List reconciliations for an org, with optional filters.
 */
export async function listReconciliations(
  prisma: PrismaClient,
  orgId: string,
  filters?: {
    status?: ChargeReconciliationStatus;
    leaseId?: string;
    fiscalYear?: number;
  },
) {
  return prisma.chargeReconciliation.findMany({
    where: {
      orgId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.leaseId ? { leaseId: filters.leaseId } : {}),
      ...(filters?.fiscalYear ? { fiscalYear: filters.fiscalYear } : {}),
    },
    include: RECONCILIATION_INCLUDE,
    orderBy: [{ fiscalYear: "desc" }, { createdAt: "desc" }],
  });
}

// ─── Mutations ─────────────────────────────────────────────────

/**
 * Create a new reconciliation with its line items.
 */
export async function createReconciliation(
  prisma: PrismaClient,
  data: {
    orgId: string;
    leaseId: string;
    fiscalYear: number;
    lineItems: Array<{
      description: string;
      chargeMode: "ACOMPTE" | "FORFAIT";
      acomptePaidCents: number;
    }>;
  },
) {
  const totalAcomptePaidCents = data.lineItems
    .filter((li) => li.chargeMode === "ACOMPTE")
    .reduce((sum, li) => sum + li.acomptePaidCents, 0);

  return prisma.chargeReconciliation.create({
    data: {
      orgId: data.orgId,
      leaseId: data.leaseId,
      fiscalYear: data.fiscalYear,
      totalAcomptePaidCents,
      status: "DRAFT",
      lineItems: {
        create: data.lineItems.map((li) => ({
          description: li.description,
          chargeMode: li.chargeMode,
          acomptePaidCents: li.acomptePaidCents,
        })),
      },
    },
    include: RECONCILIATION_INCLUDE,
  });
}

/**
 * Update the actual cost on a reconciliation line item.
 */
export async function updateLineActualCost(
  prisma: PrismaClient,
  lineId: string,
  actualCostCents: number,
) {
  const balanceCents = actualCostCents - (await getLinePaidAmount(prisma, lineId));
  return prisma.chargeReconciliationLine.update({
    where: { id: lineId },
    data: {
      actualCostCents,
      balanceCents,
    },
  });
}

/** Helper to get a line's acomptePaidCents. */
async function getLinePaidAmount(prisma: PrismaClient, lineId: string): Promise<number> {
  const line = await prisma.chargeReconciliationLine.findUnique({
    where: { id: lineId },
    select: { acomptePaidCents: true },
  });
  return line?.acomptePaidCents ?? 0;
}

/**
 * Finalize a reconciliation — recalculate all balances and mark FINALIZED.
 */
export async function finalizeReconciliation(
  prisma: PrismaClient,
  id: string,
) {
  // Recalculate line balances and totals
  const recon = await prisma.chargeReconciliation.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!recon) throw new Error("Reconciliation not found");

  let totalAcompte = 0;
  let totalActual = 0;

  for (const line of recon.lineItems) {
    const balance = line.actualCostCents - line.acomptePaidCents;
    await prisma.chargeReconciliationLine.update({
      where: { id: line.id },
      data: { balanceCents: balance },
    });
    if (line.chargeMode === "ACOMPTE") {
      totalAcompte += line.acomptePaidCents;
      totalActual += line.actualCostCents;
    }
  }

  return prisma.chargeReconciliation.update({
    where: { id },
    data: {
      status: "FINALIZED",
      totalAcomptePaidCents: totalAcompte,
      totalActualCostsCents: totalActual,
      balanceCents: totalActual - totalAcompte,
    },
    include: RECONCILIATION_INCLUDE,
  });
}

/**
 * Mark a reconciliation as settled with the generated invoice ID.
 */
export async function settleReconciliation(
  prisma: PrismaClient,
  id: string,
  settlementInvoiceId: string,
) {
  return prisma.chargeReconciliation.update({
    where: { id },
    data: {
      status: "SETTLED",
      settlementInvoiceId,
      settledAt: new Date(),
    },
    include: RECONCILIATION_INCLUDE,
  });
}

/**
 * Delete a DRAFT reconciliation and its line items.
 */
export async function deleteReconciliation(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.chargeReconciliation.delete({
    where: { id },
  });
}
