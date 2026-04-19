/**
 * Upload Maintenance Attachment Workflow
 *
 * Orchestration:
 * 1. Verify request exists
 * 2. Assert org scope
 * 3. Build storage key
 * 4. Persist file via storage.put()
 * 5. Create DB record via repository
 * 6. Emit MAINTENANCE_ATTACHMENT_UPLOADED event
 */

import * as crypto from "crypto";
import { WorkflowContext } from "./context";
import { OrgScopeMismatchError } from "../governance/orgScope";
import { maintenanceAttachmentRepo } from "../repositories";
import { storage } from "../storage/attachments";
import { emit } from "../events/bus";

/* ── Input / Output ─────────────────────────────────────────── */

export interface UploadMaintenanceAttachmentInput {
  requestId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  /** When set, tenant-actor path: ownership is verified instead of org scope. */
  tenantId?: string;
}

/* ── Workflow ────────────────────────────────────────────────── */

export async function uploadMaintenanceAttachmentWorkflow(
  ctx: WorkflowContext,
  input: UploadMaintenanceAttachmentInput,
) {
  const { prisma, actorUserId } = ctx;
  const { requestId, fileName, mimeType, buffer, tenantId } = input;

  // 1. Verify request exists
  const reqRow = await prisma.request.findUnique({
    where: { id: requestId },
    select: { orgId: true, tenantId: true },
  });
  if (!reqRow) {
    throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });
  }

  // 2a. Tenant-actor path: verify ownership
  if (tenantId) {
    if (reqRow.tenantId !== tenantId) {
      throw Object.assign(new Error("Not authorised for this request"), {
        code: "FORBIDDEN",
      });
    }
  } else {
    // 2b. Manager/standard path: assert org scope
    if (reqRow.orgId !== ctx.orgId) {
      throw new OrgScopeMismatchError(ctx.orgId, reqRow.orgId, "direct");
    }
  }

  const orgId = reqRow.orgId;

  // 3. Build storage key: maintenance-attachments/<requestId>/<uuid>.<ext>
  const uuid = crypto.randomUUID();
  const safeNameRegex = /[^a-zA-Z0-9.\-_]/g;
  const safeName = fileName.replace(safeNameRegex, "_");
  const storageKey = `maintenance-attachments/${requestId}/${uuid}-${safeName}`;

  // 4. Persist file
  await storage.put(storageKey, buffer);

  // 5. Create DB record
  const record = await maintenanceAttachmentRepo.createAttachment(prisma, {
    requestId,
    fileName,
    mimeType,
    storageKey,
    sizeBytes: buffer.length,
    uploadedBy: actorUserId ?? null,
  });

  // 6. Emit event
  emit({
    type: "MAINTENANCE_ATTACHMENT_UPLOADED",
    orgId,
    actorUserId,
    payload: {
      attachmentId: record.id,
      requestId,
      fileName,
    },
  }).catch((err) =>
    console.error("[EVENT] Failed to emit MAINTENANCE_ATTACHMENT_UPLOADED", err),
  );

  return { attachment: maintenanceAttachmentRepo.toDTO(record) };
}
