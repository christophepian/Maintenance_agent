/**
 * Financials Repository
 *
 * Centralizes ledger + financial aggregation queries for financials.ts service.
 * Extracts complex multi-model queries from private helpers into testable repo functions.
 */

import { PrismaClient } from "@prisma/client";

/** Row shape returned from expense ledger queries. */
export interface ExpenseLedgerRow {
  debitCents: number;
  sourceId: string | null;
  accountId: string;
  account: { name: string; code: string | null };
}

/** End-of-day UTC helper (mirrors financials.ts). */
function endOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

/** Find all INVOICE_ISSUED expense debit ledger entries for a building in a period. */
export async function findExpenseLedgerEntries(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
): Promise<ExpenseLedgerRow[]> {
  const rows = await prisma.ledgerEntry.findMany({
    where: {
      orgId,
      buildingId,
      sourceType: "INVOICE_ISSUED",
      date: { gte: from, lte: endOfDayUTC(to) },
      debitCents: { gt: 0 },
      account: { accountType: "EXPENSE" },
    },
    select: {
      debitCents: true,
      sourceId: true,
      accountId: true,
      account: { select: { name: true, code: true } },
    },
  });
  return rows as ExpenseLedgerRow[];
}

/**
 * Collection rate helpers — invoice-based, scoped to billing period.
 *
 * Using billing period (not payment date) prevents backlog catch-up payments
 * from inflating the rate above 100 %.
 *
 * Returns totals in cents (Invoice.totalAmount stores cents).
 */
export async function aggregateInvoicedRentForPeriod(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const agg = await prisma.invoice.aggregate({
    where: {
      orgId,
      direction: "OUTGOING",
      leaseId: { not: null },
      billingPeriodStart: { gte: from, lte: endOfDayUTC(to) },
      status: { not: "DRAFT" }, // exclude invoices that were never issued
      lease: { unit: { buildingId } },
    },
    _sum: { totalAmount: true },
  });
  return agg._sum.totalAmount ?? 0;
}

export async function aggregatePaidRentForPeriod(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const agg = await prisma.invoice.aggregate({
    where: {
      orgId,
      direction: "OUTGOING",
      leaseId: { not: null },
      billingPeriodStart: { gte: from, lte: endOfDayUTC(to) },
      status: "PAID",
      lease: { unit: { buildingId } },
    },
    _sum: { totalAmount: true },
  });
  return agg._sum.totalAmount ?? 0;
}

/** Sum of rent payments received (bank debit on INVOICE_PAID) for a building in a period. */
export async function aggregateLedgerIncome(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const agg = await prisma.ledgerEntry.aggregate({
    where: {
      orgId,
      buildingId,
      sourceType: "INVOICE_PAID",
      date: { gte: from, lte: endOfDayUTC(to) },
      debitCents: { gt: 0 },
      account: { code: "1020" },
    },
    _sum: { debitCents: true },
  });
  return agg._sum.debitCents ?? 0;
}
