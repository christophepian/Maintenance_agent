/**
 * Maintenance Attachment Repository
 *
 * Centralizes all Prisma access for the MaintenanceAttachment entity.
 * G3: canonical include constant exported for DTO mapping.
 */

import { PrismaClient, Prisma } from "@prisma/client";

/* ── Canonical Include ──────────────────────────────────────── */

export const MAINTENANCE_ATTACHMENT_INCLUDE = {} as const;

type AttachmentPayload = Prisma.MaintenanceAttachmentGetPayload<{
  include: typeof MAINTENANCE_ATTACHMENT_INCLUDE;
}>;

/* ── DTO Mapper ─────────────────────────────────────────────── */

export interface MaintenanceAttachmentDTO {
  id: string;
  requestId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string | null;
  createdAt: string;
  url: string;
}

export function toDTO(
  attachment: AttachmentPayload,
): MaintenanceAttachmentDTO {
  return {
    id: attachment.id,
    requestId: attachment.requestId,
    filename: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.sizeBytes,
    uploadedBy: attachment.uploadedBy,
    createdAt: attachment.createdAt.toISOString(),
    url: `/maintenance-attachments/${attachment.id}/download`,
  };
}

/* ── Queries ────────────────────────────────────────────────── */

export async function createAttachment(
  prisma: PrismaClient,
  data: {
    requestId: string;
    fileName: string;
    mimeType: string;
    storageKey: string;
    sizeBytes: number;
    uploadedBy: string | null;
  },
) {
  return prisma.maintenanceAttachment.create({
    data,
    include: MAINTENANCE_ATTACHMENT_INCLUDE,
  });
}

export async function findAttachmentsByRequestId(
  prisma: PrismaClient,
  requestId: string,
) {
  return prisma.maintenanceAttachment.findMany({
    where: { requestId },
    orderBy: { createdAt: "asc" },
    include: MAINTENANCE_ATTACHMENT_INCLUDE,
  });
}

export async function findAttachmentById(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.maintenanceAttachment.findUnique({
    where: { id },
    include: MAINTENANCE_ATTACHMENT_INCLUDE,
  });
}
