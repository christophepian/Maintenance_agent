/**
 * Ledger Entry Repository
 *
 * Canonical Prisma access for LedgerEntry queries used by ledgerService.ts.
 * G9: All ledger reads/aggregates go through this file.
 */

import { PrismaClient } from "@prisma/client";

/** Return all sourceId values posted with a given sourceType for an org. */
export async function findLedgerSourceIds(
  prisma: PrismaClient,
  orgId: string,
  sourceType: string,
): Promise<string[]> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { orgId, sourceType },
    select: { sourceId: true },
  });
  return rows.map((e) => e.sourceId).filter(Boolean) as string[];
}

/** Paginated ledger entries with total count. */
export async function findLedgerEntriesWithCount(
  prisma: PrismaClient,
  where: any,
  limit: number,
  offset: number,
) {
  return Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      include: { account: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.ledgerEntry.count({ where }),
  ]);
}

/** Aggregate debit/credit sums for a balance query. */
export async function aggregateLedgerBalance(prisma: PrismaClient, where: any) {
  return prisma.ledgerEntry.aggregate({
    where,
    _sum: { debitCents: true, creditCents: true },
  });
}

/**
 * Delete all ledger entries posted for a set of source invoices with the given
 * sourceTypes — used to reverse the accrual postings of onboarded invoices that
 * should be reference-only (imported-statement years are the source of truth).
 * Returns the number of entries removed.
 */
export async function deleteLedgerEntriesBySource(
  prisma: PrismaClient,
  orgId: string,
  sourceIds: string[],
  sourceTypes: string[],
): Promise<number> {
  if (sourceIds.length === 0) return 0;
  const result = await prisma.ledgerEntry.deleteMany({
    where: { orgId, sourceId: { in: sourceIds }, sourceType: { in: sourceTypes } },
  });
  return result.count;
}
