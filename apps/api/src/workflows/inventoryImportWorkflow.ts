/**
 * inventoryImportWorkflow
 *
 * Orchestrates the bulk CSV import of buildings & units. Delegates parsing,
 * validation, and record creation to inventoryImportService; owns the audit
 * trail for the commit action.
 *
 * Workflows:
 *   1. previewImportWorkflow — parse + validate CSV into a staging batch
 *   2. commitImportWorkflow  — create real records + write an audit log
 */

import { PrismaClient, ImportEntityType } from "@prisma/client";
import {
  previewImport,
  commitImport,
  CommitResult,
} from "../services/inventoryImportService";
import { ImportBatchDTO } from "../dto/importBatch";
import { writeAuditLog } from "../services/auditLog";

export async function previewImportWorkflow(
  prisma: PrismaClient,
  input: {
    orgId: string;
    entityType: ImportEntityType;
    csvText: string;
    fileName: string;
    uploadedBy: string;
  },
): Promise<ImportBatchDTO> {
  return previewImport(prisma, input);
}

export async function commitImportWorkflow(
  prisma: PrismaClient,
  input: { orgId: string; batchId: string; actorUserId: string },
): Promise<CommitResult> {
  const result = await commitImport(prisma, input.orgId, input.batchId);

  await writeAuditLog(prisma, {
    action: "INVENTORY_IMPORT_COMMITTED",
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    entityType: "ImportBatch",
    entityId: input.batchId,
    metadata: {
      entityType: result.batch.entityType,
      committed: result.committed,
      errors: result.errors,
    },
  });

  return result;
}
