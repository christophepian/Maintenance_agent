import "dotenv/config";

const port = process.env.PORT ? Number(process.env.PORT) : 3001;

import { PrismaClient, OrgMode } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { encodeToken } from "./services/auth";
import { sendError, sendJson } from "./http/json";
import { getAuthUser, getOrgIdForRequest, isAuthOptional, maybeRequireManager, requireRole, AuthedRequest } from "./authz";
import { parseQuery, first, getIntParam, getEnumParam } from "./http/query";
import { readJson } from "./http/body";
import { DEFAULT_ORG_ID, ensureDefaultOrgConfig, getOrgConfig, updateOrgConfig } from "./services/orgConfig";
import { UpdateOrgConfigSchema } from "./validation/orgConfig";
import { BuildingConfigSchema } from "./validation/buildingConfig";
import { UnitConfigSchema } from "./validation/unitConfig";
import { computeEffectiveConfig, getBuildingConfig, upsertBuildingConfig } from "./services/buildingConfig";
import { getUnitConfig, upsertUnitConfig, deleteUnitConfig, computeEffectiveUnitConfig } from "./services/unitConfig";
import { UpdateRequestStatusSchema } from "./validation/requestStatus";
import { RequestStatus } from "@prisma/client";
import { AssignContractorSchema } from "./validation/requestAssignment";
import { updateMaintenanceRequestStatus, assignContractor, unassignContractor, findMatchingContractor, listMaintenanceRequests, getMaintenanceRequestById, listOwnerPendingApprovals } from "./services/maintenanceRequests";
import { updateContractorRequestStatus, getContractorAssignedRequests } from "./services/contractorRequests";
import { CreateRequestSchema, CreateRequestInput } from "./validation/requests";
import { decideRequestStatus, decideRequestStatusWithRules } from "./services/autoApproval";
import { normalizePhoneToE164 } from "./utils/phoneNormalization";
import { getTenantByPhone, createOrGetTenant, updateTenant, deactivateTenant, listTenants, getTenantById } from "./services/tenants";
import { getTenantSession } from "./services/tenantSession";
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
} from "./services/inventory";
import { listUnitTenants, linkTenantToUnit, unlinkTenantFromUnit } from "./services/occupancies";
import { listContractors, CreateContractorSchema, createContractor, getContractorById, UpdateContractorSchema, updateContractor, deactivateContractor } from "./services/contractorRequests";
import { TenantSessionSchema } from "./validation/tenantSession";
import { TriageSchema } from "./validation/triage";
import { triageIssue } from "./services/triage";
import { LoginSchema, RegisterSchema } from "./validation/auth";
import { CreateBuildingSchema, UpdateBuildingSchema } from "./validation/buildings";
import { CreateUnitSchema, UpdateUnitSchema } from "./validation/units";
import { CreateApplianceSchema, UpdateApplianceSchema } from "./validation/appliances";
import { CreateAssetModelSchema, UpdateAssetModelSchema } from "./validation/assetModels";
import { LinkTenantSchema } from "./validation/occupancies";
import { CreateApprovalRuleSchema, UpdateApprovalRuleSchema } from "./validation/approvalRules";
import { listApprovalRules, createApprovalRule, getApprovalRule, updateApprovalRule, deleteApprovalRule } from "./services/approvalRules";
import { propertyFromBuilding } from "./services/adapters/propertyAdapter";
import { contactFromTenant, contactFromContractor } from "./services/adapters/contactAdapter";
import { workRequestFromRequest } from "./services/adapters/workRequestAdapter";
import { createJob, getJob, listJobs, updateJob } from "./services/jobs";
import { createInvoice, getInvoice, listInvoices, approveInvoice, markInvoicePaid, disputeInvoice, issueInvoice } from "./services/invoices";
import { CreateInvoiceSchema, UpdateInvoiceSchema } from "./validation/invoices";
import { createBillingEntity, deleteBillingEntity, getBillingEntity, listBillingEntities, updateBillingEntity } from "./services/billingEntities";
import { CreateBillingEntitySchema, UpdateBillingEntitySchema } from "./validation/billingEntities";
import {
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
} from "./services/notifications";
import { ListNotificationsSchema } from "./validation/notifications";
import { generateInvoiceQRBill, getInvoiceQRCodePNG } from "./services/invoiceQRBill";
import { generateInvoicePDF } from "./services/invoicePDF";

// Building/unit/appliance/asset model functions are not implemented; remove references below.
// import { ensureDefaultOrgConfig } from "./services/orgConfig";
import * as http from "http";
// ...import other helpers as needed

const prisma = new PrismaClient();

// Event log helper
async function logEvent({ orgId, type, actorUserId, requestId, payload }: { orgId: string, type: string, actorUserId?: string, requestId?: string, payload?: any }) {
  await prisma.event.create({
    data: {
      orgId,
      type,
      actorUserId: actorUserId || null,
      requestId: requestId || null,
      payload: payload ? JSON.stringify(payload) : "{}",
    },
  });
  console.log("[EVENT]", type, { orgId, actorUserId, requestId, payload });
}

function requireOrgViewer(req: AuthedRequest, res: http.ServerResponse): boolean {
  if (isAuthOptional()) return true;
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "UNAUTHORIZED" });
    return false;
  }
  if (user.role !== "MANAGER" && user.role !== "OWNER") {
    sendJson(res, 403, { error: "FORBIDDEN" });
    return false;
  }
  return true;
}

function requireGovernanceAccess(
  req: AuthedRequest,
  res: http.ServerResponse,
  orgMode: OrgMode
): boolean {
  if (isAuthOptional()) return true;
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "UNAUTHORIZED" });
    return false;
  }
  if (orgMode === "OWNER_DIRECT") {
    if (user.role !== "OWNER") {
      sendJson(res, 403, { error: "FORBIDDEN" });
      return false;
    }
    return true;
  }
  if (user.role !== "MANAGER" && user.role !== "OWNER") {
    sendJson(res, 403, { error: "FORBIDDEN" });
    return false;
  }
  return true;
}

function requireOwnerAccess(req: AuthedRequest, res: http.ServerResponse): boolean {
  if (isAuthOptional()) return true;
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "UNAUTHORIZED" });
    return false;
  }
  if (user.role !== "OWNER") {
    sendJson(res, 403, { error: "FORBIDDEN" });
    return false;
  }
  return true;
}


// =========================
// POST /__dev/create-contractor-user (dev only)
// =========================
// This block should be inside the main server handler, but here is the corrected logic:
async function handleCreateContractorUser(req, res, path) {
  if (req.method === "POST" && path === "/__dev/create-contractor-user") {
    if (process.env.NODE_ENV === "production") return sendError(res, 403, "FORBIDDEN", "Not allowed in production");
    try {
      const raw = await readJson(req);
      const { email, password, name, phone } = raw;
      if (!email || !password || !name || !phone) return sendError(res, 400, "VALIDATION_ERROR", "Missing fields");
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          orgId: DEFAULT_ORG_ID,
          email,
          name,
          passwordHash,
          role: "CONTRACTOR",
        },
      });
      const contractor = await prisma.contractor.create({
        data: {
          orgId: String(DEFAULT_ORG_ID),
          name: String(name),
          phone: String(phone),
          email: String(email),
          serviceCategories: JSON.stringify(["general"]), // stub
        },
      });
      return sendJson(res, 201, { userId: user.id, contractorId: contractor.id });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to create contractor user", String(e));
    }
  }
}




// --- routing helpers ---
// Helper: safely send error even if headers were already sent
function safeSendError(res: http.ServerResponse, status: number, code: string, message: string, detail?: string) {
  if (res.headersSent) {
    res.end();
  } else {
    sendError(res, status, code, message, detail);
  }
}

