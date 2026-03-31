/**
 * Ledger Service
 *
 * Double-entry journal for property financial tracking.
 * Each economic event produces two LedgerEntry rows sharing the same journalId —
 * a debit leg and a credit leg — following standard Swiss Liegenschaftsbuchhaltung:
 *
 *   Invoice issued (cost):   Dr. Expense account    Cr. Kreditoren (2000)
 *   Invoice paid (cost):     Dr. Kreditoren (2000)  Cr. Bankkonto (1020)
 *   Invoice issued (rent):   Dr. Mietzinsdebitoren (1100)  Cr. Mieteinnahmen (3200)
 *   Invoice paid (rent):     Dr. Bankkonto (1020)   Cr. Mietzinsdebitoren (1100)
 *
 * All amounts are stored in CHF cents (integers) to avoid floating-point rounding.
 *
 * Posting is best-effort: if the org has not yet seeded the Swiss COA, the
 * required accounts won't exist and the posting is silently skipped (logged).
 *
 * Layer: service (calls Prisma directly — no cross-service imports to avoid cycles).
 */

import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import type { InvoiceDTO } from "./invoices";

/* ── Types ─────────────────────────────────────────────────────── */

export interface LedgerEntryDTO {
  id: string;
  orgId: string;
  date: string;          // ISO date
  accountId: string;
  accountCode: string | null;
  accountName: string;
  accountType: string;
  debitCents: number;
  creditCents: number;
  description: string;
  reference: string | null;
  sourceType: string | null;
  sourceId: string | null;
  journalId: string;
  buildingId: string | null;
  unitId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface JournalLeg {
  accountId: string;
  debitCents: number;
  creditCents: number;
  description: string;
  reference?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  buildingId?: string | null;
  unitId?: string | null;
  createdBy?: string | null;
  date?: Date;
}

/* ── Internal helpers ───────────────────────────────────────────── */

/**
 * Resolve unit and building attribution for an invoice.
 * For cost invoices: derives from job → request → unit.
 * For rent invoices (leaseId set): derives from lease → unit.
 * Returns partial attribution; caller merges with invoice fields.
 */
async function resolveInvoiceAttribution(
  prisma: PrismaClient,
  invoice: InvoiceDTO,
): Promise<{ unitId: string | null; buildingId: string | null }> {
  // If already populated (e.g. enriched externally), use it
  if (invoice.unitId || invoice.buildingId) {
    return { unitId: invoice.unitId ?? null, buildingId: invoice.buildingId ?? null };
  }

  if (invoice.leaseId) {
    // Rent invoice: resolve from lease → unit → building
    try {
      const lease = await prisma.lease.findUnique({
        where: { id: invoice.leaseId },
        select: { unitId: true, unit: { select: { buildingId: true } } },
      });
      return {
        unitId: lease?.unitId ?? null,
        buildingId: lease?.unit?.buildingId ?? null,
      };
    } catch { return { unitId: null, buildingId: null }; }
  }

  // Cost invoice: resolve from job → request → unit → building
  try {
    const job = await prisma.job.findUnique({
      where: { id: invoice.jobId },
      select: { request: { select: { unitId: true, unit: { select: { buildingId: true } } } } },
    });
    const req = (job?.request as any);
    return {
      unitId: req?.unitId ?? null,
      buildingId: req?.unit?.buildingId ?? null,
    };
  } catch { return { unitId: null, buildingId: null }; }
}

async function findAccountByCode(
  prisma: PrismaClient,
  orgId: string,
  code: string,
) {
  return prisma.account.findFirst({
    where: { orgId, code, isActive: true },
  });
}

function toCents(chf: number): number {
  return Math.round(chf * 100);
}

/* ── Core: post journal entries ─────────────────────────────────── */

/**
 * Write a balanced journal posting (two or more legs sharing a journalId).
 * Returns the created entries, or null if the transaction fails.
 */
export async function postJournalEntries(
  prisma: PrismaClient,
  orgId: string,
  legs: JournalLeg[],
): Promise<LedgerEntryDTO[]> {
  const journalId = uuidv4();
  const defaultDate = new Date();

  const created = await prisma.$transaction(
    legs.map((leg) =>
      prisma.ledgerEntry.create({
        data: {
          orgId,
          date: leg.date ?? defaultDate,
          accountId: leg.accountId,
          debitCents: leg.debitCents,
          creditCents: leg.creditCents,
          description: leg.description,
          reference: leg.reference ?? null,
          sourceType: leg.sourceType ?? null,
          sourceId: leg.sourceId ?? null,
          journalId,
          buildingId: leg.buildingId ?? null,
          unitId: leg.unitId ?? null,
          createdBy: leg.createdBy ?? null,
        },
        include: { account: true },
      }),
    ),
  );

  return created.map(mapEntryToDTO);
}

/* ── Auto-posting: invoice issued ───────────────────────────────── */

/**
 * Post the accrual entry when an invoice is issued.
 * - Rent invoice (leaseId set): Dr. Mietzinsdebitoren (1100), Cr. Mieteinnahmen (3200)
 * - Cost invoice:               Dr. Expense account,           Cr. Kreditoren (2000)
 *
 * Returns null silently if the required accounts haven't been seeded yet.
 */
export async function postInvoiceIssued(
  prisma: PrismaClient,
  orgId: string,
  invoice: InvoiceDTO,
): Promise<LedgerEntryDTO[] | null> {
  const amountCents = toCents(invoice.totalAmount);
  const ref = invoice.invoiceNumber || invoice.id;
  const date = invoice.issueDate ? new Date(invoice.issueDate) : new Date();
  const attribution = await resolveInvoiceAttribution(prisma, invoice);
  const shared = { sourceType: "INVOICE_ISSUED", sourceId: invoice.id, reference: ref, date, ...attribution };

  if (invoice.leaseId) {
    // Rent invoice
    const [debtorAcc, revenueAcc] = await Promise.all([
      findAccountByCode(prisma, orgId, "1100"),
      findAccountByCode(prisma, orgId, "3200"),
    ]);
    if (!debtorAcc || !revenueAcc) {
      console.warn(`[LEDGER] Skipping INVOICE_ISSUED posting for ${invoice.id} — accounts 1100/3200 not seeded`);
      return null;
    }
    return postJournalEntries(prisma, orgId, [
      { ...shared, accountId: debtorAcc.id,  debitCents: amountCents, creditCents: 0, description: `Mietzinsforderung ${ref}` },
      { ...shared, accountId: revenueAcc.id, debitCents: 0, creditCents: amountCents, description: `Mieteinnahmen ${ref}` },
    ]);
  }

  // Cost invoice — use assigned account or fall back to 4200
  const expenseAcc = invoice.accountId
    ? await prisma.account.findFirst({ where: { id: invoice.accountId, orgId } })
    : await findAccountByCode(prisma, orgId, "4200");
  const payableAcc = await findAccountByCode(prisma, orgId, "2000");

  if (!expenseAcc || !payableAcc) {
    console.warn(`[LEDGER] Skipping INVOICE_ISSUED posting for ${invoice.id} — expense/payable accounts not seeded`);
    return null;
  }
  return postJournalEntries(prisma, orgId, [
    { ...shared, accountId: expenseAcc.id, debitCents: amountCents, creditCents: 0, description: `Aufwand ${ref}` },
    { ...shared, accountId: payableAcc.id, debitCents: 0, creditCents: amountCents, description: `Kreditor ${ref}` },
  ]);
}

/* ── Auto-posting: invoice paid ─────────────────────────────────── */

/**
 * Post the cash settlement entry when an invoice is marked paid.
 * - Rent invoice: Dr. Bankkonto (1020), Cr. Mietzinsdebitoren (1100)
 * - Cost invoice: Dr. Kreditoren (2000), Cr. Bankkonto (1020)
 */
export async function postInvoicePaid(
  prisma: PrismaClient,
  orgId: string,
  invoice: InvoiceDTO,
): Promise<LedgerEntryDTO[] | null> {
  const amountCents = toCents(invoice.totalAmount);
  const ref = invoice.invoiceNumber || invoice.id;
  const date = invoice.paidAt ? new Date(invoice.paidAt) : new Date();
  const attribution = await resolveInvoiceAttribution(prisma, invoice);
  const shared = { sourceType: "INVOICE_PAID", sourceId: invoice.id, reference: ref, date, ...attribution };

  if (invoice.leaseId) {
    const [bankAcc, debtorAcc] = await Promise.all([
      findAccountByCode(prisma, orgId, "1020"),
      findAccountByCode(prisma, orgId, "1100"),
    ]);
    if (!bankAcc || !debtorAcc) {
      console.warn(`[LEDGER] Skipping INVOICE_PAID posting for ${invoice.id} — accounts 1020/1100 not seeded`);
      return null;
    }
    return postJournalEntries(prisma, orgId, [
      { ...shared, accountId: bankAcc.id,   debitCents: amountCents, creditCents: 0, description: `Mieteingang ${ref}` },
      { ...shared, accountId: debtorAcc.id, debitCents: 0, creditCents: amountCents, description: `Forderung ausgeglichen ${ref}` },
    ]);
  }

  const [payableAcc, bankAcc] = await Promise.all([
    findAccountByCode(prisma, orgId, "2000"),
    findAccountByCode(prisma, orgId, "1020"),
  ]);
  if (!payableAcc || !bankAcc) {
    console.warn(`[LEDGER] Skipping INVOICE_PAID posting for ${invoice.id} — accounts 2000/1020 not seeded`);
    return null;
  }
  return postJournalEntries(prisma, orgId, [
    { ...shared, accountId: payableAcc.id, debitCents: amountCents, creditCents: 0, description: `Kreditor bezahlt ${ref}` },
    { ...shared, accountId: bankAcc.id,    debitCents: 0, creditCents: amountCents, description: `Zahlung ${ref}` },
  ]);
}

/* ── Query: list entries ────────────────────────────────────────── */

export interface LedgerListFilters {
  accountId?: string;
  accountCode?: string;
  buildingId?: string;
  unitId?: string;
  sourceType?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  limit?: number;
  offset?: number;
}

export async function listLedgerEntries(
  prisma: PrismaClient,
  orgId: string,
  filters: LedgerListFilters = {},
): Promise<{ data: LedgerEntryDTO[]; total: number }> {
  const where: any = { orgId };

  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.accountCode) where.account = { code: filters.accountCode };
  if (filters.buildingId) where.buildingId = filters.buildingId;
  if (filters.unitId) where.unitId = filters.unitId;
  if (filters.sourceType) where.sourceType = filters.sourceType;
  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from && { gte: new Date(filters.from) }),
      // Parse as end-of-day UTC so "to=2026-03-24" includes all entries created that day
      ...(filters.to && { lte: new Date(filters.to + "T23:59:59.999Z") }),
    };
  }

  const [entries, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      include: { account: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.ledgerEntry.count({ where }),
  ]);

  return { data: entries.map(mapEntryToDTO), total };
}

