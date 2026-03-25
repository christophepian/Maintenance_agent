/**
 * Chart of Accounts Service
 *
 * Domain logic for ExpenseType, Account, and ExpenseMapping.
 * Uses repositories for Prisma access — never calls Prisma directly.
 */

import { PrismaClient } from "@prisma/client";
import {
  findExpenseTypesByOrg,
  findExpenseTypeById,
  findExpenseTypeByOrgAndName,
  createExpenseType as repoCreateExpenseType,
  updateExpenseType as repoUpdateExpenseType,
  upsertExpenseType,
} from "../repositories/expenseTypeRepository";
import {
  findAccountsByOrg,
  findAccountById,
  findAccountByOrgAndName,
  createAccount as repoCreateAccount,
  updateAccount as repoUpdateAccount,
  upsertAccount,
} from "../repositories/accountRepository";
import {
  findExpenseMappingsByOrg,
  findExpenseMappingById,
  findExpenseMappingByUniqueKey,
  createExpenseMapping as repoCreateExpenseMapping,
  deleteExpenseMapping as repoDeleteExpenseMapping,
} from "../repositories/expenseMappingRepository";

// ─── Error Classes ─────────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ─── DTOs ──────────────────────────────────────────────────────

export interface ExpenseTypeDTO {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  code: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDTO {
  id: string;
  orgId: string;
  name: string;
  code: string | null;
  accountType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseMappingDTO {
  id: string;
  orgId: string;
  expenseTypeId: string;
  accountId: string;
  buildingId: string | null;
  expenseType: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
  building: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Mappers ───────────────────────────────────────────────────

function mapExpenseType(et: any): ExpenseTypeDTO {
  return {
    id: et.id,
    orgId: et.orgId,
    name: et.name,
    description: et.description,
    code: et.code,
    isActive: et.isActive,
    createdAt: et.createdAt.toISOString(),
    updatedAt: et.updatedAt.toISOString(),
  };
}

function mapAccount(a: any): AccountDTO {
  return {
    id: a.id,
    orgId: a.orgId,
    name: a.name,
    code: a.code,
    accountType: a.accountType,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function mapExpenseMapping(m: any): ExpenseMappingDTO {
  return {
    id: m.id,
    orgId: m.orgId,
    expenseTypeId: m.expenseTypeId,
    accountId: m.accountId,
    buildingId: m.buildingId,
    expenseType: m.expenseType
      ? { id: m.expenseType.id, name: m.expenseType.name }
      : null,
    account: m.account
      ? { id: m.account.id, name: m.account.name }
      : null,
    building: m.building
      ? { id: m.building.id, name: m.building.name }
      : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// ─── ExpenseType Service ───────────────────────────────────────

export async function listExpenseTypes(
  prisma: PrismaClient,
  orgId: string,
): Promise<ExpenseTypeDTO[]> {
  const types = await findExpenseTypesByOrg(prisma, orgId);
  return types
    .map(mapExpenseType)
    .sort((a, b) => a.name.localeCompare(b.name, "en-US"));
}

export async function getExpenseType(
  prisma: PrismaClient,
  id: string,
): Promise<ExpenseTypeDTO> {
  const et = await findExpenseTypeById(prisma, id);
  if (!et) throw new NotFoundError(`ExpenseType ${id} not found`);
  return mapExpenseType(et);
}

export async function createExpenseType(
  prisma: PrismaClient,
  orgId: string,
  data: { name: string; description?: string; code?: string },
): Promise<ExpenseTypeDTO> {
  // Check for duplicate name within org
  const existing = await findExpenseTypeByOrgAndName(prisma, orgId, data.name);
  if (existing) {
    throw new ConflictError(`ExpenseType "${data.name}" already exists in this org`);
  }
  const et = await repoCreateExpenseType(prisma, { orgId, ...data });
  return mapExpenseType(et);
}

export async function updateExpenseType(
  prisma: PrismaClient,
  id: string,
  orgId: string,
  data: { name?: string; description?: string; code?: string; isActive?: boolean },
): Promise<ExpenseTypeDTO> {
  const existing = await findExpenseTypeById(prisma, id);
  if (!existing || existing.orgId !== orgId) {
    throw new NotFoundError(`ExpenseType ${id} not found`);
  }
  // If renaming, check for duplicate
  if (data.name && data.name !== existing.name) {
    const dup = await findExpenseTypeByOrgAndName(prisma, orgId, data.name);
    if (dup) throw new ConflictError(`ExpenseType "${data.name}" already exists in this org`);
  }
  const updated = await repoUpdateExpenseType(prisma, id, data);
  return mapExpenseType(updated);
}

// ─── Account Service ───────────────────────────────────────────

export async function listAccounts(
  prisma: PrismaClient,
  orgId: string,
): Promise<AccountDTO[]> {
  const accounts = await findAccountsByOrg(prisma, orgId);
  return accounts
    .map(mapAccount)
    .sort((a, b) => a.name.localeCompare(b.name, "en-US"));
}

export async function getAccount(
  prisma: PrismaClient,
  id: string,
): Promise<AccountDTO> {
  const a = await findAccountById(prisma, id);
  if (!a) throw new NotFoundError(`Account ${id} not found`);
  return mapAccount(a);
}

export async function createAccount(
  prisma: PrismaClient,
  orgId: string,
  data: { name: string; code?: string; accountType?: string },
): Promise<AccountDTO> {
  const existing = await findAccountByOrgAndName(prisma, orgId, data.name);
  if (existing) {
    throw new ConflictError(`Account "${data.name}" already exists in this org`);
  }
  const a = await repoCreateAccount(prisma, { orgId, ...data });
  return mapAccount(a);
}

export async function updateAccount(
  prisma: PrismaClient,
  id: string,
  orgId: string,
  data: { name?: string; code?: string; accountType?: string; isActive?: boolean },
): Promise<AccountDTO> {
  const existing = await findAccountById(prisma, id);
  if (!existing || existing.orgId !== orgId) {
    throw new NotFoundError(`Account ${id} not found`);
  }
  if (data.name && data.name !== existing.name) {
    const dup = await findAccountByOrgAndName(prisma, orgId, data.name);
    if (dup) throw new ConflictError(`Account "${data.name}" already exists in this org`);
  }
  const updated = await repoUpdateAccount(prisma, id, data);
  return mapAccount(updated);
}

// ─── ExpenseMapping Service ────────────────────────────────────

export async function listExpenseMappings(
  prisma: PrismaClient,
  orgId: string,
): Promise<ExpenseMappingDTO[]> {
  const mappings = await findExpenseMappingsByOrg(prisma, orgId);
  return mappings.map(mapExpenseMapping);
}

export async function createExpenseMapping(
  prisma: PrismaClient,
  orgId: string,
  data: { expenseTypeId: string; accountId: string; buildingId?: string | null },
): Promise<ExpenseMappingDTO> {
  // Verify referenced entities exist and belong to this org
  const et = await findExpenseTypeById(prisma, data.expenseTypeId);
  if (!et || et.orgId !== orgId) {
    throw new NotFoundError(`ExpenseType ${data.expenseTypeId} not found`);
  }
  const acc = await findAccountById(prisma, data.accountId);
  if (!acc || acc.orgId !== orgId) {
    throw new NotFoundError(`Account ${data.accountId} not found`);
  }

  // Check for duplicate mapping (app-level guard for null buildingId)
  const existing = await findExpenseMappingByUniqueKey(
    prisma,
    orgId,
    data.expenseTypeId,
    data.buildingId ?? null,
  );
  if (existing) {
    throw new ConflictError(
      "An expense mapping for this expense type and building already exists",
    );
  }

  try {
    const mapping = await repoCreateExpenseMapping(prisma, {
      orgId,
      expenseTypeId: data.expenseTypeId,
      accountId: data.accountId,
      buildingId: data.buildingId ?? null,
    });
    return mapExpenseMapping(mapping);
  } catch (e: any) {
    if (e.code === "P2002") {
      throw new ConflictError(
        "An expense mapping for this expense type and building already exists",
      );
    }
    throw e;
  }
}

export async function deleteExpenseMapping(
  prisma: PrismaClient,
  id: string,
  orgId: string,
): Promise<void> {
  const existing = await findExpenseMappingById(prisma, id);
  if (!existing || existing.orgId !== orgId) {
    throw new NotFoundError(`ExpenseMapping ${id} not found`);
  }
  await repoDeleteExpenseMapping(prisma, id);
}

// ─── Seed: Swiss Residential Kontenplan ────────────────────────
//
// Account codes follow the Swiss KMU Kontenrahmen (OR) as adapted
// for residential Liegenschaftsverwaltung:
//   1xxx  Assets      — receivables, cash, prepayments
//   2xxx  Liabilities — payables, mortgages
//   3xxx  Revenue     — rental income, ancillary receipts
//   4xxx  Expenses    — interest, maintenance, ancillary costs, admin, tax
//
// Each expense type carries a defaultAccountCode so the seed can
// create precise account mappings instead of lumping everything
// into a single catch-all account.

interface TaxonomyEntry {
  name: string;
  code: string;
  description: string;
  defaultAccountCode: string;
}

const SWISS_RESIDENTIAL_TAXONOMY: TaxonomyEntry[] = [
  // ── Recoverable ancillary costs ──────────────────────────────
  { name: "Heating & Hot Water",               code: "NK-HEIZ",    description: "Heating energy and hot water preparation (oil, gas, district heating, wood pellets)",                                     defaultAccountCode: "4310" },
  { name: "Cold Water & Sewage",               code: "NK-WASSER",  description: "Water supply fees and sewage disposal charges",                                                                            defaultAccountCode: "4320" },
  { name: "Common Area Electricity",           code: "NK-STROM",   description: "Electricity for common areas: stairwells, garage, laundry room, exterior lighting",                                       defaultAccountCode: "4330" },
  { name: "Caretaker & Cleaning",              code: "NK-HAUSWART",description: "Caretaker service, stairwell cleaning, general building cleaning and transport",                                           defaultAccountCode: "4340" },
  { name: "Garden Maintenance",                code: "NK-GARTEN",  description: "Garden upkeep, lawn care, hedge and tree trimming, planting",                                                              defaultAccountCode: "4350" },
  { name: "Snow Removal",                      code: "NK-SCHNEE",  description: "Winter service: snow and ice clearing on paths, driveways and parking areas",                                              defaultAccountCode: "4360" },
  { name: "Waste Disposal",                    code: "NK-ABFALL",  description: "Waste collection fees, recycling and disposal (separate collections, green waste)",                                        defaultAccountCode: "4370" },
  { name: "Elevator Maintenance",              code: "NK-LIFT",    description: "Elevator service contract, inspections, safety certifications and minor repairs",                                          defaultAccountCode: "4380" },
  { name: "TV / Cable / Antenna",              code: "NK-TV",      description: "Shared reception equipment, cable connection or satellite system",                                                         defaultAccountCode: "4390" },
  { name: "Chimney Sweep",                     code: "NK-KAMIN",   description: "Chimney sweeping, inspection of heating systems and flue gas measurements",                                                defaultAccountCode: "4390" },
  // ── Non-recoverable maintenance & capex ─────────────────────
  { name: "General Maintenance & Repairs",     code: "MAINT-GEN",  description: "General building maintenance and repairs (non-recoverable from tenants)",                                                  defaultAccountCode: "4200" },
  { name: "Facade Maintenance",                code: "MAINT-FASS", description: "Facade cleaning, plastering, painting and insulation work",                                                               defaultAccountCode: "4200" },
  { name: "Roof Maintenance",                  code: "MAINT-DACH", description: "Roof repairs, gutter cleaning, waterproofing and skylights",                                                              defaultAccountCode: "4200" },
  { name: "Plumbing & Heating Repairs",        code: "MAINT-SANIT",description: "Repairs to plumbing, heating and ventilation installations",                                                              defaultAccountCode: "4200" },
  { name: "Electrical Repairs",                code: "MAINT-ELEK", description: "Repairs to electrical systems, controls and installations",                                                               defaultAccountCode: "4200" },
  // ── Financing ────────────────────────────────────────────────
  { name: "Mortgage Interest",                 code: "FIN-HYPO",   description: "Interest payments on mortgages and land charges — directly tax-deductible",                                               defaultAccountCode: "4100" },
  // ── Insurance ────────────────────────────────────────────────
  { name: "Building Insurance",                code: "INS-BLDG",   description: "Building, fire and natural hazard insurance premiums",                                                                     defaultAccountCode: "4400" },
  { name: "Building Liability Insurance",      code: "INS-HAFT",   description: "Building public liability insurance",                                                                                      defaultAccountCode: "4410" },
  // ── Administration ───────────────────────────────────────────
  { name: "Property Management Fee",           code: "ADM-VERW",   description: "Property management fees, accounting and audit",                                                                           defaultAccountCode: "4500" },
  // ── Taxes & fees ─────────────────────────────────────────────
  { name: "Property Tax",                      code: "TAX-LIEG",   description: "Municipal and cantonal property taxes and land registry fees",                                                             defaultAccountCode: "4600" },
];

const SWISS_DEFAULT_ACCOUNTS = [
  // ── Assets (1xxx) ──────────────────────────────────────────────────────────
  { name: "Bank Account",                code: "1020", accountType: "ASSET"     }, // Operating bank account
  { name: "Rent Receivables",            code: "1100", accountType: "ASSET"     }, // Rent receivables outstanding
  { name: "Prepaid Expenses",            code: "1180", accountType: "ASSET"     }, // Prepaid expenses / accruals
  // ── Liabilities (2xxx) ─────────────────────────────────────────────────────
  { name: "Accounts Payable",            code: "2000", accountType: "LIABILITY" }, // Accounts payable (contractors, suppliers)
  { name: "Mortgage — 1st Rank",         code: "2300", accountType: "LIABILITY" }, // 1st mortgage
  { name: "Mortgage — 2nd Rank",         code: "2350", accountType: "LIABILITY" }, // 2nd mortgage / land charge
  // ── Revenue (3xxx) ─────────────────────────────────────────────────────────
  { name: "Residential Rental Income",   code: "3200", accountType: "REVENUE"   }, // Residential rental income
  { name: "Commercial Rental Income",    code: "3210", accountType: "REVENUE"   }, // Commercial rental income
  { name: "Garage & Parking Income",     code: "3220", accountType: "REVENUE"   }, // Garage / parking income
  { name: "Ancillary Cost Receipts",     code: "3400", accountType: "REVENUE"   }, // Ancillary cost advance payments from tenants
  { name: "Miscellaneous Income",        code: "3900", accountType: "REVENUE"   }, // Miscellaneous income
  // ── Expenses: Financing ────────────────────────────────────────────────────
  { name: "Mortgage Interest",           code: "4100", accountType: "EXPENSE"   }, // Mortgage interest — directly tax-deductible
  // ── Expenses: Maintenance ──────────────────────────────────────────────────
  { name: "Maintenance & Repairs",       code: "4200", accountType: "EXPENSE"   }, // Maintenance & repairs (non-recoverable from tenants)
  // ── Expenses: Ancillary — non-recoverable catch-all ────────────────────────
  { name: "Non-Recoverable Ancillary",   code: "4300", accountType: "EXPENSE"   }, // Non-recoverable ancillary costs
  // ── Expenses: Ancillary — by type ──────────────────────────────────────────
  { name: "Heating & Hot Water",         code: "4310", accountType: "EXPENSE"   }, // Heating & hot water
  { name: "Water & Sewage",              code: "4320", accountType: "EXPENSE"   }, // Water supply & sewage
  { name: "Common Area Electricity",     code: "4330", accountType: "EXPENSE"   }, // Common area electricity
  { name: "Caretaker & Cleaning",        code: "4340", accountType: "EXPENSE"   }, // Caretaker & cleaning services
  { name: "Garden Maintenance",          code: "4350", accountType: "EXPENSE"   }, // Garden maintenance
  { name: "Snow Removal",                code: "4360", accountType: "EXPENSE"   }, // Snow removal
  { name: "Waste Disposal",              code: "4370", accountType: "EXPENSE"   }, // Waste disposal fees
  { name: "Elevator Maintenance",        code: "4380", accountType: "EXPENSE"   }, // Elevator maintenance
  { name: "Miscellaneous Ancillary",     code: "4390", accountType: "EXPENSE"   }, // Miscellaneous ancillary (chimney, TV, etc.)
  // ── Expenses: Insurance ────────────────────────────────────────────────────
  { name: "Building Insurance",          code: "4400", accountType: "EXPENSE"   }, // Building & fire insurance
  { name: "Liability Insurance",         code: "4410", accountType: "EXPENSE"   }, // Liability insurance
  // ── Expenses: Administration ───────────────────────────────────────────────
  { name: "Property Management Fee",     code: "4500", accountType: "EXPENSE"   }, // Property management fees
  // ── Expenses: Taxes & levies ───────────────────────────────────────────────
  { name: "Property Tax",                code: "4600", accountType: "EXPENSE"   }, // Property taxes (communal + cantonal)
  // ── Expenses: Depreciation ─────────────────────────────────────────────────
  { name: "Depreciation",               code: "4700", accountType: "EXPENSE"   }, // Depreciation (informational — not tax-deductible in CH)
];

export interface SeedResult {
  expenseTypes: number;
  accounts: number;
  mappings: number;
}

export async function seedSwissTaxonomy(
  prisma: PrismaClient,
  orgId: string,
): Promise<SeedResult> {
  // 1. Upsert all expense types
  const expenseTypes = await Promise.all(
    SWISS_RESIDENTIAL_TAXONOMY.map((t) =>
      upsertExpenseType(prisma, orgId, t.name, {
        description: t.description,
        code: t.code,
      }),
    ),
  );

  // 2. Upsert all accounts, build code → account lookup
  const accounts = await Promise.all(
    SWISS_DEFAULT_ACCOUNTS.map((a) =>
      upsertAccount(prisma, orgId, a.name, {
        code: a.code,
        accountType: a.accountType,
      }),
    ),
  );
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));

  // 3. Create per-type mappings (each expense type → its designated account)
  let mappingsCreated = 0;
  for (let i = 0; i < SWISS_RESIDENTIAL_TAXONOMY.length; i++) {
    const taxonomy = SWISS_RESIDENTIAL_TAXONOMY[i];
    const et = expenseTypes[i];

    // Walk up the fallback chain: designated code → 4300 → first expense account
    const targetAccount =
      accountByCode.get(taxonomy.defaultAccountCode) ??
      accountByCode.get("4300") ??
      accounts.find((a) => a.accountType === "EXPENSE");

    if (!targetAccount) continue;

    const existing = await findExpenseMappingByUniqueKey(prisma, orgId, et.id, null);
    if (existing) continue; // idempotent — skip

    try {
      await repoCreateExpenseMapping(prisma, {
        orgId,
        expenseTypeId: et.id,
        accountId: targetAccount.id,
        buildingId: null,
      });
      mappingsCreated++;
    } catch (e: any) {
      if (e.code !== "P2002") throw e; // race-condition safety
    }
  }

  return {
    expenseTypes: expenseTypes.length,
    accounts: accounts.length,
    mappings: mappingsCreated,
  };
}
