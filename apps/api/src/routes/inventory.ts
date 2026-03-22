import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { maybeRequireManager, requireRole } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import {
  listBuildings,
  createBuilding,
  updateBuilding,
  deactivateBuilding,
  listUnits,
  createUnit,
  updateUnit,
  deactivateUnit,
  getUnitById,
  listAppliances,
  createAppliance,
  updateAppliance,
  deactivateAppliance,
  listAssetModels,
  createAssetModel,
  updateAssetModel,
  deactivateAssetModel,
  addAssetModelName,
} from "../services/inventory";
import { getAssetInventoryForUnit, getAssetInventoryForBuilding, getRepairReplaceAnalysis } from "../services/assetInventory";
import { assetRepo } from "../repositories";
import { listUnitTenants, linkTenantToUnit, unlinkTenantFromUnit } from "../services/occupancies";
import { listContractors } from "../services/contractorRequests";
import { listTenants, createOrGetTenant } from "../services/tenants";
import { propertyFromBuilding } from "../services/adapters/propertyAdapter";
import { contactFromTenant, contactFromContractor } from "../services/adapters/contactAdapter";
import { CreateBuildingSchema, UpdateBuildingSchema } from "../validation/buildings";
import { CreateUnitSchema, UpdateUnitSchema } from "../validation/units";
import { CreateApplianceSchema, UpdateApplianceSchema } from "../validation/appliances";
import { CreateAssetModelSchema, UpdateAssetModelSchema } from "../validation/assetModels";
import { UpsertAssetSchema, AddInterventionSchema } from "../validation/assets";
import { LinkTenantSchema } from "../validation/occupancies";
import { normalizePhoneToE164 } from "../utils/phoneNormalization";
import * as inventoryRepo from "../repositories/inventoryRepository";
import { mapBuildingToDetailDTO } from "../dto/buildingDetail";
import { mapUnitToListDTO } from "../dto/unitList";

