import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { maybeRequireManager, requireRole, getAuthUser } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import * as crypto from "crypto";
import prismaClient from "../services/prismaClient";
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
  getMarketPriceByZip,
  upsertMarketPriceByZip,
  listAssetModels,
  createAssetModel,
  updateAssetModel,
  deactivateAssetModel,
  addAssetModelName,
} from "../services/inventory";
import { getAssetInventoryForUnit, getAssetInventoryForBuilding, getRepairReplaceAnalysis, getBuildingRenovationOpportunities } from "../services/assetInventory";
import { seedDefaultBuildingAssets, seedDefaultUnitAssets } from "../services/defaultAssets";
import { assetRepo } from "../repositories";
import { listUnitTenants, linkTenantToUnit, unlinkTenantFromUnit } from "../services/occupancies";
import { listContractors } from "../services/contractorRequests";
import { listTenants, createOrGetTenant } from "../services/tenants";
import { propertyFromBuilding } from "../services/adapters/propertyAdapter";
import { contactFromTenant, contactFromContractor } from "../services/adapters/contactAdapter";
import { CreateBuildingSchema, UpdateBuildingSchema, UpsertMarketPriceSchema } from "../validation/buildings";
import { CreateUnitSchema, UpdateUnitSchema } from "../validation/units";
import { CreateAssetModelSchema, UpdateAssetModelSchema } from "../validation/assetModels";
import { UpsertAssetSchema, AddInterventionSchema, PatchAssetSchema } from "../validation/assets";
import { LinkTenantSchema } from "../validation/occupancies";
import { normalizePhoneToE164 } from "../utils/phoneNormalization";
import { normalizeTopicKey } from "../utils/topicKey";
import * as inventoryRepo from "../repositories/inventoryRepository";
import * as legalSourceRepo from "../repositories/legalSourceRepository";
import { findDepreciationTopicSuggestions, findAssetTopicSuggestions, findOrgOwnerByIdFull, updateOwnerUser, syncAllBuildingsForOwner } from "../repositories/inventoryRepository";
import { findUnlinkedJobsByUnit } from "../repositories/jobRepository";
import { mapBuildingToDetailDTO } from "../dto/buildingDetail";
import { mapUnitToListDTO } from "../dto/unitList";
import { computeUnitIntrinsicValue } from "../services/unitValuation";
import { createBillingEntity } from "../services/billingEntities";
import { CreateBillingEntitySchema } from "../validation/billingEntities";
import * as bcrypt from "bcryptjs";

