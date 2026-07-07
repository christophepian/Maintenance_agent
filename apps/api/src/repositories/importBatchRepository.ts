/**
 * ImportBatch repository — canonical Prisma access for the bulk CSV import
 * staging tables (ImportBatch / ImportRow). Buildings & units.
 */

import {
  PrismaClient,
  Prisma,
  ImportEntityType,
  ImportBatchStatus,
  ImportRowStatus,
} from "@prisma/client";

export const IMPORT_BATCH_INCLUDE = {
  rows: { orderBy: { rowIndex: "asc" as const } },
} satisfies Prisma.ImportBatchInclude;

export type ImportBatchWithRows = Prisma.ImportBatchGetPayload<{
  include: typeof IMPORT_BATCH_INCLUDE;
}>;

export interface NewImportRow {
  rowIndex: number;
  rawJson: Prisma.InputJsonValue;
  status: ImportRowStatus;
  errorMessage?: string | null;
}

export async function createBatchWithRows(
  prisma: PrismaClient,
  data: {
    orgId: string;
    entityType: ImportEntityType;
    fileName: string;
    uploadedBy: string;
    rows: NewImportRow[];
  },
): Promise<ImportBatchWithRows> {
  const validCount = data.rows.filter((r) => r.status === ImportRowStatus.VALID).length;
  return prisma.importBatch.create({
    data: {
      orgId: data.orgId,
      entityType: data.entityType,
      fileName: data.fileName,
      uploadedBy: data.uploadedBy,
      rowCount: data.rows.length,
      validCount,
      errorCount: data.rows.length - validCount,
      rows: { create: data.rows },
    },
    include: IMPORT_BATCH_INCLUDE,
  });
}

export async function findBatchById(
  prisma: PrismaClient,
  id: string,
  orgId: string,
): Promise<ImportBatchWithRows | null> {
  return prisma.importBatch.findFirst({
    where: { id, orgId },
    include: IMPORT_BATCH_INCLUDE,
  });
}

export async function listBatches(
  prisma: PrismaClient,
  orgId: string,
  opts: { entityType?: ImportEntityType; limit: number; offset: number },
): Promise<{ data: ImportBatchWithRows[]; total: number }> {
  const where: Prisma.ImportBatchWhereInput = {
    orgId,
    ...(opts.entityType ? { entityType: opts.entityType } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.importBatch.findMany({
      where,
      include: IMPORT_BATCH_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
    prisma.importBatch.count({ where }),
  ]);
  return { data, total };
}

export async function updateBatchStatus(
  prisma: PrismaClient,
  id: string,
  update: {
    status?: ImportBatchStatus;
    committedAt?: Date | null;
    validCount?: number;
    errorCount?: number;
  },
): Promise<ImportBatchWithRows> {
  return prisma.importBatch.update({
    where: { id },
    data: update,
    include: IMPORT_BATCH_INCLUDE,
  });
}

export async function updateRow(
  prisma: PrismaClient,
  rowId: string,
  update: { status: ImportRowStatus; errorMessage?: string | null; createdEntityId?: string | null },
): Promise<void> {
  await prisma.importRow.update({ where: { id: rowId }, data: update });
}

export async function deleteBatch(prisma: PrismaClient, id: string, orgId: string): Promise<number> {
  const result = await prisma.importBatch.deleteMany({ where: { id, orgId } });
  return result.count;
}

/**
 * Resolve a unit CSV's `buildingRef` (id, exact name, or exact address) to a
 * building in the org. Returns the building id, null if not found, or the
 * literal "AMBIGUOUS" when more than one building matches.
 */
export async function resolveBuildingRef(
  prisma: PrismaClient,
  orgId: string,
  ref: string,
): Promise<string | null | "AMBIGUOUS"> {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  const matches = await prisma.building.findMany({
    where: {
      orgId,
      OR: [
        { id: trimmed },
        { name: { equals: trimmed, mode: "insensitive" } },
        { address: { equals: trimmed, mode: "insensitive" } },
      ],
    },
    select: { id: true },
    take: 2,
  });

  if (matches.length === 0) return null;
  if (matches.length > 1) return "AMBIGUOUS";
  return matches[0].id;
}
