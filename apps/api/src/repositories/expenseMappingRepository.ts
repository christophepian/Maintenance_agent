/**
 * ExpenseMapping Repository
 *
 * Centralizes all Prisma access for the ExpenseMapping entity.
 * G9: canonical include constants live here.
 */

import { PrismaClient } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

export const EXPENSE_MAPPING_INCLUDE = {
  expenseType: true,
  account: true,
  building: true,
} as const;

// ─── Query Functions ───────────────────────────────────────────

export async function findExpenseMappingById(prisma: PrismaClient, id: string) {
  return prisma.expenseMapping.findUnique({
    where: { id },
    include: EXPENSE_MAPPING_INCLUDE,
  });
}

export async function findExpenseMappingsByOrg(prisma: PrismaClient, orgId: string) {
  return prisma.expenseMapping.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    include: EXPENSE_MAPPING_INCLUDE,
  });
}

export interface CreateExpenseMappingData {
  orgId: string;
  expenseTypeId: string;
  accountId: string;
  buildingId?: string | null;
}

export async function createExpenseMapping(
  prisma: PrismaClient,
  data: CreateExpenseMappingData,
) {
  return prisma.expenseMapping.create({
    data: {
      orgId: data.orgId,
      expenseTypeId: data.expenseTypeId,
      accountId: data.accountId,
      buildingId: data.buildingId ?? null,
    },
    include: EXPENSE_MAPPING_INCLUDE,
  });
}

export async function findExpenseMappingByUniqueKey(
  prisma: PrismaClient,
  orgId: string,
  expenseTypeId: string,
  buildingId: string | null,
) {
  // PostgreSQL NULL uniqueness: Prisma's compound where doesn't handle
  // null correctly for the @@unique constraint, so we use findFirst.
  return prisma.expenseMapping.findFirst({
    where: {
      orgId,
      expenseTypeId,
      buildingId: buildingId ?? null,
    },
    include: EXPENSE_MAPPING_INCLUDE,
  });
}

export async function deleteExpenseMapping(prisma: PrismaClient, id: string) {
  return prisma.expenseMapping.delete({ where: { id } });
}
