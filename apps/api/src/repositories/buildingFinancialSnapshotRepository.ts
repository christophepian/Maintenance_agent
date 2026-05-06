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
