/**
 * RFP Repository
 *
 * Centralizes all Prisma access for the Rfp entity.
 * Owns the canonical include trees so that DTO mappers always receive
 * the correct shape. Services and workflows should use these functions
 * instead of ad-hoc prisma.rfp calls.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, Prisma, RfpStatus, RfpQuoteStatus, LegalObligation } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

/** Full include for single-RFP detail and list views. */
export const RFP_FULL_INCLUDE = {
  invites: {
    include: {
      contractor: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
  },
  quotes: {
    include: {
      contractor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { amountCents: "asc" as const },
  },
  building: {
    select: {
      id: true,
      name: true,
      address: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
    },
  },
  awardedContractor: {
    select: {
      id: true,
      name: true,
    },
  },
  request: {
    select: {
      id: true,
      requestNumber: true,
      description: true,
      category: true,
      status: true,
      urgency: true,
      createdAt: true,
      _count: {
        select: { attachments: true },
      },
      job: {
        select: { id: true },
      },
    },
  },
} as const;

// ─── Type derived from include ─────────────────────────────────

export type RfpWithRelations = Prisma.RfpGetPayload<{
  include: typeof RFP_FULL_INCLUDE;
}>;

// ─── Query Functions ───────────────────────────────────────────

export interface ListRfpOpts {
  limit: number;
  offset: number;
  status?: RfpStatus;
}

/**
 * List RFPs for an org with pagination and optional status filter.
 */
export async function findRfpsByOrg(
  prisma: PrismaClient,
  orgId: string,
  opts: ListRfpOpts,
): Promise<{ rows: RfpWithRelations[]; total: number }> {
  const where: Prisma.RfpWhereInput = { orgId };
  if (opts.status) where.status = opts.status;

  const [rows, total] = await Promise.all([
    prisma.rfp.findMany({
      where,
      include: RFP_FULL_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
    prisma.rfp.count({ where }),
  ]);

  return { rows: rows as RfpWithRelations[], total };
}

/**
 * Fetch a single RFP by ID, scoped to org.
 */
export async function findRfpById(
  prisma: PrismaClient,
  orgId: string,
  rfpId: string,
): Promise<RfpWithRelations | null> {
  return prisma.rfp.findFirst({
    where: { id: rfpId, orgId },
    include: RFP_FULL_INCLUDE,
  }) as Promise<RfpWithRelations | null>;
}

/**
 * Find an existing RFP for a request (idempotency check).
 */
export async function findRfpByRequestId(
  prisma: PrismaClient,
  orgId: string,
  requestId: string,
): Promise<RfpWithRelations | null> {
  return prisma.rfp.findFirst({
    where: { requestId, orgId },
    include: RFP_FULL_INCLUDE,
  }) as Promise<RfpWithRelations | null>;
}

export async function findRfpByCashflowGroup(
  prisma: PrismaClient,
  cashflowPlanId: string,
  cashflowGroupKey: string,
): Promise<RfpWithRelations | null> {
  return prisma.rfp.findFirst({
    where: { cashflowPlanId, cashflowGroupKey },
    include: RFP_FULL_INCLUDE,
  }) as Promise<RfpWithRelations | null>;
}

/**
 * Find RFPs visible to a specific contractor.
 * Visibility: status=OPEN AND category matches, OR contractor has an invite.
 * Org-scoped. Returns paginated results.
 */
export async function findRfpsForContractor(
  prisma: PrismaClient,
  orgId: string,
  contractorId: string,
  categories: string[],
  opts: ListRfpOpts,
): Promise<{ rows: RfpWithRelations[]; total: number }> {
  const where: Prisma.RfpWhereInput = {
    orgId,
    OR: [
      // Open RFPs matching the contractor's trade categories
      ...(categories.length > 0
        ? [{ status: "OPEN" as RfpStatus, category: { in: categories } }]
        : []),
      // RFPs where the contractor was explicitly invited (any status)
      { invites: { some: { contractorId } } },
      // RFPs where the contractor submitted a quote (any status — awarded/rejected visible)
      { quotes: { some: { contractorId } } },
    ],
  };
  if (opts.status) {
    where.AND = [{ status: opts.status }];
  }

  const [rows, total] = await Promise.all([
    prisma.rfp.findMany({
      where,
      include: RFP_FULL_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
    prisma.rfp.count({ where }),
  ]);

  return { rows: rows as RfpWithRelations[], total };
}

// ─── Quote Query Functions ─────────────────────────────────────

/**
 * Find an existing quote by a contractor for a specific RFP.
 * Used for idempotency / uniqueness checks before insertion.
 */
export async function findQuoteByContractorAndRfp(
  prisma: PrismaClient,
  rfpId: string,
  contractorId: string,
) {
  return prisma.rfpQuote.findUnique({
    where: { rfpId_contractorId: { rfpId, contractorId } },
  });
}

export interface CreateQuoteData {
  rfpId: string;
  contractorId: string;
  amountCents: number;
  currency: string;
  vatIncluded: boolean;
  estimatedDurationDays?: number | null;
  earliestAvailability?: Date | null;
  lineItems?: any;
  workPlan?: string | null;
  assumptions?: string | null;
  validUntil?: Date | null;
  notes?: string | null;
}

/**
 * Create a quote for an RFP. The @@unique constraint on
 * [rfpId, contractorId] enforces one-quote-per-contractor at the DB level.
 */
export async function createQuoteForRfp(
  prisma: PrismaClient,
  data: CreateQuoteData,
) {
  return prisma.rfpQuote.create({
    data: {
      rfpId: data.rfpId,
      contractorId: data.contractorId,
      amountCents: data.amountCents,
      currency: data.currency,
      vatIncluded: data.vatIncluded,
      estimatedDurationDays: data.estimatedDurationDays ?? null,
      earliestAvailability: data.earliestAvailability ?? null,
      lineItems: data.lineItems ?? undefined,
      workPlan: data.workPlan ?? null,
      assumptions: data.assumptions ?? null,
      validUntil: data.validUntil ?? null,
      notes: data.notes ?? null,
    },
    include: {
      contractor: { select: { id: true, name: true } },
    },
  });
}

// ─── RFP Write Functions ───────────────────────────────────────

export interface CreateRfpData {
  orgId: string;
  buildingId: string;
  unitId?: string | null;
  requestId?: string | null;
  cashflowPlanId?: string | null;
  cashflowGroupKey?: string | null;
  category: string;
  legalObligation: LegalObligation;
  status: RfpStatus;
  inviteCount: number;
  contractorIds: string[];
}

/**
 * Create an RFP with contractor invites in a single transaction.
 * Returns the full RFP with all relations loaded.
 */
export async function createRfpWithInvites(
  prisma: PrismaClient,
  data: CreateRfpData,
): Promise<RfpWithRelations> {
  const rfp = await prisma.$transaction(async (tx) => {
    const created = await tx.rfp.create({
      data: {
        orgId: data.orgId,
        buildingId: data.buildingId,
        unitId: data.unitId ?? null,
        requestId: data.requestId ?? null,
        cashflowPlanId: data.cashflowPlanId ?? null,
        cashflowGroupKey: data.cashflowGroupKey ?? null,
        category: data.category,
        legalObligation: data.legalObligation,
        status: data.status,
        inviteCount: data.inviteCount,
      },
    });

    if (data.contractorIds.length > 0) {
      await tx.rfpInvite.createMany({
        data: data.contractorIds.map((contractorId) => ({
          rfpId: created.id,
          contractorId,
          status: "INVITED" as const,
        })),
      });
    }

    return created;
  });

  // Reload with full includes
  const loaded = await prisma.rfp.findUnique({
    where: { id: rfp.id },
    include: RFP_FULL_INCLUDE,
  });

  return loaded as RfpWithRelations;
}

// ─── Award Functions ───────────────────────────────────────────

/**
 * Update an RFP for award: set status, awardedContractorId, awardedQuoteId.
 * Returns the updated RFP with full includes.
 */
export async function updateRfpForAward(
  prisma: PrismaClient,
  rfpId: string,
  data: {
    status: RfpStatus;
    awardedContractorId: string | null;
    awardedQuoteId: string | null;
  },
): Promise<RfpWithRelations> {
  await prisma.rfp.update({
    where: { id: rfpId },
    data: {
      status: data.status,
      awardedContractorId: data.awardedContractorId,
      awardedQuoteId: data.awardedQuoteId,
    },
  });

  const loaded = await prisma.rfp.findUnique({
    where: { id: rfpId },
    include: RFP_FULL_INCLUDE,
  });
  return loaded as RfpWithRelations;
}

/**
 * Update a single quote's status (e.g., SUBMITTED → AWARDED).
 */
export async function updateQuoteStatus(
  prisma: PrismaClient,
  quoteId: string,
  status: RfpQuoteStatus,
): Promise<void> {
  await prisma.rfpQuote.update({
    where: { id: quoteId },
    data: { status },
  });
}

/**
 * Reject all quotes on an RFP except the winning one.
 * Only rejects quotes that are currently SUBMITTED.
 */
export async function rejectOtherQuotes(
  prisma: PrismaClient,
  rfpId: string,
  winningQuoteId: string,
): Promise<number> {
  const result = await prisma.rfpQuote.updateMany({
    where: {
      rfpId,
      id: { not: winningQuoteId },
      status: RfpQuoteStatus.SUBMITTED,
    },
    data: { status: RfpQuoteStatus.REJECTED },
  });
  return result.count;
}

/**
 * Find a single quote by ID, scoped to an RFP.
 */
export async function findQuoteById(
  prisma: PrismaClient,
  quoteId: string,
  rfpId: string,
) {
  return prisma.rfpQuote.findFirst({
    where: { id: quoteId, rfpId },
    include: {
      contractor: { select: { id: true, name: true, email: true } },
    },
  });
}

// ─── Re-invite Functions ───────────────────────────────────────

/**
 * Add additional contractor invites to an existing RFP.
 * Skips contractors already invited (unique constraint: rfpId+contractorId).
 * Returns the count of newly created invites.
 */
export async function addInvitesToRfp(
  prisma: PrismaClient,
  rfpId: string,
  contractorIds: string[],
): Promise<{ addedCount: number }> {
  // Get existing invite contractor IDs to avoid duplicates
  const existing = await prisma.rfpInvite.findMany({
    where: { rfpId, contractorId: { in: contractorIds } },
    select: { contractorId: true },
  });
  const existingSet = new Set(existing.map((e) => e.contractorId));
  const newIds = contractorIds.filter((id) => !existingSet.has(id));

  if (newIds.length === 0) return { addedCount: 0 };

  await prisma.rfpInvite.createMany({
    data: newIds.map((contractorId) => ({
      rfpId,
      contractorId,
      status: "INVITED" as const,
    })),
  });

  // Update inviteCount on the RFP
  await prisma.rfp.update({
    where: { id: rfpId },
    data: {
      inviteCount: { increment: newIds.length },
    },
  });

  return { addedCount: newIds.length };
}

/**
 * Close an RFP for direct assignment (bypassing quote collection).
 * Rejects all submitted quotes and sets status to CLOSED.
 */
export async function closeRfpForDirectAssign(
  prisma: PrismaClient,
  rfpId: string,
): Promise<RfpWithRelations> {
  // Reject any submitted quotes
  await prisma.rfpQuote.updateMany({
    where: { rfpId, status: RfpQuoteStatus.SUBMITTED },
    data: { status: RfpQuoteStatus.REJECTED },
  });

  // Close the RFP
  await prisma.rfp.update({
    where: { id: rfpId },
    data: { status: RfpStatus.CLOSED },
  });

  const loaded = await prisma.rfp.findUnique({
    where: { id: rfpId },
    include: RFP_FULL_INCLUDE,
  });
  return loaded as RfpWithRelations;
}
