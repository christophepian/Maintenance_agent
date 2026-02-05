
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { encodeToken } from "./services/auth";
import { sendError, sendJson } from "./http/json";
import { parseQuery, first, getIntParam, getEnumParam } from "./http/query";
import { readJson } from "./http/body";
import { DEFAULT_ORG_ID, getOrgConfig, updateOrgConfig } from "./services/orgConfig";
import { UpdateOrgConfigSchema } from "./validation/orgConfig";
import { UpdateRequestStatusSchema } from "./validation/requestStatus";
import { RequestStatus } from "@prisma/client";
import { AssignContractorSchema } from "./validation/requestAssignment";
import { updateMaintenanceRequestStatus, assignContractor, unassignContractor, findMatchingContractor, listMaintenanceRequests, getMaintenanceRequestById } from "./services/maintenanceRequests";
import { updateContractorRequestStatus, getContractorAssignedRequests } from "./services/contractorRequests";
import { CreateRequestSchema, CreateRequestInput } from "./validation/requests";
import { decideRequestStatus } from "./services/autoApproval";
import { normalizePhoneToE164 } from "./utils/phoneNormalization";
import { getTenantByPhone, createOrGetTenant, updateTenant } from "./services/tenants";
import { listContractors, CreateContractorSchema, createContractor, getContractorById, UpdateContractorSchema, updateContractor, deactivateContractor } from "./services/contractorRequests";
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

function matchTenantById(path: string) {
  const m = path.match(/^\/tenants\/([a-f0-9-]{36})$/i);
  return m ? m[1] : null;
}

const server = http.createServer(async (req, res) => {
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }


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
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid org config", parsed.error.flatten());
      }

      const input = parsed.data;
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

      // --- enrichment: if phone exists + tenantId not provided, lookup tenant by phone ---
      if (contactPhone && !tenantId) {
        const tenant = await getTenantByPhone({
          phone: contactPhone,
          orgId: DEFAULT_ORG_ID,
        });

        if (tenant) {
          tenantId = tenant.id;
          if (!unitId && tenant.unitId) unitId = tenant.unitId;
        }
      }

      let status: RequestStatus = RequestStatus.PENDING_REVIEW;
      if (hasEstimatedCost) {
        const config = await getOrgConfig(prisma);
        status = decideRequestStatus(estimatedCost!, config.autoApproveLimit);
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
        const matchingContractor = await findMatchingContractor(prisma, DEFAULT_ORG_ID, category);
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
  // GET /tenants?phone=...
  // Returns { data: tenant | null }
  // =========================
  if (req.method === "GET" && path === "/tenants") {
    try {
      const phoneRaw = first(query, "phone");
      if (!phoneRaw) return sendError(res, 400, "VALIDATION_ERROR", "Phone parameter required");

      const normalizedPhone = normalizePhoneToE164(phoneRaw);
      if (!normalizedPhone) return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");

      const tenant = await getTenantByPhone({
        phone: normalizedPhone,
        orgId: DEFAULT_ORG_ID,
      });

      return sendJson(res, 200, { data: tenant ?? null });
    } catch (e: any) {
      return sendError(res, 500, "DB_ERROR", "Failed to lookup tenant", String(e));
    }
  }

  // =========================
  // POST /tenants (create or get)
  // Body: { phone: string, name?, email?, unitId? }
  // =========================
  if (req.method === "POST" && path === "/tenants") {
    try {
      const raw = await readJson(req);

      const normalizedPhone = normalizePhoneToE164(raw?.phone);
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
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      return sendError(res, 500, "DB_ERROR", "Failed to create tenant", String(e));
    }
  }

  // =========================
  // PATCH /tenants/:id  (link tenant to unit, edit details)
  // =========================
  if (req.method === "PATCH") {
    const tenantId = matchTenantById(path);
    if (tenantId) {
      try {
        const raw = await readJson(req);
        const updated = await updateTenant(tenantId, raw);
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
    try {
      const success = await deactivateContractor(prisma, contractorId);
      if (!success) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      return sendJson(res, 200, { message: "Contractor deactivated" });
    } catch (e) {
      return sendError(res, 500, "DB_ERROR", "Failed to deactivate contractor", String(e));
    }
  }



  return sendError(res, 404, "NOT_FOUND", "Not found");
});

async function start() {
  try {
    // await ensureDefaultOrgConfig();
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
