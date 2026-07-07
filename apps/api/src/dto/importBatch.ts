/**
 * ImportBatch DTO — stable API shape for the bulk CSV import staging tables.
 * Mapper reads from ImportBatchWithRows (repository IMPORT_BATCH_INCLUDE).
 */

import { ImportEntityType, ImportBatchStatus, ImportRowStatus } from "@prisma/client";
import type { ImportBatchWithRows } from "../repositories/importBatchRepository";

export interface ImportRowDTO {
  id: string;
  rowIndex: number;
  status: ImportRowStatus;
  errorMessage: string | null;
  createdEntityId: string | null;
  /** The parsed, normalized row payload (as uploaded). */
  data: Record<string, unknown>;
}

export interface ImportBatchDTO {
  id: string;
  entityType: ImportEntityType;
  fileName: string;
  uploadedBy: string;
  status: ImportBatchStatus;
  rowCount: number;
  validCount: number;
  errorCount: number;
  createdAt: string;
  committedAt: string | null;
  rows: ImportRowDTO[];
}

export function mapImportRowToDTO(row: ImportBatchWithRows["rows"][number]): ImportRowDTO {
  return {
    id: row.id,
    rowIndex: row.rowIndex,
    status: row.status,
    errorMessage: row.errorMessage,
    createdEntityId: row.createdEntityId,
    data: (row.rawJson as Record<string, unknown>) ?? {},
  };
}

export function mapImportBatchToDTO(batch: ImportBatchWithRows): ImportBatchDTO {
  return {
    id: batch.id,
    entityType: batch.entityType,
    fileName: batch.fileName,
    uploadedBy: batch.uploadedBy,
    status: batch.status,
    rowCount: batch.rowCount,
    validCount: batch.validCount,
    errorCount: batch.errorCount,
    createdAt: batch.createdAt.toISOString(),
    committedAt: batch.committedAt ? batch.committedAt.toISOString() : null,
    rows: batch.rows.map(mapImportRowToDTO),
  };
}
