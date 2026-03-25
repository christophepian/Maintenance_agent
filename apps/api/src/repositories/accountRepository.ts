/**
 * Account Repository
 *
 * Centralizes all Prisma access for the Account entity.
 * G9: canonical include constants live here.
 */

import { PrismaClient } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

export const ACCOUNT_INCLUDE = {} as const;

export const ACCOUNT_WITH_MAPPINGS_INCLUDE = {
  mappings: {
    include: {
      expenseType: true,
      building: true,
    },
  },
} as const;

// ─── Query Functions ───────────────────────────────────────────

export async function findAccountById(prisma: PrismaClient, id: string) {
  return prisma.account.findUnique({
    where: { id },
    include: ACCOUNT_INCLUDE,
  });
}

export async function findAccountsByOrg(prisma: PrismaClient, orgId: string) {
  return prisma.account.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    include: ACCOUNT_INCLUDE,
  });
}

export async function findAccountByOrgAndName(
  prisma: PrismaClient,
  orgId: string,
  name: string,
) {
  return prisma.account.findUnique({
    where: { orgId_name: { orgId, name } },
  });
}

export interface CreateAccountData {
  orgId: string;
  name: string;
  code?: string;
  accountType?: string;
}

export async function createAccount(
  prisma: PrismaClient,
  data: CreateAccountData,
) {
  return prisma.account.create({
    data: {
      orgId: data.orgId,
      name: data.name,
      code: data.code ?? null,
      accountType: data.accountType ?? "EXPENSE",
    },
    include: ACCOUNT_INCLUDE,
  });
}

export async function updateAccount(
  prisma: PrismaClient,
  id: string,
  data: Partial<Pick<CreateAccountData, "name" | "code" | "accountType">> & { isActive?: boolean },
) {
  return prisma.account.update({
    where: { id },
    data,
    include: ACCOUNT_INCLUDE,
  });
}

export async function upsertAccount(
  prisma: PrismaClient,
  orgId: string,
  name: string,
  data: { code?: string; accountType?: string },
) {
  return prisma.account.upsert({
    where: { orgId_name: { orgId, name } },
    create: {
      orgId,
      name,
      code: data.code ?? null,
      accountType: data.accountType ?? "EXPENSE",
    },
    update: {
      code: data.code ?? undefined,
      accountType: data.accountType ?? undefined,
    },
    include: ACCOUNT_INCLUDE,
  });
}
