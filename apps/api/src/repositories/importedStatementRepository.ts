/**
 * Imported Statement Repository
 *
 * Canonical Prisma access for ImportedStatement and ImportedAccountBalance.
 * G9: all DB access for this domain goes through this file.
 */

import { ImportedStatementStatus, MatchConfidence, PrismaClient } from "@prisma/client";

/* ── statement includes ─────────────────────────────────────── */

const STATEMENT_INCLUDE = {
  building: { select: { id: true, name: true } },
  accountBalances: {
    include: { account: { select: { id: true, code: true, name: true } } },
    orderBy: { rawAccountCode: "asc" as const },
  },
} as const;

/* ── list ───────────────────────────────────────────────────── */

export async function findStatementsByOrg(
  prisma: PrismaClient,
  orgId: string,
  opts: {
    status?: ImportedStatementStatus;
    buildingId?: string;
    fiscalYear?: number;
    limit?: number;
    offset?: number;
  } = {},
) {
  const { status, buildingId, fiscalYear, limit = 50, offset = 0 } = opts;
  const where = {
    orgId,
    ...(status !== undefined ? { status } : {}),
    ...(buildingId ? { buildingId } : {}),
    ...(fiscalYear !== undefined ? { fiscalYear } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.importedStatement.findMany({
      where,
      include: STATEMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.importedStatement.count({ where }),
  ]);
  return { rows, total };
}

/* ── single ─────────────────────────────────────────────────── */

export async function findStatementById(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
) {
  return prisma.importedStatement.findFirst({
    where: { id: statementId, orgId },
    include: STATEMENT_INCLUDE,
  });
}

/* ── create ─────────────────────────────────────────────────── */

export async function createStatement(
  prisma: PrismaClient,
  data: {
    id: string;
    orgId: string;
    buildingId: string;
    fiscalYear: number;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    sourceFileUrl: string;
    uploadedBy: string;
    rawOcrText?: string | null;
    ocrConfidence?: number | null;
    buildingMatchConfidence?: MatchConfidence | null;
    notes?: string | null;
  },
) {
  return prisma.importedStatement.create({ data });
}

/* ── update status ───────────────────────────────────────────── */

export async function updateStatementStatus(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
  update: {
    status: ImportedStatementStatus;
    approvedBy?: string | null;
    approvedAt?: Date | null;
    notes?: string | null;
  },
) {
  return prisma.importedStatement.update({
    where: { id: statementId },
    data: { ...update, updatedAt: new Date() },
    include: STATEMENT_INCLUDE,
  });
}

/* ── account balances ────────────────────────────────────────── */

export async function createAccountBalance(
  prisma: PrismaClient,
  data: {
    id: string;
    orgId: string;
    statementId: string;
    accountId?: string | null;
    rawAccountCode: string;
    rawAccountName: string;
    balanceCents: number;
    balanceType: string;
    matchConfidence: MatchConfidence;
  },
) {
  return prisma.importedAccountBalance.create({ data });
}

export async function updateAccountBalance(
  prisma: PrismaClient,
  balanceId: string,
  orgId: string,
  update: {
    accountId?: string | null;
    matchConfidence?: MatchConfidence;
  },
) {
  return prisma.importedAccountBalance.updateMany({
    where: { id: balanceId, orgId },
    data: { ...update, updatedAt: new Date() },
  });
}

export async function findAccountBalanceById(
  prisma: PrismaClient,
  balanceId: string,
  orgId: string,
) {
  return prisma.importedAccountBalance.findFirst({
    where: { id: balanceId, orgId },
    include: { account: { select: { id: true, code: true, name: true } } },
  });
}

export async function findBalancesByStatement(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
) {
  return prisma.importedAccountBalance.findMany({
    where: { statementId, orgId },
    include: { account: { select: { id: true, code: true, name: true } } },
    orderBy: { rawAccountCode: "asc" },
  });
}
