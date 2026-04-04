/**
 * cashflowPlanRepository
 *
 * Canonical Prisma access for CashflowPlan and CashflowOverride.
 * All queries are org-scoped. Routes and workflows must not call Prisma directly.
 */

import { PrismaClient, CashflowPlanStatus } from "@prisma/client";

// ─── Canonical include ─────────────────────────────────────────

export const CASHFLOW_PLAN_INCLUDE = {
  building: {
    select: { id: true, name: true, canton: true },
  },
  overrides: {
    include: {
      asset: {
        select: {
          id: true,
          name: true,
          type: true,
          topic: true,
          unitId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export type CashflowPlanWithRelations = NonNullable<
  Awaited<ReturnType<typeof findCashflowPlanById>>
>;

// ─── Queries ───────────────────────────────────────────────────

export async function findCashflowPlanById(
  prisma: PrismaClient,
  id: string,
  orgId: string,
) {
  return prisma.cashflowPlan.findFirst({
    where: { id, orgId },
    include: CASHFLOW_PLAN_INCLUDE,
  });
}

export async function listCashflowPlans(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string,
) {
  return prisma.cashflowPlan.findMany({
    where: {
      orgId,
      ...(buildingId ? { buildingId } : {}),
    },
    include: CASHFLOW_PLAN_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

// ─── Mutations ─────────────────────────────────────────────────

export async function createCashflowPlan(
  prisma: PrismaClient,
  data: {
    orgId: string;
    name: string;
    buildingId?: string | null;
    incomeGrowthRatePct?: number;
    openingBalanceCents?: bigint | null;
    horizonMonths?: number;
  },
) {
  return prisma.cashflowPlan.create({
    data: {
      orgId: data.orgId,
      name: data.name,
      buildingId: data.buildingId ?? null,
      incomeGrowthRatePct: data.incomeGrowthRatePct ?? 0,
      openingBalanceCents: data.openingBalanceCents ?? null,
      horizonMonths: data.horizonMonths ?? 60,
    },
    include: CASHFLOW_PLAN_INCLUDE,
  });
}

export async function updateCashflowPlan(
  prisma: PrismaClient,
  id: string,
  orgId: string,
  data: {
    name?: string;
    incomeGrowthRatePct?: number;
    openingBalanceCents?: bigint | null;
    status?: CashflowPlanStatus;
    lastComputedAt?: Date | null;
  },
) {
  const existing = await prisma.cashflowPlan.findFirst({ where: { id, orgId } });
  if (!existing) return null;

  return prisma.cashflowPlan.update({
    where: { id },
    data,
    include: CASHFLOW_PLAN_INCLUDE,
  });
}

// ─── Overrides ─────────────────────────────────────────────────

export async function addCashflowOverride(
  prisma: PrismaClient,
  planId: string,
  orgId: string,
  data: { assetId: string; originalYear: number; overriddenYear: number },
) {
  const plan = await prisma.cashflowPlan.findFirst({ where: { id: planId, orgId } });
  if (!plan) return null;

  const override = await prisma.cashflowOverride.create({
    data: {
      planId,
      assetId: data.assetId,
      originalYear: data.originalYear,
      overriddenYear: data.overriddenYear,
    },
  });

  // Mark plan as needing recompute
  await prisma.cashflowPlan.update({
    where: { id: planId },
    data: { lastComputedAt: null },
  });

  return override;
}

export async function removeCashflowOverride(
  prisma: PrismaClient,
  overrideId: string,
  planId: string,
  orgId: string,
) {
  const plan = await prisma.cashflowPlan.findFirst({ where: { id: planId, orgId } });
  if (!plan) return null;

  const deleted = await prisma.cashflowOverride.deleteMany({
    where: { id: overrideId, planId },
  });

  if (deleted.count > 0) {
    await prisma.cashflowPlan.update({
      where: { id: planId },
      data: { lastComputedAt: null },
    });
  }

  return deleted;
}

/**
 * Resolve the buildingId for a given asset (via its unit relation).
 * Used when creating an RFP from a portfolio-level cashflow plan where
 * `plan.buildingId` is null and we need to derive building from the asset.
 */
export async function findBuildingIdForAsset(
  prisma: PrismaClient,
  assetId: string,
): Promise<string | null> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { unit: { select: { buildingId: true } } },
  });
  return asset?.unit?.buildingId ?? null;
}