function matchRequestById(path: string) {
  const m = path.match(/^\/requests\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchWorkRequestById(path: string) {
  const m = path.match(/^\/work-requests\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchRequestStatus(path: string) {
  const m = path.match(/^\/requests\/([a-f0-9-]{36})\/status$/i);
  return m ? m[1] : null;
}

function matchContractorById(path: string) {
  const m = path.match(/^\/contractors\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchTenantById(path: string) {
  const m = path.match(/^\/tenants\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchBuildingById(path: string) {
  const m = path.match(/^\/buildings\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchBuildingUnits(path: string) {
  const m = path.match(/^\/buildings\/([a-f0-9-]{36})\/units$/i);
  return m ? m[1] : null;
}

function matchBuildingConfig(path: string) {
  const m = path.match(/^\/buildings\/([a-f0-9-]{36})\/config$/i);
  return m ? m[1] : null;
}

function matchUnitConfig(path: string) {
  const m = path.match(/^\/units\/([a-f0-9-]{36})\/config$/i);
  return m ? m[1] : null;
}

function matchApprovalRuleById(path: string) {
  const m = path.match(/^\/approval-rules\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchBillingEntityById(path: string) {
  const m = path.match(/^\/billing-entities\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchPropertyUnits(path: string) {
  const m = path.match(/^\/properties\/([a-f0-9-]{36})\/units$/i);
  return m ? m[1] : null;
}

function matchUnitById(path: string) {
  const m = path.match(/^\/units\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchUnitAppliances(path: string) {
  const m = path.match(/^\/units\/([a-f0-9-]{36})\/appliances$/i);
  return m ? m[1] : null;
}

function matchUnitTenants(path: string) {
  const m = path.match(/^\/units\/([a-f0-9-]{36})\/tenants$/i);
  return m ? m[1] : null;
}

function matchUnitTenant(path: string) {
  const m = path.match(/^\/units\/([a-f0-9-]{36})\/tenants\/([a-f0-9-]{36})$/i);
  return m ? { unitId: m[1], tenantId: m[2] } : null;
}

function matchApplianceById(path: string) {
  const m = path.match(/^\/appliances\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchAssetModelById(path: string) {
  const m = path.match(/^\/asset-models\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchJobById(path: string) {
  const m = path.match(/^\/jobs\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

function matchInvoiceById(path: string) {
  const m = path.match(/^\/invoices\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

const server = http.createServer(async (req: AuthedRequest, res) => {
    const { path, query } = parseQuery(req.url);

    // =========================
    // GET/POST /requests/:id/events
    // =========================
    const eventMatch = path.match(/^\/requests\/([a-f0-9\-]{36})\/events$/i);
    if (eventMatch) {
      if (req.method === "GET") {
        const requestId = eventMatch[1];
        try {
          const events = await prisma.requestEvent.findMany({
            where: { requestId },
            orderBy: { timestamp: "asc" },
          });
          return sendJson(res, 200, { data: events });
        } catch (e) {
          return sendError(res, 500, "DB_ERROR", "Failed to fetch events", String(e));
        }
      }
      if (req.method === "POST") {
        const requestId = eventMatch[1];
        try {
          const raw = await readJson(req);
          const { contractorId, type, message } = raw;
          console.log("Event creation attempt:", { requestId, contractorId, type, message });
          if (!contractorId || !type || !message) {
            return sendError(res, 400, "VALIDATION_ERROR", "Missing contractorId, type, or message");
          }
          // Check request exists
          const reqExists = await prisma.request.findUnique({ where: { id: requestId } });
          console.log("Request exists:", !!reqExists, "ID:", requestId);
          if (!reqExists) {
            return sendError(res, 404, "NOT_FOUND", "Request not found");
          }
          // Check contractor exists
          const contractorExists = await prisma.contractor.findUnique({ where: { id: contractorId } });
          console.log("Contractor exists:", !!contractorExists, "ID:", contractorId);
          if (!contractorExists) {
            return sendError(res, 404, "NOT_FOUND", "Contractor not found");
          }
          try {
            const event = await prisma.requestEvent.create({
              data: {
                requestId,
                contractorId,
                type,
                message,
              },
            });
            console.log("Event created:", event);
            return sendJson(res, 201, { data: event });
          } catch (dbErr) {
            console.error("Event creation error:", dbErr);
            return sendError(res, 500, "DB_ERROR", "Failed to create event", dbErr?.message || String(dbErr));
          }
        } catch (e) {
          console.error("Event handler error:", e);
          return sendError(res, 500, "DB_ERROR", "Failed to create event", e?.message || String(e));
        }
      }
      return; // Prevent fallthrough to NOT_FOUND
    }
  // CORS
  const isProd = process.env.NODE_ENV === "production";
  const corsOrigin = process.env.CORS_ORIGIN || (isProd ? "" : "*");
  if (corsOrigin) {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, authorization, x-dev-role, x-dev-org-id, x-dev-user-id, x-dev-email"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const orgId = getOrgIdForRequest(req);

  // =========================
  // Properties (alias over Buildings)
  // =========================
  if (req.method === "GET" && path === "/properties") {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const buildings = await listBuildings(orgId, includeInactive);
      const properties = buildings.map(propertyFromBuilding);
      return sendJson(res, 200, { data: properties });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch properties", String(e));
    }
  }

  const propertyId = matchPropertyUnits(path);
  if (req.method === "GET" && propertyId) {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const unitTypeRaw = first(query, "type");
      const unitType = unitTypeRaw && ["RESIDENTIAL", "COMMON_AREA"].includes(unitTypeRaw)
        ? (unitTypeRaw as any)
        : undefined;
      const units = await listUnits(orgId, propertyId, includeInactive, unitType);
      return sendJson(res, 200, { data: units });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch property units", String(e));
    }
  }

  // =========================
  // People (alias over tenants/contractors)
  // =========================
  if (req.method === "GET" && path === "/people/tenants") {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const tenants = await listTenants(orgId, includeInactive);
      const contacts = tenants.map(contactFromTenant);
      return sendJson(res, 200, { data: contacts });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch tenant contacts", String(e));
    }
  }

  if (req.method === "GET" && path === "/people/vendors") {
    try {
      const vendors = await listContractors(prisma, orgId);
      const contacts = vendors.map(contactFromContractor);
      return sendJson(res, 200, { data: contacts });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch vendor contacts", String(e));
    }
  }

  // =========================
  // Buildings
  // =========================
  if (req.method === "GET" && path === "/buildings") {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const buildings = await listBuildings(orgId, includeInactive);
      return sendJson(res, 200, { data: buildings });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch buildings", String(e));
    }
  }

  if (req.method === "POST" && path === "/buildings") {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateBuildingSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid building data", parsed.error.flatten());
      }
      const created = await createBuilding(orgId, parsed.data);
      return sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to create building", String(e));
    }
  }

  const buildingId = matchBuildingById(path);
  if (req.method === "PATCH" && buildingId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = UpdateBuildingSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid building data", parsed.error.flatten());
      }
      const updated = await updateBuilding(orgId, buildingId, parsed.data);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Building not found");
      return sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to update building", String(e));
    }
  }

  if (req.method === "DELETE" && buildingId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const result = await deactivateBuilding(orgId, buildingId);
      if (!result.success && result.reason === "NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Building not found");
      }
      if (!result.success && result.reason === "HAS_ACTIVE_UNITS") {
        return sendError(res, 409, "CONFLICT", "Building has active units");
      }
      return sendJson(res, 200, { message: "Building deactivated" });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to deactivate building", String(e));
    }
  }

  // =========================
  // Units
  // =========================
  const buildingUnitsId = matchBuildingUnits(path);
  if (req.method === "GET" && buildingUnitsId) {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const typeParam = first(query, "type");
      const type = typeParam === "COMMON_AREA" || typeParam === "RESIDENTIAL" ? typeParam : undefined;
      const units = await listUnits(orgId, buildingUnitsId, includeInactive, type as any);
      return sendJson(res, 200, { data: units });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch units", String(e));
    }
  }

  if (req.method === "POST" && buildingUnitsId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateUnitSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid unit data", parsed.error.flatten());
      }
      const created = await createUnit(orgId, buildingUnitsId, parsed.data);
      if (!created) return sendError(res, 404, "NOT_FOUND", "Building not found");
      return sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to create unit", String(e));
    }
  }

  const unitId = matchUnitById(path);
  if (req.method === "GET" && unitId) {
    try {
      const unit = await getUnitById(orgId, unitId);
      if (!unit) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      return sendJson(res, 200, { data: unit });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch unit", String(e));
    }
  }
  if (req.method === "PATCH" && unitId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = UpdateUnitSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid unit data", parsed.error.flatten());
      }
      const updated = await updateUnit(orgId, unitId, parsed.data);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      return sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to update unit", String(e));
    }
  }

  if (req.method === "DELETE" && unitId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const result = await deactivateUnit(orgId, unitId);
      if (!result.success && result.reason === "NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Unit not found");
      }
      if (!result.success && result.reason === "HAS_ACTIVE_APPLIANCES") {
        return sendError(res, 409, "CONFLICT", "Unit has active appliances");
      }
      return sendJson(res, 200, { message: "Unit deactivated" });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to deactivate unit", String(e));
    }
  }

  // List all units across all buildings in the org
  if (req.method === "GET" && path === "/units") {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const units = await prisma.unit.findMany({
        where: {
          building: { orgId },
          ...(includeInactive ? {} : { isActive: true }),
        },
        include: { building: true },
        orderBy: { createdAt: "desc" },
      });
      return sendJson(res, 200, { data: units });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch units", String(e));
    }
  }

  // =========================
  // Appliances
  // =========================
  const unitAppliancesId = matchUnitAppliances(path);
  if (req.method === "GET" && unitAppliancesId) {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const appliances = await listAppliances(orgId, unitAppliancesId, includeInactive);
      return sendJson(res, 200, { data: appliances });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch appliances", String(e));
    }
  }

  if (req.method === "POST" && unitAppliancesId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateApplianceSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid appliance data", parsed.error.flatten());
      }
      const created = await createAppliance(orgId, unitAppliancesId, parsed.data);
      if (!created) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      return sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to create appliance", String(e));
    }
  }

  const applianceId = matchApplianceById(path);
  if (req.method === "PATCH" && applianceId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = UpdateApplianceSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid appliance data", parsed.error.flatten());
      }
      const updated = await updateAppliance(orgId, applianceId, parsed.data);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Appliance not found");
      return sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to update appliance", String(e));
    }
  }

  if (req.method === "DELETE" && applianceId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const result = await deactivateAppliance(orgId, applianceId);
      if (!result.success && result.reason === "NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Appliance not found");
      }
      if (!result.success && result.reason === "HAS_REQUESTS") {
        return sendError(res, 409, "CONFLICT", "Appliance is referenced by requests");
      }
      return sendJson(res, 200, { message: "Appliance deactivated" });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to deactivate appliance", String(e));
    }
  }

  // =========================
  // Asset Models
  // =========================
  if (req.method === "GET" && path === "/asset-models") {
    try {
      const includeInactive = first(query, "includeInactive") === "true";
      const models = await listAssetModels(orgId, includeInactive);
      const data = models.map((m) => ({ ...m, name: addAssetModelName(m) }));
      return sendJson(res, 200, { data });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch asset models", String(e));
    }
  }

  if (req.method === "POST" && path === "/asset-models") {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateAssetModelSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid asset model data", parsed.error.flatten());
      }
      const created = await createAssetModel(orgId, parsed.data);
      return sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to create asset model", String(e));
    }
  }

  const assetModelId = matchAssetModelById(path);
  if (req.method === "PATCH" && assetModelId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = UpdateAssetModelSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid asset model data", parsed.error.flatten());
      }
      const updated = await updateAssetModel(orgId, assetModelId, parsed.data);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Asset model not found");
      return sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to update asset model", String(e));
    }
  }

  if (req.method === "DELETE" && assetModelId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const result = await deactivateAssetModel(orgId, assetModelId);
      if (!result.success && result.reason === "NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Asset model not found");
      }
      if (!result.success && result.reason === "HAS_APPLIANCES") {
        return sendError(res, 409, "CONFLICT", "Asset model is referenced by appliances");
      }
      if (!result.success && result.reason === "FORBIDDEN") {
        return sendError(res, 403, "FORBIDDEN", "Asset model is not org-private");
      }
      return sendJson(res, 200, { message: "Asset model deactivated" });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to deactivate asset model", String(e));
    }
  }

  // =========================
  // Occupancies
  // =========================
  const unitTenantsId = matchUnitTenants(path);
  if (req.method === "GET" && unitTenantsId) {
    try {
      const tenants = await listUnitTenants(orgId, unitTenantsId);
      if (!tenants) return sendError(res, 404, "NOT_FOUND", "Unit not found");
      return sendJson(res, 200, { data: tenants });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch unit tenants", String(e));
    }
  }

  if (req.method === "POST" && unitTenantsId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = LinkTenantSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid tenant link data", parsed.error.flatten());
      }

      let tenantId = parsed.data.tenantId;
      if (!tenantId) {
        const normalizedPhone = normalizePhoneToE164(parsed.data.phone);
        if (!normalizedPhone) {
          return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");
        }
        const tenant = await createOrGetTenant({
          orgId,
          phone: normalizedPhone,
          name: parsed.data.name,
        });
        tenantId = tenant.id;
      }

      const result = await linkTenantToUnit(orgId, tenantId, unitTenantsId);
      if (!result.success && result.reason === "UNIT_NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Unit not found");
      }
      if (!result.success && result.reason === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Tenant not found");
      }
      return sendJson(res, 200, {
        message: "Tenant linked",
        data: { tenantId, unitId: unitTenantsId },
      });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to link tenant", String(e));
    }
  }

  const unitTenantMatch = matchUnitTenant(path);
  if (req.method === "DELETE" && unitTenantMatch) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const result = await unlinkTenantFromUnit(orgId, unitTenantMatch.tenantId, unitTenantMatch.unitId);
      if (!result.success && result.reason === "UNIT_NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Unit not found");
      }
      return sendJson(res, 200, { message: "Tenant unlinked" });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to unlink tenant", String(e));
    }
  }

  // =========================
  // POST /tenant-session
  // Body: { phone: string }
  // =========================
  if (req.method === "POST" && path === "/tenant-session") {
    try {
      const raw = await readJson(req);
      const parsed = TenantSessionSchema.safeParse(raw);

      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid tenant session input", parsed.error.flatten());
      }

      const session = await getTenantSession(prisma, DEFAULT_ORG_ID, parsed.data.phone);
      if (!session) {
        return sendError(res, 404, "NOT_FOUND", "Tenant not found");
      }

      return sendJson(res, 200, { data: session });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to create tenant session", String(e));
    }
  }

  // =========================
  // POST /triage
  // Body: { unitId: string, message: string }
  // =========================
  if (req.method === "POST" && path === "/triage") {
    try {
      const raw = await readJson(req);
      const parsed = TriageSchema.safeParse(raw);

      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid triage input", parsed.error.flatten());
      }

      const result = await triageIssue(prisma, parsed.data);
      return sendJson(res, 200, { data: result });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to triage request", String(e));
    }
  }

  // =========================
  // POST /auth/register
  // Body: { email, password, name, role? }
  // =========================
  if (req.method === "POST" && path === "/auth/register") {
    try {
      const raw = await readJson(req);
      const parsed = RegisterSchema.safeParse(raw);

      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid registration input", parsed.error.flatten());
      }

      const { email, password, name, role } = parsed.data;
      if (role === "OWNER") {
        const allowOwner =
          process.env.NODE_ENV !== "production" &&
          process.env.ALLOW_OWNER_REGISTRATION === "true";
        if (!allowOwner) {
          return sendError(res, 403, "FORBIDDEN", "OWNER registration disabled");
        }
      }
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          orgId: DEFAULT_ORG_ID,
          email,
          name,
          passwordHash,
          role: role || "TENANT",
        },
      });

      const token = encodeToken({
        userId: user.id,
        orgId: user.orgId,
        email: user.email || email,
        role: user.role,
      });

      return sendJson(res, 201, {
        data: {
          token,
          user: {
            id: user.id,
            orgId: user.orgId,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        return sendError(res, 409, "CONFLICT", "Email already registered");
      }
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to register", String(e));
    }
  }

  // =========================
  // POST /auth/login
  // Body: { email, password }
  // =========================
  if (req.method === "POST" && path === "/auth/login") {
    try {
      const raw = await readJson(req);
      const parsed = LoginSchema.safeParse(raw);

      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid login input", parsed.error.flatten());
      }

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({
        where: {
          user_org_email_unique: {
            orgId: DEFAULT_ORG_ID,
            email,
          },
        },
      });

      if (!user || !user.passwordHash) {
        return sendError(res, 401, "UNAUTHORIZED", "Invalid credentials");
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return sendError(res, 401, "UNAUTHORIZED", "Invalid credentials");
      }

      const token = encodeToken({
        userId: user.id,
        orgId: user.orgId,
        email: user.email || email,
        role: user.role,
      });

      return sendJson(res, 200, {
        data: {
          token,
          user: {
            id: user.id,
            orgId: user.orgId,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to login", String(e));
    }
  }


  // =========================
  // GET /org-config
  // =========================
  if (req.method === "GET" && path === "/org-config") {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const config = await getOrgConfig(prisma, orgId);
      return sendJson(res, 200, { data: config });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to load org config", String(e));
    }
  }

  // =========================
  // PUT /org-config
  // =========================
  if (req.method === "PUT" && path === "/org-config") {
    try {
      const orgId = getOrgIdForRequest(req);
      const raw = await readJson(req);
      const parsed = UpdateOrgConfigSchema.safeParse(raw);

      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid org config", parsed.error.flatten());
      }

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
      return sendJson(res, 200, { data: updated });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to update org config", String(e));
    }
  }

  // =========================
  // GET/PUT /buildings/:id/config
  // =========================
  const buildingConfigId = matchBuildingConfig(path);
  if (buildingConfigId) {
    if (req.method === "GET") {
      if (!requireOrgViewer(req, res)) return;
      try {
        const orgId = getOrgIdForRequest(req);
        const building = await prisma.building.findFirst({ where: { id: buildingConfigId, orgId } });
        if (!building) return sendError(res, 404, "NOT_FOUND", "Building not found");
        const config = await getBuildingConfig(prisma, orgId, buildingConfigId);
        return sendJson(res, 200, { data: config });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to load building config", String(e));
      }
    }

    if (req.method === "PUT") {
      try {
        const orgId = getOrgIdForRequest(req);
        const current = await getOrgConfig(prisma, orgId);
        if (!requireGovernanceAccess(req, res, current.mode)) return;

        const raw = await readJson(req);
        const parsed = BuildingConfigSchema.safeParse(raw);
        if (!parsed.success) {
          return sendError(res, 400, "VALIDATION_ERROR", "Invalid building config", parsed.error.flatten());
        }

        const updated = await upsertBuildingConfig(prisma, orgId, buildingConfigId, parsed.data);
        if (!updated) return sendError(res, 404, "NOT_FOUND", "Building not found");
        return sendJson(res, 200, { data: updated });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to update building config", String(e));
      }
    }
  }

  // GET/PUT /units/:id/config
  // =========================
  const unitConfigId = matchUnitConfig(path);
  if (unitConfigId) {
    if (req.method === "GET") {
      if (!requireOrgViewer(req, res)) return;
      try {
        const orgId = getOrgIdForRequest(req);
        const unit = await prisma.unit.findFirst({ where: { id: unitConfigId, orgId } });
        if (!unit) return sendError(res, 404, "NOT_FOUND", "Unit not found");
        
        const effectiveConfig = await computeEffectiveUnitConfig(prisma, orgId, unitConfigId);
        return sendJson(res, 200, { data: effectiveConfig });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to load unit config", String(e));
      }
    }

    if (req.method === "PUT") {
      try {
        const orgId = getOrgIdForRequest(req);
        const current = await getOrgConfig(prisma, orgId);
        if (!requireGovernanceAccess(req, res, current.mode)) return;

        const raw = await readJson(req);
        const parsed = UnitConfigSchema.safeParse(raw);
        if (!parsed.success) {
          return sendError(res, 400, "VALIDATION_ERROR", "Invalid unit config", parsed.error.flatten());
        }

        const updated = await upsertUnitConfig(prisma, orgId, unitConfigId, parsed.data);
        if (!updated) return sendError(res, 404, "NOT_FOUND", "Unit not found");
        
        const effectiveConfig = await computeEffectiveUnitConfig(prisma, orgId, unitConfigId);
        return sendJson(res, 200, { data: effectiveConfig });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to update unit config", String(e));
      }
    }

    if (req.method === "DELETE") {
      try {
        const orgId = getOrgIdForRequest(req);
        const current = await getOrgConfig(prisma, orgId);
        if (!requireGovernanceAccess(req, res, current.mode)) return;

        const deleted = await deleteUnitConfig(prisma, orgId, unitConfigId);
        if (!deleted) return sendError(res, 404, "NOT_FOUND", "Unit config not found");
        
        const effectiveConfig = await computeEffectiveUnitConfig(prisma, orgId, unitConfigId);
        return sendJson(res, 200, { data: effectiveConfig });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to delete unit config", String(e));
      }
    }
  }

  // =========================
  // GET /approval-rules
  // List approval rules for an org (optionally filtered by buildingId)
  // =========================
  if (req.method === "GET" && path === "/approval-rules") {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const buildingId = first(query, "buildingId") || undefined;
      const rules = await listApprovalRules(prisma, orgId, buildingId);
      return sendJson(res, 200, { data: rules });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to load approval rules", String(e));
    }
  }

  // =========================
  // POST /approval-rules
  // Create a new approval rule
  // =========================
  if (req.method === "POST" && path === "/approval-rules") {
    try {
      const orgId = getOrgIdForRequest(req);
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const raw = await readJson(req);
      const parsed = CreateApprovalRuleSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid approval rule", parsed.error.flatten());
      }

      const rule = await createApprovalRule(prisma, orgId, parsed.data as any);
      return sendJson(res, 201, { data: rule });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "BUILDING_NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Building not found");
      }
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 500, "DB_ERROR", "Failed to create approval rule", String(e));
    }
  }

  // =========================
  // GET/PATCH/DELETE /approval-rules/:id
  // =========================
  const approvalRuleId = matchApprovalRuleById(path);
  if (approvalRuleId) {
    if (req.method === "GET") {
      if (!requireOrgViewer(req, res)) return;
      try {
        const orgId = getOrgIdForRequest(req);
        const rule = await getApprovalRule(prisma, orgId, approvalRuleId);
        if (!rule) return sendError(res, 404, "NOT_FOUND", "Approval rule not found");
        return sendJson(res, 200, { data: rule });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to load approval rule", String(e));
      }
    }

    if (req.method === "PATCH") {
      try {
        const orgId = getOrgIdForRequest(req);
        const current = await getOrgConfig(prisma, orgId);
        if (!requireGovernanceAccess(req, res, current.mode)) return;

        const raw = await readJson(req);
        const parsed = UpdateApprovalRuleSchema.safeParse(raw);
        if (!parsed.success) {
          return sendError(res, 400, "VALIDATION_ERROR", "Invalid approval rule update", parsed.error.flatten());
        }

        const rule = await updateApprovalRule(prisma, orgId, approvalRuleId, parsed.data as any);
        if (!rule) return sendError(res, 404, "NOT_FOUND", "Approval rule not found");
        return sendJson(res, 200, { data: rule });
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
        if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
        return sendError(res, 500, "DB_ERROR", "Failed to update approval rule", String(e));
      }
    }

    if (req.method === "DELETE") {
      try {
        const orgId = getOrgIdForRequest(req);
        const current = await getOrgConfig(prisma, orgId);
        if (!requireGovernanceAccess(req, res, current.mode)) return;

        const deleted = await deleteApprovalRule(prisma, orgId, approvalRuleId);
        if (!deleted) return sendError(res, 404, "NOT_FOUND", "Approval rule not found");
        return sendJson(res, 200, { message: "Approval rule deleted" });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to delete approval rule", String(e));
      }
    }
  }

  // =========================
  // GET /billing-entities
  // =========================
  if (req.method === "GET" && path === "/billing-entities") {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const type = first(query, "type") || undefined;
      const entities = await listBillingEntities(orgId, { type: type as any });
      return sendJson(res, 200, { data: entities });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to load billing entities", String(e));
    }
  }

  // =========================
  // POST /billing-entities
  // =========================
  if (req.method === "POST" && path === "/billing-entities") {
    try {
      const orgId = getOrgIdForRequest(req);
      const current = await getOrgConfig(prisma, orgId);
      if (!requireGovernanceAccess(req, res, current.mode)) return;

      const raw = await readJson(req);
      const parsed = CreateBillingEntitySchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid billing entity", parsed.error.flatten());
      }

      const created = await createBillingEntity({
        orgId,
        ...parsed.data,
      });

      return sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "BILLING_ENTITY_TYPE_EXISTS") {
        return sendError(res, 409, "CONFLICT", "Billing entity already exists for this type");
      }
      if (msg === "CONTRACTOR_NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      }
      if (msg === "CONTRACTOR_TYPE_REQUIRED") {
        return sendError(res, 400, "VALIDATION_ERROR", "Contractor link requires type CONTRACTOR");
      }
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 500, "DB_ERROR", "Failed to create billing entity", String(e));
    }
  }

  // =========================
  // GET/PATCH/DELETE /billing-entities/:id
  // =========================
  const billingEntityId = matchBillingEntityById(path);
  if (billingEntityId) {
    if (req.method === "GET") {
      if (!requireOrgViewer(req, res)) return;
      try {
        const orgId = getOrgIdForRequest(req);
        const entity = await getBillingEntity(orgId, billingEntityId);
        if (!entity) return sendError(res, 404, "NOT_FOUND", "Billing entity not found");
        return sendJson(res, 200, { data: entity });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to load billing entity", String(e));
      }
    }

    if (req.method === "PATCH") {
      try {
        const orgId = getOrgIdForRequest(req);
        const current = await getOrgConfig(prisma, orgId);
        if (!requireGovernanceAccess(req, res, current.mode)) return;

        const raw = await readJson(req);
        const parsed = UpdateBillingEntitySchema.safeParse(raw);
        if (!parsed.success) {
          return sendError(res, 400, "VALIDATION_ERROR", "Invalid billing entity update", parsed.error.flatten());
        }

        if (Object.keys(parsed.data).length === 0) {
          return sendError(res, 400, "VALIDATION_ERROR", "No billing entity fields provided");
        }

        const updated = await updateBillingEntity(orgId, billingEntityId, parsed.data);
        if (!updated) return sendError(res, 404, "NOT_FOUND", "Billing entity not found");
        return sendJson(res, 200, { data: updated });
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg === "CONTRACTOR_NOT_FOUND") {
          return sendError(res, 404, "NOT_FOUND", "Contractor not found");
        }
        if (msg === "CONTRACTOR_TYPE_REQUIRED") {
          return sendError(res, 400, "VALIDATION_ERROR", "Contractor link requires type CONTRACTOR");
        }
        if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
        if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
        return sendError(res, 500, "DB_ERROR", "Failed to update billing entity", String(e));
      }
    }

    if (req.method === "DELETE") {
      try {
        const orgId = getOrgIdForRequest(req);
        const current = await getOrgConfig(prisma, orgId);
        if (!requireGovernanceAccess(req, res, current.mode)) return;

        const deleted = await deleteBillingEntity(orgId, billingEntityId);
        if (!deleted) return sendError(res, 404, "NOT_FOUND", "Billing entity not found");
        return sendJson(res, 200, { message: "Billing entity deleted" });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to delete billing entity", String(e));
      }
    }
  }

  // =========================
  // GET /jobs
  // =========================
  if (req.method === "GET" && path === "/jobs") {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const contractorId = first(query, "contractorId") || undefined;
      const status = first(query, "status") || undefined;
      const jobs = await listJobs(orgId, { contractorId, status: status as any });
      return sendJson(res, 200, { data: jobs });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to load jobs", String(e));
    }
  }

  // =========================
  // GET /jobs/:id
  // =========================
  const jobId = matchJobById(path);
  if (jobId && req.method === "GET") {
    if (!requireOrgViewer(req, res)) return;
    try {
      const job = await getJob(jobId);
      if (!job) return sendError(res, 404, "NOT_FOUND", "Job not found");
      return sendJson(res, 200, { data: job });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to load job", String(e));
    }
  }

  // =========================
  // PATCH /jobs/:id
  // Body: { status?: "IN_PROGRESS" | "COMPLETED", actualCost?: number, ... }
  // =========================
  const jobActionMatch = path.match(/^\/jobs\/([a-f0-9-]{36})$/i);
  if (jobActionMatch && req.method !== undefined) {
    const jobId = jobActionMatch[1];

    if (req.method === "GET") {
      if (!requireOrgViewer(req, res)) return;
      try {
        const job = await getJob(jobId);
        if (!job) return sendError(res, 404, "NOT_FOUND", "Job not found");
        return sendJson(res, 200, { data: job });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to load job", String(e));
      }
    }

    if (req.method === "PATCH") {
      if (!requireOrgViewer(req, res)) return;
      try {
        const raw = await readJson(req);
        const orgId = getOrgIdForRequest(req);
        const job = await getJob(jobId);
        if (!job || job.orgId !== orgId) {
          return sendError(res, 404, "NOT_FOUND", "Job not found");
        }

        const updated = await updateJob(jobId, {
          status: raw.status,
          actualCost: raw.actualCost,
          startedAt: raw.startedAt ? new Date(raw.startedAt) : undefined,
          completedAt: raw.completedAt ? new Date(raw.completedAt) : undefined,
        });

        // Auto-create invoice when job is marked COMPLETED
        if (raw.status === "COMPLETED" && job.status !== "COMPLETED" && updated.actualCost) {
          try {
            await createInvoice({
              orgId,
              jobId,
              amount: updated.actualCost,
            });
          } catch (err) {
            console.warn("Failed to auto-create invoice for job", jobId, err);
          }
        }

        return sendJson(res, 200, { data: updated });
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
        if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
        return sendError(res, 500, "DB_ERROR", "Failed to update job", String(e));
      }
    }
  }

  // =========================
  // GET /invoices
  // =========================
  if (req.method === "GET" && path === "/invoices") {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const jobId = first(query, "jobId") || undefined;
      const status = first(query, "status") || undefined;
      const invoices = await listInvoices(orgId, { jobId, status: status as any });
      return sendJson(res, 200, { data: invoices });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to load invoices", String(e));
    }
  }

  // =========================
  // POST /invoices
  // =========================
  if (req.method === "POST" && path === "/invoices") {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const raw = await readJson(req);
      const parsed = CreateInvoiceSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid invoice", parsed.error.flatten());
      }

      const created = await createInvoice({
        orgId,
        jobId: parsed.data.jobId,
        amount: parsed.data.amount,
        description: parsed.data.description,
        issuerBillingEntityId: parsed.data.issuerBillingEntityId,
        recipientName: parsed.data.recipientName,
        recipientAddressLine1: parsed.data.recipientAddressLine1,
        recipientAddressLine2: parsed.data.recipientAddressLine2,
        recipientPostalCode: parsed.data.recipientPostalCode,
        recipientCity: parsed.data.recipientCity,
        recipientCountry: parsed.data.recipientCountry,
        issueDate: parsed.data.issueDate ? new Date(parsed.data.issueDate) : undefined,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        vatRate: parsed.data.vatRate,
        lineItems: parsed.data.lineItems,
      });

      return sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 500, "DB_ERROR", "Failed to create invoice", String(e));
    }
  }

  // =========================
  // GET/POST /invoices/:id
  // POST /invoices/:id/approve
  // POST /invoices/:id/mark-paid
  // POST /invoices/:id/dispute
  // POST /invoices/:id/issue
  // =========================
  const invoiceActionMatch = path.match(/^\/invoices\/([a-f0-9-]{36})(\/(?:approve|mark-paid|dispute|issue))?$/i);
  if (invoiceActionMatch && req.method !== undefined) {
    const invoiceId = invoiceActionMatch[1];
    const action = invoiceActionMatch[2]?.slice(1); // Remove leading "/"
    if (req.method === "POST" && action === "issue") {
      if (!requireOwnerAccess(req, res)) return;
      try {
        const orgId = getOrgIdForRequest(req);
        const invoice = await getInvoice(invoiceId);
        if (!invoice || invoice.orgId !== orgId) {
          return sendError(res, 404, "NOT_FOUND", "Invoice not found");
        }

        // Issue the invoice (assign number, lock, set dates)
        const issued = await issueInvoice(invoiceId);
        const actor = getAuthUser(req);
        // Fetch job to get tenantId for notification
        let tenantId: string | undefined = undefined;
        try {
          const { PrismaClient } = require("@prisma/client");
          const prisma = new PrismaClient();
          const job = await prisma.job.findUnique({
            where: { id: issued.jobId },
            include: { request: true },
          });
          tenantId = job?.request?.tenantId;
        } catch (err) {
          console.warn("Failed to fetch tenantId for invoice notification", err);
        }
        // Trigger notification to tenant (if found)
        try {
          if (tenantId) {
            const { notifyInvoiceStatusChanged } = require("./services/notifications");
            await notifyInvoiceStatusChanged(
              invoiceId,
              orgId,
              tenantId,
              "INVOICE_CREATED"
            );
          }
        } catch (notifyErr) {
          // Log but do not fail issuing if notification fails
          console.warn("Failed to send invoice issued notification", notifyErr);
        }

        return sendJson(res, 200, { data: issued });
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg === "INVOICE_ALREADY_ISSUED") {
          return sendError(res, 400, "ALREADY_ISSUED", "Invoice already issued");
        }
        if (msg === "ISSUER_BILLING_ENTITY_REQUIRED") {
          return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            "Invoice issuer billing entity is required before issuing"
          );
        }
        return sendError(res, 500, "DB_ERROR", "Failed to issue invoice", String(e));
      }
    }

    if (req.method === "GET") {
      if (!requireOrgViewer(req, res)) return;
      try {
        const orgId = getOrgIdForRequest(req);
        const invoice = await getInvoice(invoiceId);
        if (!invoice || invoice.orgId !== orgId) {
          return sendError(res, 404, "NOT_FOUND", "Invoice not found");
        }
        return sendJson(res, 200, { data: invoice });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to load invoice", String(e));
      }
    }

    if (req.method === "POST" && action === "approve") {
      if (!requireOwnerAccess(req, res)) return;
      try {
        const orgId = getOrgIdForRequest(req);
        const invoice = await getInvoice(invoiceId);
        if (!invoice || invoice.orgId !== orgId) {
          return sendError(res, 404, "NOT_FOUND", "Invoice not found");
        }

        const approved = await approveInvoice(invoiceId);
        const actor = getAuthUser(req);
        await logEvent({
          orgId,
          type: "INVOICE_APPROVED",
          actorUserId: actor?.userId,
          payload: { invoiceId, amount: approved.amount },
        });

        return sendJson(res, 200, { data: approved });
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg === "ISSUER_BILLING_ENTITY_REQUIRED") {
          return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            "Invoice issuer billing entity is required before approval"
          );
        }
        return sendError(res, 500, "DB_ERROR", "Failed to approve invoice", String(e));
      }
    }

    if (req.method === "POST" && action === "mark-paid") {
      if (!requireOwnerAccess(req, res)) return;
      try {
        const orgId = getOrgIdForRequest(req);
        const invoice = await getInvoice(invoiceId);
        if (!invoice || invoice.orgId !== orgId) {
          return sendError(res, 404, "NOT_FOUND", "Invoice not found");
        }

        const paid = await markInvoicePaid(invoiceId);
        const actor = getAuthUser(req);
        await logEvent({
          orgId,
          type: "INVOICE_PAID",
          actorUserId: actor?.userId,
          payload: { invoiceId, amount: paid.amount },
        });

        return sendJson(res, 200, { data: paid });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to mark invoice paid", String(e));
      }
    }

    if (req.method === "POST" && action === "dispute") {
      if (!requireOwnerAccess(req, res)) return;
      try {
        const orgId = getOrgIdForRequest(req);
        const invoice = await getInvoice(invoiceId);
        if (!invoice || invoice.orgId !== orgId) {
          return sendError(res, 404, "NOT_FOUND", "Invoice not found");
        }

        const raw = await readJson(req);
        const disputed = await disputeInvoice(invoiceId);
        const actor = getAuthUser(req);
        await logEvent({
          orgId,
          type: "INVOICE_DISPUTED",
          actorUserId: actor?.userId,
          payload: { invoiceId, reason: raw?.reason || null },
        });

        return sendJson(res, 200, { data: disputed });
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
        if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
        return sendError(res, 500, "DB_ERROR", "Failed to dispute invoice", String(e));
      }
    }
  }

  // =========================
  // GET /owner/invoices
  // Owner-specific dashboard: list pending/approved invoices
  // =========================
  if (req.method === "GET" && path === "/owner/invoices") {
    if (!requireOwnerAccess(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const status = first(query, "status") || undefined;
      const invoices = await listInvoices(orgId, { status: status as any });
      return sendJson(res, 200, { data: invoices });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to load invoices", String(e));
    }
  }

  // =========================
  // QR-BILL ENDPOINTS (SLICE 8.4)
  // =========================

  // GET /invoices/:id/qr-bill
  // Get QR-bill data for an invoice (JSON)
  const qrBillMatch = path.match(/^\/invoices\/([a-f0-9-]{36})\/qr-bill$/i);
  if (req.method === "GET" && qrBillMatch) {
    if (!requireOrgViewer(req, res)) return;
    try {
      const invoiceId = qrBillMatch[1];
      const orgId = getOrgIdForRequest(req);
      const qrBill = await generateInvoiceQRBill(invoiceId, orgId);
      return sendJson(res, 200, { data: qrBill });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("not found")) return sendError(res, 404, "NOT_FOUND", "Invoice not found");
      return sendError(res, 500, "DB_ERROR", "Failed to generate QR-bill", String(e));
    }
  }

  // GET /invoices/:id/qr-code.png
  // Get QR code as PNG image
  const qrCodeMatch = path.match(/^\/invoices\/([a-f0-9-]{36})\/qr-code\.png$/i);
  if (req.method === "GET" && qrCodeMatch) {
    if (!requireOrgViewer(req, res)) return;
    try {
      const invoiceId = qrCodeMatch[1];
      const orgId = getOrgIdForRequest(req);
      const pngBuffer = await getInvoiceQRCodePNG(invoiceId, orgId);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': pngBuffer.length });
      res.end(pngBuffer);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (res.headersSent) {
        res.end();
      } else {
        if (msg.includes("not found")) return sendError(res, 404, "NOT_FOUND", "Invoice not found");
        return sendError(res, 500, "DB_ERROR", "Failed to generate QR code", String(e));
      }
    }
  }

  // PDF ENDPOINTS (SLICE 8.5)
  // =========================

  // GET /invoices/:id/pdf
  // Generate invoice PDF with embedded QR-bill
  const invoicePDFMatch = path.match(/^\/invoices\/([a-f0-9-]{36})\/pdf$/i);
  if (req.method === "GET" && invoicePDFMatch) {
    if (!requireOrgViewer(req, res)) return;
    try {
      const invoiceId = invoicePDFMatch[1];
      const orgId = getOrgIdForRequest(req);
      const { query } = parseQuery(req.url!.split('?')[1] || '');
      const includeQRBillParam = first(query, 'includeQRBill') || 'true';
      const includeQRBill = includeQRBillParam !== 'false';
      console.log(`[PDF] Generating PDF for invoice ${invoiceId}, includeQRBill=${includeQRBill}`);
      const pdfBuffer = await generateInvoicePDF(invoiceId, orgId, { includeQRBill });
      
      console.log(`[PDF] Generated ${pdfBuffer.length} bytes, sending...`);
      const fileName = `invoice-${new Date().toISOString().split('T')[0]}.pdf`;
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      });
      res.end(pdfBuffer);
      console.log(`[PDF] PDF sent successfully`);
      return;
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.error(`[PDF] Error: ${msg}`, e);
      if (res.headersSent) {
        console.log(`[PDF] Headers already sent, closing connection`);
        res.end();
        return;
      }
      if (msg.includes("not found")) return sendError(res, 404, "NOT_FOUND", "Invoice not found");
      if (msg.includes("Unauthorized")) return sendError(res, 403, "FORBIDDEN", "You do not have access to this invoice");
      return sendError(res, 500, "PDF_ERROR", "Failed to generate PDF", String(e));
    }
  }

  // =========================
  // GET /owner/pending-approvals
  // Optional: ?buildingId=<uuid>
  // =========================
  if (req.method === "GET" && path === "/owner/pending-approvals") {

    if (!requireOwnerAccess(req, res)) return;
    try {
      const buildingId = first(query, "buildingId") || undefined;
      const data = await listOwnerPendingApprovals(prisma, { buildingId });
      return sendJson(res, 200, { data });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to load pending approvals", String(e));
    }
  }

  // =========================
  // POST /requests/:id/owner-approve
  // POST /requests/:id/owner-reject
  // =========================
  const ownerApprovalMatch = path.match(/^\/requests\/([a-f0-9\-]{36})\/(owner-approve|owner-reject)$/i);
  if (ownerApprovalMatch && req.method === "POST") {
    if (!requireOwnerAccess(req, res)) return;
    const requestId = ownerApprovalMatch[1];
    const action = ownerApprovalMatch[2];
    try {
      const raw = await readJson(req);
      const current = await prisma.request.findUnique({ where: { id: requestId } });
      if (!current) return sendError(res, 404, "NOT_FOUND", "Request not found");

      if (action === "owner-approve") {
        // If already approved, check if job needs to be created
        if (current.status === RequestStatus.APPROVED) {
          const orgId = getOrgIdForRequest(req);
          const orgConfig = await getOrgConfig(prisma, orgId);
          
          // Try to create job if in owner-direct mode and no job exists yet
          if (orgConfig.mode === OrgMode.OWNER_DIRECT) {
            const existingJob = await prisma.job.findUnique({ where: { requestId } });
            
            if (!existingJob) {
              console.log('[Owner Approve] Request already APPROVED but no job exists, attempting to create job');
              let contractorId = current.assignedContractorId;
              
              // If no contractor assigned, try to find one by category
              if (!contractorId && current.category) {
                const matchingContractor = await findMatchingContractor(prisma, orgId, current.category);
                console.log('[Owner Approve] Found matching contractor:', matchingContractor);
                if (matchingContractor) {
                  contractorId = matchingContractor.id;
                  await assignContractor(prisma, requestId, contractorId);
                  console.log('[Owner Approve] Assigned contractor:', contractorId);
                }
              }
              
              // Create job if we have a contractor
              if (contractorId) {
                console.log('[Owner Approve] Creating job for already-approved request');
                await createJob({ orgId, requestId, contractorId });
                console.log('[Owner Approve] Job created successfully');
              } else {
                console.log('[Owner Approve] No contractor available, cannot create job');
              }
            }
          }
          
          const found = await getMaintenanceRequestById(prisma, requestId);
          return sendJson(res, 200, { data: found });
        }
        
        // Allow owner to approve PENDING_OWNER_APPROVAL, AUTO_APPROVED, or PENDING_REVIEW
        if (
          current.status !== RequestStatus.PENDING_OWNER_APPROVAL &&
          current.status !== RequestStatus.AUTO_APPROVED &&
          current.status !== RequestStatus.PENDING_REVIEW
        ) {
          return sendError(
            res,
            409,
            "INVALID_TRANSITION",
            `Cannot owner-approve request from ${current.status}`
          );
        }

        const updated = await updateMaintenanceRequestStatus(prisma, requestId, RequestStatus.APPROVED);
        if (!updated) return sendError(res, 404, "NOT_FOUND", "Request not found");

        // Auto-create Job if in owner-direct mode
        const orgId = getOrgIdForRequest(req);
        const orgConfig = await getOrgConfig(prisma, orgId);
        console.log('[Owner Approve] orgConfig.mode:', orgConfig.mode);
        if (orgConfig.mode === OrgMode.OWNER_DIRECT) {
          try {
            let contractorId = current.assignedContractorId;
            console.log('[Owner Approve] Initial contractorId:', contractorId, 'category:', current.category);
            
            // If no contractor assigned, try to find one by category
            if (!contractorId && current.category) {
              const matchingContractor = await findMatchingContractor(prisma, orgId, current.category);
              console.log('[Owner Approve] Found matching contractor:', matchingContractor);
              if (matchingContractor) {
                contractorId = matchingContractor.id;
                // Assign the contractor to the request
                await assignContractor(prisma, requestId, contractorId);
                console.log('[Owner Approve] Assigned contractor:', contractorId);
              }
            }
            
            // Create job if we have a contractor
            if (contractorId) {
              console.log('[Owner Approve] Creating job for contractor:', contractorId);
              await createJob({
                orgId,
                requestId,
                contractorId,
              });
              console.log('[Owner Approve] Job created successfully');
            } else {
              console.log('[Owner Approve] No contractor available, skipping job creation');
            }
          } catch (err: any) {
            if (String(err?.message || err).includes("already exists")) {
              // Job was already created, ignore
            } else {
              console.warn("Failed to auto-create job for request", requestId, err);
            }
          }
        }

        const actor = getAuthUser(req);
        await logEvent({
          orgId,
          type: "OWNER_APPROVED",
          actorUserId: actor?.userId,
          requestId,
          payload: { comment: raw?.comment || null },
        });

        return sendJson(res, 200, { data: updated });
      }

      if (current.status !== RequestStatus.PENDING_OWNER_APPROVAL) {
        return sendError(
          res,
          409,
          "INVALID_TRANSITION",
          `Cannot owner-reject request from ${current.status}`
        );
      }

      const updated = await updateMaintenanceRequestStatus(prisma, requestId, RequestStatus.PENDING_REVIEW);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Request not found");

      const actor = getAuthUser(req);
      await logEvent({
        orgId: getOrgIdForRequest(req),
        type: "OWNER_REJECTED",
        actorUserId: actor?.userId,
        requestId,
        payload: { reason: raw?.reason || null },
      });

      return sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (res.headersSent) {
        res.end();
      } else {
        if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
        if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
        return sendError(res, 500, "DB_ERROR", "Database error", String(e));
      }
    }
  }

  // =========================
  // PATCH /requests/:id/status
  // Body: { status: "APPROVED" | "IN_PROGRESS" | "COMPLETED" }
  // ?contractorId=<uuid> query param for contractor updates
  // =========================
  if (req.method === "PATCH") {
    const id = matchRequestStatus(path);
    if (id) {
      try {
        const raw = await readJson(req);
        const parsed = UpdateRequestStatusSchema.safeParse(raw);

        if (!parsed.success) {
          return sendError(res, 400, "VALIDATION_ERROR", "Invalid status update", parsed.error.flatten());
        }

        const input = parsed.data;
        const contractorId = first(query, "contractorId") || null;

        // Contractor status update path
        if (contractorId) {
          if (!requireRole(req, res, "CONTRACTOR")) return;
          const result = await updateContractorRequestStatus(
            prisma,
            id,
            contractorId,
            RequestStatus[input.status as keyof typeof RequestStatus]
          );
          if (!result.success) {
            return sendError(res, 400, "UPDATE_FAILED", result.message);
          }
          return sendJson(res, 200, { data: result.data, message: result.message });
        }

        // Manager approval update path
        if (!maybeRequireManager(req, res)) return;
        const current = await prisma.request.findUnique({ where: { id } });
        if (!current) return sendError(res, 404, "NOT_FOUND", "Request not found");

        // Idempotent approve
        if (current.status === RequestStatus.APPROVED) {
          const found = await getMaintenanceRequestById(prisma, id);
          return sendJson(res, 200, { data: found });
        }

        if (current.status !== RequestStatus.PENDING_REVIEW) {
          return sendError(
            res,
            409,
            "INVALID_TRANSITION",
            `Cannot change status from ${current.status} to ${input.status}`
          );
        }

        const updated = await updateMaintenanceRequestStatus(prisma, id, RequestStatus.APPROVED);
        if (!updated) return sendError(res, 404, "NOT_FOUND", "Request not found");
        return sendJson(res, 200, { data: updated });
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
        if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
        return sendError(res, 500, "DB_ERROR", "Database error", String(e));
      }
    }
  }

  // =========================
  // DEV ONLY: DELETE /__dev/requests
  // =========================
  if (req.method === "DELETE" && path === "/__dev/requests") {
    if (process.env.NODE_ENV === "production") {
      return sendError(res, 403, "FORBIDDEN", "Not allowed in production");
    }
    try {
      const result = await prisma.request.deleteMany({});
      return sendJson(res, 200, { data: { deleted: result.count } });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Database error", String(e));
    }
  }

  // =========================
  // POST /requests/:id/assign
  // Body: { contractorId: "uuid" }
  // =========================
  const assignMatch = path.match(/^\/requests\/([a-f0-9\-]{36})\/assign$/i);
  if (req.method === "POST" && assignMatch) {
    if (!maybeRequireManager(req, res)) return;
    const requestId = assignMatch[1];
    try {
      const raw = await readJson(req);
      const parsed = AssignContractorSchema.safeParse(raw);

      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid assignment data", parsed.error.flatten());
      }

      const result = await assignContractor(prisma, requestId, parsed.data.contractorId);
      if (!result.success) {
        return sendError(res, 400, "ASSIGNMENT_FAILED", result.message);
      }

      const updated = await getMaintenanceRequestById(prisma, requestId);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Request not found");
      return sendJson(res, 200, { data: updated, message: result.message });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 500, "DB_ERROR", "Database error", String(e));
    }
  }

  // =========================
  // DELETE /requests/:id/assign
  // =========================
  if (req.method === "DELETE" && assignMatch) {
    if (!maybeRequireManager(req, res)) return;
    const requestId = assignMatch[1];
    try {
      const result = await unassignContractor(prisma, requestId);
      const updated = await getMaintenanceRequestById(prisma, requestId);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Request not found");
      return sendJson(res, 200, { data: updated, message: result.message });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Database error", String(e));
    }
  }

  // =========================
  // GET /requests/:id/suggest-contractor
  // =========================
  const suggestMatch = path.match(/^\/requests\/([a-f0-9\-]{36})\/suggest-contractor$/i);
  if (req.method === "GET" && suggestMatch) {
    const requestId = suggestMatch[1];
    try {
      console.log(`[suggest-contractor] requestId=${requestId}`);
      const reqRow = await prisma.request.findUnique({ where: { id: requestId } });
      if (!reqRow) return sendError(res, 404, "NOT_FOUND", "Request not found");

      const category = reqRow.category;
      console.log(`[suggest-contractor] category=${category}`);
      if (!category) return sendJson(res, 200, { data: null });

      const contractor = await findMatchingContractor(prisma, DEFAULT_ORG_ID, category);
      console.log(`[suggest-contractor] found=${contractor ? contractor.id : "none"}`);
      return sendJson(res, 200, { data: contractor });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to suggest contractor", String(e));
    }
  }

  // =========================
  // GET /contractors/match?category=...
  // =========================
  if (req.method === "GET" && path === "/contractors/match") {
    try {
      const category = first(query, "category");
      console.log(`[contractors/match] category=${category}`);
      if (!category) return sendError(res, 400, "VALIDATION_ERROR", "Category required");
      const contractor = await findMatchingContractor(prisma, DEFAULT_ORG_ID, category);
      console.log(`[contractors/match] found=${contractor ? contractor.id : "none"}`);
      return sendJson(res, 200, { data: contractor });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to find matching contractor", String(e));
    }
  }

  // =========================
  // GET /requests/:id
  // =========================
  if (req.method === "GET") {
    const id = matchRequestById(path);
    if (id) {
      try {
        const found = await getMaintenanceRequestById(prisma, id);
        if (!found) return sendError(res, 404, "NOT_FOUND", "Request not found");
        return sendJson(res, 200, { data: found });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Database error", String(e));
      }
    }
  }

  // =========================
  // GET /requests/contractor/:contractorId
  // =========================
  const contractorRequestMatch = path.match(/^\/requests\/contractor\/([a-f0-9\-]{36})$/i);
  if (req.method === "GET" && contractorRequestMatch) {
    const contractorId = contractorRequestMatch[1];
    try {
      const requests = await getContractorAssignedRequests(prisma, contractorId);
      return sendJson(res, 200, { data: requests });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch requests", String(e));
    }
  }

  // Fallback: GET /requests/contractor?contractorId=<uuid>
  if (req.method === "GET" && path === "/requests/contractor") {
    const cid = first(query, "contractorId");
    if (!cid) return sendError(res, 400, "VALIDATION_ERROR", "Missing contractorId");
    try {
      const requests = await getContractorAssignedRequests(prisma, cid);
      return sendJson(res, 200, { data: requests });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch requests", String(e));
    }
  }

  // =========================
  // GET /requests?limit=&offset=&order=
  // =========================
  if (req.method === "GET" && path === "/requests") {
    try {
      const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
      const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
      const order = getEnumParam(query, "order", ["asc", "desc"] as const, "asc");

      const data = await listMaintenanceRequests(prisma, { limit, offset, order });
      return sendJson(res, 200, { data });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Database error", String(e));
    }
  }

  // =========================
  // GET /work-requests?limit=&offset=&order=
  // =========================
  if (req.method === "GET" && path === "/work-requests") {
    try {
      const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
      const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
      const order = getEnumParam(query, "order", ["asc", "desc"] as const, "asc");

      const data = await listMaintenanceRequests(prisma, { limit, offset, order });
      const workRequests = data.map(workRequestFromRequest);
      return sendJson(res, 200, { data: workRequests });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Database error", String(e));
    }
  }

  // =========================
  // GET /work-requests/:id
  // =========================
  const workRequestId = matchWorkRequestById(path);
  if (req.method === "GET" && workRequestId) {
    try {
      const request = await getMaintenanceRequestById(prisma, workRequestId);
      if (!request) return sendError(res, 404, "NOT_FOUND", "Work request not found");
      return sendJson(res, 200, { data: workRequestFromRequest(request) });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch work request", String(e));
    }
  }

  // =========================
  // POST /requests
  // Enrichment: contactPhone -> tenantId/unitId (if tenant exists)
  // =========================
  if (req.method === "POST" && path === "/requests") {
    try {
      const raw = await readJson(req);

      // Normalize legacy { text } to { description }
      if (raw?.text && !raw?.description) raw.description = raw.text;

      const parsed = CreateRequestSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid request body", parsed.error.flatten());
      }

      const input: CreateRequestInput = parsed.data;

      const description = input.description;
      const category = input.category ? input.category : null;

      const hasEstimatedCost = typeof input.estimatedCost === "number";
      const estimatedCost = hasEstimatedCost ? input.estimatedCost : null;

      // --- contactPhone (always store if provided) ---
      let contactPhone: string | null = null;
      if ((input as any).contactPhone) {
        const normalized = normalizePhoneToE164((input as any).contactPhone);
        if (!normalized) {
          return sendError(res, 400, "VALIDATION_ERROR", "Invalid contactPhone format");
        }
        contactPhone = normalized;
      }

      // --- optional context from client ---
      let tenantId = (input as any).tenantId ?? null;
      let unitId = (input as any).unitId ?? null;
      const applianceId = (input as any).applianceId ?? null;

      const orgId = getOrgIdForRequest(req);

      // --- enrichment: if phone exists + tenantId not provided, lookup tenant by phone ---
      if (contactPhone && !tenantId) {
        const tenant = await getTenantByPhone({
          phone: contactPhone,
          orgId,
        });

        if (tenant) {
          tenantId = tenant.id;
          if (!unitId && tenant.unitId) unitId = tenant.unitId;
        }
      }

      let status: RequestStatus = RequestStatus.PENDING_REVIEW;
      let matchedRuleName: string | undefined;

      if (hasEstimatedCost || category) {
        // Get unit type, unit number, and building ID if unitId is available
        let unitType: string | null = null;
        let unitNumber: string | null = null;
        let buildingId: string | null = null;
        if (unitId) {
          const unit = await prisma.unit.findUnique({
            where: { id: unitId },
            select: { type: true, unitNumber: true, buildingId: true },
          });
          unitType = unit?.type ?? null;
          unitNumber = unit?.unitNumber ?? null;
          buildingId = unit?.buildingId ?? null;
        }

        const effective = await computeEffectiveConfig(prisma, orgId, buildingId ?? undefined);

        // Use rules-based approval with three-tier cascade (Unit > Building > Org)
        const approvalResult = await decideRequestStatusWithRules(
          prisma,
          orgId,
          {
            category,
            estimatedCost,
            unitType,
            unitNumber,
            buildingId,
            unitId,
          },
          effective.effectiveAutoApproveLimit,
          unitId
        );
        status = approvalResult.status;
        matchedRuleName = approvalResult.matchedRuleName;

        if (
          effective.org.mode === "OWNER_DIRECT" &&
          estimatedCost !== null &&
          estimatedCost !== undefined &&
          estimatedCost > effective.effectiveRequireOwnerApprovalAbove
        ) {
          status = RequestStatus.PENDING_OWNER_APPROVAL;
        }
      }

      // Create request directly so new fields are persisted
      const created = await prisma.request.create({
        data: {
          description,
          category,
          estimatedCost,
          status,
          contactPhone,
          tenantId,
          unitId,
          applianceId,
        },
      });

      // Auto-assign contractor if category matches
      if (category) {
        const matchingContractor = await findMatchingContractor(prisma, orgId, category);
        if (matchingContractor) {
          await assignContractor(prisma, created.id, matchingContractor.id);
        }
      }

      const updated = await getMaintenanceRequestById(prisma, created.id);
      return sendJson(res, 201, { data: updated ?? created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 500, "UNKNOWN_ERROR", "Unexpected error", String(e));
    }
  }

  // =========================
  // POST /work-requests
  // Alias of /requests
  // =========================
  if (req.method === "POST" && path === "/work-requests") {
    try {
      const raw = await readJson(req);

      if (raw?.text && !raw?.description) raw.description = raw.text;

      const parsed = CreateRequestSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid request body", parsed.error.flatten());
      }

      const input: CreateRequestInput = parsed.data;

      const description = input.description;
      const category = input.category ? input.category : null;

      const hasEstimatedCost = typeof input.estimatedCost === "number";
      const estimatedCost = hasEstimatedCost ? input.estimatedCost : null;

      let contactPhone: string | null = null;
      if ((input as any).contactPhone) {
        const normalized = normalizePhoneToE164((input as any).contactPhone);
        if (!normalized) {
          return sendError(res, 400, "VALIDATION_ERROR", "Invalid contactPhone format");
        }
        contactPhone = normalized;
      }

      let tenantId = (input as any).tenantId ?? null;
      let unitId = (input as any).unitId ?? null;
      const applianceId = (input as any).applianceId ?? null;

      const orgId = getOrgIdForRequest(req);

      if (contactPhone && !tenantId) {
        const tenant = await getTenantByPhone({
          phone: contactPhone,
          orgId,
        });

        if (tenant) {
          tenantId = tenant.id;
          if (!unitId && tenant.unitId) unitId = tenant.unitId;
        }
      }

      let status: RequestStatus = RequestStatus.PENDING_REVIEW;
      let matchedRuleName: string | undefined;

      if (hasEstimatedCost || category) {
        // Get unit type, unit number, and building ID if unitId is available
        let unitType: string | null = null;
        let unitNumber: string | null = null;
        let buildingId: string | null = null;
        if (unitId) {
          const unit = await prisma.unit.findUnique({
            where: { id: unitId },
            select: { type: true, unitNumber: true, buildingId: true },
          });
          unitType = unit?.type ?? null;
          unitNumber = unit?.unitNumber ?? null;
          buildingId = unit?.buildingId ?? null;
        }

        const effective = await computeEffectiveConfig(prisma, orgId, buildingId ?? undefined);

        const approvalResult = await decideRequestStatusWithRules(
          prisma,
          orgId,
          {
            category,
            estimatedCost,
            unitType,
            unitNumber,
            buildingId,
            unitId,
          },
          effective.effectiveAutoApproveLimit,
          unitId
        );
        status = approvalResult.status;
        matchedRuleName = approvalResult.matchedRuleName;

        if (
          effective.org.mode === "OWNER_DIRECT" &&
          estimatedCost !== null &&
          estimatedCost !== undefined &&
          estimatedCost > effective.effectiveRequireOwnerApprovalAbove
        ) {
          status = RequestStatus.PENDING_OWNER_APPROVAL;
        }
      }

      const created = await prisma.request.create({
        data: {
          description,
          category,
          estimatedCost,
          status,
          contactPhone,
          tenantId,
          unitId,
          applianceId,
        },
      });

      if (category) {
        const matchingContractor = await findMatchingContractor(prisma, orgId, category);
        if (matchingContractor) {
          await assignContractor(prisma, created.id, matchingContractor.id);
        }
      }

      const updated = await getMaintenanceRequestById(prisma, created.id);
      const response = updated ? workRequestFromRequest(updated) : workRequestFromRequest({
        ...created,
        assignedContractor: null,
        tenant: null,
        unit: null,
        appliance: null,
        createdAt: created.createdAt.toISOString(),
      } as any);
      return sendJson(res, 201, { data: response });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 500, "UNKNOWN_ERROR", "Unexpected error", String(e));
    }
  }

  // =========================
  // GET /tenants?phone=...
  // Returns { data: tenant | null } when phone is provided
  // Returns { data: TenantDTO[] } when phone is omitted
  // =========================
  if (req.method === "GET" && path === "/tenants") {
    try {
      const phoneRaw = first(query, "phone");
      if (phoneRaw) {
        const normalizedPhone = normalizePhoneToE164(phoneRaw);
        if (!normalizedPhone) return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");

        const tenant = await getTenantByPhone({
          phone: normalizedPhone,
          orgId,
        });

        return sendJson(res, 200, { data: tenant ?? null });
      }

      const includeInactive = first(query, "includeInactive") === "true";
      const tenants = await listTenants(orgId, includeInactive);
      return sendJson(res, 200, { data: tenants });
    } catch (e: any) {
      return sendError(res, 500, "DB_ERROR", "Failed to lookup tenant", String(e));
    }
  }

  // =========================
  // POST /tenants (create or get)
  // Body: { phone: string, name?, email?, unitId? }
  // =========================
  if (req.method === "POST" && path === "/tenants") {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);

      const normalizedPhone = normalizePhoneToE164(raw?.phone);
      if (!normalizedPhone) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");
      }

      const tenant = await createOrGetTenant({
        ...raw,
        phone: normalizedPhone,
        orgId,
      });

      return sendJson(res, 200, { data: tenant });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to create tenant", String(e));
    }
  }

  // =========================
  // PATCH /tenants/:id  (link tenant to unit, edit details)
  // =========================
  if (req.method === "GET") {
    const tenantId = matchTenantById(path);
    if (tenantId) {
      try {
        const tenant = await getTenantById(tenantId);
        if (!tenant) return sendError(res, 404, "NOT_FOUND", "Tenant not found");
        return sendJson(res, 200, { data: tenant });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to fetch tenant", String(e));
      }
    }
  }

  // =========================
  // PATCH /tenants/:id  (link tenant to unit, edit details)
  // =========================
  if (req.method === "PATCH") {
    const tenantId = matchTenantById(path);
    if (tenantId) {
      if (!maybeRequireManager(req, res)) return;
      try {
        const raw = await readJson(req);
        if (raw?.phone) {
          const normalizedPhone = normalizePhoneToE164(raw.phone);
          if (!normalizedPhone) {
            return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");
          }
          raw.phone = normalizedPhone;
        }
        const updated = await updateTenant(orgId, tenantId, raw);
        if (!updated) return sendError(res, 404, "NOT_FOUND", "Tenant not found");
        return sendJson(res, 200, { data: updated });
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
        return sendError(res, 500, "DB_ERROR", "Failed to update tenant", String(e));
      }
    }
  }

  // =========================
  // DELETE /tenants/:id (soft delete)
  // =========================
  if (req.method === "DELETE") {
    const tenantId = matchTenantById(path);
    if (tenantId) {
      if (!maybeRequireManager(req, res)) return;
      try {
        const result = await deactivateTenant(orgId, tenantId);
        if (!result.success && result.reason === "NOT_FOUND") {
          return sendError(res, 404, "NOT_FOUND", "Tenant not found");
        }
        if (!result.success && result.reason === "HAS_OCCUPANCIES") {
          return sendError(res, 409, "CONFLICT", "Tenant has active occupancies");
        }
        return sendJson(res, 200, { message: "Tenant deactivated" });
      } catch (e) {
        return sendError(res, 500, "DB_ERROR", "Failed to deactivate tenant", String(e));
      }
    }
  }

  // =========================
  // GET /contractors
  // =========================
  if (req.method === "GET" && path === "/contractors") {
    try {
      const contractors = await listContractors(prisma, DEFAULT_ORG_ID);
      return sendJson(res, 200, { data: contractors });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch contractors", String(e));
    }
  }

  // =========================
  // POST /contractors
  // =========================
  if (req.method === "POST" && path === "/contractors") {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      // Directly create contractor (stub validation)
      const contractor = await createContractor(prisma, DEFAULT_ORG_ID, raw);
      return sendJson(res, 201, { data: contractor });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to create contractor", String(e));
    }
  }

  // =========================
  // GET /contractors/:id
  // =========================
  const contractorId = matchContractorById(path);
  if (req.method === "GET" && contractorId) {
    try {
      const contractor = await getContractorById(prisma, contractorId);
      if (!contractor) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      return sendJson(res, 200, { data: contractor });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch contractor", String(e));
    }
  }

  // =========================
  // PATCH /contractors/:id
  // =========================
  if (req.method === "PATCH" && contractorId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const raw = await readJson(req);
      // Directly update contractor (stub validation)
      const contractor = await updateContractor(prisma, contractorId, raw);
      if (!contractor) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      return sendJson(res, 200, { data: contractor });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to update contractor", String(e));
    }
  }

  // =========================
  // DELETE /contractors/:id
  // =========================
  if (req.method === "DELETE" && contractorId) {
    if (!maybeRequireManager(req, res)) return;
    try {
      const success = await deactivateContractor(prisma, contractorId);
      if (!success) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      return sendJson(res, 200, { message: "Contractor deactivated" });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to deactivate contractor", String(e));
    }
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  // GET /notifications?unreadOnly=true&limit=20&offset=0
  if (req.method === "GET" && path === "/notifications") {
    if (!maybeRequireManager(req, res)) return;

    try {
      const user = getAuthUser(req);
      if (!user || !user.userId) return sendError(res, 401, "UNAUTHORIZED", "Not authenticated");

      const unreadOnly = first(query, "unreadOnly") === "true";
      const limit = getIntParam(query, "limit", { defaultValue: 20, min: 1, max: 100 });
      const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0 });

      const schema = ListNotificationsSchema.parse({
        orgId,
        userId: user.userId,
        unreadOnly,
        limit,
        offset,
      });

      const { notifications, total } = await getUserNotifications(schema);
      return sendJson(res, 200, { data: { notifications, total } });
    } catch (e) {
      return safeSendError(res, 500, "DB_ERROR", "Failed to fetch notifications", String(e));
    }
  }

  // GET /notifications/unread-count
  if (req.method === "GET" && path === "/notifications/unread-count") {
    if (!maybeRequireManager(req, res)) return;

    try {
      const user = getAuthUser(req);
      if (!user || !user.userId) return sendError(res, 401, "UNAUTHORIZED", "Not authenticated");

      const count = await getUnreadNotificationCount(orgId, user.userId);
      return sendJson(res, 200, { data: { count } });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch unread count", String(e));
    }
  }

  // POST /notifications/:id/read
  const notificationReadMatch = path.match(/^\/notifications\/([a-f0-9-]{36})\/read$/i);
  if (req.method === "POST" && notificationReadMatch) {
    if (!maybeRequireManager(req, res)) return;

    try {
      const user = getAuthUser(req);
      if (!user || !user.userId) return sendError(res, 401, "UNAUTHORIZED", "Not authenticated");

      const notificationId = notificationReadMatch[1];
      const notification = await markNotificationAsRead(notificationId, orgId);
      return sendJson(res, 200, { data: notification });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to mark notification as read", String(e));
    }
  }

  // POST /notifications/mark-all-read
  if (req.method === "POST" && path === "/notifications/mark-all-read") {
    if (!maybeRequireManager(req, res)) return;

    try {
      const user = getAuthUser(req);
      if (!user || !user.userId) return sendError(res, 401, "UNAUTHORIZED", "Not authenticated");

      const count = await markAllNotificationsAsRead(orgId, user.userId);
      return sendJson(res, 200, { data: { count } });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to mark all notifications as read", String(e));
    }
  }

  // DELETE /notifications/:id
  const notificationDeleteMatch = path.match(/^\/notifications\/([a-f0-9-]{36})$/i);
  if (req.method === "DELETE" && notificationDeleteMatch) {
    if (!maybeRequireManager(req, res)) return;

    try {
      const user = getAuthUser(req);
      if (!user || !user.userId) return sendError(res, 401, "UNAUTHORIZED", "Not authenticated");

      const notificationId = notificationDeleteMatch[1];
      await deleteNotification(notificationId, orgId);
      return sendJson(res, 200, { message: "Notification deleted" });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to delete notification", String(e));
    }
  }

  return sendError(res, 404, "NOT_FOUND", "Not found");
});

async function start() {
  try {
    await ensureDefaultOrgConfig(prisma);
    server.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });
  } catch (e) {
    console.error("Failed to start API:", e);
    process.exit(1);
  }
}

start();

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
