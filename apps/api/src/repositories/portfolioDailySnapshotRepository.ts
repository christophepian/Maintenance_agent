import { PrismaClient } from "@prisma/client";

export interface DailySnapshotRow {
  date: Date;
  noiCents: number;
  earnedIncomeCents: number;
  expensesCents: number;
  collectionRate: number;
  noiMarginPct: number | null;
  opexRatioPct: number | null;
  occupancyRate: number | null;
  activeUnitsCount: number;
}

export async function upsertPortfolioDailySnapshot(
  prisma: PrismaClient,
  orgId: string,
  date: Date,
  data: Omit<DailySnapshotRow, "date">,
): Promise<void> {
  await prisma.portfolioDailySnapshot.upsert({
    where: { orgId_date: { orgId, date } },
    create: { orgId, date, ...data },
    update: { ...data, computedAt: new Date() },
  });
}

export async function findDailySnapshotExists(
  prisma: PrismaClient,
  orgId: string,
  date: Date,
): Promise<boolean> {
  const row = await prisma.portfolioDailySnapshot.findUnique({
    where: { orgId_date: { orgId, date } },
    select: { id: true },
  });
  return row !== null;
}

export async function findDailySnapshotsInRange(
  prisma: PrismaClient,
  orgId: string,
  from: Date,
  to: Date,
): Promise<DailySnapshotRow[]> {
  const rows = await prisma.portfolioDailySnapshot.findMany({
    where: {
      orgId,
      date: { gte: from, lte: to },
    },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    date: r.date,
    noiCents: r.noiCents,
    earnedIncomeCents: r.earnedIncomeCents,
    expensesCents: r.expensesCents,
    collectionRate: r.collectionRate,
    noiMarginPct: r.noiMarginPct,
    opexRatioPct: r.opexRatioPct,
    occupancyRate: r.occupancyRate,
    activeUnitsCount: r.activeUnitsCount,
  }));
}

export async function findEarliestDailySnapshot(
  prisma: PrismaClient,
  orgId: string,
): Promise<Date | null> {
  const row = await prisma.portfolioDailySnapshot.findFirst({
    where: { orgId },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return row?.date ?? null;
}
