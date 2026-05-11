/**
 * Imported Statement Routes
 *
 * POST   /imported-statements/upload         — upload PDF for ingestion (MANAGER)
 * GET    /imported-statements                — list statements (MANAGER + OWNER)
 * GET    /imported-statements/:id            — get single statement (MANAGER + OWNER)
 * POST   /imported-statements/:id/approve    — approve and push to owner surface (MANAGER)
 * POST   /imported-statements/:id/reject     — reject statement (MANAGER)
 * PATCH  /imported-statements/:id/balances/:balanceId — manually resolve account match (MANAGER)
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { requireAnyRole, getAuthUser } from "../authz";
import { requireOrgViewer } from "./helpers";
import {
  readRawBody,
  parseMultipart,
} from "../storage/attachments";
import {
  ingestStatement,
  approveStatement,
  rejectStatement,
  listStatements,
  getStatement,
  resolveAccountBalance,
  assignBuilding,
  ImportedStatementError,
} from "../services/importedStatementService";

/** 25 MB limit for imported statement PDFs — larger than the default 5 MB. */
const IMPORT_MAX_BYTES = 25 * 1024 * 1024;

export function registerImportedStatementRoutes(router: Router) {
  // ── POST /imported-statements/upload ────────────────────────────────────
  router.post("/imported-statements/upload", async ({ req, res, orgId, prisma }) => {
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
    } catch (e: any) {
      return sendError(res, 413, "FILE_TOO_LARGE", "File exceeds 25 MB limit");
    }

    const parts = parseMultipart(body, boundaryMatch[1]);
    const filePart = parts.find((p) => p.filename && p.name === "file");
    if (!filePart || !filePart.filename) {
      return sendError(res, 400, "MISSING_FILE", "No file part named 'file' found");
    }

    const fiscalYearPart = parts.find((p) => p.name === "fiscalYear");
    const fiscalYear = fiscalYearPart
      ? parseInt(fiscalYearPart.data.toString("utf8"), 10)
      : new Date().getFullYear();
    if (isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      return sendError(res, 400, "INVALID_FISCAL_YEAR", "fiscalYear must be a valid year (2000–2100)");
    }

    const buildingIdPart = parts.find((p) => p.name === "buildingId");
    const hintBuildingId = buildingIdPart?.data.toString("utf8").trim() || undefined;

    const mimeType = filePart.contentType ?? "application/octet-stream";
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/tiff"];
    if (!allowedTypes.includes(mimeType)) {
      return sendError(res, 415, "UNSUPPORTED_MEDIA_TYPE", `Unsupported file type: ${mimeType}`);
    }

    try {
      const statement = await ingestStatement(prisma, {
        buffer: filePart.data,
        fileName: filePart.filename,
        mimeType,
        orgId,
        uploadedBy: user.userId,
        fiscalYear,
        buildingId: hintBuildingId,
      });
      sendJson(res, 202, { data: statement });
    } catch (e: any) {
      if (e instanceof ImportedStatementError) {
        const status = e.code === "BUILDING_NOT_FOUND" ? 422 : 400;
        return sendError(res, status, e.code, e.message);
      }
      console.error("[IMPORT] upload error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to ingest statement", e.message);
    }
  });

  // ── GET /imported-statements ─────────────────────────────────────────────
  router.get("/imported-statements", async ({ req, res, orgId, prisma }) => {
    if (!requireOrgViewer(req, res)) return;
    const user = getAuthUser(req);

    const url = new URL(req.url ?? "/", "http://localhost");
    const status = url.searchParams.get("status") as any ?? undefined;
    const buildingId = url.searchParams.get("buildingId") ?? undefined;
    const fiscalYear = url.searchParams.get("fiscalYear")
      ? parseInt(url.searchParams.get("fiscalYear")!, 10)
      : undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    try {
      const result = await listStatements(prisma, orgId, {
        status,
        buildingId,
        fiscalYear,
        limit,
        offset,
      });
      sendJson(res, 200, {
        data: result.data,
        pagination: { total: result.total, limit, offset },
      });
    } catch (e: any) {
      console.error("[IMPORT] list error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list statements", e.message);
    }
  });

  // ── GET /imported-statements/:id ─────────────────────────────────────────
  router.get("/imported-statements/:id", async ({ req, res, orgId, prisma, params }) => {
    if (!requireOrgViewer(req, res)) return;

    try {
      const statement = await getStatement(prisma, params.id, orgId);
      if (!statement) return sendError(res, 404, "NOT_FOUND", "Statement not found");
      sendJson(res, 200, { data: statement });
    } catch (e: any) {
      console.error("[IMPORT] get error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to get statement", e.message);
    }
  });

  // ── POST /imported-statements/:id/approve ────────────────────────────────
  router.post("/imported-statements/:id/approve", async ({ req, res, orgId, prisma, params }) => {
    const user = requireAnyRole(req, res, ["MANAGER"]);
    if (!user) return;

    try {
      const statement = await approveStatement(prisma, params.id, orgId, user.userId);
      sendJson(res, 200, { data: statement });
    } catch (e: any) {
      if (e instanceof ImportedStatementError) {
        const status = e.code === "NOT_FOUND" ? 404 : 409;
        return sendError(res, status, e.code, e.message);
      }
      console.error("[IMPORT] approve error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to approve statement", e.message);
    }
  });

  // ── POST /imported-statements/:id/reject ─────────────────────────────────
  router.post("/imported-statements/:id/reject", async ({ req, res, orgId, prisma, params }) => {
    const user = requireAnyRole(req, res, ["MANAGER"]);
    if (!user) return;

    let notes: string | undefined;
    try {
      const rawBody = await readRawBody(req, 4096);
      const body = JSON.parse(rawBody.toString("utf8"));
      notes = typeof body.notes === "string" ? body.notes.trim() : undefined;
    } catch { /* notes stays undefined */ }

    try {
      const statement = await rejectStatement(prisma, params.id, orgId, notes);
      sendJson(res, 200, { data: statement });
    } catch (e: any) {
      if (e instanceof ImportedStatementError) {
        const status = e.code === "NOT_FOUND" ? 404 : 409;
        return sendError(res, status, e.code, e.message);
      }
      console.error("[IMPORT] reject error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to reject statement", e.message);
    }
  });

  // ── PATCH /imported-statements/:id/building ──────────────────────────────
  router.patch("/imported-statements/:id/building", async ({ req, res, orgId, prisma, params }) => {
    const user = requireAnyRole(req, res, ["MANAGER"]);
    if (!user) return;

    let buildingId: string;
    try {
      const rawBody = await readRawBody(req, 4096);
      const body = JSON.parse(rawBody.toString("utf8"));
      if (!body.buildingId || typeof body.buildingId !== "string") {
        return sendError(res, 400, "MISSING_FIELD", "buildingId is required");
      }
      buildingId = body.buildingId.trim();
    } catch {
      return sendError(res, 400, "INVALID_JSON", "Request body must be valid JSON");
    }

    try {
      const statement = await assignBuilding(prisma, params.id, orgId, buildingId);
      sendJson(res, 200, { data: statement });
    } catch (e: any) {
      if (e instanceof ImportedStatementError) {
        const status = e.code === "NOT_FOUND" || e.code === "BUILDING_NOT_FOUND" ? 404 : 400;
        return sendError(res, status, e.code, e.message);
      }
      console.error("[IMPORT] assign building error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to assign building", e.message);
    }
  });

  // ── PATCH /imported-statements/:id/balances/:balanceId ──────────────────
  router.patch(
    "/imported-statements/:id/balances/:balanceId",
    async ({ req, res, orgId, prisma, params }) => {
      const user = requireAnyRole(req, res, ["MANAGER"]);
      if (!user) return;

      let accountId: string;
      try {
        const rawBody = await readRawBody(req, 4096);
        const body = JSON.parse(rawBody.toString("utf8"));
        if (!body.accountId || typeof body.accountId !== "string") {
          return sendError(res, 400, "MISSING_FIELD", "accountId is required");
        }
        accountId = body.accountId.trim();
      } catch {
        return sendError(res, 400, "INVALID_JSON", "Request body must be valid JSON");
      }

      try {
        const balance = await resolveAccountBalance(prisma, params.balanceId, orgId, accountId);
        sendJson(res, 200, { data: balance });
      } catch (e: any) {
        if (e instanceof ImportedStatementError) {
          const status = e.code === "NOT_FOUND" ? 404 : 400;
          return sendError(res, status, e.code, e.message);
        }
        console.error("[IMPORT] resolve balance error:", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to resolve balance", e.message);
      }
    },
  );
}
