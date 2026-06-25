/**
 * Fixed Asset Service (accounting bridge WS-D)
 *
 * Capitalizes CAPEX invoices to the balance sheet and depreciates them
 * straight-line over their useful life.
 *
 * - Capitalize: Dr Fixed Assets (1500) / Cr <the expense account the invoice
 *   debited> — moves the cost off the P&L onto the balance sheet, sourceType
 *   "CAPITALIZATION". Idempotent per source invoice.
 * - Depreciate: Dr Depreciation expense (4700) / Cr Accumulated depreciation
 *   (1509 contra-asset), sourceType "DEPRECIATION". Idempotent per asset (the
 *   accumulated balance caps how much is ever posted).
 *
 * Building shell is held at cost — only catalogued CAPEX assets depreciate.
 * Layering: all Prisma via repositories (G20); journals via ledgerService.
 */

import { PrismaClient } from "@prisma/client";
import { postJournalEntries } from "./ledgerService";
import {
  findAccountByOrgAndCode,
  upsertAccount,
  findAccountByIdAndOrg,
} from "../repositories/accountRepository";
import * as repo from "../repositories/fixedAssetRepository";

const FIXED_ASSET_CODE = "1500";
const ACCUM_DEP_CODE = "1509";
const DEPRECIATION_EXPENSE_CODE = "4700";
const DEFAULT_EXPENSE_CODE = "4200";
const DEFAULT_USEFUL_LIFE_YEARS = 10;

export interface FixedAssetDTO {
  id: string;
  buildingId: string;
  unitId: string | null;
  name: string;
  sourceInvoiceId: string | null;
  acquisitionDate: string;
  costCents: number;
  salvageCents: number;
  usefulLifeYears: number;
  accumulatedDepreciationCents: number;
  bookValueCents: number;
  status: string;
}

function mapAsset(a: any): FixedAssetDTO {
  return {
    id: a.id,
    buildingId: a.buildingId,
    unitId: a.unitId ?? null,
    name: a.name,
    sourceInvoiceId: a.sourceInvoiceId ?? null,
    acquisitionDate: a.acquisitionDate.toISOString(),
    costCents: a.costCents,
    salvageCents: a.salvageCents,
    usefulLifeYears: a.usefulLifeYears,
    accumulatedDepreciationCents: a.accumulatedDepreciationCents,
    bookValueCents: a.costCents - a.accumulatedDepreciationCents,
    status: a.status,
  };
}

async function ensureAccount(
  prisma: PrismaClient,
  orgId: string,
  code: string,
  name: string,
  accountType: string,
) {
  const existing = await findAccountByOrgAndCode(prisma, orgId, code);
  if (existing) return existing;
  return upsertAccount(prisma, orgId, name, { code, accountType });
}

