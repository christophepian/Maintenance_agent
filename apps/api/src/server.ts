import * as http from "http";
import { PrismaClient, RequestStatus } from "@prisma/client";
import {
  createMaintenanceRequest,
  getMaintenanceRequestById,
  listMaintenanceRequests,
  updateMaintenanceRequestStatus,
} from "./services/maintenanceRequests";
import {
  createContractor,
  getContractorById,
  listContractors,
  updateContractor,
  deactivateContractor,
  type ContractorDTO,
} from "./services/contractors";
import { decideRequestStatus } from "./services/autoApproval";
import {
  findMatchingContractor,
  assignContractor,
  unassignContractor,
} from "./services/requestAssignment";
import {
  getContractorAssignedRequests,
  updateContractorRequestStatus,
} from "./services/contractorRequests";
import {
  createOrGetTenant,
  getTenantByPhone,
  getTenantById,
  updateTenant,
} from "./services/tenants";
import {
  createBuilding,
  getBuilding,
  listBuildings,
  updateBuilding,
  deleteBuilding,
  createUnit,
  getUnit,
  listUnits,
  updateUnit,
  deleteUnit,
  createAppliance,
  getAppliance,
  listAppliances,
  updateAppliance,
  deleteAppliance,
  createAssetModel,
  getAssetModel,
  listAssetModels,
  updateAssetModel,
  deleteAssetModel,
} from "./services/inventory";
import { getOrgConfig, updateOrgConfig } from "./services/orgConfig";
import { readJson } from "./http/body";
import { sendError, sendJson } from "./http/json";
import { CreateRequestSchema, CreateRequestInput } from "./validation/requests";
import { UpdateOrgConfigSchema, UpdateOrgConfigInput } from "./validation/orgConfig";
import { UpdateRequestStatusSchema, UpdateRequestStatusInput } from "./validation/requestStatus";
import { CreateContractorSchema, UpdateContractorSchema } from "./validation/contractors";
import { AssignContractorSchema } from "./validation/requestAssignment";

import { normalizePhoneToE164 } from "./utils/phoneNormalization";

const prisma = new PrismaClient();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

// Temporary until auth exists
const DEFAULT_ORG_ID = "default-org";
const DEFAULT_ORG_NAME = "Default Org";
const DEFAULT_AUTO_APPROVE_LIMIT_CHF = 200;

async function ensureDefaultOrgConfig() {
  await prisma.org.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: { id: DEFAULT_ORG_ID, name: DEFAULT_ORG_NAME },
  });

  await prisma.orgConfig.upsert({
    where: { orgId: DEFAULT_ORG_ID },
    update: {},
    create: {
      orgId: DEFAULT_ORG_ID,
      autoApproveLimit: DEFAULT_AUTO_APPROVE_LIMIT_CHF,
    },
  });
}

// --- tiny URL parser (no dependencies) ---
type QueryParams = Record<string, string[]>;
function parseUrl(url?: string): { path: string; query: QueryParams } {
  const raw = url || "/";
  const [path, qs = ""] = raw.split("?", 2);
  const query: QueryParams = {};
  if (!qs) return { path, query };

  for (const part of qs.split("&")) {
    if (!part) continue;
    const [kRaw, vRaw = ""] = part.split("=", 2);
    const k = decodeURIComponent(kRaw || "").trim();
    if (!k) continue;
    const v = decodeURIComponent(vRaw || "");
    if (!query[k]) query[k] = [];
    query[k].push(v);
  }
  return { path, query };
}

function first(query: QueryParams, key: string): string | undefined {
  const v = query[key];
  if (!v || v.length === 0) return undefined;
  return v[0];
}

function getIntParam(
  query: QueryParams,
  key: string,
  opts: { defaultValue: number; min?: number; max?: number }
): number {
  const raw = first(query, key);
  if (raw == null || raw === "") return opts.defaultValue;

  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return opts.defaultValue;

  if (opts.min != null && n < opts.min) return opts.min;
  if (opts.max != null && n > opts.max) return opts.max;

  return n;
}

