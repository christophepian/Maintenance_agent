/**
 * ExpenseType Repository
 *
 * Centralizes all Prisma access for the ExpenseType entity.
 * G9: canonical include constants live here.
 */

import { PrismaClient } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

export const EXPENSE_TYPE_INCLUDE = {} as const;

export const EXPENSE_TYPE_WITH_MAPPINGS_INCLUDE = {
  mappings: {
    include: {
      account: true,
      building: true,
    },
  },
} as const;

// ─── Query Functions ───────────────────────────────────────────

export async function findExpenseTypeById(prisma: PrismaClient, id: string) {
  return prisma.expenseType.findUnique({
    where: { id },
    include: EXPENSE_TYPE_INCLUDE,
  });
}

export async function findExpenseTypesByOrg(prisma: PrismaClient, orgId: string) {
  return prisma.expenseType.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    include: EXPENSE_TYPE_INCLUDE,
  });
}

export async function findExpenseTypeByOrgAndName(
  prisma: PrismaClient,
  orgId: string,
  name: string,
) {
  return prisma.expenseType.findUnique({
    where: { orgId_name: { orgId, name } },
  });
}

export interface CreateExpenseTypeData {
  orgId: string;
  name: string;
  description?: string;
  code?: string;
}

export async function createExpenseType(
  prisma: PrismaClient,
  data: CreateExpenseTypeData,
) {
  return prisma.expenseType.create({
    data: {
      orgId: data.orgId,
      name: data.name,
      description: data.description ?? null,
      code: data.code ?? null,
    },
    include: EXPENSE_TYPE_INCLUDE,
  });
}

export async function updateExpenseType(
  prisma: PrismaClient,
  id: string,
  data: Partial<Pick<CreateExpenseTypeData, "name" | "description" | "code">> & { isActive?: boolean },
) {
  return prisma.expenseType.update({
    where: { id },
    data,
    include: EXPENSE_TYPE_INCLUDE,
  });
}

export async function upsertExpenseType(
  prisma: PrismaClient,
  orgId: string,
  name: string,
  data: { description?: string; code?: string },
) {
  return prisma.expenseType.upsert({
    where: { orgId_name: { orgId, name } },
    create: {
      orgId,
      name,
      description: data.description ?? null,
      code: data.code ?? null,
    },
    update: {
      description: data.description ?? undefined,
      code: data.code ?? undefined,
    },
    include: EXPENSE_TYPE_INCLUDE,
  });
}