export function registerInventoryRoutes(router: Router) {
  /* ── Properties (alias over Buildings) ─────────────────────── */

  router.get("/properties", withAuthRequired(async ({ res, orgId, query }) => {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const buildings = await listBuildings(orgId, includeInactive);
      const properties = buildings.map(propertyFromBuilding);
      sendJson(res, 200, { data: properties, total: properties.length });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch properties", String(e));
    }
  }));

  router.get("/properties/:id/units", withAuthRequired(async ({ res, orgId, query, params }) => {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const unitTypeRaw = first(query, "type");
      const unitType = unitTypeRaw && ["RESIDENTIAL", "COMMON_AREA"].includes(unitTypeRaw)
        ? (unitTypeRaw as any) : undefined;
      const units = await listUnits(orgId, params.id, includeInactive, unitType);
      sendJson(res, 200, { data: units.map(mapUnitToListDTO) });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch property units", String(e));
    }
  }));

  /* ── People aliases ────────────────────────────────────────── */

  router.get("/people/tenants", withAuthRequired(async ({ res, orgId, query }) => {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const result = await listTenants(orgId, includeInactive);
      const contacts = result.data.map(contactFromTenant);
      sendJson(res, 200, { data: contacts, total: result.total });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch tenant contacts", String(e));
    }
  }));

  router.get("/people/vendors", withAuthRequired(async ({ res, orgId, prisma }) => {
    try {
      const result = await listContractors(prisma, orgId);
      const contacts = result.data.map(contactFromContractor);
      sendJson(res, 200, { data: contacts, total: result.total });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch vendor contacts", String(e));
    }
  }));

  /* ── Buildings ─────────────────────────────────────────────── */

  router.get("/buildings", withAuthRequired(async ({ res, orgId, query, prisma }) => {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const buildings = await listBuildings(orgId, includeInactive);
      sendJson(res, 200, { data: buildings, total: buildings.length });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch buildings", String(e));
    }
  }));

  router.post("/buildings", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateBuildingSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid building data", parsed.error.flatten());
      const created = await createBuilding(orgId, parsed.data);
      sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to create building", String(e));
    }
  });

  router.get("/buildings/:id", withAuthRequired(async ({ res, orgId, params, prisma }) => {
    try {
      const building = await inventoryRepo.findBuildingByIdDeep(prisma, params.id, orgId);
      if (!building) return sendError(res, 404, "NOT_FOUND", "Building not found");
      sendJson(res, 200, { data: mapBuildingToDetailDTO(building as any) });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch building", String(e));
    }
  }));

  router.patch("/buildings/:id", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = UpdateBuildingSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid building data", parsed.error.flatten());

      // Convert managedSince ISO string → Date | null for Prisma
      const { managedSince, ...rest } = parsed.data;
      const updateData: Parameters<typeof updateBuilding>[2] = { ...rest };
      if (managedSince !== undefined) {
        updateData.managedSince = managedSince ? new Date(managedSince) : null;
      }

      const updated = await updateBuilding(orgId, params.id, updateData);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Building not found");
      sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to update building", String(e));
    }
  });

  router.delete("/buildings/:id", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const result = await deactivateBuilding(orgId, params.id);
      if (!result.success && result.reason === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Building not found");
      if (!result.success && result.reason === "HAS_ACTIVE_UNITS") return sendError(res, 409, "CONFLICT", "Building has active units");
      sendJson(res, 200, { message: "Building deactivated" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to deactivate building", String(e));
    }
  });

  /* ── Building Owners ───────────────────────────────────────── */

  router.get("/buildings/:id/owners", withAuthRequired(async ({ res, params, prisma }) => {
    try {
      const rows = await inventoryRepo.findBuildingOwners(prisma, params.id);
      const data = rows.map((r) => r.user);
      sendJson(res, 200, { data });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch building owners", String(e));
    }
  }));

  router.get("/buildings/:id/owners/candidates", withAuthRequired(async ({ res, orgId, prisma }) => {
    try {
      const candidates = await inventoryRepo.findOrgOwners(prisma, orgId);
      sendJson(res, 200, { data: candidates });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch owner candidates", String(e));
    }
  }));

  router.post("/buildings/:id/owners", async ({ req, res, orgId, params, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const userId = raw?.userId;
      if (!userId || typeof userId !== "string") {
        return sendError(res, 400, "VALIDATION_ERROR", "userId is required");
      }

      // Validate user exists, same org, role=OWNER
      const user = await prisma.user.findFirst({
        where: { id: userId, orgId },
      });
      if (!user) {
        return sendError(res, 422, "VALIDATION_ERROR", "User not found in this org");
      }
      if (user.role !== "OWNER") {
        return sendError(res, 422, "VALIDATION_ERROR", "User must have OWNER role");
      }

      const row = await inventoryRepo.addBuildingOwner(prisma, params.id, userId);
      sendJson(res, 201, { data: row?.user ?? { id: userId } });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to add building owner", String(e));
    }
  });

  router.delete("/buildings/:id/owners/:userId", async ({ req, res, params, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      await inventoryRepo.removeBuildingOwner(prisma, params.id, params.userId);
      sendJson(res, 204, null);
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to remove building owner", String(e));
    }
  });

  /* ── Units ─────────────────────────────────────────────────── */

  router.get("/buildings/:id/units", withAuthRequired(async ({ res, orgId, query, params }) => {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const typeParam = first(query, "type");
      const type = typeParam === "COMMON_AREA" || typeParam === "RESIDENTIAL" ? typeParam : undefined;
      const units = await listUnits(orgId, params.id, includeInactive, type as any);
      sendJson(res, 200, { data: units.map(mapUnitToListDTO) });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch units", String(e));
    }
  }));

  router.post("/buildings/:id/units", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateUnitSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid unit data", parsed.error.flatten());
      const created = await createUnit(orgId, params.id, parsed.data);
      if (!created) return sendError(res, 404, "NOT_FOUND", "Building not found");
      sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to create unit", String(e));
    }
  });

  router.get("/units", withAuthRequired(async ({ res, orgId, query, prisma }) => {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const units = await inventoryRepo.listAllUnitsForOrg(prisma, orgId, includeInactive);
      sendJson(res, 200, { data: units });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch units", String(e));
    }
  }));

  router.get("/units/:id", withAuthRequired(async ({ res, orgId, params }) => {
    try {
      const unit = await getUnitById(orgId, params.id);
      if (!unit) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      sendJson(res, 200, { data: unit });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch unit", String(e));
    }
  }));

  router.patch("/units/:id", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = UpdateUnitSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid unit data", parsed.error.flatten());
      const updated = await updateUnit(orgId, params.id, parsed.data);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to update unit", String(e));
    }
  });

  router.delete("/units/:id", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const result = await deactivateUnit(orgId, params.id);
      if (!result.success && result.reason === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Unit not found");
      if (!result.success && result.reason === "HAS_ACTIVE_APPLIANCES") return sendError(res, 409, "CONFLICT", "Unit has active appliances");
      sendJson(res, 200, { message: "Unit deactivated" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to deactivate unit", String(e));
    }
  });

  /* ── Appliances ────────────────────────────────────────────── */

  router.get("/units/:id/appliances", withAuthRequired(async ({ res, orgId, query, params }) => {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const appliances = await listAppliances(orgId, params.id, includeInactive);
      sendJson(res, 200, { data: appliances });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch appliances", String(e));
    }
  }));

  router.post("/units/:id/appliances", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateApplianceSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid appliance data", parsed.error.flatten());
      const created = await createAppliance(orgId, params.id, parsed.data);
      if (!created) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to create appliance", String(e));
    }
  });

  router.patch("/appliances/:id", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = UpdateApplianceSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid appliance data", parsed.error.flatten());
      const updated = await updateAppliance(orgId, params.id, parsed.data);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Appliance not found");
      sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to update appliance", String(e));
    }
  });

  router.delete("/appliances/:id", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const result = await deactivateAppliance(orgId, params.id);
      if (!result.success && result.reason === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Appliance not found");
      if (!result.success && result.reason === "HAS_REQUESTS") return sendError(res, 409, "CONFLICT", "Appliance is referenced by requests");
      sendJson(res, 200, { message: "Appliance deactivated" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to deactivate appliance", String(e));
    }
  });

  /* ── Asset Models ──────────────────────────────────────────── */

  router.get("/asset-models", withAuthRequired(async ({ res, orgId, query }) => {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const models = await listAssetModels(orgId, includeInactive);
      const data = models.map((m) => ({ ...m, name: addAssetModelName(m) }));
      sendJson(res, 200, { data, total: data.length });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch asset models", String(e));
    }
  }));

  router.post("/asset-models", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateAssetModelSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid asset model data", parsed.error.flatten());
      const created = await createAssetModel(orgId, parsed.data);
      sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to create asset model", String(e));
    }
  });

  router.patch("/asset-models/:id", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = UpdateAssetModelSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid asset model data", parsed.error.flatten());
      const updated = await updateAssetModel(orgId, params.id, parsed.data);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Asset model not found");
      sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to update asset model", String(e));
    }
  });

  router.delete("/asset-models/:id", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const result = await deactivateAssetModel(orgId, params.id);
      if (!result.success && result.reason === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Asset model not found");
      if (!result.success && result.reason === "HAS_APPLIANCES") return sendError(res, 409, "CONFLICT", "Asset model is referenced by appliances");
      if (!result.success && result.reason === "FORBIDDEN") return sendError(res, 403, "FORBIDDEN", "Asset model is not org-private");
      sendJson(res, 200, { message: "Asset model deactivated" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to deactivate asset model", String(e));
    }
  });

  /* ── Occupancies ───────────────────────────────────────────── */

  router.get("/units/:unitId/tenants", withAuthRequired(async ({ res, orgId, params }) => {
    try {
      const tenants = await listUnitTenants(orgId, params.unitId);
      if (!tenants) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      sendJson(res, 200, { data: tenants });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch unit tenants", String(e));
    }
  }));

  router.post("/units/:unitId/tenants", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = LinkTenantSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid tenant link data", parsed.error.flatten());

      let tenantId = parsed.data.tenantId;
      if (!tenantId) {
        const normalizedPhone = normalizePhoneToE164(parsed.data.phone);
        if (!normalizedPhone) return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");
        const tenant = await createOrGetTenant({ orgId, phone: normalizedPhone, name: parsed.data.name });
        tenantId = tenant.id;
      }

      const result = await linkTenantToUnit(orgId, tenantId, params.unitId);
      if (!result.success && result.reason === "UNIT_NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Unit not found");
      if (!result.success && result.reason === "TENANT_NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Tenant not found");
      sendJson(res, 200, { message: "Tenant linked", data: { tenantId, unitId: params.unitId } });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to link tenant", String(e));
    }
  });

  router.delete("/units/:unitId/tenants/:tenantId", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const result = await unlinkTenantFromUnit(orgId, params.tenantId, params.unitId);
      if (!result.success && result.reason === "UNIT_NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Unit not found");
      sendJson(res, 200, { message: "Tenant unlinked" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to unlink tenant", String(e));
    }
  });

  /* ── Asset Inventory ───────────────────────────────────────── */

  /* ── Repair vs Replace Analysis ────────────────────────────── */

  router.get("/units/:id/repair-replace-analysis", async ({ req, res, orgId, params, prisma, query }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const canton = first(query, "canton") || null;
      const analysis = await getRepairReplaceAnalysis(prisma, orgId, params.id, canton);
      sendJson(res, 200, { data: analysis });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch repair-replace analysis", String(e));
    }
  });

  /* ── Asset Inventory ───────────────────────────────────────── */

  router.get("/units/:id/asset-inventory", withAuthRequired(async ({ res, orgId, params, prisma, query }) => {
    try {
      const canton = first(query, "canton") || null;
      const items = await getAssetInventoryForUnit(prisma, orgId, params.id, canton);
      sendJson(res, 200, { data: items });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch unit asset inventory", String(e));
    }
  }));

  router.post("/units/:id/assets", async ({ req, res, orgId, params, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const body = { ...raw, unitId: params.id };
      const parsed = UpsertAssetSchema.safeParse(body);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid asset data", parsed.error.flatten());
      const data = parsed.data;
      const asset = await assetRepo.upsertAsset(prisma, orgId, {
        unitId: data.unitId,
        type: data.type as any,
        topic: data.topic,
        name: data.name,
        assetModelId: data.assetModelId,
        installedAt: data.installedAt ? new Date(data.installedAt) : null,
        lastRenovatedAt: data.lastRenovatedAt ? new Date(data.lastRenovatedAt) : null,
        replacedAt: data.replacedAt ? new Date(data.replacedAt) : null,
        brand: data.brand,
        modelNumber: data.modelNumber,
        serialNumber: data.serialNumber,
        notes: data.notes,
        isPresent: data.isPresent,
      });
      sendJson(res, 201, { data: asset });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to upsert asset", String(e));
    }
  });

  router.get("/buildings/:id/asset-inventory", withAuthRequired(async ({ res, orgId, params, prisma, query }) => {
    try {
      const canton = first(query, "canton") || null;
      const buildingLevelOnly = first(query, "buildingLevelOnly") === "true";
      const items = await getAssetInventoryForBuilding(prisma, orgId, params.id, { buildingLevelOnly, canton });
      sendJson(res, 200, { data: items });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch building asset inventory", String(e));
    }
  }));

  router.post("/buildings/:id/assets", async ({ req, res, orgId, params, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = UpsertAssetSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid asset data", parsed.error.flatten());
      const data = parsed.data;
      const asset = await assetRepo.upsertAsset(prisma, orgId, {
        unitId: data.unitId,
        type: data.type as any,
        topic: data.topic,
        name: data.name,
        assetModelId: data.assetModelId,
        installedAt: data.installedAt ? new Date(data.installedAt) : null,
        lastRenovatedAt: data.lastRenovatedAt ? new Date(data.lastRenovatedAt) : null,
        replacedAt: data.replacedAt ? new Date(data.replacedAt) : null,
        brand: data.brand,
        modelNumber: data.modelNumber,
        serialNumber: data.serialNumber,
        notes: data.notes,
        isPresent: data.isPresent,
      });
      sendJson(res, 201, { data: asset });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to upsert asset", String(e));
    }
  });

  router.post("/assets/:id/interventions", async ({ req, res, orgId, params, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = AddInterventionSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid intervention data", parsed.error.flatten());
      // Verify asset exists and belongs to org
      const asset = await assetRepo.findAssetById(prisma, orgId, params.id);
      if (!asset) return sendError(res, 404, "NOT_FOUND", "Asset not found");
      const data = parsed.data;
      const intervention = await assetRepo.addIntervention(prisma, params.id, {
        type: data.type as any,
        interventionDate: new Date(data.interventionDate),
        costChf: data.costChf,
        jobId: data.jobId,
        notes: data.notes,
      });
      sendJson(res, 201, { data: intervention });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to add intervention", String(e));
    }
  });
}