/* ── Query: account balance ─────────────────────────────────────── */

export interface AccountBalance {
  accountId: string;
  accountCode: string | null;
  accountName: string;
  accountType: string;
  debitCents: number;
  creditCents: number;
  /** Net balance: debitCents - creditCents (positive = debit balance) */
  balanceCents: number;
}

export async function getAccountBalance(
  prisma: PrismaClient,
  orgId: string,
  accountId: string,
  periodFilter?: { from?: Date; to?: Date },
): Promise<AccountBalance | null> {
  const account = await prisma.account.findFirst({ where: { id: accountId, orgId } });
  if (!account) return null;

  const where: any = { orgId, accountId };
  if (periodFilter?.from || periodFilter?.to) {
    where.date = {
      ...(periodFilter.from && { gte: periodFilter.from }),
      // End-of-day so "to=2026-03-24" includes all entries created that day
      ...(periodFilter.to && { lte: new Date(periodFilter.to.toISOString().slice(0, 10) + "T23:59:59.999Z") }),
    };
  }

  const agg = await prisma.ledgerEntry.aggregate({
    where,
    _sum: { debitCents: true, creditCents: true },
  });

  const debitCents = agg._sum.debitCents ?? 0;
  const creditCents = agg._sum.creditCents ?? 0;

  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    accountType: account.accountType,
    debitCents,
    creditCents,
    balanceCents: debitCents - creditCents,
  };
}

