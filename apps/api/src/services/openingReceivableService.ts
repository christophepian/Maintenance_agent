/**
 * Opening Receivable Service (accounting bridge WS-F)
 *
 * Per-tenant opening receivables entered at switchover — the sub-ledger detail of
 * the imported account-level AR lump (account 1100). The sum is reconciled to
 * that lump (control total + variance). Settling one posts Dr Bank (1020) / Cr
 * Receivables (1100), recording the collection so the opening AR shrinks.
 *
 * Aging buckets day-one arrears by due date, so they no longer hide.
 * Layering: Prisma via repositories (G20); journals via ledgerService.
 */

import { PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "../http/errors";
import { postJournalEntries } from "./ledgerService";
import { findAccountByOrgAndCode, upsertAccount } from "../repositories/accountRepository";
import { aggregateOpeningBalanceFromImport } from "../repositories/financialsRepository";
import * as repo from "../repositories/openingReceivableRepository";

const AR_CODE = "1100";
const BANK_CODE = "1020";
const SETTLEMENT_SOURCE = "OPENING_AR_SETTLEMENT";

export interface OpeningReceivableDTO {
  id: string;
  buildingId: string;
  unitId: string | null;
  tenantName: string;
  amountCents: number;
  dueDate: string | null;
  status: string;
  settledAt: string | null;
}

function mapItem(r: any): OpeningReceivableDTO {
  return {
    id: r.id,
    buildingId: r.buildingId,
    unitId: r.unitId ?? null,
    tenantName: r.tenantName,
    amountCents: r.amountCents,
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    status: r.status,
    settledAt: r.settledAt ? r.settledAt.toISOString() : null,
  };
}

export interface OpeningReceivableReport {
  buildingId: string;
  items: OpeningReceivableDTO[];
  control: { enteredCents: number; importLumpCents: number; varianceCents: number };
  aging: { currentCents: number; overdue1to30Cents: number; overdue31to60Cents: number; overdue61plusCents: number };
}

export async function createOpeningReceivable(
  prisma: PrismaClient,
  orgId: string,
  input: { buildingId: string; unitId?: string | null; tenantName: string; amountCents: number; dueDate?: string | null },
): Promise<OpeningReceivableDTO> {
  if (!input.buildingId) throw new ValidationError("buildingId is required");
  if (!input.tenantName?.trim()) throw new ValidationError("tenantName is required");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new ValidationError("amountCents must be a positive integer");
  }
  const created = await repo.createItem(prisma, {
    orgId,
    buildingId: input.buildingId,
    unitId: input.unitId ?? null,
    tenantName: input.tenantName.trim(),
    amountCents: input.amountCents,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
  });
  return mapItem(created);
}

export async function getOpeningReceivableReport(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  asOf: Date = new Date(),
): Promise<OpeningReceivableReport> {
  const [rows, enteredCents, importLumpSigned] = await Promise.all([
    repo.listByBuilding(prisma, orgId, buildingId),
    repo.sumByBuilding(prisma, orgId, buildingId),
    // Gross imported lump (BALANCE_SHEET_IMPORT only) = control target.
    aggregateOpeningBalanceFromImport(prisma, orgId, buildingId, AR_CODE, asOf, ["BALANCE_SHEET_IMPORT"]),
  ]);
  const importLumpCents = Math.max(0, importLumpSigned);

  const buckets = { currentCents: 0, overdue1to30Cents: 0, overdue31to60Cents: 0, overdue61plusCents: 0 };
  const todayMs = asOf.getTime();
  for (const r of rows) {
    if (r.status !== "OPEN") continue;
    const amt = r.amountCents;
    if (!r.dueDate) { buckets.currentCents += amt; continue; }
    const days = Math.floor((todayMs - r.dueDate.getTime()) / 86400000);
    if (days <= 0) buckets.currentCents += amt;
    else if (days <= 30) buckets.overdue1to30Cents += amt;
    else if (days <= 60) buckets.overdue31to60Cents += amt;
    else buckets.overdue61plusCents += amt;
  }

  return {
    buildingId,
    items: rows.map(mapItem),
    control: { enteredCents, importLumpCents, varianceCents: importLumpCents - enteredCents },
    aging: buckets,
  };
}

/**
 * Settle an opening receivable (collection received): post Dr Bank (1020) / Cr
 * Receivables (1100) and mark SETTLED. Reduces the opening AR on the ledger.
 */
export async function settleOpeningReceivable(
  prisma: PrismaClient,
  orgId: string,
  id: string,
  userId: string | null,
): Promise<OpeningReceivableDTO> {
  const item = await repo.findById(prisma, orgId, id);
  if (!item) throw new NotFoundError(`Opening receivable ${id} not found`);
  if (item.status !== "OPEN") throw new ConflictError("Opening receivable is already settled");

  const bank = await findAccountByOrgAndCode(prisma, orgId, BANK_CODE)
    ?? await upsertAccount(prisma, orgId, "Bank Account", { code: BANK_CODE, accountType: "ASSET" });
  const ar = await findAccountByOrgAndCode(prisma, orgId, AR_CODE)
    ?? await upsertAccount(prisma, orgId, "Rent Receivables", { code: AR_CODE, accountType: "ASSET" });

  const shared = {
    sourceType: SETTLEMENT_SOURCE,
    sourceId: item.id,
    reference: `Opening AR ${item.tenantName}`,
    date: new Date(),
    buildingId: item.buildingId,
    unitId: item.unitId ?? null,
    createdBy: userId,
  };
  const entries = await postJournalEntries(prisma, orgId, [
    { ...shared, accountId: bank.id, debitCents: item.amountCents, creditCents: 0, description: `Opening AR collected ${item.tenantName}` },
    { ...shared, accountId: ar.id, debitCents: 0, creditCents: item.amountCents, description: `Opening AR settled ${item.tenantName}` },
  ]);

  const updated = await repo.updateItem(prisma, item.id, {
    status: "SETTLED",
    settlementJournalId: entries[0]?.journalId ?? null,
    settledAt: new Date(),
  });
  return mapItem(updated);
}
