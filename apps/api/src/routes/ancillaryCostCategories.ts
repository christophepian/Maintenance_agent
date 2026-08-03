/**
 * ancillaryCostCategories routes
 *
 * Canonical Nebenkosten taxonomy (billable vs non-billable cost categories).
 *
 * Endpoints:
 *   GET  /ancillary-cost-categories            — list (org-scoped; ?includeInactive=1)
 *   POST /ancillary-cost-categories            — create
 *   PUT  /ancillary-cost-categories/:id        — update
 *   POST /ancillary-cost-categories/seed       — idempotently seed Swiss defaults
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first } from "../http/query";
import { maybeRequireManager, requireRole } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { readJson } from "../http/body";
import * as categoryService from "../services/ancillaryCostCategoryService";
import {
  CreateAncillaryCostCategorySchema,
  UpdateAncillaryCostCategorySchema,
} from "../validation/ancillaryCostCategories";

export function registerAncillaryCostCategoryRoutes(router: Router) {
  // ── GET /ancillary-cost-categories ──────────────────────────
  router.get(
    "/ancillary-cost-categories",
    withAuthRequired(async ({ req, res, orgId, query }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const includeInactive = first(query, "includeInactive") === "1";
        const data = await categoryService.listCategories(orgId, { includeInactive });
        sendJson(res, 200, { data });
      } catch (err: any) {
        console.error("[ancillary-cost-categories] list error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── POST /ancillary-cost-categories ─────────────────────────
  router.post(
    "/ancillary-cost-categories",
    withAuthRequired(async ({ req, res, orgId }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        const parsed = CreateAncillaryCostCategorySchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "));
        }
        const data = await categoryService.createCategory(orgId, parsed.data);
        sendJson(res, 201, { data });
      } catch (err: any) {
        if (err?.code === "P2002") return sendError(res, 409, "CONFLICT", "A category with this code already exists");
        console.error("[ancillary-cost-categories] create error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── PUT /ancillary-cost-categories/:id ──────────────────────
  router.put(
    "/ancillary-cost-categories/:id",
    withAuthRequired(async ({ req, res, orgId, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        const parsed = UpdateAncillaryCostCategorySchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "));
        }
        const data = await categoryService.updateCategory(orgId, params.id, parsed.data);
        sendJson(res, 200, { data });
      } catch (err: any) {
        if (err?.message === "Category not found") return sendError(res, 404, "NOT_FOUND", err.message);
        console.error("[ancillary-cost-categories] update error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── POST /ancillary-cost-categories/seed ────────────────────
  router.post(
    "/ancillary-cost-categories/seed",
    withAuthRequired(async ({ req, res, orgId }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const seeded = await categoryService.seedDefaultCategories(orgId);
        const data = await categoryService.listCategories(orgId);
        sendJson(res, 200, { data, seeded });
      } catch (err: any) {
        console.error("[ancillary-cost-categories] seed error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );
}
