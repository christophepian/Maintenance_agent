/**
 * Building Financial Snapshot Repository
 *
 * Centralizes all Prisma access for the BuildingFinancialSnapshot model.
 * G3: canonical include constant exported for DTO mapping.
 * G9: canonical include constants live here.
 */

import { PrismaClient } from "@prisma/client";

// ─── Canonical Include ────────────────────────────────────────

export const BUILDING_FINANCIAL_SNAPSHOT_INCLUDE = {} as const;

// ─── Query Functions ──────────────────────────────────────────

/**
 * Find financial snapshots for a building within a date range.
 * Used by capex projection for income estimation.
 */
/** Find a single snapshot by exact period key. */
export async function findBuildingFinancialSnapshotByPeriod(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  return prisma.buildingFinancialSnapshot.findUnique({
    where: {
      orgId_buildingId_periodStart_periodEnd: {
        orgId,
        buildingId,
        periodStart,
        periodEnd,
      },
    },
  });
}

/** Upsert a building financial snapshot. */
export async function upsertBuildingFinancialSnapshot(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  periodStart: Date,
  periodEnd: Date,
  data: {
    earnedIncomeCents: number;
    projectedIncomeCents: number;
    expensesTotalCents: number;
    maintenanceTotalCents: number;
    capexTotalCents: number;
    operatingTotalCents: number;
    netIncomeCents: number;
    netOperatingIncomeCents: number;
    activeUnitsCount: number;
    computedAt: Date;
  },
) {
  return prisma.buildingFinancialSnapshot.upsert({
    where: {
      orgId_buildingId_periodStart_periodEnd: {
        orgId,
        buildingId,
        periodStart,
        periodEnd,
      },
    },
    update: data,
    create: {
      orgId,
      buildingId,
      periodStart,
      periodEnd,
      ...data,
    },
  });
}

/**
 * Return all snapshots for a building, ordered by periodStart ascending.
 * Used for NOI trendline display (all stored annual/custom periods).
 */
export async function findAllSnapshotsForBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  return prisma.buildingFinancialSnapshot.findMany({
    where: { orgId, buildingId },
    orderBy: { periodStart: "asc" },
  });
}

export async function findSnapshotsByBuildingAndPeriod(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  fromDate: Date,
  toDate: Date,
) {
  return prisma.buildingFinancialSnapshot.findMany({
    where: {
      orgId,
      buildingId,
      periodStart: { gte: fromDate },
      periodEnd: { lte: toDate },
    },
    select: { periodStart: true, projectedIncomeCents: true },
    orderBy: { periodStart: "asc" },
  });
}
