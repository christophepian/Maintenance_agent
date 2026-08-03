/**
 * billingPeriods routes
 *
 * Building-level ancillary cost pool (Phase 2): a billing period collects actual
 * incurred costs (CostEntry) which are apportioned to leases via distribution keys.
 *
 * Endpoints:
 *   GET    /billing-periods                          — list (?buildingId=)
 *   GET    /billing-periods/:id                      — single with cost entries
 *   POST   /billing-periods                          — create
 *   PUT    /billing-periods/:id                      — update status / admin fee
 *   POST   /billing-periods/:id/cost-entries         — add a cost entry
 *   DELETE /billing-periods/:id/cost-entries/:eid    — remove a cost entry
 *   GET    /billing-periods/:id/apportionment/:lid   — preview apportioned shares for a lease
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first } from "../http/query";
import { maybeRequireManager, requireRole } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { readJson } from "../http/body";
import * as service from "../services/ancillaryReconciliationService";
import {
  CreateBillingPeriodSchema,
  UpdateBillingPeriodSchema,
  CreateCostEntrySchema,
} from "../validation/billingPeriods";

function badRequest(res: any, parsed: any) {
  return sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((i: any) => i.message).join("; "));
}

export function registerBillingPeriodRoutes(router: Router) {
  router.get(
    "/billing-periods",
    withAuthRequired(async ({ req, res, orgId, query }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const buildingId = first(query, "buildingId") || undefined;
        sendJson(res, 200, { data: await service.listPeriods(orgId, buildingId) });
      } catch (err: any) {
        console.error("[billing-periods] list error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  router.get(
    "/billing-periods/:id",
    withAuthRequired(async ({ req, res, orgId, params }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const dto = await service.getPeriod(orgId, params.id);
        if (!dto) return sendError(res, 404, "NOT_FOUND", "Billing period not found");
        sendJson(res, 200, { data: dto });
      } catch (err: any) {
        console.error("[billing-periods] get error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  router.post(
    "/billing-periods",
    withAuthRequired(async ({ req, res, orgId }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const parsed = CreateBillingPeriodSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(res, parsed);
        sendJson(res, 201, { data: await service.createPeriod(orgId, parsed.data) });
      } catch (err: any) {
        if (err?.code === "P2002") return sendError(res, 409, "CONFLICT", "A billing period with these dates already exists for this building");
        if (/not found|Invalid period|adminFee/.test(err?.message)) return sendError(res, 400, "BAD_REQUEST", err.message);
        console.error("[billing-periods] create error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  router.put(
    "/billing-periods/:id",
    withAuthRequired(async ({ req, res, orgId, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const parsed = UpdateBillingPeriodSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(res, parsed);
        sendJson(res, 200, { data: await service.updatePeriod(orgId, params.id, parsed.data) });
      } catch (err: any) {
        if (err?.message === "Billing period not found") return sendError(res, 404, "NOT_FOUND", err.message);
        if (/status must|adminFee/.test(err?.message)) return sendError(res, 400, "BAD_REQUEST", err.message);
        console.error("[billing-periods] update error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  router.post(
    "/billing-periods/:id/cost-entries",
    withAuthRequired(async ({ req, res, orgId, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const parsed = CreateCostEntrySchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(res, parsed);
        sendJson(res, 201, { data: await service.addCostEntry(orgId, params.id, parsed.data) });
      } catch (err: any) {
        if (/not found/.test(err?.message)) return sendError(res, 404, "NOT_FOUND", err.message);
        if (/CLOSED/.test(err?.message)) return sendError(res, 409, "CONFLICT", err.message);
        console.error("[billing-periods] add cost entry error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  router.post(
    "/billing-periods/:id/qualify-invoice",
    withAuthRequired(async ({ req, res, orgId, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        if (!body?.invoiceId || !body?.categoryId) return sendError(res, 400, "VALIDATION_ERROR", "invoiceId and categoryId are required");
        sendJson(res, 201, { data: await service.qualifyInvoiceAsCost(orgId, params.id, { invoiceId: body.invoiceId, categoryId: body.categoryId }) });
      } catch (err: any) {
        if (/not found/.test(err?.message)) return sendError(res, 404, "NOT_FOUND", err.message);
        if (/CLOSED|already|Only incoming/.test(err?.message)) return sendError(res, 409, "CONFLICT", err.message);
        console.error("[billing-periods] qualify-invoice error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  router.delete(
    "/billing-periods/:id/cost-entries/:eid",
    withAuthRequired(async ({ req, res, orgId, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        sendJson(res, 200, { data: await service.removeCostEntry(orgId, params.id, params.eid) });
      } catch (err: any) {
        if (/not found/.test(err?.message)) return sendError(res, 404, "NOT_FOUND", err.message);
        if (/CLOSED/.test(err?.message)) return sendError(res, 409, "CONFLICT", err.message);
        console.error("[billing-periods] remove cost entry error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── GET /flat-rate?leaseId=&categoryId= — suggested forfait (3-yr avg) ──
  router.get(
    "/flat-rate",
    withAuthRequired(async ({ req, res, orgId, query }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const leaseId = first(query, "leaseId");
        const categoryId = first(query, "categoryId");
        if (!leaseId || !categoryId) return sendError(res, 400, "VALIDATION_ERROR", "leaseId and categoryId are required");
        sendJson(res, 200, { data: await service.calculateFlatRate(orgId, leaseId, categoryId) });
      } catch (err: any) {
        if (/not found/.test(err?.message)) return sendError(res, 404, "NOT_FOUND", err.message);
        console.error("[flat-rate] error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── Unit reconciliation (v2 C4): advances vs apportioned actual → delta ──
  router.get(
    "/unit-reconciliation",
    withAuthRequired(async ({ req, res, orgId, query }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const unitId = first(query, "unitId");
        const billingPeriodId = first(query, "billingPeriodId");
        if (!unitId || !billingPeriodId) return sendError(res, 400, "VALIDATION_ERROR", "unitId and billingPeriodId are required");
        sendJson(res, 200, { data: await service.getUnitReconciliationPreview(orgId, unitId, billingPeriodId) });
      } catch (err: any) {
        if (/not found|No active lease|not an active participant/.test(err?.message)) return sendError(res, 404, "NOT_FOUND", err.message);
        console.error("[unit-reconciliation] preview error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  router.post(
    "/unit-reconciliation/settle",
    withAuthRequired(async ({ req, res, orgId }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        if (!body?.unitId || !body?.billingPeriodId) return sendError(res, 400, "VALIDATION_ERROR", "unitId and billingPeriodId are required");
        sendJson(res, 201, { data: await service.settleUnitReconciliation(orgId, body.unitId, body.billingPeriodId) });
      } catch (err: any) {
        if (/not found|No active lease/.test(err?.message)) return sendError(res, 404, "NOT_FOUND", err.message);
        if (/already exists/.test(err?.message)) return sendError(res, 409, "CONFLICT", err.message);
        console.error("[unit-reconciliation] settle error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── Per-building per-category distribution config (v2 C2) ──
  router.get(
    "/charge-distribution",
    withAuthRequired(async ({ req, res, orgId, query }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const buildingId = first(query, "buildingId");
        if (!buildingId) return sendError(res, 400, "VALIDATION_ERROR", "buildingId is required");
        sendJson(res, 200, { data: await service.getBuildingDistribution(orgId, buildingId) });
      } catch (err: any) {
        console.error("[charge-distribution] get error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  router.put(
    "/charge-distribution",
    withAuthRequired(async ({ req, res, orgId }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        const KEYS = ["SURFACE_AREA", "UNIT_COUNT", "CONSUMPTION", "OCCUPANT_COUNT", "FIXED_SHARE"];
        if (!body?.buildingId || !body?.categoryId || !KEYS.includes(body?.key)) {
          return sendError(res, 400, "VALIDATION_ERROR", "buildingId, categoryId and a valid key are required");
        }
        sendJson(res, 200, { data: await service.setBuildingDistribution(orgId, body.buildingId, body.categoryId, body.key) });
      } catch (err: any) {
        if (/not found/.test(err?.message)) return sendError(res, 404, "NOT_FOUND", err.message);
        console.error("[charge-distribution] put error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  router.get(
    "/billing-periods/:id/apportionment/:lid",
    withAuthRequired(async ({ req, res, orgId, params }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        sendJson(res, 200, { data: await service.apportionForLease(orgId, params.id, params.lid) });
      } catch (err: any) {
        if (/not found|not an active participant/.test(err?.message)) return sendError(res, 404, "NOT_FOUND", err.message);
        console.error("[billing-periods] apportionment error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );
}
