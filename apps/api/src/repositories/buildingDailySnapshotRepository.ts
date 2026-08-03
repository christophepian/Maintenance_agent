import { PrismaClient } from "@prisma/client";

export interface BuildingDailySnapshotRow {
  date: Date;
  noiCents: number;
  collectedIncomeCents: number;
  expensesCents: number;
  collectionRate: number;
  noiMarginPct: number | null;
  opexRatioPct: number | null;
  occupancyRate: number | null;
  activeUnitsCount: number;
}

export async function upsertBuildingDailySnapshot(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  date: Date,
  data: Omit<BuildingDailySnapshotRow, "date">,
): Promise<void> {
  await prisma.buildingDailySnapshot.upsert({
    where: { orgId_buildingId_date: { orgId, buildingId, date } },
    create: { orgId, buildingId, date, ...data },
    update: { ...data, computedAt: new Date() },
  });
}

export async function findBuildingDailySnapshotsInRange(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
): Promise<BuildingDailySnapshotRow[]> {
  const rows = await prisma.buildingDailySnapshot.findMany({
    where: { orgId, buildingId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    date: r.date,
    noiCents: r.noiCents,
    collectedIncomeCents: r.collectedIncomeCents,
    expensesCents: r.expensesCents,
    collectionRate: r.collectionRate,
    noiMarginPct: r.noiMarginPct,
    opexRatioPct: r.opexRatioPct,
    occupancyRate: r.occupancyRate,
    activeUnitsCount: r.activeUnitsCount,
  }));
}

export async function findEarliestBuildingDailySnapshot(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
): Promise<Date | null> {
  const row = await prisma.buildingDailySnapshot.findFirst({
    where: { orgId, buildingId },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return row?.date ?? null;
}
