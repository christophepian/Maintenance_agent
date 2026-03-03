import { OrgMode } from "@prisma/client";
import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { requireOrgViewer, requireGovernanceAccess } from "./helpers";
import { withAuthRequired } from "../http/routeProtection";
import { getOrgConfig, updateOrgConfig } from "../services/orgConfig";
import { UpdateOrgConfigSchema } from "../validation/orgConfig";
import { BuildingConfigSchema } from "../validation/buildingConfig";
import { UnitConfigSchema } from "../validation/unitConfig";
import { computeEffectiveConfig, getBuildingConfig, upsertBuildingConfig } from "../services/buildingConfig";
import { getUnitConfig, upsertUnitConfig, deleteUnitConfig, computeEffectiveUnitConfig } from "../services/unitConfig";
import { CreateApprovalRuleSchema, UpdateApprovalRuleSchema } from "../validation/approvalRules";
import { listApprovalRules, createApprovalRule, getApprovalRule, updateApprovalRule, deleteApprovalRule } from "../services/approvalRules";
import { createBillingEntity, deleteBillingEntity, getBillingEntity, listBillingEntities, updateBillingEntity } from "../services/billingEntities";
import { CreateBillingEntitySchema, UpdateBillingEntitySchema } from "../validation/billingEntities";

