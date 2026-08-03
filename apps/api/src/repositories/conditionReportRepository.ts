import { PrismaClient, ConditionReportStatus, ConditionReportType, ItemCondition } from "@prisma/client";

// ── Include constants ──────────────────────────────────────────────────────────

export const REPORT_ITEM_INCLUDE = {
  photos: true,
  asset: { select: { id: true, name: true, type: true } },
} as const;

export const REPORT_FULL_INCLUDE = {
  items: { include: REPORT_ITEM_INCLUDE },
  unit: { select: { id: true, unitNumber: true, buildingId: true } },
  tenant: { select: { id: true, name: true, phone: true } },
  lease: { select: { id: true } },
  approvedBy: { select: { id: true, name: true } },
} as const;

export const REPORT_LIST_INCLUDE = {
  tenant: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} as const;

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReportFull = NonNullable<Awaited<ReturnType<typeof findById>>>;
export type ReportListItem = Awaited<ReturnType<typeof listByUnit>>[number];

// ── Queries ────────────────────────────────────────────────────────────────────

export async function findById(prisma: PrismaClient, id: string, orgId: string) {
  return prisma.unitConditionReport.findFirst({
    where: { id, orgId },
    include: REPORT_FULL_INCLUDE,
  });
}

export async function findMoveInForLease(prisma: PrismaClient, leaseId: string) {
  return prisma.unitConditionReport.findFirst({
    where: { leaseId, type: ConditionReportType.MOVE_IN, status: ConditionReportStatus.APPROVED },
    include: { items: { include: REPORT_ITEM_INCLUDE } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listByUnit(prisma: PrismaClient, unitId: string, orgId: string) {
  return prisma.unitConditionReport.findMany({
    where: { unitId, orgId },
    include: REPORT_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function listByTenant(prisma: PrismaClient, tenantId: string, orgId: string) {
  return prisma.unitConditionReport.findMany({
    where: { tenantId, orgId },
    include: REPORT_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function findLatestApprovedItemForAsset(
  prisma: PrismaClient,
  assetId: string,
  orgId: string,
) {
  return prisma.unitConditionReportItem.findFirst({
    where: {
      assetId,
      report: { orgId, status: ConditionReportStatus.APPROVED },
    },
    include: { report: { select: { id: true, approvedAt: true, type: true } } },
    orderBy: { report: { approvedAt: "desc" } },
  });
}

export interface LatestCondition {
  condition: ItemCondition;
  reportId: string;
  reportedAt: Date | null;
  reportType: string;
}

export async function findLatestConditionsForAssets(
  prisma: PrismaClient,
  assetIds: string[],
  orgId: string,
): Promise<Map<string, LatestCondition>> {
  if (assetIds.length === 0) return new Map();

  const rows = await prisma.unitConditionReportItem.findMany({
    where: {
      assetId: { in: assetIds },
      condition: { not: ItemCondition.NOT_INSPECTED }, // ignore un-rated seeded baseline items
      report: { orgId, status: ConditionReportStatus.APPROVED },
    },
    select: {
      assetId: true,
      condition: true,
      report: { select: { id: true, approvedAt: true, type: true } },
    },
    orderBy: { report: { approvedAt: "desc" } },
  });

  // For each asset, keep only the most recent row (already sorted desc)
  const result = new Map<string, LatestCondition>();
  for (const row of rows) {
    if (!row.assetId || result.has(row.assetId)) continue;
    result.set(row.assetId, {
      condition: row.condition,
      reportId: row.report.id,
      reportedAt: row.report.approvedAt,
      reportType: row.report.type,
    });
  }
  return result;
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export async function createReport(
  prisma: PrismaClient,
  data: {
    orgId: string;
    unitId: string;
    tenantId: string;
    leaseId: string;
    type: ConditionReportType;
    dueAt?: Date;
  },
) {
  return prisma.unitConditionReport.create({ data });
}

/**
 * Baseline a freshly-created report against the unit's active asset inventory:
 * create one asset-linked item per asset (condition NOT_INSPECTED, to be rated
 * before submit). This guarantees every asset in the unit is reported on.
 *
 * Idempotent: skips assets that already have an item on this report, so it is
 * safe to call more than once. Returns the number of items created.
 */
export async function seedAssetItems(
  prisma: PrismaClient,
  reportId: string,
  orgId: string,
  unitId: string,
): Promise<number> {
  const assets = await prisma.asset.findMany({
    where: { orgId, unitId, isActive: true },
    select: { id: true, topic: true, name: true },
    orderBy: [{ topic: "asc" }, { name: "asc" }],
  });
  if (assets.length === 0) return 0;

  const existing = await prisma.unitConditionReportItem.findMany({
    where: { reportId, assetId: { in: assets.map((a) => a.id) } },
    select: { assetId: true },
  });
  const seen = new Set(existing.map((e) => e.assetId));

  const toCreate = assets
    .filter((a) => !seen.has(a.id))
    .map((a) => ({
      reportId,
      assetId: a.id,
      roomLabel: a.topic,
      itemLabel: a.name,
      condition: ItemCondition.NOT_INSPECTED,
    }));
  if (toCreate.length === 0) return 0;

  const result = await prisma.unitConditionReportItem.createMany({ data: toCreate });
  return result.count;
}

export async function addItem(
  prisma: PrismaClient,
  reportId: string,
  data: {
    assetId?: string;
    roomLabel: string;
    itemLabel: string;
    condition: ItemCondition;
    notes?: string;
  },
) {
  return prisma.unitConditionReportItem.create({ data: { reportId, ...data } });
}

export async function upsertItem(
  prisma: PrismaClient,
  itemId: string,
  reportId: string,
  data: { condition?: ItemCondition; notes?: string },
) {
  return prisma.unitConditionReportItem.updateMany({
    where: { id: itemId, reportId },
    data,
  });
}

/** Lightweight metadata for delete-guard checks (does the item exist, is it asset-baselined?). */
export async function findItemMeta(prisma: PrismaClient, itemId: string, reportId: string) {
  return prisma.unitConditionReportItem.findFirst({
    where: { id: itemId, reportId },
    select: { id: true, assetId: true },
  });
}

export async function deleteItem(prisma: PrismaClient, itemId: string, reportId: string) {
  // Coverage lock: asset-baselined items (assetId set) can never be deleted — only
  // free-form extras (assetId null) are removable. Guarantees every asset stays reported on.
  return prisma.unitConditionReportItem.deleteMany({ where: { id: itemId, reportId, assetId: null } });
}

export async function addPhoto(
  prisma: PrismaClient,
  itemId: string,
  storageKey: string,
  caption?: string,
) {
  return prisma.unitConditionReportPhoto.create({ data: { itemId, storageKey, caption } });
}

export async function deletePhoto(prisma: PrismaClient, photoId: string, itemId: string) {
  return prisma.unitConditionReportPhoto.deleteMany({ where: { id: photoId, itemId } });
}

export async function setStatus(
  prisma: PrismaClient,
  id: string,
  status: ConditionReportStatus,
  extra?: { submittedAt?: Date; approvedAt?: Date; approvedByUserId?: string; managerNotes?: string },
) {
  return prisma.unitConditionReport.update({ where: { id }, data: { status, ...extra } });
}

// ── Auto-creation lookups (used by createReportFromLease) ──────────────────────

/** Load a lease with the unit/building/config/occupancy shape needed to seed a report. */
export async function findLeaseForReportCreation(prisma: PrismaClient, leaseId: string) {
  return prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      unit: {
        include: {
          building: {
            include: { config: { select: { conditionReportDeadlineDays: true } } },
          },
          occupancies: { select: { tenantId: true }, take: 1 },
        },
      },
    },
  });
}

/** Idempotency guard: find an existing report for a lease + type. */
export async function findReportByLeaseAndType(
  prisma: PrismaClient,
  leaseId: string,
  type: ConditionReportType,
) {
  return prisma.unitConditionReport.findFirst({ where: { leaseId, type } });
}