export function registerInventoryRoutes(router: Router) {
  /* ── Properties (alias over Buildings) ─────────────────────── */

  router.get("/properties", withAuthRequired(async ({ req, res, orgId, query }) => {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const user = getAuthUser(req);
      const ownerId   = user?.role === "OWNER" ? (user.ownerId || user.userId) : undefined;
      const managerId = user?.role === "MANAGER" ? user.userId : undefined;
      const buildings = await listBuildings(orgId, includeInactive, ownerId, managerId);
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

  /* ── Owners ────────────────────────────────────────────────── */

  router.get("/people/owners", withAuthRequired(async ({ res, orgId, prisma }) => {
    try {
      const owners = await inventoryRepo.findOrgOwnersWithBilling(prisma, orgId);
      sendJson(res, 200, { data: owners.map((o) => ({
        id: o.id,
        name: o.name,
        email: o.email || undefined,
        createdAt: o.createdAt.toISOString(),
        billingEntity: o.billingEntity
          ? { id: o.billingEntity.id, name: o.billingEntity.name, iban: o.billingEntity.iban }
          : null,
      })), total: owners.length });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch owners", String(e));
    }
  }));

  // GET /people/owners/:id — owner detail with billingEntity + buildings
  router.get("/people/owners/:id", withAuthRequired(async ({ res, params, orgId, prisma }) => {
    try {
      const owner = await findOrgOwnerByIdFull(prisma, orgId, params.id);
      if (!owner) return sendError(res, 404, "NOT_FOUND", "Owner not found");
      sendJson(res, 200, {
        data: {
          id: owner.id,
          name: owner.name,
          email: owner.email || null,
          createdAt: owner.createdAt.toISOString(),
          billingEntity: owner.billingEntity
            ? {
                id: owner.billingEntity.id,
                name: owner.billingEntity.name,
                addressLine1: owner.billingEntity.addressLine1,
                postalCode: owner.billingEntity.postalCode,
                city: owner.billingEntity.city,
                country: owner.billingEntity.country,
                iban: owner.billingEntity.iban,
                vatNumber: owner.billingEntity.vatNumber || null,
                type: owner.billingEntity.type,
              }
            : null,
          buildings: (owner.ownedBuildings || []).map((ob: any) => ({
            id: ob.building.id,
            name: ob.building.name,
            address: ob.building.address,
          })),
        },
      });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch owner", String(e));
    }
  }));

  router.post("/people/owners", async ({ req, res, orgId, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const { name, email, password } = raw as any;
      if (!name?.trim()) return sendError(res, 400, "VALIDATION_ERROR", "name is required");
      if (!email?.trim()) return sendError(res, 400, "VALIDATION_ERROR", "email is required");
      if (!password?.trim()) return sendError(res, 400, "VALIDATION_ERROR", "password is required");

      const existing = await inventoryRepo.findUserByOrgAndEmail(prisma, orgId, email.trim());
      if (existing) return sendError(res, 409, "CONFLICT", "A user with this email already exists");

      const passwordHash = await bcrypt.hash(password, 10);
      const owner = await inventoryRepo.createOwnerUser(prisma, {
        orgId, name: name.trim(), email: email.trim(), passwordHash,
      });
      sendJson(res, 201, { data: { id: owner.id, name: owner.name, email: owner.email, createdAt: owner.createdAt.toISOString(), billingEntity: null } });
    } catch (e: any) {
      if (e.message === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to create owner", String(e));
    }
  });

  router.post("/people/owners/:id/billing-entity", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateBillingEntitySchema.safeParse({ ...raw, type: "OWNER", userId: params.id });
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid billing entity data", parsed.error.flatten());
      const created = await createBillingEntity({ orgId, ...parsed.data, userId: params.id });
      sendJson(res, 201, { data: created });
    } catch (e: any) {
      if (e.message === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (e.message === "BILLING_ENTITY_TYPE_EXISTS") return sendError(res, 409, "CONFLICT", "Billing entity already exists for this owner");
      sendError(res, 500, "DB_ERROR", "Failed to create billing entity", String(e));
    }
  });

  // PATCH /people/owners/:id — update owner name and/or email
  router.patch("/people/owners/:id", async ({ req, res, params, orgId, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req) as any;
      const name: string | undefined = raw.name?.trim() || undefined;
      const email: string | undefined = raw.email?.trim() || undefined;
      if (!name && !email) return sendError(res, 400, "VALIDATION_ERROR", "At least name or email is required");

      const existing = await inventoryRepo.findOrgOwnerById(prisma, orgId, params.id);
      if (!existing || existing.role !== "OWNER") return sendError(res, 404, "NOT_FOUND", "Owner not found");

      const updated = await updateOwnerUser(prisma, params.id, { ...(name ? { name } : {}), ...(email ? { email } : {}) });
      sendJson(res, 200, { data: { id: updated.id, name: updated.name, email: updated.email } });
    } catch (e: any) {
      if (e.message === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (e?.code === "P2002") {
        return sendError(res, 409, "DUPLICATE_EMAIL", "This email address is already in use by another user in your organisation.");
      }
      console.error("[owners/patch]", e);
      sendError(res, 500, "DB_ERROR", "Failed to update owner", String(e));
    }
  });

  /* ── Buildings ─────────────────────────────────────────────── */

  router.get("/buildings", withAuthRequired(async ({ req, res, orgId, query }) => {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const filterByOwner = first(query, "filterByOwner") === "true";
      const user = getAuthUser(req);
      // filterByOwner=true: owner surface requesting owner-scoped view (works for any role)
      const ownerId = filterByOwner ? (user?.ownerId || user?.userId) : user?.role === "OWNER" ? (user.ownerId || user.userId) : undefined;
      // Managers see all org buildings — managerId on Building is an assignment field,
      // not an access-control gate. Filtering by userId here breaks when prismaUserId
      // is absent from the JWT (Supabase UUID ≠ Prisma User.id).
      const buildings = await listBuildings(orgId, includeInactive, ownerId, undefined);
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
      // Auto-assign the creating manager — skip silently if userId is not a DB User (e.g. test tokens)
      const user = getAuthUser(req);
      const managerId = user?.userId ?? null;
      let created: Awaited<ReturnType<typeof createBuilding>>;
      try {
        created = await createBuilding(orgId, { ...parsed.data, managerId });
      } catch (fkErr: any) {
        // P2003 = FK constraint violation (user not in DB) — retry without managerId
        if (fkErr?.code === 'P2003') {
          created = await createBuilding(orgId, parsed.data);
        } else {
          throw fkErr;
        }
      }
      sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to create building", String(e));
    }
  });

  router.get("/buildings/:id", withAuthRequired(async ({ req, res, orgId, params, prisma }) => {
    try {
      const building = await inventoryRepo.findBuildingByIdDeep(prisma, params.id, orgId);
      if (!building) return sendError(res, 404, "NOT_FOUND", "Building not found");
      // managerId is an assignment/tracking field, not an access gate —
      // same rationale as GET /buildings (see earlier fix). Managers see all org buildings.
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

      // Convert ISO date strings → Date | null for Prisma
      const { managedSince, constructionDate, lastRenovationDate, ...rest } = parsed.data;
      const updateData: Parameters<typeof updateBuilding>[2] = { ...rest };
      if (managedSince !== undefined) {
        updateData.managedSince = managedSince ? new Date(managedSince) : null;
      }
      if (constructionDate !== undefined) {
        updateData.constructionDate = constructionDate ? new Date(constructionDate) : null;
      }
      if (lastRenovationDate !== undefined) {
        updateData.lastRenovationDate = lastRenovationDate ? new Date(lastRenovationDate) : null;
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

  // GET /buildings/:id/house-rules-pdf — stream house rules as PDF
  router.get("/buildings/:id/house-rules-pdf", async ({ req, res, params, orgId }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const building = await prismaClient.building.findUnique({ where: { id: params.id } });
      if (!building || building.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Building not found");
      if (!building.houseRulesText) return sendError(res, 404, "NOT_FOUND", "No house rules text defined for this building");

      const PDFKit = await import("pdfkit");
      const PDFDocument = (PDFKit as any).default ?? PDFKit;
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      await new Promise<void>((resolve, reject) => {
        doc.on("end", resolve);
        doc.on("error", reject);
        doc.fontSize(16).font("Helvetica-Bold").text("RÈGLEMENT DE LA MAISON", { align: "center" });
        doc.fontSize(10).font("Helvetica").text(building.name, { align: "center" });
        doc.moveDown(1);
        doc.fontSize(9).font("Helvetica").text(building.houseRulesText!, { lineGap: 2 });
        doc.end();
      });
      const buffer = Buffer.concat(chunks);
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
      res.writeHead(200, {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="house-rules-${params.id.slice(0, 8)}.pdf"`,
        "content-length": buffer.length.toString(),
        "x-pdf-sha256": sha256,
      });
      res.end(buffer);
    } catch (e) {
      if (res.headersSent) { res.end(); return; }
      sendError(res, 500, "PDF_ERROR", "Failed to generate house rules PDF", String(e));
    }
  });

  // GET /buildings/:id/legal-sources — legal sources applicable to a building (FEDERAL + canton)
  router.get("/buildings/:id/legal-sources", withAuthRequired(async ({ res, params, prisma }) => {
    try {
      const sources = await legalSourceRepo.findForBuilding(prisma, params.id);
      sendJson(res, 200, { data: sources });
    } catch (e: any) {
      console.error("[GET /buildings/:id/legal-sources]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch legal sources");
    }
  }));

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
      const user = await inventoryRepo.findOrgOwnerById(prisma, orgId, userId);
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

  // POST /people/owners/:id/sync-buildings — insert BuildingOwner rows for all
  // active buildings. Called by admin/users after setting ownerId in app_metadata.
  router.post("/people/owners/:id/sync-buildings", async ({ req, res, orgId, params, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const userId = params.id;
      const user = await inventoryRepo.findOrgOwnerById(prisma, orgId, userId);
      if (!user) return sendError(res, 404, "NOT_FOUND", "User not found");

      const synced = await syncAllBuildingsForOwner(prisma, orgId, userId);
      sendJson(res, 200, { synced });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to sync buildings", String(e));
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
      const intrinsicValuation = computeUnitIntrinsicValue(unit);
      // Market estimate (reference only) — zip price × living area, kept distinct
      // from the intrinsic valuation. Null when no price is on file for the zip.
      const postalCode = (unit as { building?: { postalCode?: string | null } }).building?.postalCode ?? null;
      const marketPrice = postalCode ? await getMarketPriceByZip(orgId, postalCode) : null;
      const marketEstimate = marketPrice
        ? {
            pricePerSqmChf: marketPrice.pricePerSqmChf,
            source: marketPrice.source,
            asOf: marketPrice.asOf,
            estimateChf: unit.livingAreaSqm != null ? unit.livingAreaSqm * marketPrice.pricePerSqmChf : null,
          }
        : null;
      sendJson(res, 200, { data: { ...unit, intrinsicValuation, marketEstimate } });
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
      sendJson(res, 200, { message: "Unit deactivated" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to deactivate unit", String(e));
    }
  });

  // Reference market price per m² for a postal code (manually maintained / seeded).
  router.get("/market-prices/:postalCode", withAuthRequired(async ({ res, orgId, params }) => {
    try {
      const price = await getMarketPriceByZip(orgId, params.postalCode);
      sendJson(res, 200, { data: price });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch market price", String(e));
    }
  }));

  router.put("/market-prices", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = UpsertMarketPriceSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid market price", parsed.error.flatten());
      const { asOf, ...rest } = parsed.data;
      const saved = await upsertMarketPriceByZip(orgId, {
        ...rest,
        asOf: asOf ? new Date(asOf) : null,
      });
      sendJson(res, 200, { data: saved });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to save market price", String(e));
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

  /* ── Building Renovation Opportunities ─────────────────────── */

  router.get("/buildings/:id/renovation-opportunities", withAuthRequired(async ({ res, orgId, params, prisma }) => {
    try {
      const items = await getBuildingRenovationOpportunities(prisma, orgId, params.id);
      sendJson(res, 200, { data: items });
    } catch (e: any) {
      if (String(e?.message).includes("not found")) return sendError(res, 404, "NOT_FOUND", String(e.message));
      sendError(res, 500, "DB_ERROR", "Failed to fetch renovation opportunities", String(e));
    }
  }));

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

  /* ── Asset Topic Suggestions ────────────────────────────────── */

  /**
   * Returns distinct canonical topic keys from DepreciationStandard + existing Asset records.
   * Used by the frontend to power autocomplete on the topic field.
   * topic is the PRIMARY depreciation key — guiding users toward known values
   * prevents silent depreciation misses.
   */
  router.get("/asset-topic-suggestions", withAuthRequired(async ({ res, orgId, prisma, query }) => {
    try {
      const assetType = first(query, "assetType") || undefined;

      // Source 1: depreciation standards (canonical)
      const standards = await findDepreciationTopicSuggestions(prisma, assetType);

      // Source 2: existing asset topics in this org (may include user-created values)
      const assets = await findAssetTopicSuggestions(prisma, orgId, assetType);

      // Merge + deduplicate by normalized topic key
      const seen = new Map<string, { topic: string; assetType: string; source: string; usefulLifeMonths: number | null }>();
      for (const s of standards) {
        const key = normalizeTopicKey(s.topic);
        if (!seen.has(key)) seen.set(key, { topic: s.topic, assetType: s.assetType, source: "standard", usefulLifeMonths: s.usefulLifeMonths });
      }
      for (const a of assets) {
        const key = normalizeTopicKey(a.topic);
        if (!seen.has(key)) seen.set(key, { topic: a.topic, assetType: a.type, source: "asset", usefulLifeMonths: null });
      }

      const suggestions = Array.from(seen.entries()).map(([topicKey, v]) => ({
        topicKey,
        label: v.topic,
        assetType: v.assetType,
        source: v.source,
        usefulLifeMonths: v.usefulLifeMonths,
      })).sort((a, b) => a.topicKey.localeCompare(b.topicKey));

      sendJson(res, 200, { data: suggestions });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch topic suggestions", String(e));
    }
  }));

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

  /* ── GET /units/:id/unlinked-jobs — completed jobs with no asset linked ── */
  router.get("/units/:id/unlinked-jobs", withAuthRequired(async ({ res, orgId, params, prisma }) => {
    try {
      // Jobs are COMPLETED or INVOICED, request.assetId IS NULL
      const jobs = await findUnlinkedJobsByUnit(prisma, orgId, params.id);
      sendJson(res, 200, { data: jobs, total: jobs.length });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch unlinked jobs", String(e));
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
        usefulLifeOverrideMonths: data.usefulLifeOverrideMonths,
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
      // Default to building-scoped assets only; pass ?buildingLevelOnly=false for full inventory
      const buildingLevelOnly = first(query, "buildingLevelOnly") !== "false";
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
      // If no unitId provided, treat as a building-level asset
      const asset = await assetRepo.upsertAsset(prisma, orgId, {
        unitId: data.unitId ?? null,
        buildingId: data.unitId ? null : params.id,
        type: data.type as any,
        topic: data.topic,
        name: data.name,
        assetModelId: data.assetModelId,
        usefulLifeOverrideMonths: data.usefulLifeOverrideMonths,
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

  // POST /buildings/:id/seed-default-assets — retroactive default seeding
  router.post("/buildings/:id/seed-default-assets", async ({ req, res, orgId, params, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, params.id, orgId);
      if (!building) return sendError(res, 404, "NOT_FOUND", "Building not found");
      await seedDefaultBuildingAssets(prisma, orgId, params.id, { hasElevator: building.hasElevator });
      sendJson(res, 200, { success: true });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to seed default assets", String(e));
    }
  });

  // POST /units/:id/seed-default-assets — retroactive default seeding
  router.post("/units/:id/seed-default-assets", async ({ req, res, orgId, params, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const unit = await inventoryRepo.findUnitByIdAndOrg(prisma, params.id, orgId);
      if (!unit) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      await seedDefaultUnitAssets(prisma, orgId, params.id);
      sendJson(res, 200, { success: true });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to seed default assets", String(e));
    }
  });

  router.patch("/assets/:id", async ({ req, res, orgId, params, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const parsed = PatchAssetSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid asset data", parsed.error.flatten());
      const d = parsed.data;
      const asset = await assetRepo.updateAsset(prisma, orgId, params.id, {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.installedAt !== undefined ? { installedAt: d.installedAt ? new Date(d.installedAt) : null } : {}),
        ...(d.lastRenovatedAt !== undefined ? { lastRenovatedAt: d.lastRenovatedAt ? new Date(d.lastRenovatedAt) : null } : {}),
        ...(d.replacedAt !== undefined ? { replacedAt: d.replacedAt ? new Date(d.replacedAt) : null } : {}),
        ...(d.brand !== undefined ? { brand: d.brand } : {}),
        ...(d.modelNumber !== undefined ? { modelNumber: d.modelNumber } : {}),
        ...(d.serialNumber !== undefined ? { serialNumber: d.serialNumber } : {}),
        ...(d.usefulLifeOverrideMonths !== undefined ? { usefulLifeOverrideMonths: d.usefulLifeOverrideMonths } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.isPresent !== undefined ? { isPresent: d.isPresent } : {}),
      });
      if (!asset) return sendError(res, 404, "NOT_FOUND", "Asset not found");
      sendJson(res, 200, { data: asset });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to update asset", String(e));
    }
  });

  router.delete("/assets/:id", async ({ req, res, orgId, params, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const asset = await assetRepo.deactivateAsset(prisma, orgId, params.id);
      if (!asset) return sendError(res, 404, "NOT_FOUND", "Asset not found");
      sendJson(res, 200, { data: asset });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to deactivate asset", String(e));
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
