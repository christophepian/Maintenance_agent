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

/**
 * Arrears aging for a portfolio (all buildings in org).
 *
 * Returns OUTGOING rent invoices that are ISSUED (unpaid), grouped into
 * aging buckets based on how many days past their dueDate they are.
 * Invoices with no dueDate are treated as current.
 */
export interface ArrearsAgingDTO {
  currentCents: number;      // not yet due
  overdue1to30Cents: number;
  overdue31to60Cents: number;
  overdue61plusCents: number;
  totalOverdueCents: number;
}

export async function getArrearsAging(
  prisma: PrismaClient,
  orgId: string,
  today: Date = new Date(),
): Promise<ArrearsAgingDTO> {
  const invoices = await prisma.invoice.findMany({
    where: {
      orgId,
      direction: "OUTGOING",
      leaseId: { not: null },
      status: "ISSUED",
    },
    select: { totalAmount: true, dueDate: true },
  });

  let currentCents = 0;
  let overdue1to30Cents = 0;
  let overdue31to60Cents = 0;
  let overdue61plusCents = 0;

  const todayMs = today.getTime();
  for (const inv of invoices) {
    const amount = inv.totalAmount ?? 0;
    if (!inv.dueDate) {
      currentCents += amount;
      continue;
    }
    const daysOverdue = Math.floor((todayMs - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue <= 0) currentCents += amount;
    else if (daysOverdue <= 30) overdue1to30Cents += amount;
    else if (daysOverdue <= 60) overdue31to60Cents += amount;
    else overdue61plusCents += amount;
  }

  return {
    currentCents,
    overdue1to30Cents,
    overdue31to60Cents,
    overdue61plusCents,
    totalOverdueCents: overdue1to30Cents + overdue31to60Cents + overdue61plusCents,
  };
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
