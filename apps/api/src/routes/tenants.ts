import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { maybeRequireManager, requireRole } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { normalizePhoneToE164 } from "../utils/phoneNormalization";
import { getTenantByPhone, createOrGetTenant, updateTenant, deactivateTenant, listTenants, getTenantById } from "../services/tenants";
import { listContractors, createContractor, getContractorById, updateContractor, deactivateContractor } from "../services/contractorRequests";

export function registerTenantRoutes(router: Router) {
  // GET /tenants
  router.get("/tenants", withAuthRequired(async ({ res, query, orgId }) => {
    try {
      const phoneRaw = first(query, "phone");
      if (phoneRaw) {
        const normalizedPhone = normalizePhoneToE164(phoneRaw);
        if (!normalizedPhone) return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");
        const tenant = await getTenantByPhone({ phone: normalizedPhone, orgId });
        return sendJson(res, 200, { data: tenant ?? null });
      }
      const includeInactive = first(query, "includeInactive") === "true";
      const result = await listTenants(orgId, includeInactive);
      sendJson(res, 200, { data: result.data, total: result.total });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to lookup tenant", String(e));
    }
  }));

  // POST /tenants
  router.post("/tenants", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const normalizedPhone = normalizePhoneToE164(raw?.phone);
      if (!normalizedPhone) return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");
      const tenant = await createOrGetTenant({ ...raw, phone: normalizedPhone, orgId });
      sendJson(res, 200, { data: tenant });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to create tenant", String(e));
    }
  });

  // GET /tenants/:id
  router.get("/tenants/:id", withAuthRequired(async ({ res, params, orgId }) => {
    try {
      const tenant = await getTenantById(params.id);
      if (!tenant || tenant.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Tenant not found");
      sendJson(res, 200, { data: tenant });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch tenant", String(e));
    }
  }));

  // PATCH /tenants/:id
  router.patch("/tenants/:id", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      if (raw?.phone) {
        const normalizedPhone = normalizePhoneToE164(raw.phone);
        if (!normalizedPhone) return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone format");
        raw.phone = normalizedPhone;
      }
      const updated = await updateTenant(orgId, params.id, raw);
      if (!updated) return sendError(res, 404, "NOT_FOUND", "Tenant not found");
      sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to update tenant", String(e));
    }
  });

  // DELETE /tenants/:id
  router.delete("/tenants/:id", async ({ req, res, orgId, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const result = await deactivateTenant(orgId, params.id);
      if (!result.success && result.reason === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Tenant not found");
      if (!result.success && result.reason === "HAS_OCCUPANCIES") return sendError(res, 409, "CONFLICT", "Tenant has active occupancies");
      sendJson(res, 200, { message: "Tenant deactivated" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to deactivate tenant", String(e));
    }
  });

  // GET /contractors
  router.get("/contractors", withAuthRequired(async ({ res, prisma, orgId }) => {
    try {
      const result = await listContractors(prisma, orgId);
      sendJson(res, 200, { data: result.data, total: result.total });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch contractors", String(e));
    }
  }));

  // POST /contractors
  router.post("/contractors", async ({ req, res, prisma, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const raw = await readJson(req);
      const contractor = await createContractor(prisma, orgId, raw);
      sendJson(res, 201, { data: contractor });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to create contractor", String(e));
    }
  });

  // GET /contractors/:id
  router.get("/contractors/:id", withAuthRequired(async ({ res, prisma, params, orgId }) => {
    try {
      const contractor = await getContractorById(prisma, params.id);
      if (!contractor) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      // Verify org ownership via raw lookup (DTO omits orgId)
      const raw = await prisma.contractor.findUnique({ where: { id: params.id }, select: { orgId: true } });
      if (raw?.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      sendJson(res, 200, { data: contractor });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch contractor", String(e));
    }
  }));

  // PATCH /contractors/:id
  router.patch("/contractors/:id", async ({ req, res, prisma, params, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      // Verify org ownership before updating
      const raw = await prisma.contractor.findUnique({ where: { id: params.id }, select: { orgId: true } });
      if (!raw || raw.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      const body = await readJson(req);
      const contractor = await updateContractor(prisma, params.id, body);
      if (!contractor) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      sendJson(res, 200, { data: contractor });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to update contractor", String(e));
    }
  });

  // DELETE /contractors/:id
  router.delete("/contractors/:id", async ({ req, res, prisma, params, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      // Verify org ownership before deactivating
      const raw = await prisma.contractor.findUnique({ where: { id: params.id }, select: { orgId: true } });
      if (!raw || raw.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      const success = await deactivateContractor(prisma, params.id);
      if (!success) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      sendJson(res, 200, { message: "Contractor deactivated" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to deactivate contractor", String(e));
    }
  });
}