/** Completed whole months between two dates (>= 0). */
function monthsElapsed(from: Date, to: Date): number {
  let m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

/**
 * Capitalize a CAPEX invoice. No-op (returns null) for non-CAPEX, unattributed,
 * zero-amount, or already-capitalized invoices. Best-effort: callers wrap in catch.
 */
export async function capitalizeInvoice(
  prisma: PrismaClient,
  orgId: string,
  invoice: any,
): Promise<FixedAssetDTO | null> {
  if ((invoice?.expenseCategory ?? "") !== "CAPEX") return null;
  const buildingId: string | null = invoice.buildingId ?? null;
  if (!buildingId) {
    console.warn(`[FIXED-ASSET] Skip capitalize ${invoice.id} — no building attribution`);
    return null;
  }
  const existing = await repo.findBySourceInvoice(prisma, orgId, invoice.id);
  if (existing) return mapAsset(existing);

  const costCents = Math.round((invoice.totalAmount ?? 0) * 100);
  if (costCents <= 0) return null;

  const assetAcc = await ensureAccount(prisma, orgId, FIXED_ASSET_CODE, "Fixed Assets", "ASSET");
  const expenseAcc = invoice.accountId
    ? await findAccountByIdAndOrg(prisma, invoice.accountId, orgId)
    : await findAccountByOrgAndCode(prisma, orgId, DEFAULT_EXPENSE_CODE);
  if (!expenseAcc) {
    console.warn(`[FIXED-ASSET] Skip capitalize ${invoice.id} — expense account not found`);
    return null;
  }

  const date = invoice.issueDate ? new Date(invoice.issueDate) : new Date();
  const ref = invoice.invoiceNumber || invoice.id;
  const shared = {
    sourceType: "CAPITALIZATION",
    sourceId: invoice.id,
    reference: ref,
    date,
    buildingId,
    unitId: invoice.unitId ?? null,
  };
  await postJournalEntries(prisma, orgId, [
    { ...shared, accountId: assetAcc.id, debitCents: costCents, creditCents: 0, description: `Capitalize ${ref}` },
    { ...shared, accountId: expenseAcc.id, debitCents: 0, creditCents: costCents, description: `Capitalize ${ref}` },
  ]);

  const created = await repo.createAsset(prisma, {
    orgId,
    buildingId,
    unitId: invoice.unitId ?? null,
    name: `CAPEX ${ref}`,
    sourceInvoiceId: invoice.id,
    acquisitionDate: date,
    costCents,
    salvageCents: 0,
    usefulLifeYears: DEFAULT_USEFUL_LIFE_YEARS,
  });
  return mapAsset(created);
}

/**
 * Post straight-line depreciation due up to `asOf` for every active asset in
 * the org. Idempotent: the catch-up amount is (linear-cap − already-accumulated),
 * so repeated runs (e.g. a daily job) only post when a new month is due.
 */
export async function runDepreciation(
  prisma: PrismaClient,
  orgId: string,
  asOf: Date = new Date(),
): Promise<{ assetsDepreciated: number; totalCents: number }> {
  const assets = await repo.listDepreciable(prisma, orgId);
  if (assets.length === 0) return { assetsDepreciated: 0, totalCents: 0 };

  const depExpAcc = await ensureAccount(prisma, orgId, DEPRECIATION_EXPENSE_CODE, "Depreciation", "EXPENSE");
  const accumAcc = await ensureAccount(prisma, orgId, ACCUM_DEP_CODE, "Accumulated Depreciation", "ASSET");

  let assetsDepreciated = 0;
  let totalCents = 0;
  for (const a of assets) {
    const base = a.costCents - a.salvageCents;
    if (base <= 0) continue;
    const totalMonths = a.usefulLifeYears * 12;
    if (totalMonths <= 0) continue;
    const months = Math.min(totalMonths, monthsElapsed(a.acquisitionDate, asOf));
    // Linear cap to date (rounded), self-correcting against drift.
    const cap = Math.min(base, Math.round((base * months) / totalMonths));
    const due = cap - a.accumulatedDepreciationCents;
    if (due <= 0) continue;

    const ref = `DEP ${a.name}`;
    const shared = { sourceType: "DEPRECIATION", sourceId: a.id, reference: ref, date: asOf, buildingId: a.buildingId, unitId: a.unitId ?? null };
    await postJournalEntries(prisma, orgId, [
      { ...shared, accountId: depExpAcc.id, debitCents: due, creditCents: 0, description: `Depreciation ${a.name}` },
      { ...shared, accountId: accumAcc.id, debitCents: 0, creditCents: due, description: `Accumulated depreciation ${a.name}` },
    ]);
    await repo.updateAsset(prisma, a.id, { accumulatedDepreciationCents: a.accumulatedDepreciationCents + due });
    assetsDepreciated++;
    totalCents += due;
  }
  return { assetsDepreciated, totalCents };
}

export async function listFixedAssets(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string,
): Promise<FixedAssetDTO[]> {
  const rows = await repo.listAssets(prisma, orgId, buildingId);
  return rows.map(mapAsset);
}
