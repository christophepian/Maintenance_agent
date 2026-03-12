/**
 * Maintenance Attachment Routes
 *
 * Thin HTTP handlers for uploading, listing, and downloading
 * maintenance-request attachments.
 *
 * Route → Workflow / Repository.  No business logic here.
 */

import { Router, HandlerContext } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { getAuthUser, requireAuth, requireTenantSession } from "../authz";
import { resolveRequestOrg, assertOrgScope } from "../governance/orgScope";
import { readRawBody, parseMultipart, MAX_FILE_SIZE, storage } from "../storage/attachments";
import { maintenanceAttachmentRepo } from "../repositories";
import { uploadMaintenanceAttachmentWorkflow } from "../workflows/uploadMaintenanceAttachmentWorkflow";

/* ── Helper: build WorkflowContext from HandlerContext ────────── */

function wfCtx(ctx: HandlerContext) {
  const actor = getAuthUser(ctx.req);
  return {
    orgId: ctx.orgId,
    prisma: ctx.prisma,
    actorUserId: actor?.userId ?? null,
  };
}

/* ── Route registration ──────────────────────────────────────── */

export function registerMaintenanceAttachmentRoutes(router: Router) {

  /**
   * GET /maintenance-attachments/:requestId
   * List attachments for a maintenance request.
   */
  router.get("/maintenance-attachments/:requestId", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireAuth(req, res)) return;

    const resolution = await resolveRequestOrg(prisma, params.requestId);
    if (!resolution.resolved) {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    try {
      assertOrgScope(orgId, resolution);
    } catch {
      return sendError(res, 403, "FORBIDDEN", "Not authorised for this request");
    }

    const records = await maintenanceAttachmentRepo.findAttachmentsByRequestId(
      prisma,
      params.requestId,
    );

    sendJson(res, 200, { data: records.map(maintenanceAttachmentRepo.toDTO) });
  });

  /**
   * POST /maintenance-attachments/:requestId
   * Upload a file attachment. Multipart: field "file" (binary).
   */
  router.post("/maintenance-attachments/:requestId", async (ctx) => {
    const { req, res, params } = ctx;
    if (!requireAuth(req, res)) return;

    try {
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/i);

      if (!boundaryMatch) {
        return sendError(
          res, 400, "BAD_REQUEST",
          "Content-Type must be multipart/form-data with boundary",
        );
      }

      const rawBody = await readRawBody(req, MAX_FILE_SIZE + 128 * 1024);
      const parts = parseMultipart(rawBody, boundaryMatch[1]);

      const filePart = parts.find((p) => p.name === "file" && p.filename);
      if (!filePart) {
        return sendError(
          res, 400, "BAD_REQUEST",
          'Missing "file" field with filename in multipart body',
        );
      }

      if (filePart.data.length > MAX_FILE_SIZE) {
        return sendError(
          res, 413, "PAYLOAD_TOO_LARGE",
          `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
        );
      }

      const result = await uploadMaintenanceAttachmentWorkflow(wfCtx(ctx), {
        requestId: params.requestId,
        fileName: filePart.filename!,
        mimeType: filePart.contentType || "application/octet-stream",
        buffer: filePart.data,
      });

      sendJson(res, 201, { data: result.attachment });
    } catch (e: any) {
      if (e.code === "NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", e.message);
      }
      if (e.code === "ORG_SCOPE_MISMATCH") {
        return sendError(res, 403, "FORBIDDEN", "Not authorised for this request");
      }
      console.error("[MAINT-ATTACH] upload error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to upload attachment", e.message);
    }
  });

  /**
   * GET /maintenance-attachments/:id/download
   * Download the raw file for a maintenance attachment.
   */
  router.get("/maintenance-attachments/:id/download", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireAuth(req, res)) return;

    try {
      const attachment = await maintenanceAttachmentRepo.findAttachmentById(
        prisma,
        params.id,
      );
      if (!attachment) {
        return sendError(res, 404, "NOT_FOUND", "Attachment not found");
      }

      // Org-scope: resolve via the parent request
      const resolution = await resolveRequestOrg(prisma, attachment.requestId);
      try {
        assertOrgScope(orgId, resolution);
      } catch {
        return sendError(res, 403, "FORBIDDEN", "Not authorised for this attachment");
      }

      const fileExists = await storage.exists(attachment.storageKey);
      if (!fileExists) {
        return sendError(res, 404, "NOT_FOUND", "Attachment file not found on disk");
      }

      const buffer = await storage.get(attachment.storageKey);
      res.writeHead(200, {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      });
      res.end(buffer);
    } catch (e: any) {
      console.error("[MAINT-ATTACH] download error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to download attachment", e.message);
    }
  });

  // ────────────── Tenant Portal Routes ────────────────────────

  /**
   * GET /tenant-portal/maintenance-attachments/:requestId
   * List attachments for a tenant's own maintenance request.
   */
  router.get("/tenant-portal/maintenance-attachments/:requestId", async (ctx) => {
    const { req, res, prisma, params } = ctx;
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;

    // Verify request exists and belongs to this tenant
    const request = await prisma.request.findUnique({
      where: { id: params.requestId },
      select: { tenantId: true },
    });
    if (!request) {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    if (request.tenantId !== tenantId) {
      return sendError(res, 403, "FORBIDDEN", "Not authorised for this request");
    }

    const records = await maintenanceAttachmentRepo.findAttachmentsByRequestId(
      prisma,
      params.requestId,
    );
    sendJson(res, 200, { data: records.map(maintenanceAttachmentRepo.toDTO) });
  });

  /**
   * POST /tenant-portal/maintenance-attachments/:requestId
   * Upload a file attachment from the tenant portal.
   */
  router.post("/tenant-portal/maintenance-attachments/:requestId", async (ctx) => {
    const { req, res, prisma, params } = ctx;
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;

    try {
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/i);

      if (!boundaryMatch) {
        return sendError(
          res, 400, "BAD_REQUEST",
          "Content-Type must be multipart/form-data with boundary",
        );
      }

      const rawBody = await readRawBody(req, MAX_FILE_SIZE + 128 * 1024);
      const parts = parseMultipart(rawBody, boundaryMatch[1]);

      const filePart = parts.find((p) => p.name === "file" && p.filename);
      if (!filePart) {
        return sendError(
          res, 400, "BAD_REQUEST",
          'Missing "file" field with filename in multipart body',
        );
      }

      if (filePart.data.length > MAX_FILE_SIZE) {
        return sendError(
          res, 413, "PAYLOAD_TOO_LARGE",
          `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
        );
      }

      // Resolve org from request for workflow context
      const resolution = await resolveRequestOrg(prisma, params.requestId);
      const tenantOrgId = resolution.resolved ? resolution.orgId! : ctx.orgId;

      const result = await uploadMaintenanceAttachmentWorkflow(
        { orgId: tenantOrgId, prisma, actorUserId: tenantId },
        {
          requestId: params.requestId,
          fileName: filePart.filename!,
          mimeType: filePart.contentType || "application/octet-stream",
          buffer: filePart.data,
          tenantId,
        },
      );

      sendJson(res, 201, { data: result.attachment });
    } catch (e: any) {
      if (e.code === "NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", e.message);
      }
      if (e.code === "FORBIDDEN") {
        return sendError(res, 403, "FORBIDDEN", e.message);
      }
      console.error("[MAINT-ATTACH] tenant upload error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to upload attachment", e.message);
    }
  });

  /**
   * GET /tenant-portal/maintenance-attachments/:id/download
   * Download the raw file for a maintenance attachment (tenant portal).
   */
  router.get("/tenant-portal/maintenance-attachments/:id/download", async (ctx) => {
    const { req, res, prisma, params } = ctx;
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;

    try {
      const attachment = await maintenanceAttachmentRepo.findAttachmentById(
        prisma,
        params.id,
      );
      if (!attachment) {
        return sendError(res, 404, "NOT_FOUND", "Attachment not found");
      }

      // Verify the parent request belongs to this tenant
      const request = await prisma.request.findUnique({
        where: { id: attachment.requestId },
        select: { tenantId: true },
      });
      if (!request || request.tenantId !== tenantId) {
        return sendError(res, 403, "FORBIDDEN", "Not authorised for this attachment");
      }

      const fileExists = await storage.exists(attachment.storageKey);
      if (!fileExists) {
        return sendError(res, 404, "NOT_FOUND", "Attachment file not found on disk");
      }

      const buffer = await storage.get(attachment.storageKey);
      res.writeHead(200, {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      });
      res.end(buffer);
    } catch (e: any) {
      console.error("[MAINT-ATTACH] tenant download error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to download attachment", e.message);
    }
  });
}
