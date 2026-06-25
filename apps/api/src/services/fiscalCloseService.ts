/**
 * Fiscal Close Service (accounting bridge WS-E)
 *
 * Year-end closing of a building's books: post a self-balancing journal that
 * zeroes every REVENUE/EXPENSE account for the fiscal year into retained
 * earnings (account 2900), so the balance sheet reconciles and equity carries
 * the period result. Reversible to reopen a year.
 *
 * Layering: all Prisma access goes through repositories (G20). Journals are
 * posted via ledgerService.postJournalEntries.
 */

import { PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "../http/errors";
import { postJournalEntries, JournalLeg } from "./ledgerService";
import {
  findAccountByOrgAndCode,
  upsertAccount,
} from "../repositories/accountRepository";
import { findBuildingByIdAndOrg } from "../repositories/inventoryRepository";
import * as repo from "../repositories/fiscalPeriodCloseRepository";

const RETAINED_EARNINGS_CODE = "2900";
const CLOSE_SOURCE = "YEAR_END_CLOSE";
const REVERSAL_SOURCE = "YEAR_END_CLOSE_REVERSAL";

export interface FiscalCloseDTO {
  id: string;
  buildingId: string;
  fiscalYear: number;
  status: string;
  retainedEarningsCents: number;
  closingJournalId: string;
  reversalJournalId: string | null;
  closedAt: string;
  reversedAt: string | null;
}

function mapClose(c: any): FiscalCloseDTO {
  return {
    id: c.id,
    buildingId: c.buildingId,
    fiscalYear: c.fiscalYear,
    status: c.status,
    retainedEarningsCents: c.retainedEarningsCents,
    closingJournalId: c.closingJournalId,
    reversalJournalId: c.reversalJournalId ?? null,
    closedAt: c.closedAt.toISOString(),
    reversedAt: c.reversedAt ? c.reversedAt.toISOString() : null,
  };
}

async function ensureRetainedEarnings(prisma: PrismaClient, orgId: string) {
  const existing = await findAccountByOrgAndCode(prisma, orgId, RETAINED_EARNINGS_CODE);
  if (existing) return existing;
  return upsertAccount(prisma, orgId, "Retained Earnings", {
    code: RETAINED_EARNINGS_CODE,
    accountType: "LIABILITY",
  });
}

/**
 * Close one fiscal (calendar) year for a building. Idempotent: throws if the
 * year is already CLOSED; re-closes a previously REVERSED year in place.
 */
export async function closeFiscalYear(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  fiscalYear: number,
  userId: string | null,
): Promise<FiscalCloseDTO> {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 1900 || fiscalYear > 2200) {
    throw new ValidationError("fiscalYear must be a valid calendar year");
  }
  const building = await findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new NotFoundError(`Building ${buildingId} not found`);

  const existing = await repo.findClose(prisma, orgId, buildingId, fiscalYear);
  if (existing && existing.status === "CLOSED") {
    throw new ConflictError(`Fiscal year ${fiscalYear} is already closed for this building`);
  }

  const periodStart = new Date(Date.UTC(fiscalYear, 0, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(fiscalYear, 11, 31, 23, 59, 59, 999));

  const pnl = await repo.aggregatePnlBalances(prisma, orgId, buildingId, periodStart, periodEnd);
  const nonZero = pnl.filter((a) => a.debitCents - a.creditCents !== 0);
  if (nonZero.length === 0) {
    throw new ValidationError(`No profit & loss activity to close for ${fiscalYear}`);
  }

  const equity = await ensureRetainedEarnings(prisma, orgId);
  const shared = {
    sourceType: CLOSE_SOURCE,
    reference: `Close ${fiscalYear}`,
    date: periodEnd,
    buildingId,
    createdBy: userId,
  };

  const legs: JournalLeg[] = [];
  let netResultCents = 0; // positive = profit (revenue > expense)
  for (const acc of nonZero) {
    const bal = acc.debitCents - acc.creditCents; // expense: >0 (debit); revenue: <0 (credit)
    // Zero the account by posting the opposite side.
    legs.push(
      bal > 0
        ? { ...shared, accountId: acc.accountId, debitCents: 0, creditCents: bal, description: `Close P&L ${acc.code ?? ""}`.trim() }
        : { ...shared, accountId: acc.accountId, debitCents: -bal, creditCents: 0, description: `Close P&L ${acc.code ?? ""}`.trim() },
    );
    netResultCents -= bal; // revenue (bal<0) adds to profit; expense (bal>0) subtracts
  }

  // Balancing leg to equity: profit → credit equity; loss → debit equity.
  if (netResultCents > 0) {
    legs.push({ ...shared, accountId: equity.id, debitCents: 0, creditCents: netResultCents, description: `Result ${fiscalYear} → retained earnings` });
  } else if (netResultCents < 0) {
    legs.push({ ...shared, accountId: equity.id, debitCents: -netResultCents, creditCents: 0, description: `Result ${fiscalYear} → retained earnings` });
  }

  const entries = await postJournalEntries(prisma, orgId, legs);
  const closingJournalId = entries[0]?.journalId;
  if (!closingJournalId) throw new ValidationError("Closing journal could not be posted");

  if (existing) {
    const updated = await repo.updateClose(prisma, existing.id, {
      status: "CLOSED",
      closingJournalId,
      reversalJournalId: null,
      retainedEarningsCents: netResultCents,
      reversedAt: null,
      reversedBy: null,
      closedBy: userId,
      periodStart,
      periodEnd,
    });
    return mapClose(updated);
  }

  const created = await repo.createClose(prisma, {
    orgId,
    buildingId,
    fiscalYear,
    periodStart,
    periodEnd,
    closingJournalId,
    retainedEarningsCents: netResultCents,
    closedBy: userId,
  });
  return mapClose(created);
}

/**
 * Reopen a closed fiscal year by posting the reversing journal. Leaves an audit
 * trail (status REVERSED + reversalJournalId); the year can be re-closed later.
 */
export async function reopenFiscalYear(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  fiscalYear: number,
  userId: string | null,
): Promise<FiscalCloseDTO> {
  const close = await repo.findClose(prisma, orgId, buildingId, fiscalYear);
  if (!close) throw new NotFoundError(`No close found for ${fiscalYear}`);
  if (close.status !== "CLOSED") {
    throw new ConflictError(`Fiscal year ${fiscalYear} is not currently closed`);
  }

  const closingLegs = await repo.findEntriesByJournal(prisma, orgId, close.closingJournalId);
  if (closingLegs.length === 0) {
    throw new ValidationError("Original closing journal entries not found");
  }

  // Date the reversal at periodEnd (not "now") so the balance sheet stays
  // consistent at any asOf ≥ periodEnd: close + reversal net to zero there.
  const reversalLegs: JournalLeg[] = closingLegs.map((leg) => ({
    accountId: leg.accountId,
    debitCents: leg.creditCents, // swap to reverse
    creditCents: leg.debitCents,
    description: `Reopen ${fiscalYear} (reversal)`,
    reference: `Reopen ${fiscalYear}`,
    sourceType: REVERSAL_SOURCE,
    date: close.periodEnd,
    buildingId,
    createdBy: userId,
  }));

  const entries = await postJournalEntries(prisma, orgId, reversalLegs);
  const reversalJournalId = entries[0]?.journalId ?? null;

  const updated = await repo.updateClose(prisma, close.id, {
    status: "REVERSED",
    reversalJournalId,
    reversedAt: new Date(),
    reversedBy: userId,
  });
  return mapClose(updated);
}

export async function listFiscalCloses(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string,
): Promise<FiscalCloseDTO[]> {
  const rows = await repo.listCloses(prisma, orgId, buildingId);
  return rows.map(mapClose);
}
