/**
 * Fiscal Period Close Repository (accounting bridge WS-E)
 *
 * Persistence for year-end closing journals + the P&L balance aggregation the
 * close service needs. Keeps all Prisma access out of the service layer (G20).
 */

import { PrismaClient } from "@prisma/client";

/** One REVENUE/EXPENSE account's net movement over the close window. */
export interface PnlAccountBalance {
  accountId: string;
  code: string | null;
  accountType: string; // "REVENUE" | "EXPENSE"
  debitCents: number;
  creditCents: number;
}

/**
 * Sum debit/credit per REVENUE and EXPENSE account for a building in
 * [from, to]. These are the P&L balances the year-end close zeroes into equity.
 */
export async function aggregatePnlBalances(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
): Promise<PnlAccountBalance[]> {
  const groups = await prisma.ledgerEntry.groupBy({
    by: ["accountId"],
    where: {
      orgId,
      buildingId,
      date: { gte: from, lte: to },
      account: { accountType: { in: ["REVENUE", "EXPENSE"] } },
      // Exclude prior close/reversal postings so the operating result is stable
      // across reopen→re-close cycles. (OR-null keeps null-sourceType P&L rows.)
      OR: [
        { sourceType: null },
        { sourceType: { notIn: ["YEAR_END_CLOSE", "YEAR_END_CLOSE_REVERSAL"] } },
      ],
    },
    _sum: { debitCents: true, creditCents: true },
  });
  if (groups.length === 0) return [];

  const accounts = await prisma.account.findMany({
    where: { id: { in: groups.map((g) => g.accountId) } },
    select: { id: true, code: true, accountType: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  return groups.map((g) => {
    const a = byId.get(g.accountId);
    return {
      accountId: g.accountId,
      code: a?.code ?? null,
      accountType: a?.accountType ?? "",
      debitCents: g._sum.debitCents ?? 0,
      creditCents: g._sum.creditCents ?? 0,
    };
  });
}

/** All ledger legs of one journal (used to build a reversing entry). */
export async function findEntriesByJournal(
  prisma: PrismaClient,
  orgId: string,
  journalId: string,
) {
  return prisma.ledgerEntry.findMany({
    where: { orgId, journalId },
    select: { accountId: true, debitCents: true, creditCents: true, buildingId: true },
  });
}

export async function findClose(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  fiscalYear: number,
) {
  return prisma.fiscalPeriodClose.findUnique({
    where: { orgId_buildingId_fiscalYear: { orgId, buildingId, fiscalYear } },
  });
}

export async function listCloses(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string,
) {
  return prisma.fiscalPeriodClose.findMany({
    where: { orgId, ...(buildingId ? { buildingId } : {}) },
    orderBy: [{ buildingId: "asc" }, { fiscalYear: "desc" }],
  });
}

export async function createClose(
  prisma: PrismaClient,
  data: {
    orgId: string;
    buildingId: string;
    fiscalYear: number;
    periodStart: Date;
    periodEnd: Date;
    closingJournalId: string;
    retainedEarningsCents: number;
    closedBy: string | null;
  },
) {
  return prisma.fiscalPeriodClose.create({ data });
}

export async function updateClose(
  prisma: PrismaClient,
  id: string,
  data: {
    status?: string;
    closingJournalId?: string;
    reversalJournalId?: string | null;
    retainedEarningsCents?: number;
    reversedAt?: Date | null;
    reversedBy?: string | null;
    closedBy?: string | null;
    periodStart?: Date;
    periodEnd?: Date;
  },
) {
  return prisma.fiscalPeriodClose.update({ where: { id }, data });
}
