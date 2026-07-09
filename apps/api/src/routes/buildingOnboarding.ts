/**
 * Building onboarding routes — hydrate an (empty) building from a régie rent roll.
 *
 *   POST /buildings/:id/onboarding/preview   parse + preview (no writes) (MANAGER)
 *
 * The commit route (create Units/Tenants/Leases + optional billing) follows.
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { requireAnyRole } from "../authz";
import { readRawBody, parseMultipart } from "../storage/attachments";
import { previewOnboarding, commitOnboarding, OnboardingError } from "../services/buildingOnboardingService";
import { previewInvoiceOnboarding, commitInvoiceOnboarding } from "../services/invoiceOnboardingService";

/** 10 MB limit — a rent roll is small even for a large portfolio. */
const ONBOARDING_MAX_BYTES = 10 * 1024 * 1024;

const errDetail = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function registerBuildingOnboardingRoutes(router: Router) {
  router.post("/buildings/:id/onboarding/preview", async ({ req, res, orgId, prisma, params }) => {
    const user = requireAnyRole(req, res, ["MANAGER"]);
    if (!user) return;

    const contentType = req.headers["content-type"] ?? "";
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      return sendError(res, 400, "INVALID_REQUEST", "Expected multipart/form-data");
    }
    let body: Buffer;
    try {
      body = await readRawBody(req, ONBOARDING_MAX_BYTES);
    } catch {
      return sendError(res, 413, "FILE_TOO_LARGE", "File exceeds 10 MB limit");
    }
    const parts = parseMultipart(body, boundaryMatch[1]);
    const filePart = parts.find((p) => p.filename && p.name === "file");
    if (!filePart || !filePart.filename) {
      return sendError(res, 400, "MISSING_FILE", "No file part named 'file' found");
    }

    try {
      const preview = await previewOnboarding(prisma, orgId, params.id, filePart.data.toString("utf8"));
      sendJson(res, 200, { data: preview });
    } catch (e) {
      if (e instanceof OnboardingError) {
        const status = e.code === "BUILDING_NOT_FOUND" ? 404 : 400;
        return sendError(res, status, e.code, e.message);
      }
      console.error("[ONBOARDING] preview error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to preview onboarding", errDetail(e));
    }
  });

  router.post("/buildings/:id/onboarding/commit", async ({ req, res, orgId, prisma, params }) => {
    const user = requireAnyRole(req, res, ["MANAGER"]);
    if (!user) return;

    // Activation walks each lease through the billing workflow (schedule + first
    // invoice); give the socket room like other heavy imports.
    req.socket?.setTimeout(120_000);

    const contentType = req.headers["content-type"] ?? "";
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      return sendError(res, 400, "INVALID_REQUEST", "Expected multipart/form-data");
    }
    let body: Buffer;
    try {
      body = await readRawBody(req, ONBOARDING_MAX_BYTES);
    } catch {
      return sendError(res, 413, "FILE_TOO_LARGE", "File exceeds 10 MB limit");
    }
    const parts = parseMultipart(body, boundaryMatch[1]);
    const filePart = parts.find((p) => p.filename && p.name === "file");
    if (!filePart || !filePart.filename) {
      return sendError(res, 400, "MISSING_FILE", "No file part named 'file' found");
    }
    const billingMode = parts.find((p) => p.name === "billingMode")?.data.toString("utf8").trim();
    if (billingMode !== "activate" && billingMode !== "snapshot") {
      return sendError(res, 400, "INVALID_BILLING_MODE", "billingMode must be 'activate' or 'snapshot'");
    }

    try {
      const result = await commitOnboarding(prisma, orgId, params.id, filePart.data.toString("utf8"), {
        billingMode,
        actorUserId: user.userId,
      });
      sendJson(res, 201, { data: result });
    } catch (e) {
      if (e instanceof OnboardingError) {
        const status = e.code === "BUILDING_NOT_FOUND" ? 404 : 400;
        return sendError(res, status, e.code, e.message);
      }
      console.error("[ONBOARDING] commit error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to commit onboarding", errDetail(e));
    }
  });

  // ── Contractor-invoice onboarding from a régie general ledger ──────────────

  router.post("/buildings/:id/onboarding/invoices/preview", async ({ req, res, orgId, prisma, params }) => {
    const user = requireAnyRole(req, res, ["MANAGER"]);
    if (!user) return;

    const contentType = req.headers["content-type"] ?? "";
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      return sendError(res, 400, "INVALID_REQUEST", "Expected multipart/form-data");
    }
    let body: Buffer;
    try {
      body = await readRawBody(req, ONBOARDING_MAX_BYTES);
    } catch {
      return sendError(res, 413, "FILE_TOO_LARGE", "File exceeds 10 MB limit");
    }
    const parts = parseMultipart(body, boundaryMatch[1]);
    const filePart = parts.find((p) => p.filename && p.name === "file");
    if (!filePart || !filePart.filename) {
      return sendError(res, 400, "MISSING_FILE", "No file part named 'file' found");
    }

    try {
      const preview = await previewInvoiceOnboarding(prisma, orgId, params.id, filePart.data.toString("utf8"));
      sendJson(res, 200, { data: preview });
    } catch (e) {
      if (e instanceof OnboardingError) {
        const status = e.code === "BUILDING_NOT_FOUND" ? 404 : 400;
        return sendError(res, status, e.code, e.message);
      }
      console.error("[ONBOARDING] invoice preview error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to preview invoice onboarding", errDetail(e));
    }
  });

  router.post("/buildings/:id/onboarding/invoices/commit", async ({ req, res, orgId, prisma, params }) => {
    const user = requireAnyRole(req, res, ["MANAGER"]);
    if (!user) return;

    // Commit issues + posts each invoice to the ledger; give the socket room.
    req.socket?.setTimeout(120_000);

    const contentType = req.headers["content-type"] ?? "";
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      return sendError(res, 400, "INVALID_REQUEST", "Expected multipart/form-data");
    }
    let body: Buffer;
    try {
      body = await readRawBody(req, ONBOARDING_MAX_BYTES);
    } catch {
      return sendError(res, 413, "FILE_TOO_LARGE", "File exceeds 10 MB limit");
    }
    const parts = parseMultipart(body, boundaryMatch[1]);
    const filePart = parts.find((p) => p.filename && p.name === "file");
    if (!filePart || !filePart.filename) {
      return sendError(res, 400, "MISSING_FILE", "No file part named 'file' found");
    }

    try {
      const result = await commitInvoiceOnboarding(prisma, orgId, params.id, filePart.data.toString("utf8"), {
        actorUserId: user.userId,
      });
      sendJson(res, 201, { data: result });
    } catch (e) {
      if (e instanceof OnboardingError) {
        const status = e.code === "BUILDING_NOT_FOUND" ? 404 : 400;
        return sendError(res, status, e.code, e.message);
      }
      console.error("[ONBOARDING] invoice commit error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to commit invoice onboarding", errDetail(e));
    }
  });
}