export function registerConfigRoutes(router: Router) {
  // GET /org-config
  router.get("/org-config", withAuthRequired(async ({ req, res, prisma, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const config = await getOrgConfig(prisma, orgId);
      sendJson(res, 200, { data: config });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load org config", String(e));
    }
  }));

  // PUT /org-config
  router.put("/org-config", withAuthRequired(async ({ req, res, prisma, orgId }) => {
    try {
      const raw = await readJson(req);
      const parsed = UpdateOrgConfigSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid org config", parsed.error.flatten());

      const input = parsed.data;
      if (input.autoApproveLimit === undefined && input.mode === undefined) {
        return sendError(res, 400, "VALIDATION_ERROR", "No org config fields provided");
      }

      const current = await getOrgConfig(prisma, orgId);
      const targetMode = (input.mode || current.mode) as OrgMode;
      if (!requireGovernanceAccess(req, res, targetMode)) return;

      const updated = await updateOrgConfig(prisma, orgId, {
        autoApproveLimit: input.autoApproveLimit,
        mode: input.mode as OrgMode | undefined,
      });
      sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to update org config", String(e));
    }
  }));

  // GET /buildings/:id/config
  router.get("/buildings/:id/config", withAuthRequired(async ({ req, res, prisma, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const building = await prisma.building.findFirst({ where: { id: params.id, orgId } });
      if (!building) return sendError(res, 404, "NOT_FOUND", "Building not found");
      const config = await getBuildingConfig(prisma, orgId, params.id);
      sendJson(res, 200, { data: config });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load building config", String(e));
    }
  }));

  // PUT /buildings/:id/config
  router.put("/buildings/:id/config", withAuthRequired(async ({ req, res, prisma, params, orgId }) => {
    try {
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const raw = await readJson(req);
      const parsed = BuildingConfigSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid building config", parsed.error.flatten());

      const updated = await upsertBuildingConfig(prisma, orgId, params.id, parsed.data);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Building not found");
      sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to update building config", String(e));
    }
  }));

  // GET /units/:id/config
  router.get("/units/:id/config", withAuthRequired(async ({ req, res, prisma, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const unit = await prisma.unit.findFirst({ where: { id: params.id, orgId } });
      if (!unit) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      const effectiveConfig = await computeEffectiveUnitConfig(prisma, orgId, params.id);
      sendJson(res, 200, { data: effectiveConfig });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load unit config", String(e));
    }
  }));

  // PUT /units/:id/config
  router.put("/units/:id/config", withAuthRequired(async ({ req, res, prisma, params, orgId }) => {
    try {
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const raw = await readJson(req);
      const parsed = UnitConfigSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid unit config", parsed.error.flatten());

      const updated = await upsertUnitConfig(prisma, orgId, params.id, parsed.data);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      const effectiveConfig = await computeEffectiveUnitConfig(prisma, orgId, params.id);
      sendJson(res, 200, { data: effectiveConfig });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to update unit config", String(e));
    }
  }));

  // DELETE /units/:id/config
  router.delete("/units/:id/config", withAuthRequired(async ({ req, res, prisma, params, orgId }) => {
    try {
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const deleted = await deleteUnitConfig(prisma, orgId, params.id);
      if (!deleted) return sendError(res, 404, "NOT_FOUND", "Unit config not found");
      const effectiveConfig = await computeEffectiveUnitConfig(prisma, orgId, params.id);
      sendJson(res, 200, { data: effectiveConfig });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to delete unit config", String(e));
    }
  }));

  // GET /approval-rules
  router.get("/approval-rules", withAuthRequired(async ({ req, res, prisma, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const buildingId = first(query, "buildingId") || undefined;
      const rules = await listApprovalRules(prisma, orgId, buildingId);
      sendJson(res, 200, { data: rules });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load approval rules", String(e));
    }
  }));

  // POST /approval-rules
  router.post("/approval-rules", async ({ req, res, prisma, orgId }) => {
    try {
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const raw = await readJson(req);
      const parsed = CreateApprovalRuleSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid approval rule", parsed.error.flatten());

      const rule = await createApprovalRule(prisma, orgId, parsed.data as any);
      sendJson(res, 201, { data: rule });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "BUILDING_NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Building not found");
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to create approval rule", String(e));
    }
  });

  // GET /approval-rules/:id
  router.get("/approval-rules/:id", async ({ req, res, prisma, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const rule = await getApprovalRule(prisma, orgId, params.id);
      if (!rule) return sendError(res, 404, "NOT_FOUND", "Approval rule not found");
      sendJson(res, 200, { data: rule });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load approval rule", String(e));
    }
  });

  // PATCH /approval-rules/:id
  router.patch("/approval-rules/:id", async ({ req, res, prisma, params, orgId }) => {
    try {
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const raw = await readJson(req);
      const parsed = UpdateApprovalRuleSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid approval rule update", parsed.error.flatten());

      const rule = await updateApprovalRule(prisma, orgId, params.id, parsed.data as any);
      if (!rule) return sendError(res, 404, "NOT_FOUND", "Approval rule not found");
      sendJson(res, 200, { data: rule });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to update approval rule", String(e));
    }
  });

  // DELETE /approval-rules/:id
  router.delete("/approval-rules/:id", async ({ req, res, prisma, params, orgId }) => {
    try {
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const deleted = await deleteApprovalRule(prisma, orgId, params.id);
      if (!deleted) return sendError(res, 404, "NOT_FOUND", "Approval rule not found");
      sendJson(res, 200, { message: "Approval rule deleted" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to delete approval rule", String(e));
    }
  });

  // GET /billing-entities
  router.get("/billing-entities", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const type = first(query, "type") || undefined;
      const entities = await listBillingEntities(orgId, { type: type as any });
      sendJson(res, 200, { data: entities });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load billing entities", String(e));
    }
  });

  // POST /billing-entities
  router.post("/billing-entities", async ({ req, res, prisma, orgId }) => {
    try {
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const raw = await readJson(req);
      const parsed = CreateBillingEntitySchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid billing entity", parsed.error.flatten());

      const created = await createBillingEntity({ orgId, ...parsed.data });
      sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "BILLING_ENTITY_TYPE_EXISTS") return sendError(res, 409, "CONFLICT", "Billing entity already exists for this type");
      if (msg === "CONTRACTOR_NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      if (msg === "CONTRACTOR_TYPE_REQUIRED") return sendError(res, 400, "VALIDATION_ERROR", "Contractor link requires type CONTRACTOR");
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to create billing entity", String(e));
    }
  });

  // GET /billing-entities/:id
  router.get("/billing-entities/:id", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const entity = await getBillingEntity(orgId, params.id);
      if (!entity) return sendError(res, 404, "NOT_FOUND", "Billing entity not found");
      sendJson(res, 200, { data: entity });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load billing entity", String(e));
    }
  });

  // PATCH /billing-entities/:id
  router.patch("/billing-entities/:id", async ({ req, res, prisma, params, orgId }) => {
    try {
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const raw = await readJson(req);
      const parsed = UpdateBillingEntitySchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid billing entity update", parsed.error.flatten());

      if (Object.keys(parsed.data).length === 0) return sendError(res, 400, "VALIDATION_ERROR", "No billing entity fields provided");

      const updated = await updateBillingEntity(orgId, params.id, parsed.data);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Billing entity not found");
      sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "CONTRACTOR_NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      if (msg === "CONTRACTOR_TYPE_REQUIRED") return sendError(res, 400, "VALIDATION_ERROR", "Contractor link requires type CONTRACTOR");
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to update billing entity", String(e));
    }
  });

  // DELETE /billing-entities/:id
  router.delete("/billing-entities/:id", async ({ req, res, prisma, params, orgId }) => {
    try {
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const deleted = await deleteBillingEntity(orgId, params.id);
      if (!deleted) return sendError(res, 404, "NOT_FOUND", "Billing entity not found");
      sendJson(res, 200, { message: "Billing entity deleted" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to delete billing entity", String(e));
    }
  });
}
