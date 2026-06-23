/**
 * Condition Report routes (État des lieux)
 *
 * Manager endpoints:
 *   GET  /units/:id/condition-reports                                      — list for a unit
 *   POST /units/:id/condition-reports                                      — manually create
 *   GET  /condition-reports/:id                                            — detail + items + delta
 *   POST /condition-reports/:id/approve                                    — manager sign-off
 *   POST /condition-reports/:id/reopen                                     — send back to tenant
 *   GET  /condition-report-photos/:photoId                                 — serve photo file
 *
 * Tenant-portal endpoints:
 *   GET    /tenant-portal/condition-reports                                — tenant inbox
 *   GET    /tenant-portal/condition-reports/:id                           — report detail
 *   POST   /tenant-portal/condition-reports/:id/items                     — add item
 *   PATCH  /tenant-portal/condition-reports/:id/items/:itemId             — update item
 *   DELETE /tenant-portal/condition-reports/:id/items/:itemId             — remove item
 *   POST   /tenant-portal/condition-reports/:id/items/:itemId/photos      — upload photo
 *   DELETE /tenant-portal/condition-reports/:id/items/:itemId/photos/:photoId — delete photo
 *   POST   /tenant-portal/condition-reports/:id/submit                    — submit
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { readRawBody, parseMultipart, storage } from "../storage/attachments";
import { maybeRequireManager, requireTenantSession, requireAuth } from "../authz";
import { ConditionReportType, ConditionReportStatus, ItemCondition } from "@prisma/client";
import * as repo from "../repositories/conditionReportRepository";
import * as svc from "../services/conditionReportService";
import { assertConditionReportTransition } from "../workflows/transitions";
import { randomUUID } from "crypto";
import { createNotification } from "../services/notifications";
import { enqueueEmail } from "../services/emailOutbox";
import { trySendImmediate } from "../services/emailTransport";
import * as userRepo from "../repositories/userRepository";

const ACCEPTED_PHOTO_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

const VALID_CONDITIONS = Object.values(ItemCondition);
const VALID_TYPES = Object.values(ConditionReportType);

// ── DTO mappers ────────────────────────────────────────────────────────────────

function mapListItem(r: any) {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    dueAt: r.dueAt,
    submittedAt: r.submittedAt,
    approvedAt: r.approvedAt,
    itemCount: r._count?.items ?? 0,
    tenant: r.tenant,
    createdAt: r.createdAt,
  };
}

function mapFull(r: repo.ReportFull) {
  return {
    id: r.id,
    orgId: r.orgId,
    type: r.type,
    status: r.status,
    dueAt: r.dueAt,
    submittedAt: r.submittedAt,
    approvedAt: r.approvedAt,
    managerNotes: r.managerNotes,
    unit: r.unit,
    tenant: r.tenant,
    lease: r.lease,
    approvedBy: r.approvedBy,
    items: r.items.map((it) => ({
      id: it.id,
      assetId: it.assetId,
      asset: it.asset,
      roomLabel: it.roomLabel,
      itemLabel: it.itemLabel,
      condition: it.condition,
      notes: it.notes,
      photos: it.photos,
    })),
    createdAt: r.createdAt,
  };
}

export function registerConditionReportRoutes(router: Router) {

  // ── GET /units/:id/condition-reports ─────────────────────────────────────────
  router.get("/units/:id/condition-reports", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const reports = await repo.listByUnit(prisma, params.id, orgId);
      sendJson(res, 200, { data: reports.map(mapListItem) });
    } catch (e) {
      console.error("[condition-reports/listByUnit]", e);
      sendError(res, 500, "DB_ERROR", "Failed to list reports", String(e));
    }
  });

  // ── POST /units/:id/condition-reports ────────────────────────────────────────
  router.post("/units/:id/condition-reports", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const body = await readJson(req) as any;
      if (!VALID_TYPES.includes(body.type)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid type");
      }

      // Verify unit belongs to org
      const unit = await prisma.unit.findFirst({ where: { id: params.id, orgId } });
      if (!unit) return sendError(res, 404, "NOT_FOUND", "Unit not found");

      if (!body.tenantId || !body.leaseId) {
        return sendError(res, 400, "VALIDATION_ERROR", "tenantId and leaseId are required");
      }

      const dueAt = body.dueAtDays
        ? (() => { const d = new Date(); d.setDate(d.getDate() + Number(body.dueAtDays)); return d; })()
        : undefined;

      const report = await repo.createReport(prisma, {
        orgId,
        unitId: params.id,
        tenantId: body.tenantId,
        leaseId: body.leaseId,
        type: body.type as ConditionReportType,
        dueAt,
      });
      // Baseline against the unit's asset inventory so every asset is reported on.
      await repo.seedAssetItems(prisma, report.id, orgId, params.id);
      sendJson(res, 201, { data: report });
    } catch (e) {
      console.error("[condition-reports/create]", e);
      sendError(res, 500, "DB_ERROR", "Failed to create report", String(e));
    }
  });

  // ── GET /condition-reports/:id ────────────────────────────────────────────────
  router.get("/condition-reports/:id", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const report = await repo.findById(prisma, params.id, orgId);
      if (!report) return sendError(res, 404, "NOT_FOUND", "Report not found");

      const withDelta = await svc.attachDelta(prisma, report);
      sendJson(res, 200, {
        data: {
          ...mapFull(report),
          delta: withDelta.delta,
          deltaCount: withDelta.deltaCount,
          hasUnphotoedDeltas: withDelta.hasUnphotoedDeltas,
        },
      });
    } catch (e) {
      console.error("[condition-reports/get]", e);
      sendError(res, 500, "DB_ERROR", "Failed to fetch report", String(e));
    }
  });

  // ── POST /condition-reports/:id/approve ───────────────────────────────────────
  router.post("/condition-reports/:id/approve", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const report = await repo.findById(prisma, params.id, orgId);
      if (!report) return sendError(res, 404, "NOT_FOUND", "Report not found");
      assertConditionReportTransition(report.status, ConditionReportStatus.APPROVED);

      const body = await readJson(req).catch(() => ({})) as any;
      await repo.setStatus(prisma, params.id, ConditionReportStatus.APPROVED, {
        approvedAt: new Date(),
        approvedByUserId: (req as any).user?.userId,
        managerNotes: body.managerNotes,
      });

      // Email tenant confirmation (best-effort)
      const tenant = await prisma.tenant.findUnique({
        where: { id: report.tenantId }, select: { email: true, name: true },
      });
      if (tenant?.email) {
        const emailRecord = await enqueueEmail(orgId, {
          toEmail: tenant.email,
          template: "TENANT_LETTER",
          subject: "Votre état des lieux a été approuvé / Your condition report has been approved",
          bodyText: [
            `${tenant.name ? `Chère/Cher ${tenant.name},` : "Madame, Monsieur,"}`,
            "",
            "Votre état des lieux a été examiné et approuvé par la gérance.",
            "Your condition report has been reviewed and approved by the property manager.",
            "",
            "La Gérance",
          ].join("\n"),
          metaJson: { conditionReportId: params.id },
        });
        trySendImmediate(emailRecord.id);
      }

      sendJson(res, 200, { data: { ok: true } });
    } catch (e: any) {
      if (e?.code === "INVALID_TRANSITION") return sendError(res, 409, "CONFLICT", e.message);
      console.error("[condition-reports/approve]", e);
      sendError(res, 500, "DB_ERROR", "Failed to approve report", String(e));
    }
  });

  // ── POST /condition-reports/:id/reopen ───────────────────────────────────────
  router.post("/condition-reports/:id/reopen", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const report = await repo.findById(prisma, params.id, orgId);
      if (!report) return sendError(res, 404, "NOT_FOUND", "Report not found");
      assertConditionReportTransition(report.status, ConditionReportStatus.PENDING);

      const body = await readJson(req).catch(() => ({})) as any;
      if (!body.managerNotes?.trim()) {
        return sendError(res, 400, "VALIDATION_ERROR", "managerNotes required when reopening");
      }
      await repo.setStatus(prisma, params.id, ConditionReportStatus.PENDING, {
        managerNotes: body.managerNotes,
      });
      sendJson(res, 200, { data: { ok: true } });
    } catch (e: any) {
      if (e?.code === "INVALID_TRANSITION") return sendError(res, 409, "CONFLICT", e.message);
      console.error("[condition-reports/reopen]", e);
      sendError(res, 500, "DB_ERROR", "Failed to reopen report", String(e));
    }
  });

  // ── GET /tenant-portal/condition-reports ─────────────────────────────────────
  router.get("/tenant-portal/condition-reports", async ({ req, res, orgId, prisma }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const reports = await repo.listByTenant(prisma, tenantId, orgId);
      sendJson(res, 200, { data: reports.map(mapListItem) });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to list reports", String(e));
    }
  });

  // ── GET /tenant-portal/condition-reports/:id ──────────────────────────────────
  router.get("/tenant-portal/condition-reports/:id", async ({ req, res, orgId, prisma, params }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const report = await repo.findById(prisma, params.id, orgId);
      if (!report || report.tenantId !== tenantId) {
        return sendError(res, 404, "NOT_FOUND", "Report not found");
      }
      sendJson(res, 200, { data: mapFull(report) });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch report", String(e));
    }
  });

  // ── POST /tenant-portal/condition-reports/:id/items ───────────────────────────
  router.post("/tenant-portal/condition-reports/:id/items", async ({ req, res, orgId, prisma, params }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const report = await repo.findById(prisma, params.id, orgId);
      if (!report || report.tenantId !== tenantId) {
        return sendError(res, 404, "NOT_FOUND", "Report not found");
      }
      if (report.status !== ConditionReportStatus.PENDING) {
        return sendError(res, 409, "CONFLICT", "Report is no longer editable");
      }

      const body = await readJson(req) as any;
      if (!body.roomLabel?.trim() || !body.itemLabel?.trim()) {
        return sendError(res, 400, "VALIDATION_ERROR", "roomLabel and itemLabel are required");
      }
      if (!VALID_CONDITIONS.includes(body.condition)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid condition");
      }

      const item = await repo.addItem(prisma, params.id, {
        assetId: body.assetId || undefined,
        roomLabel: body.roomLabel.trim(),
        itemLabel: body.itemLabel.trim(),
        condition: body.condition as ItemCondition,
        notes: body.notes?.trim() || undefined,
      });
      sendJson(res, 201, { data: item });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to add item", String(e));
    }
  });

  // ── PATCH /tenant-portal/condition-reports/:id/items/:itemId ─────────────────
  router.patch("/tenant-portal/condition-reports/:id/items/:itemId", async ({ req, res, orgId, prisma, params }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const report = await repo.findById(prisma, params.id, orgId);
      if (!report || report.tenantId !== tenantId) {
        return sendError(res, 404, "NOT_FOUND", "Report not found");
      }
      if (report.status !== ConditionReportStatus.PENDING) {
        return sendError(res, 409, "CONFLICT", "Report is no longer editable");
      }

      const body = await readJson(req) as any;
      if (body.condition && !VALID_CONDITIONS.includes(body.condition)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid condition");
      }

      await repo.upsertItem(prisma, params.itemId, params.id, {
        ...(body.condition && { condition: body.condition as ItemCondition }),
        ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
      });
      sendJson(res, 200, { data: { ok: true } });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to update item", String(e));
    }
  });

  // ── DELETE /tenant-portal/condition-reports/:id/items/:itemId ────────────────
  router.delete("/tenant-portal/condition-reports/:id/items/:itemId", async ({ req, res, orgId, prisma, params }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const report = await repo.findById(prisma, params.id, orgId);
      if (!report || report.tenantId !== tenantId) {
        return sendError(res, 404, "NOT_FOUND", "Report not found");
      }
      if (report.status !== ConditionReportStatus.PENDING) {
        return sendError(res, 409, "CONFLICT", "Report is no longer editable");
      }
      const meta = await repo.findItemMeta(prisma, params.itemId, params.id);
      if (!meta) return sendError(res, 404, "NOT_FOUND", "Item not found");
      if (meta.assetId) {
        return sendError(res, 409, "ASSET_ITEM_LOCKED", "Asset items are part of the inventory baseline and cannot be removed");
      }
      await repo.deleteItem(prisma, params.itemId, params.id);
      sendJson(res, 200, { data: { ok: true } });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to delete item", String(e));
    }
  });

  // ── POST /tenant-portal/condition-reports/:id/items/:itemId/photos ──────────
  router.post("/tenant-portal/condition-reports/:id/items/:itemId/photos", async ({ req, res, orgId, prisma, params }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const report = await repo.findById(prisma, params.id, orgId);
      if (!report || report.tenantId !== tenantId) {
        return sendError(res, 404, "NOT_FOUND", "Report not found");
      }
      if (report.status !== ConditionReportStatus.PENDING) {
        return sendError(res, 409, "CONFLICT", "Report is no longer editable");
      }

      // Verify item belongs to this report
      const item = report.items.find((i) => i.id === params.itemId);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Item not found");

      // Parse multipart body
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
      if (!boundaryMatch) {
        return sendError(res, 400, "BAD_REQUEST", "Content-Type must be multipart/form-data");
      }
      const rawBody = await readRawBody(req, MAX_PHOTO_SIZE);
      const parts = parseMultipart(rawBody, boundaryMatch[1]);
      const filePart = parts.find((p) => p.name === "photo" && p.filename);

      if (!filePart) {
        return sendError(res, 400, "BAD_REQUEST", 'Missing "photo" file field');
      }
      const mimeType = filePart.contentType ?? "image/jpeg";
      if (!ACCEPTED_PHOTO_MIMES.has(mimeType)) {
        return sendError(res, 400, "BAD_REQUEST", "Only JPEG, PNG, and WebP photos are accepted");
      }
      if (filePart.data.length > MAX_PHOTO_SIZE) {
        return sendError(res, 413, "PAYLOAD_TOO_LARGE", "Photo exceeds 5 MB limit");
      }

      const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const key = `condition-reports/${params.id}/${params.itemId}/${randomUUID()}.${ext}`;
      await storage.put(key, filePart.data);

      const captionPart = parts.find((p) => p.name === "caption" && !p.filename);
      const caption = captionPart ? captionPart.data.toString("utf8").trim() : undefined;

      const photo = await repo.addPhoto(prisma, params.itemId, key, caption || undefined);
      sendJson(res, 201, { data: { ...photo, url: `/api/condition-report-photos/${photo.id}` } });
    } catch (e: any) {
      if (e?.message?.includes("too large") || e?.code === "PAYLOAD_TOO_LARGE") {
        return sendError(res, 413, "PAYLOAD_TOO_LARGE", "Photo exceeds 5 MB limit");
      }
      console.error("[condition-reports/upload-photo]", e);
      sendError(res, 500, "UPLOAD_ERROR", "Failed to upload photo", String(e));
    }
  });

  // ── DELETE /tenant-portal/condition-reports/:id/items/:itemId/photos/:photoId ─
  router.delete("/tenant-portal/condition-reports/:id/items/:itemId/photos/:photoId", async ({ req, res, orgId, prisma, params }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const report = await repo.findById(prisma, params.id, orgId);
      if (!report || report.tenantId !== tenantId) {
        return sendError(res, 404, "NOT_FOUND", "Report not found");
      }
      if (report.status !== ConditionReportStatus.PENDING) {
        return sendError(res, 409, "CONFLICT", "Report is no longer editable");
      }
      // Fetch photo to get storageKey before deleting
      const photo = await prisma.unitConditionReportPhoto.findFirst({
        where: { id: params.photoId, itemId: params.itemId },
      });
      if (!photo) return sendError(res, 404, "NOT_FOUND", "Photo not found");

      await repo.deletePhoto(prisma, params.photoId, params.itemId);
      storage.delete(photo.storageKey).catch(() => {}); // best-effort storage cleanup
      sendJson(res, 200, { data: { ok: true } });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to delete photo", String(e));
    }
  });

  // ── GET /condition-report-photos/:photoId — serve photo file ─────────────────
  // Accessible to any authenticated user (manager or tenant) — auth enforced by requireAuth.
  router.get("/condition-report-photos/:photoId", async ({ req, res, prisma, params }) => {
    if (!requireAuth(req, res)) return;
    try {
      const photo = await prisma.unitConditionReportPhoto.findUnique({
        where: { id: params.photoId },
      });
      if (!photo) return sendError(res, 404, "NOT_FOUND", "Photo not found");

      const buffer = await storage.get(photo.storageKey);
      const ext = photo.storageKey.split(".").pop() ?? "jpg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": buffer.length,
        "Cache-Control": "private, max-age=3600",
      });
      res.end(buffer);
    } catch (e) {
      sendError(res, 500, "STORAGE_ERROR", "Failed to retrieve photo", String(e));
    }
  });

  // ── POST /tenant-portal/condition-reports/:id/submit ─────────────────────────
  router.post("/tenant-portal/condition-reports/:id/submit", async ({ req, res, orgId, prisma, params }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const report = await repo.findById(prisma, params.id, orgId);
      if (!report || report.tenantId !== tenantId) {
        return sendError(res, 404, "NOT_FOUND", "Report not found");
      }

      const err = await svc.validateSubmit(prisma, report);
      if (err) {
        if (err.code === "WRONG_STATUS") {
          return sendError(res, 409, "CONFLICT", `Report is ${err.current}, not submittable`);
        }
        if (err.code === "NOT_INSPECTED_ITEMS") {
          return sendError(
            res, 400, "NOT_INSPECTED_ITEMS",
            `Rate every item before submitting — still not inspected: ${err.items.join(", ")}`,
          );
        }
        if (err.code === "UNPHOTOED_DELTAS") {
          return sendError(
            res, 400, "PHOTOS_REQUIRED",
            `Photos required for degraded items: ${err.items.join(", ")}`,
          );
        }
        return sendError(res, 400, "VALIDATION_ERROR", "Report is not submittable");
      }

      await repo.setStatus(prisma, params.id, ConditionReportStatus.SUBMITTED, {
        submittedAt: new Date(),
      });

      // Notify all managers in-app (best-effort, non-blocking)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }, select: { name: true },
      });
      const typeLabel = report.type === ConditionReportType.MOVE_IN ? "move-in" : "move-out";
      const managers = await userRepo.findManagersByOrg(prisma, orgId);
      for (const mgr of managers) {
        createNotification({
          orgId,
          userId: mgr.id,
          entityType: "LETTER",
          entityId: params.id,
          eventType: "CONDITION_REPORT_SUBMITTED",
          message: `${tenant?.name ?? "A tenant"} submitted their ${typeLabel} condition report.`,
        }).catch(() => {});
      }

      sendJson(res, 200, { data: { ok: true } });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to submit report", String(e));
    }
  });
}
