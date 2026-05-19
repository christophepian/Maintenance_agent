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
import { PrismaClient, InvoiceStatus } from "@prisma/client";
import type { InvoiceDTO } from "./invoices";
import * as accountRepo from "../repositories/accountRepository";
import * as leaseRepo from "../repositories/leaseRepository";
import * as jobRepo from "../repositories/jobRepository";
import * as invoiceRepo from "../repositories/invoiceRepository";
import * as ledgerRepo from "../repositories/ledgerEntryRepository";

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
      const lease = await leaseRepo.findLeaseUnitAndBuilding(prisma, invoice.leaseId);
      return {
        unitId: lease?.unitId ?? null,
        buildingId: lease?.unit?.buildingId ?? null,
      };
    } catch { return { unitId: null, buildingId: null }; }
  }

  // Cost invoice: resolve from job → request → unit → building
  try {
    const job = await jobRepo.findJobRequestUnitBuilding(prisma, invoice.jobId);
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
  return accountRepo.findAccountByOrgAndCode(prisma, orgId, code);
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
    ? await accountRepo.findAccountByIdAndOrg(prisma, invoice.accountId, orgId)
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

  const [entries, total] = await ledgerRepo.findLedgerEntriesWithCount(
    prisma,
    where,
    filters.limit ?? 50,
    filters.offset ?? 0,
  );

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
  const account = await accountRepo.findAccountByIdAndOrg(prisma, accountId, orgId);
  if (!account) return null;

  const where: any = { orgId, accountId };
  if (periodFilter?.from || periodFilter?.to) {
    where.date = {
      ...(periodFilter.from && { gte: periodFilter.from }),
      // End-of-day so "to=2026-03-24" includes all entries created that day
      ...(periodFilter.to && { lte: new Date(periodFilter.to.toISOString().slice(0, 10) + "T23:59:59.999Z") }),
    };
  }

  const agg = await ledgerRepo.aggregateLedgerBalance(prisma, where);

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
  const accounts = await accountRepo.findActiveAccountsByOrg(prisma, orgId);

  const results = await Promise.all(
    accounts.map((a) => getAccountBalance(prisma, orgId, a.id, periodFilter)),
  );

  // Return only accounts that have at least one entry
  return results.filter(
    (b): b is AccountBalance => b !== null && (b.debitCents > 0 || b.creditCents > 0),
  );
}

/* ── Query: balance sheet (building-scoped, as-of date) ────────── */

export interface BalanceSheetLine {
  accountId: string;
  accountCode: string | null;
  accountName: string;
  accountType: string;
  /** Signed display amount:
   *  ASSET:     positive = normal asset, negative = contra-asset deduction
   *  LIABILITY: positive = normal liability/equity, negative = debit-balance deduction
   */
  displayCents: number;
}

export interface BalanceSheetReport {
  asOf: string;           // ISO date
  buildingId: string;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  differenceCents: number; // assets - liabilities; 0 = balanced
  isBalanced: boolean;
}

export async function getBalanceSheet(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  asOf: Date,
): Promise<BalanceSheetReport> {
  // One aggregation per account for this building up to asOf
  const groups = await prisma.ledgerEntry.groupBy({
    by: ["accountId"],
    where: {
      orgId,
      buildingId,
      date: { lte: asOf },
    },
    _sum: { debitCents: true, creditCents: true },
  });

  if (groups.length === 0) {
    return {
      asOf: asOf.toISOString(),
      buildingId,
      assets: [],
      liabilities: [],
      totalAssetsCents: 0,
      totalLiabilitiesCents: 0,
      differenceCents: 0,
      isBalanced: true,
    };
  }

  // Fetch account details in a single query
  const accounts = await prisma.account.findMany({
    where: { id: { in: groups.map((g) => g.accountId) } },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const assets: BalanceSheetLine[] = [];
  const liabilities: BalanceSheetLine[] = [];

  for (const group of groups) {
    const account = accountMap.get(group.accountId);
    if (!account) continue;

    const debitCents  = group._sum.debitCents  ?? 0;
    const creditCents = group._sum.creditCents ?? 0;
    const balanceCents = debitCents - creditCents; // positive = debit balance

    if (account.accountType === "ASSET") {
      // Normal asset: debit balance → positive; contra-asset: credit balance → negative
      assets.push({
        accountId:   account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        displayCents: balanceCents,
      });
    } else if (account.accountType === "LIABILITY") {
      // Normal liability: credit balance (negative balanceCents) → negate → positive display
      // Debit-balance liability (e.g. owner drawings): balanceCents > 0 → negate → negative display
      liabilities.push({
        accountId:   account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        displayCents: -balanceCents,
      });
    }
    // REVENUE / EXPENSE accounts do not appear on the balance sheet
  }

  // Sort both sections by account code
  const byCode = (a: BalanceSheetLine, b: BalanceSheetLine) =>
    (a.accountCode ?? "").localeCompare(b.accountCode ?? "");
  assets.sort(byCode);
  liabilities.sort(byCode);

  const totalAssetsCents      = assets.reduce((s, l) => s + l.displayCents, 0);
  const totalLiabilitiesCents = liabilities.reduce((s, l) => s + l.displayCents, 0);
  const differenceCents       = totalAssetsCents - totalLiabilitiesCents;

  return {
    asOf: asOf.toISOString(),
    buildingId,
    assets,
    liabilities,
    totalAssetsCents,
    totalLiabilitiesCents,
    differenceCents,
    isBalanced: Math.abs(differenceCents) < 2, // 1-cent rounding tolerance
  };
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
    await ledgerRepo.findLedgerSourceIds(prisma, orgId, "INVOICE_ISSUED"),
  );

  const ids = await invoiceRepo.findInvoiceIdsByStatuses(prisma, orgId, [InvoiceStatus.ISSUED, InvoiceStatus.APPROVED, InvoiceStatus.PAID]);

  return ids.filter((id) => !postedIds.has(id));
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
    await ledgerRepo.findLedgerSourceIds(prisma, orgId, "INVOICE_PAID"),
  );

  const ids = await invoiceRepo.findInvoiceIdsByStatuses(prisma, orgId, [InvoiceStatus.PAID]);

  return ids.filter((id) => !postedIds.has(id));
}

/**
 * Find DRAFT invoice IDs for backfill issuing.
 */
export async function getDraftInvoiceIds(
  prisma: PrismaClient,
  orgId: string,
): Promise<string[]> {
  return invoiceRepo.findInvoiceIdsByStatuses(prisma, orgId, [InvoiceStatus.DRAFT]);
}