/* ── Query: trial balance (all accounts with activity) ─────────── */

export async function getTrialBalance(
  prisma: PrismaClient,
  orgId: string,
  periodFilter?: { from?: Date; to?: Date },
): Promise<AccountBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { orgId, isActive: true },
    orderBy: { code: "asc" },
  });

  const results = await Promise.all(
    accounts.map((a) => getAccountBalance(prisma, orgId, a.id, periodFilter)),
  );

  // Return only accounts that have at least one entry
  return results.filter(
    (b): b is AccountBalance => b !== null && (b.debitCents > 0 || b.creditCents > 0),
  );
}

/* ── Mapper ─────────────────────────────────────────────────────── */

function mapEntryToDTO(entry: any): LedgerEntryDTO {
  return {
    id: entry.id,
    orgId: entry.orgId,
    date: entry.date.toISOString(),
    accountId: entry.accountId,
    accountCode: entry.account?.code ?? null,
    accountName: entry.account?.name ?? "",
    accountType: entry.account?.accountType ?? "",
    debitCents: entry.debitCents,
    creditCents: entry.creditCents,
    description: entry.description,
    reference: entry.reference ?? null,
    sourceType: entry.sourceType ?? null,
    sourceId: entry.sourceId ?? null,
    journalId: entry.journalId,
    buildingId: entry.buildingId ?? null,
    unitId: entry.unitId ?? null,
    createdBy: entry.createdBy ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

/* ── Backfill helpers (CQ-36 resolution) ───────────────────────── */

/**
 * Find invoice IDs that have not yet been posted as INVOICE_ISSUED entries.
 * Returns IDs of ISSUED, APPROVED, or PAID invoices missing ledger postings.
 */
export async function getUnpostedIssuedInvoiceIds(
  prisma: PrismaClient,
  orgId: string,
): Promise<string[]> {
  const postedIds = new Set(
    (await prisma.ledgerEntry.findMany({
      where: { orgId, sourceType: "INVOICE_ISSUED" },
      select: { sourceId: true },
    })).map((e) => e.sourceId).filter(Boolean) as string[],
  );

  const candidates = await prisma.invoice.findMany({
    where: { orgId, status: { in: ["ISSUED", "APPROVED", "PAID"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return candidates.filter((i) => !postedIds.has(i.id)).map((i) => i.id);
}

/**
 * Find invoice IDs that have not yet been posted as INVOICE_PAID entries.
 * Returns IDs of PAID invoices missing ledger postings.
 */
export async function getUnpostedPaidInvoiceIds(
  prisma: PrismaClient,
  orgId: string,
): Promise<string[]> {
  const postedIds = new Set(
    (await prisma.ledgerEntry.findMany({
      where: { orgId, sourceType: "INVOICE_PAID" },
      select: { sourceId: true },
    })).map((e) => e.sourceId).filter(Boolean) as string[],
  );

  const candidates = await prisma.invoice.findMany({
    where: { orgId, status: "PAID" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return candidates.filter((i) => !postedIds.has(i.id)).map((i) => i.id);
}

/**
 * Find DRAFT invoice IDs for backfill issuing.
 */
export async function getDraftInvoiceIds(
  prisma: PrismaClient,
  orgId: string,
): Promise<string[]> {
  const drafts = await prisma.invoice.findMany({
    where: { orgId, status: "DRAFT" },
    select: { id: true },
  });
  return drafts.map((i) => i.id);
}
