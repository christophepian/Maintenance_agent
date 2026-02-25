import * as bcrypt from "bcryptjs";
import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { getOrgIdForRequest } from "../authz";
import { encodeToken } from "../services/auth";
import { DEFAULT_ORG_ID } from "../services/orgConfig";
import { getTenantSession } from "../services/tenantSession";
import { listTenantLeases, getTenantLease, tenantAcceptLease } from "../services/tenantPortal";
import { triageIssue } from "../services/triage";
import { TenantSessionSchema } from "../validation/tenantSession";
import { TriageSchema } from "../validation/triage";
import { LoginSchema, RegisterSchema } from "../validation/auth";

export function registerAuthRoutes(router: Router) {
  // POST /tenant-session
  router.post("/tenant-session", async ({ req, res, prisma }) => {
    try {
      const raw = await readJson(req);
      const parsed = TenantSessionSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid tenant session input", parsed.error.flatten());
      const session = await getTenantSession(prisma, DEFAULT_ORG_ID, parsed.data.phone);
      if (!session) return sendError(res, 404, "NOT_FOUND", "Tenant not found");
      sendJson(res, 200, { data: session });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to create tenant session", String(e));
    }
  });

  // GET /tenant-portal/leases
  router.get("/tenant-portal/leases", async ({ req, res, query }) => {
    try {
      const tenantId = first(query, "tenantId");
      if (!tenantId) return sendError(res, 400, "VALIDATION_ERROR", "tenantId is required");
      const unitId = first(query, "unitId") || undefined;
      const orgId = getOrgIdForRequest(req);
      const leases = await listTenantLeases(tenantId, orgId, unitId);
      sendJson(res, 200, { data: leases });
    } catch (e: any) {
      if (e.message?.includes("does not occupy")) return sendError(res, 403, "FORBIDDEN", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to list tenant leases", String(e));
    }
  });

  // GET /tenant-portal/leases/:id
  router.get("/tenant-portal/leases/:id", async ({ req, res, query, params }) => {
    try {
      const tenantId = first(query, "tenantId");
      if (!tenantId) return sendError(res, 400, "VALIDATION_ERROR", "tenantId is required");
      const orgId = getOrgIdForRequest(req);
      const lease = await getTenantLease(params.id, tenantId, orgId);
      if (!lease) return sendError(res, 404, "NOT_FOUND", "Lease not found");
      sendJson(res, 200, { data: lease });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to get tenant lease", String(e));
    }
  });

  // POST /tenant-portal/leases/:id/accept
  router.post("/tenant-portal/leases/:id/accept", async ({ req, res, params }) => {
    try {
      const raw = await readJson(req);
      const tenantId = raw?.tenantId;
      if (!tenantId) return sendError(res, 400, "VALIDATION_ERROR", "tenantId is required in body");
      const orgId = getOrgIdForRequest(req);
      const result = await tenantAcceptLease(params.id, tenantId, orgId);
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      if (e.message?.includes("does not occupy")) return sendError(res, 403, "FORBIDDEN", e.message);
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only READY_TO_SIGN")) return sendError(res, 409, "CONFLICT", e.message);
      if (e.message?.includes("No active signature")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to accept lease", String(e));
    }
  });

  // POST /triage
  router.post("/triage", async ({ req, res, prisma }) => {
    try {
      const raw = await readJson(req);
      const parsed = TriageSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid triage input", parsed.error.flatten());
      const result = await triageIssue(prisma, parsed.data);
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to triage request", String(e));
    }
  });

  // POST /auth/register
  router.post("/auth/register", async ({ req, res, prisma }) => {
    try {
      const raw = await readJson(req);
      const parsed = RegisterSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid registration input", parsed.error.flatten());

      const { email, password, name, role } = parsed.data;
      if (role === "OWNER") {
        const allowOwner = process.env.NODE_ENV !== "production" && process.env.ALLOW_OWNER_REGISTRATION === "true";
        if (!allowOwner) return sendError(res, 403, "FORBIDDEN", "OWNER registration disabled");
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { orgId: DEFAULT_ORG_ID, email, name, passwordHash, role: role || "TENANT" },
      });

      const token = encodeToken({
        userId: user.id,
        orgId: user.orgId,
        email: user.email || email,
        role: user.role,
      });

      sendJson(res, 201, {
        data: {
          token,
          user: { id: user.id, orgId: user.orgId, email: user.email, name: user.name, role: user.role },
        },
      });
    } catch (e: any) {
      if (e?.code === "P2002") return sendError(res, 409, "CONFLICT", "Email already registered");
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to register", String(e));
    }
  });

  // POST /auth/login
  router.post("/auth/login", async ({ req, res, prisma }) => {
    try {
      const raw = await readJson(req);
      const parsed = LoginSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid login input", parsed.error.flatten());

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({
        where: { user_org_email_unique: { orgId: DEFAULT_ORG_ID, email } },
      });

      if (!user || !user.passwordHash) return sendError(res, 401, "UNAUTHORIZED", "Invalid credentials");

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return sendError(res, 401, "UNAUTHORIZED", "Invalid credentials");

      const token = encodeToken({
        userId: user.id,
        orgId: user.orgId,
        email: user.email || email,
        role: user.role,
      });

      sendJson(res, 200, {
        data: {
          token,
          user: { id: user.id, orgId: user.orgId, email: user.email, name: user.name, role: user.role },
        },
      });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to login", String(e));
    }
  });

  // POST /__dev/create-contractor-user (dev only)
  router.post("/__dev/create-contractor-user", async ({ res, req, prisma }) => {
    if (process.env.NODE_ENV === "production") return sendError(res, 403, "FORBIDDEN", "Not allowed in production");
    try {
      const raw = await readJson(req);
      const { email, password, name, phone } = raw;
      if (!email || !password || !name || !phone) return sendError(res, 400, "VALIDATION_ERROR", "Missing fields");
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { orgId: DEFAULT_ORG_ID, email, name, passwordHash, role: "CONTRACTOR" },
      });
      const contractor = await prisma.contractor.create({
        data: {
          orgId: String(DEFAULT_ORG_ID),
          name: String(name),
          phone: String(phone),
          email: String(email),
          serviceCategories: JSON.stringify(["general"]),
        },
      });
      sendJson(res, 201, { userId: user.id, contractorId: contractor.id });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to create contractor user", String(e));
    }
  });
}
