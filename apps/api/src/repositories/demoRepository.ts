/**
 * Demo seeding queries.
 *
 * Exists so demoEnrichment (a service) doesn't reach for Prisma directly —
 * services go through repositories (guardrail G20). Everything here is
 * demo-only: it writes buildings, units, assets, tenancies, inspection history
 * and cashflow plans into whatever org it is handed, and must never be reachable
 * from a production route.
 */

import type { PrismaClient, Prisma } from "@prisma/client";

export async function updateBuildingProfile(
  prisma: PrismaClient,
  buildingId: string,
  data: Prisma.BuildingUpdateInput,
) {
  return prisma.building.update({ where: { id: buildingId }, data });
}

export async function findMortgage(prisma: PrismaClient, orgId: string, buildingId: string) {
  return prisma.mortgage.findFirst({ where: { orgId, buildingId } });
}

export async function createMortgage(prisma: PrismaClient, data: Prisma.MortgageUncheckedCreateInput) {
  return prisma.mortgage.create({ data });
}

export async function findBuildingUnits(prisma: PrismaClient, orgId: string, buildingId: string) {
  return prisma.unit.findMany({
    where: { orgId, buildingId },
    select: { id: true, unitNumber: true, type: true, livingAreaSqm: true },
    orderBy: { unitNumber: "asc" },
  });
}

export async function updateUnitValuation(
  prisma: PrismaClient,
  unitId: string,
  data: Prisma.UnitUpdateInput,
) {
  return prisma.unit.update({ where: { id: unitId }, data });
}

export async function findBuildingAndUnitAssets(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  unitIds: string[],
) {
  return prisma.asset.findMany({
    where: { orgId, OR: [{ buildingId }, { unitId: { in: unitIds } }] },
    select: { id: true, topic: true, unitId: true, buildingId: true },
    // Ordered so callers can't accidentally depend on the database's arbitrary
    // row order.
    orderBy: [{ unitId: "asc" }, { topic: "asc" }],
  });
}

export async function setAssetsInstalledAt(prisma: PrismaClient, assetIds: string[], installedAt: Date) {
  return prisma.asset.updateMany({ where: { id: { in: assetIds } }, data: { installedAt } });
}

export async function updateAssetDates(
  prisma: PrismaClient,
  assetId: string,
  data: { installedAt: Date; lastRenovatedAt: Date | null },
) {
  return prisma.asset.update({ where: { id: assetId }, data });
}

export async function countConditionReportsForBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  return prisma.unitConditionReport.count({ where: { orgId, unit: { buildingId } } });
}

export async function findUnitOccupancy(prisma: PrismaClient, unitId: string) {
  return prisma.occupancy.findFirst({ where: { unitId }, select: { tenantId: true } });
}

export async function findLatestLeaseForUnit(prisma: PrismaClient, unitId: string) {
  return prisma.lease.findFirst({
    where: { unitId, isTemplate: false },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
}

export async function upsertTenantByPhone(
  prisma: PrismaClient,
  orgId: string,
  phone: string,
  create: { name: string; email: string | null; isActive: boolean },
) {
  return prisma.tenant.upsert({
    where: { orgId_phone: { orgId, phone } },
    create: { orgId, phone, ...create },
    update: {},
  });
}

export async function createLease(prisma: PrismaClient, data: Prisma.LeaseUncheckedCreateInput) {
  return prisma.lease.create({ data, select: { id: true } });
}

export async function createConditionReport(
  prisma: PrismaClient,
  data: Prisma.UnitConditionReportUncheckedCreateInput,
) {
  return prisma.unitConditionReport.create({ data });
}

export async function findCashflowPlanForBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  return prisma.cashflowPlan.findFirst({ where: { orgId, buildingId }, select: { id: true } });
}

export async function createCashflowPlan(
  prisma: PrismaClient,
  data: Prisma.CashflowPlanUncheckedCreateInput,
) {
  return prisma.cashflowPlan.create({ data, select: { id: true } });
}
