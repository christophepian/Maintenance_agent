/**
 * ancillaryCostCategoryRepository
 *
 * Canonical Prisma access for AncillaryCostCategory (Nebenkosten taxonomy).
 * All queries are org-scoped. Routes/services must not call Prisma directly.
 */

import { PrismaClient, CostBillability, DistributionKey, Prisma } from "@prisma/client";

// No relations needed for the category list — scalars only.
export const ANCILLARY_COST_CATEGORY_INCLUDE = {} as const;

export interface AncillaryCostCategoryWriteData {
  code: string;
  name: string;
  billability?: CostBillability;
  defaultKey?: DistributionKey;
  isAdminFee?: boolean;
  expenseTypeId?: string | null;
  accountId?: string | null;
  isActive?: boolean;
}

export async function listAncillaryCostCategories(
  prisma: PrismaClient,
  orgId: string,
  opts: { includeInactive?: boolean } = {},
) {
  return prisma.ancillaryCostCategory.findMany({
    where: { orgId, ...(opts.includeInactive ? {} : { isActive: true }) },
    orderBy: [{ billability: "asc" }, { name: "asc" }],
  });
}

export async function findAncillaryCostCategoryById(
  prisma: PrismaClient,
  id: string,
  orgId: string,
) {
  return prisma.ancillaryCostCategory.findFirst({ where: { id, orgId } });
}

export async function createAncillaryCostCategory(
  prisma: PrismaClient,
  orgId: string,
  data: AncillaryCostCategoryWriteData,
) {
  return prisma.ancillaryCostCategory.create({
    data: {
      orgId,
      code: data.code,
      name: data.name,
      billability: data.billability ?? "BILLABLE",
      defaultKey: data.defaultKey ?? "SURFACE_AREA",
      isAdminFee: data.isAdminFee ?? false,
      expenseTypeId: data.expenseTypeId ?? null,
      accountId: data.accountId ?? null,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateAncillaryCostCategory(
  prisma: PrismaClient,
  id: string,
  data: Partial<AncillaryCostCategoryWriteData>,
) {
  const patch: Prisma.AncillaryCostCategoryUpdateInput = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.billability !== undefined) patch.billability = data.billability;
  if (data.defaultKey !== undefined) patch.defaultKey = data.defaultKey;
  if (data.isAdminFee !== undefined) patch.isAdminFee = data.isAdminFee;
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  if (data.expenseTypeId !== undefined)
    patch.expenseType = data.expenseTypeId ? { connect: { id: data.expenseTypeId } } : { disconnect: true };
  if (data.accountId !== undefined)
    patch.account = data.accountId ? { connect: { id: data.accountId } } : { disconnect: true };
  return prisma.ancillaryCostCategory.update({ where: { id }, data: patch });
}

/** Idempotent per-org seed (unique on [orgId, code]). */
export async function upsertAncillaryCostCategory(
  prisma: PrismaClient,
  orgId: string,
  data: AncillaryCostCategoryWriteData,
) {
  return prisma.ancillaryCostCategory.upsert({
    where: { orgId_code: { orgId, code: data.code } },
    create: {
      orgId,
      code: data.code,
      name: data.name,
      billability: data.billability ?? "BILLABLE",
      defaultKey: data.defaultKey ?? "SURFACE_AREA",
      isAdminFee: data.isAdminFee ?? false,
    },
    // Seed is non-destructive: only fills name on existing rows, never flips
    // an admin-customised billability/key back to the default.
    update: { name: data.name },
  });
}
