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

export async function deleteItem(prisma: PrismaClient, itemId: string, reportId: string) {
  return prisma.unitConditionReportItem.deleteMany({ where: { id: itemId, reportId } });
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
