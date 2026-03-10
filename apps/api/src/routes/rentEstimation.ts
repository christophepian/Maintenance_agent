/**
 * Rent Estimation Routes
 *
 * GET  /rent-estimation/config            → org-default config
 * PUT  /rent-estimation/config            → upsert org-default config
 * PUT  /rent-estimation/config/:canton    → upsert canton-specific config
 * GET  /units/:id/rent-estimate           → single unit estimate
 * POST /rent-estimation/bulk              → bulk estimate (unitIds or buildingId)
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { maybeRequireManager, requireRole } from "../authz";
import {
  getEffectiveRentEstimationConfig,
  upsertRentEstimationConfig,
  estimateRentForUnit,
  bulkEstimateRent,
} from "../services/rentEstimation";
import { UpsertRentEstimationConfigSchema, BulkEstimateSchema } from "../validation/rentEstimation";

export function registerRentEstimationRoutes(router: Router) {

  /* ── GET /rent-estimation/config ───────────────────────────── */
  router.get("/rent-estimation/config", async ({ req, res, orgId }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const config = await getEffectiveRentEstimationConfig(orgId);
      sendJson(res, 200, { data: config });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch rent estimation config", String(e));
    }
  });

  /* ── PUT /rent-estimation/config  (org default, canton=null) ─ */
  router.put("/rent-estimation/config", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const body = await readJson(req);
      const parsed = UpsertRentEstimationConfigSchema.safeParse(body);
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid config payload", parsed.error.issues);
        return;
      }
      const config = await upsertRentEstimationConfig(orgId, null, parsed.data);
      sendJson(res, 200, { data: config });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to upsert rent estimation config", String(e));
    }
  });

  /* ── PUT /rent-estimation/config/:canton ────────────────────── */
  // Canton is 2 uppercase letters, not a UUID, so we need addCustom
  router.addCustom(
    "PUT",
    /^\/rent-estimation\/config\/([A-Za-z]{2})$/,
    ["canton"],
    async ({ req, res, orgId, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        const parsed = UpsertRentEstimationConfigSchema.safeParse(body);
        if (!parsed.success) {
          sendError(res, 400, "VALIDATION_ERROR", "Invalid config payload", parsed.error.issues);
          return;
        }
        const canton = params.canton.toUpperCase();
        const config = await upsertRentEstimationConfig(orgId, canton, parsed.data);
        sendJson(res, 200, { data: config });
      } catch (e) {
        sendError(res, 500, "DB_ERROR", "Failed to upsert canton config", String(e));
      }
    },
    "PUT /rent-estimation/config/:canton",
  );

  /* ── GET /units/:id/rent-estimate ──────────────────────────── */
  router.get("/units/:id/rent-estimate", async ({ req, res, orgId, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const estimate = await estimateRentForUnit(orgId, params.id);
      sendJson(res, 200, { data: estimate });
    } catch (e: any) {
      if (e.message === "UNIT_NOT_FOUND") {
        sendError(res, 404, "NOT_FOUND", "Unit not found or not in your org");
        return;
      }
      if (e.message === "MISSING_LIVING_AREA") {
        sendError(res, 422, "MISSING_DATA", "Unit has no livingAreaSqm — cannot estimate rent");
        return;
      }
      sendError(res, 500, "DB_ERROR", "Failed to estimate rent", String(e));
    }
  });

  /* ── POST /rent-estimation/bulk ────────────────────────────── */
  router.post("/rent-estimation/bulk", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const body = await readJson(req);
      const parsed = BulkEstimateSchema.safeParse(body);
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid bulk estimate payload", parsed.error.issues);
        return;
      }
      const estimates = await bulkEstimateRent(orgId, parsed.data);
      sendJson(res, 200, { data: estimates });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to bulk estimate rent", String(e));
    }
  });
}