function getEnumParam<T extends readonly string[]>(
  query: QueryParams,
  key: string,
  allowed: T,
  defaultValue: T[number]
): T[number] {
  const raw = first(query, key);
  if (!raw) return defaultValue;
  return (allowed as readonly string[]).includes(raw) ? (raw as T[number]) : defaultValue;
}

// --- routing helpers ---
function matchRequestById(path: string) {
  const m = path.match(/^\/requests\/([a-f0-9-]{36})$/i);
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

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const { path, query } = parseUrl(req.url);

  // =========================
  // GET /org-config
  // =========================
  if (req.method === "GET" && path === "/org-config") {
    try {
      const config = await getOrgConfig(prisma);
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
      const raw = await readJson(req);
      const parsed = UpdateOrgConfigSchema.safeParse(raw);

      if (!parsed.success) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Invalid org config",
          parsed.error.flatten()
        );
      }

      const input: UpdateOrgConfigInput = parsed.data;
      const updated = await updateOrgConfig(prisma, input.autoApproveLimit);
      return sendJson(res, 200, { data: updated });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to update org config", String(e));
    }
  }

  // =========================
  // PATCH /requests/:id/status
    // Body: { status: "APPROVED" | "IN_PROGRESS" | "COMPLETED" }
    // ?contractorId=<uuid> query param for contractor updates
    // Manager: PENDING_REVIEW -> APPROVED
    // Contractor: any approved status -> IN_PROGRESS -> COMPLETED
  // =========================
  if (req.method === "PATCH") {
    const id = matchRequestStatus(path);
    if (id) {
      try {
        const raw = await readJson(req);
        const parsed = UpdateRequestStatusSchema.safeParse(raw);

        if (!parsed.success) {
          return sendError(
            res,
            400,
            "VALIDATION_ERROR",
            "Invalid status update",
            parsed.error.flatten()
          );
        }

        const input: UpdateRequestStatusInput = parsed.data;
          const contractorId = query.contractorId ? String(query.contractorId) : null;

          // Contractor status update path
          if (contractorId) {
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

          // Manager approval update path (original logic)
        const current = await prisma.request.findUnique({ where: { id } });
        if (!current) return sendError(res, 404, "NOT_FOUND", "Request not found");

        // enforce simple transition rule
        // Idempotent approve: if already approved, return success
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
        if (msg === "Body too large")
          return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
        return sendError(res, 500, "DB_ERROR", "Database error", String(e));
      }
    }
  }

  // =========================
  // DEV ONLY: DELETE /__dev/requests
  // =========================
  if (req.method === "DELETE" && path === "/__dev/requests") {
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
  const assignMatch = path.match(/^\/requests\/([a-f0-9\-]{36})\/assign$/);
  if (req.method === "POST" && assignMatch) {
    const requestId = assignMatch[1];
    try {
      const raw = await readJson(req);
      const parsed = AssignContractorSchema.safeParse(raw);

      if (!parsed.success) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Invalid assignment data",
          parsed.error.flatten()
        );
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
      if (msg === "Body too large")
        return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 500, "DB_ERROR", "Database error", String(e));
    }
  }

  // =========================
  // DELETE /requests/:id/assign
  // Unassign contractor from request
  // =========================
  if (req.method === "DELETE" && assignMatch) {
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

  // GET /requests/:id
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
    // List all requests assigned to a contractor
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

  // GET /requests?limit=&offset=&order=
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

  // POST /requests
  if (req.method === "POST" && path === "/requests") {
    try {
      const raw = await readJson(req);

      // Normalize legacy { text } to { description }
      if (raw?.text && !raw?.description) raw.description = raw.text;

      const parsed = CreateRequestSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          parsed.error.flatten()
        );
      }

      const input: CreateRequestInput = parsed.data;

      const description = input.description;
      const category = input.category ? input.category : null;

      const hasEstimatedCost = typeof input.estimatedCost === "number";
      const estimatedCost = hasEstimatedCost ? input.estimatedCost : null;

      let status: RequestStatus = RequestStatus.PENDING_REVIEW;

      if (hasEstimatedCost) {
        const config = await getOrgConfig(prisma);
        status = decideRequestStatus(estimatedCost!, config.autoApproveLimit);
      }

      const created = await createMaintenanceRequest(prisma, {
        description,
        category,
        estimatedCost,
        status,
      });

      // Auto-assign contractor if category matches
      if (category) {
        const matchingContractor = await findMatchingContractor(
          prisma,
          DEFAULT_ORG_ID,
          category
        );
        if (matchingContractor) {
          await assignContractor(prisma, created.id, matchingContractor.id);
          // Update response to include assigned contractor
          const updated = await getMaintenanceRequestById(prisma, created.id);
          return sendJson(res, 201, { data: updated });
        }
      }

      return sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large")
        return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 500, "UNKNOWN_ERROR", "Unexpected error", String(e));
    }
  }

  // =========================
  // GET /tenants (lookup by phone)
  // =========================
  if (req.method === "GET" && path === "/tenants") {
    try {
      const phone = first(query, "phone");
      if (!phone) {
        return sendError(res, 400, "VALIDATION_ERROR", "Phone number required");
      }

      const tenant = await getTenantByPhone({
        phone,
        orgId: DEFAULT_ORG_ID,
      });

      return sendJson(res, 200, { data: tenant });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch tenant", String(e));
    }
  }

  // =========================
  // POST /tenants (create or get)
  // =========================
  if (req.method === "POST" && path === "/tenants") {
    try {
      const raw = await readJson(req);
      const tenant = await createOrGetTenant({
        ...raw,
        orgId: DEFAULT_ORG_ID,
      });
      return sendJson(res, 201, { data: tenant });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("Invalid phone")) {
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }
      return sendError(res, 500, "DB_ERROR", "Failed to create tenant", String(e));
    }
  }

  // =========================

  // GET /tenants (lookup by phone)
  // =========================
  if (req.method === "GET" && path === "/tenants") {
    try {
      const phone = first(query, "phone");
      if (!phone) {
        return sendError(res, 400, "VALIDATION_ERROR", "Phone parameter required");
      }

      const tenant = await getTenantByPhone({
        phone,
        orgId: DEFAULT_ORG_ID,
      });

      if (!tenant) {
        // Phone not found, still return 200 with null for frontend to trigger create flow
        return sendJson(res, 200, { data: null });
      }

      return sendJson(res, 200, { data: tenant });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("Invalid phone")) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");
      }
      return sendError(res, 500, "DB_ERROR", "Failed to lookup tenant", String(e));
    }
  }

  // =========================
  // POST /tenants (create or get)
  // =========================
  if (req.method === "POST" && path === "/tenants") {
    try {
      const raw = await readJson(req);
      const normalizedPhone = normalizePhoneToE164(raw.phone);
      if (!normalizedPhone) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");
      }

      const tenant = await createOrGetTenant({
        ...raw,
        phone: normalizedPhone,
        orgId: DEFAULT_ORG_ID,
      });

      return sendJson(res, 200, { data: tenant });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("Invalid phone")) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");
      }
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to create tenant", String(e));
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
    try {
      const raw = await readJson(req);
      const parsed = CreateContractorSchema.safeParse(raw);

      if (!parsed.success) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Invalid contractor data",
          parsed.error.flatten()
        );
      }

      const contractor = await createContractor(prisma, DEFAULT_ORG_ID, parsed.data);
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
    try {
      const raw = await readJson(req);
      const parsed = UpdateContractorSchema.safeParse(raw);

      if (!parsed.success) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Invalid contractor data",
          parsed.error.flatten()
        );
      }

      const contractor = await updateContractor(prisma, contractorId, parsed.data);
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
    try {
      const success = await deactivateContractor(prisma, contractorId);
      if (!success) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      return sendJson(res, 200, { message: "Contractor deactivated" });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to deactivate contractor", String(e));
    }
  }

  // =========================
  // BUILDINGS ENDPOINTS
  // =========================

  // GET /buildings
  if (req.method === "GET" && path === "/buildings") {
    try {
      const buildingsList = await listBuildings(DEFAULT_ORG_ID);
      return sendJson(res, 200, { data: buildingsList });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch buildings", String(e));
    }
  }

  // POST /buildings
  if (req.method === "POST" && path === "/buildings") {
    try {
      const raw = await readJson(req);
      if (!raw.name || !raw.address) {
        return sendError(res, 400, "VALIDATION_ERROR", "Name and address required");
      }
      const building = await createBuilding(DEFAULT_ORG_ID, raw);
      return sendJson(res, 201, { data: building });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to create building", String(e));
    }
  }

  // GET /buildings/:id/units
  const buildingId = path.match(/^\/buildings\/([a-f0-9-]+)$/)?.[1];
  if (req.method === "GET" && buildingId && query["units"]) {
    try {
      const unitsList = await listUnits(buildingId);
      return sendJson(res, 200, { data: unitsList });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch units", String(e));
    }
  }

  const buildingUnitsPath = path.match(/^\/buildings\/([a-f0-9-]+)\/units$/);
  if (req.method === "GET" && buildingUnitsPath) {
    try {
      const bId = buildingUnitsPath[1];
      const unitsList = await listUnits(bId);
      return sendJson(res, 200, { data: unitsList });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch units", String(e));
    }
  }

  // POST /buildings/:id/units
  if (req.method === "POST" && buildingUnitsPath) {
    try {
      const bId = buildingUnitsPath[1];
      const raw = await readJson(req);
      if (!raw.unitNumber) {
        return sendError(res, 400, "VALIDATION_ERROR", "Unit number required");
      }
      const unit = await createUnit(bId, raw);
      return sendJson(res, 201, { data: unit });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to create unit", String(e));
    }
  }

  // =========================
  // UNITS ENDPOINTS
  // =========================

  const unitAppliancesPath = path.match(/^\/units\/([a-f0-9-]+)\/appliances$/);

  // GET /units/:id/appliances
  if (req.method === "GET" && unitAppliancesPath) {
    try {
      const uId = unitAppliancesPath[1];
      const appList = await listAppliances(uId);
      return sendJson(res, 200, { data: appList });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch appliances", String(e));
    }
  }

  // POST /units/:id/appliances
  if (req.method === "POST" && unitAppliancesPath) {
    try {
      const uId = unitAppliancesPath[1];
      const raw = await readJson(req);
      if (!raw.name) {
        return sendError(res, 400, "VALIDATION_ERROR", "Appliance name required");
      }
      const appliance = await createAppliance(uId, raw);
      return sendJson(res, 201, { data: appliance });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to create appliance", String(e));
    }
  }

  // =========================
  // ASSET MODELS ENDPOINTS
  // =========================

  // GET /asset-models
  if (req.method === "GET" && path === "/asset-models") {
    try {
      const category = first(query, "category");
      const models = await listAssetModels(DEFAULT_ORG_ID, category);
      return sendJson(res, 200, { data: models });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to fetch asset models", String(e));
    }
  }

  // POST /asset-models
  if (req.method === "POST" && path === "/asset-models") {
    try {
      const raw = await readJson(req);
      if (!raw.manufacturer || !raw.model || !raw.category) {
        return sendError(res, 400, "VALIDATION_ERROR", "Manufacturer, model, and category required");
      }
      const model = await createAssetModel(DEFAULT_ORG_ID, raw);
      return sendJson(res, 201, { data: model });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to create asset model", String(e));
    }
  }

  return sendError(res, 404, "NOT_FOUND", "Not found");
});

async function start() {
  try {
    await ensureDefaultOrgConfig();
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
