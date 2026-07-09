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
import { previewOnboarding, OnboardingError } from "../services/buildingOnboardingService";

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
}
