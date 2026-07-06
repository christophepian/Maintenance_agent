/**
 * Inventory CSV import service — buildings & units.
 *
 * Two phases behind a review gate:
 *   previewImport — parse + validate CSV into ImportBatch/ImportRow staging
 *                   (no writes to real tables)
 *   commitImport  — create Building/Unit records for every VALID row, then
 *                   flip the batch to COMMITTED
 *
 * Reuses the existing create/update services (services/inventory.ts) so imported
 * rows go through the same validation and asset-seeding as manual creation.
 * All Prisma access is via importBatchRepository (G20) except the create/update
 * services, which own their own repository access.
 */

import {
  PrismaClient,
  ImportEntityType,
  ImportBatchStatus,
  ImportRowStatus,
} from "@prisma/client";
import { parseCsv } from "../utils/csvParser";
import { validateRow, isBlankRow, ImportEntity } from "../validation/inventoryImport";
import * as importRepo from "../repositories/importBatchRepository";
import { mapImportBatchToDTO, ImportBatchDTO } from "../dto/importBatch";
import {
  createBuilding,
  updateBuilding,
  createUnit,
  updateUnit,
} from "./inventory";

export class InventoryImportError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "InventoryImportError";
  }
}

/** Drop keys whose value is undefined so the row stores clean JSON. */
function clean(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/* ── Preview ──────────────────────────────────────────────────────────────── */

export async function previewImport(
  prisma: PrismaClient,
  input: {
    orgId: string;
    entityType: ImportEntityType;
    csvText: string;
    fileName: string;
    uploadedBy: string;
  },
): Promise<ImportBatchDTO> {
  const entity = input.entityType as ImportEntity;

  let parsed;
  try {
    parsed = parseCsv(input.csvText);
  } catch (e: any) {
    throw new InventoryImportError("INVALID_CSV", e?.message || "Could not parse CSV");
  }

  const newRows: importRepo.NewImportRow[] = [];
  parsed.rows.forEach((raw, i) => {
    if (isBlankRow(entity, raw)) return; // skip fully-blank lines
    const rowIndex = i + 1;
    const res = validateRow(entity, raw);
    if (res.ok && res.data) {
      newRows.push({
        rowIndex,
        rawJson: clean(res.data as Record<string, unknown>) as any,
        status: ImportRowStatus.VALID,
      });
    } else {
      newRows.push({
        rowIndex,
        rawJson: clean(raw) as any,
        status: ImportRowStatus.ERROR,
        errorMessage: res.error ?? "Invalid row",
      });
    }
  });

  if (newRows.length === 0) {
    throw new InventoryImportError("EMPTY_CSV", "No data rows found in the CSV");
  }

  const batch = await importRepo.createBatchWithRows(prisma, {
    orgId: input.orgId,
    entityType: input.entityType,
    fileName: input.fileName,
    uploadedBy: input.uploadedBy,
    rows: newRows,
  });

  return mapImportBatchToDTO(batch);
}

/* ── Commit ───────────────────────────────────────────────────────────────── */

export interface CommitResult {
  batch: ImportBatchDTO;
  committed: number;
  errors: number;
}

export async function commitImport(
  prisma: PrismaClient,
  orgId: string,
  batchId: string,
): Promise<CommitResult> {
  const batch = await importRepo.findBatchById(prisma, batchId, orgId);
  if (!batch) throw new InventoryImportError("NOT_FOUND", "Import batch not found");
  if (batch.status !== ImportBatchStatus.PENDING_REVIEW) {
    throw new InventoryImportError("ALREADY_RESOLVED", `Batch is already ${batch.status}`);
  }

  let committed = 0;
  let errors = 0;

  for (const row of batch.rows) {
    if (row.status !== ImportRowStatus.VALID) {
      errors++;
      continue;
    }
    const data = (row.rawJson as Record<string, any>) ?? {};
    try {
      let entityId: string;

      if (batch.entityType === ImportEntityType.BUILDING) {
        const { name, address, ...rest } = data;
        const building = await createBuilding(orgId, { name, address });
        if (Object.keys(rest).length > 0) {
          await updateBuilding(orgId, building.id, rest);
        }
        entityId = building.id;
      } else {
        // Resolve buildingRef at commit time so units can be imported right
        // after their buildings in the same session.
        const resolved = await importRepo.resolveBuildingRef(prisma, orgId, String(data.buildingRef ?? ""));
        if (resolved === null) {
          throw new Error(`No building matches buildingRef "${data.buildingRef}"`);
        }
        if (resolved === "AMBIGUOUS") {
          throw new Error(`buildingRef "${data.buildingRef}" matches more than one building — use the building id`);
        }
        const { buildingRef, unitNumber, floor, type, parkingKind, ...rest } = data;
        const unit = await createUnit(orgId, resolved, { unitNumber, floor, type, parkingKind });
        if (!unit) throw new Error("Building not found while creating unit");
        if (Object.keys(rest).length > 0) {
          await updateUnit(orgId, unit.id, rest);
        }
        entityId = unit.id;
      }

      await importRepo.updateRow(prisma, row.id, {
        status: ImportRowStatus.COMMITTED,
        createdEntityId: entityId,
        errorMessage: null,
      });
      committed++;
    } catch (e: any) {
      await importRepo.updateRow(prisma, row.id, {
        status: ImportRowStatus.ERROR,
        errorMessage: String(e?.message || e),
      });
      errors++;
    }
  }

  const updated = await importRepo.updateBatchStatus(prisma, batchId, {
    status: ImportBatchStatus.COMMITTED,
    committedAt: new Date(),
    validCount: committed,
    errorCount: errors,
  });

  return { batch: mapImportBatchToDTO(updated), committed, errors };
}

/* ── Passthrough reads / delete ───────────────────────────────────────────── */

export async function getBatch(
  prisma: PrismaClient,
  batchId: string,
  orgId: string,
): Promise<ImportBatchDTO | null> {
  const batch = await importRepo.findBatchById(prisma, batchId, orgId);
  return batch ? mapImportBatchToDTO(batch) : null;
}

export async function listBatches(
  prisma: PrismaClient,
  orgId: string,
  opts: { entityType?: ImportEntityType; limit: number; offset: number },
): Promise<{ data: ImportBatchDTO[]; total: number }> {
  const result = await importRepo.listBatches(prisma, orgId, opts);
  return { data: result.data.map(mapImportBatchToDTO), total: result.total };
}

export async function deleteBatch(prisma: PrismaClient, batchId: string, orgId: string): Promise<number> {
  return importRepo.deleteBatch(prisma, batchId, orgId);
}
