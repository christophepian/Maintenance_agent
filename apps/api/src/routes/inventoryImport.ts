/**
 * Inventory CSV import routes — bulk create buildings & units behind a review
 * gate. Upload (multipart CSV) → preview batch → commit.
 *
 *   POST   /imports/inventory              upload + validate (MANAGER)
 *   GET    /imports/inventory              list batches (MANAGER/OWNER)
 *   GET    /imports/inventory/:id          one batch with rows
 *   POST   /imports/inventory/:id/commit   create records for valid rows (MANAGER)
 *   DELETE /imports/inventory/:id          discard a batch (MANAGER)
 */

import { ImportEntityType } from "@prisma/client";
import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { requireAnyRole } from "../authz";
import { requireOrgViewer } from "./helpers";
import { readRawBody, parseMultipart } from "../storage/attachments";
import {
  previewImportWorkflow,
  commitImportWorkflow,
} from "../workflows/inventoryImportWorkflow";
import {
  getBatch,
  listBatches,
  deleteBatch,
  InventoryImportError,
} from "../services/inventoryImportService";

/** 10 MB limit for inventory CSVs — generous for tens of thousands of rows. */
const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

function parseEntityType(raw: string | undefined): ImportEntityType | null {
  const up = (raw ?? "").trim().toUpperCase();
  if (up === "BUILDING" || up === "UNIT") return up as ImportEntityType;
  return null;
}

export function registerInventoryImportRoutes(router: Router) {
  // ── POST /imports/inventory ─── upload + validate ───────────────────────
  router.post("/imports/inventory", async ({ req, res, orgId, prisma }) => {
    const user = requireAnyRole(req, res, ["MANAGER"]);
    if (!user) return;

    const contentType = req.headers["content-type"] ?? "";
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      return sendError(res, 400, "INVALID_REQUEST", "Expected multipart/form-data");
    }

    let body: Buffer;
    try {
      body = await readRawBody(req, IMPORT_MAX_BYTES);
    } catch {
      return sendError(res, 413, "FILE_TOO_LARGE", "File exceeds 10 MB limit");
    }

    const parts = parseMultipart(body, boundaryMatch[1]);
    const filePart = parts.find((p) => p.filename && p.name === "file");
    if (!filePart || !filePart.filename) {
      return sendError(res, 400, "MISSING_FILE", "No file part named 'file' found");
    }

    const entityType = parseEntityType(
      parts.find((p) => p.name === "entityType")?.data.toString("utf8"),
    );
    if (!entityType) {
      return sendError(res, 400, "INVALID_ENTITY_TYPE", "entityType must be BUILDING or UNIT");
    }

    try {
      const batch = await previewImportWorkflow(prisma, {
        orgId,
        entityType,
        csvText: filePart.data.toString("utf8"),
        fileName: filePart.filename,
        uploadedBy: user.userId,
      });
      sendJson(res, 201, { data: batch });
    } catch (e: any) {
      if (e instanceof InventoryImportError) {
        return sendError(res, 400, e.code, e.message);
      }
      console.error("[INV IMPORT] upload error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to parse import", e.message);
    }
  });

  // ── GET /imports/inventory ─── list batches ─────────────────────────────
  router.get("/imports/inventory", async ({ req, res, orgId, prisma }) => {
    if (!requireOrgViewer(req, res)) return;

    const url = new URL(req.url ?? "/", "http://localhost");
    const entityType = parseEntityType(url.searchParams.get("entityType") ?? undefined) ?? undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    try {
      const result = await listBatches(prisma, orgId, { entityType, limit, offset });
      sendJson(res, 200, {
        data: result.data,
        pagination: { total: result.total, limit, offset },
      });
    } catch (e: any) {
      console.error("[INV IMPORT] list error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list import batches", e.message);
    }
  });

  // ── POST /imports/inventory/:id/commit ─── create records ───────────────
  // Registered before /:id so the literal 'commit' segment is matched first.
  router.post("/imports/inventory/:id/commit", async ({ req, res, orgId, prisma, params }) => {
    const user = requireAnyRole(req, res, ["MANAGER"]);
    if (!user) return;
    try {
      const result = await commitImportWorkflow(prisma, {
        orgId,
        batchId: params.id,
        actorUserId: user.userId,
      });
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      if (e instanceof InventoryImportError) {
        const status = e.code === "NOT_FOUND" ? 404 : 400;
        return sendError(res, status, e.code, e.message);
      }
      console.error("[INV IMPORT] commit error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to commit import", e.message);
    }
  });

  // ── GET /imports/inventory/:id ─── one batch ────────────────────────────
  router.get("/imports/inventory/:id", async ({ req, res, orgId, prisma, params }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const batch = await getBatch(prisma, params.id, orgId);
      if (!batch) return sendError(res, 404, "NOT_FOUND", "Import batch not found");
      sendJson(res, 200, { data: batch });
    } catch (e: any) {
      console.error("[INV IMPORT] get error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to get import batch", e.message);
    }
  });

  // ── DELETE /imports/inventory/:id ─── discard ───────────────────────────
  router.delete("/imports/inventory/:id", async ({ req, res, orgId, prisma, params }) => {
    const user = requireAnyRole(req, res, ["MANAGER"]);
    if (!user) return;
    try {
      const count = await deleteBatch(prisma, params.id, orgId);
      if (count === 0) return sendError(res, 404, "NOT_FOUND", "Import batch not found");
      sendJson(res, 200, { data: { deleted: count } });
    } catch (e: any) {
      console.error("[INV IMPORT] delete error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to delete import batch", e.message);
    }
  });
}
