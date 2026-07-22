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
    discountRatePct?: number;
    capRatePct?: number;
    deferYears?: number;
    propertyValueChf?: number | null;
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
      ...(data.discountRatePct  != null ? { discountRatePct:  data.discountRatePct  } : {}),
      ...(data.capRatePct       != null ? { capRatePct:       data.capRatePct       } : {}),
      ...(data.deferYears       != null ? { deferYears:       data.deferYears       } : {}),
      ...(data.propertyValueChf !== undefined ? { propertyValueChf: data.propertyValueChf } : {}),
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
    discountRatePct?: number;
    capRatePct?: number;
    deferYears?: number;
    propertyValueChf?: number | null;
    lastVerdictScenario?: string | null;
    lastVerdictAt?: Date | null;
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
  data: {
    assetId: string;
    originalYear: number;
    overriddenYear: number;
    costChf?: number | null;
    rentUpliftChfPerMonth?: number | null;
    riskAvoidedChfPerYear?: number | null;
    vacancyDays?: number | null;
    oblfPassthroughPct?: number | null;
  },
) {
  const plan = await prisma.cashflowPlan.findFirst({ where: { id: planId, orgId } });
  if (!plan) return null;

  const override = await prisma.cashflowOverride.create({
    data: {
      planId,
      assetId: data.assetId,
      originalYear: data.originalYear,
      overriddenYear: data.overriddenYear,
      costChf: data.costChf ?? null,
      rentUpliftChfPerMonth: data.rentUpliftChfPerMonth ?? null,
      riskAvoidedChfPerYear: data.riskAvoidedChfPerYear ?? null,
      vacancyDays: data.vacancyDays ?? null,
      oblfPassthroughPct: data.oblfPassthroughPct ?? null,
    },
  });

  // Mark plan as needing recompute
  await prisma.cashflowPlan.update({
    where: { id: planId },
    data: { lastComputedAt: null },
  });

  return override;
}

/**
 * Active-lease monthly net rent per unit — used to value vacancy lost-rent
 * (months × rent) when reconstructing renovation economics for the plan NPV.
 */
export async function findActiveUnitRents(
  prisma: PrismaClient,
  orgId: string,
  unitIds: string[],
): Promise<Map<string, number>> {
  if (unitIds.length === 0) return new Map();
  const leases = await prisma.lease.findMany({
    where: { orgId, unitId: { in: unitIds }, status: { in: ["ACTIVE", "SIGNED"] }, isTemplate: false },
    select: { unitId: true, netRentChf: true, startDate: true },
    orderBy: { startDate: "desc" },
  });
  const map = new Map<string, number>();
  for (const l of leases) {
    if (l.unitId && !map.has(l.unitId)) map.set(l.unitId, l.netRentChf ?? 0);
  }
  return map;
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
 *
 * Scoped by orgId (defense-in-depth): the asset must belong to the caller's org,
 * so a stray/attacker-influenced assetId can never resolve a building in another
 * tenant and seed a cross-tenant RFP.
 */
export async function findBuildingIdForAsset(
  prisma: PrismaClient,
  assetId: string,
  orgId: string,
): Promise<string | null> {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, orgId },
    select: { unit: { select: { buildingId: true } } },
  });
  return asset?.unit?.buildingId ?? null;
}
