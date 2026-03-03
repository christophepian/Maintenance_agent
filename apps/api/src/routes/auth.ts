import * as bcrypt from "bcryptjs";
import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { encodeToken } from "../services/auth";
import { getTenantSession } from "../services/tenantSession";
import { listTenantLeases, getTenantLease, tenantAcceptLease } from "../services/tenantPortal";
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, getUnreadNotificationCount, deleteNotification } from "../services/notifications";
import { triageIssue } from "../services/triage";
import { TenantSessionSchema } from "../validation/tenantSession";
import { TriageSchema } from "../validation/triage";
import { LoginSchema, RegisterSchema } from "../validation/auth";

export function registerAuthRoutes(router: Router) {
  // POST /tenant-session
  router.post("/tenant-session", async ({ req, res, prisma, orgId }) => {
    try {
      const raw = await readJson(req);
      const parsed = TenantSessionSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid tenant session input", parsed.error.flatten());
      const session = await getTenantSession(prisma, orgId, parsed.data.phone);
      if (!session) return sendError(res, 404, "NOT_FOUND", "Tenant not found");
      sendJson(res, 200, { data: session });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to create tenant session", String(e));
    }
  });

  // GET /tenant-portal/leases
  router.get("/tenant-portal/leases", async ({ res, query, orgId }) => {
    try {
      const tenantId = first(query, "tenantId");
      if (!tenantId) return sendError(res, 400, "VALIDATION_ERROR", "tenantId is required");
      const unitId = first(query, "unitId") || undefined;
      const leases = await listTenantLeases(tenantId, orgId, unitId);
      sendJson(res, 200, { data: leases });
    } catch (e: any) {
      if (e.message?.includes("does not occupy")) return sendError(res, 403, "FORBIDDEN", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to list tenant leases", String(e));
    }
  });

  // GET /tenant-portal/leases/:id
  router.get("/tenant-portal/leases/:id", async ({ res, query, params, orgId }) => {
    try {
      const tenantId = first(query, "tenantId");
      if (!tenantId) return sendError(res, 400, "VALIDATION_ERROR", "tenantId is required");
      const lease = await getTenantLease(params.id, tenantId, orgId);
      if (!lease) return sendError(res, 404, "NOT_FOUND", "Lease not found");
      sendJson(res, 200, { data: lease });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to get tenant lease", String(e));
    }
  });

  // POST /tenant-portal/leases/:id/accept
  router.post("/tenant-portal/leases/:id/accept", async ({ req, res, params, orgId }) => {
    try {
      const raw = await readJson(req);
      const tenantId = raw?.tenantId;
      if (!tenantId) return sendError(res, 400, "VALIDATION_ERROR", "tenantId is required in body");
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

  // ─── Tenant Notifications (uses tenantId → userId resolution) ───

  // GET /tenant-portal/notifications
  router.get("/tenant-portal/notifications", async ({ res, query, orgId, prisma }) => {
    try {
      const tenantId = first(query, "tenantId");
      if (!tenantId) return sendError(res, 400, "VALIDATION_ERROR", "tenantId is required");
      // Resolve tenant to userId: look up User with matching email or use tenantId directly
      const userId = await resolveTenantUserId(prisma, orgId, tenantId);
      const limit = query.limit ? parseInt(String(query.limit), 10) : 20;
      const offset = query.offset ? parseInt(String(query.offset), 10) : 0;
      const unreadOnly = String(query.unreadOnly) === "true";
      const result = await getUserNotifications({ orgId, userId, limit, offset, unreadOnly });
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to get tenant notifications", String(e));
    }
  });

  // GET /tenant-portal/notifications/unread-count
  router.get("/tenant-portal/notifications/unread-count", async ({ res, query, orgId, prisma }) => {
    try {
      const tenantId = first(query, "tenantId");
      if (!tenantId) return sendError(res, 400, "VALIDATION_ERROR", "tenantId is required");
      const userId = await resolveTenantUserId(prisma, orgId, tenantId);
      const count = await getUnreadNotificationCount(orgId, userId);
      sendJson(res, 200, { count });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to get unread count", String(e));
    }
  });

  // POST /tenant-portal/notifications/:id/read
  router.post("/tenant-portal/notifications/:id/read", async ({ res, params, orgId }) => {
    try {
      const result = await markNotificationAsRead(params.id, orgId);
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to mark as read", String(e));
    }
  });

  // POST /tenant-portal/notifications/mark-all-read
  router.post("/tenant-portal/notifications/mark-all-read", async ({ req, res, query, orgId, prisma }) => {
    try {
      const raw = await readJson(req).catch(() => ({}));
      const tenantId = (raw as any)?.tenantId || first(query, "tenantId");
      if (!tenantId) return sendError(res, 400, "VALIDATION_ERROR", "tenantId is required");
      const userId = await resolveTenantUserId(prisma, orgId, tenantId);
      const count = await markAllNotificationsAsRead(orgId, userId);
      sendJson(res, 200, { marked: count });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to mark all as read", String(e));
    }
  });

  // DELETE /tenant-portal/notifications/:id
  router.delete("/tenant-portal/notifications/:id", async ({ res, params, orgId }) => {
    try {
      await deleteNotification(params.id, orgId);
      sendJson(res, 200, { ok: true });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to delete notification", String(e));
    }
  });

  // ─── Tenant Invoices ────────────────────────────────────────

  // GET /tenant-portal/invoices
  router.get("/tenant-portal/invoices", async ({ res, query, orgId, prisma }) => {
    try {
      const tenantId = first(query, "tenantId");
      if (!tenantId) return sendError(res, 400, "VALIDATION_ERROR", "tenantId is required");

      // Get all units this tenant occupies
      const occupancies = await prisma.occupancy.findMany({
        where: { tenantId },
        select: { unitId: true },
      });
      if (occupancies.length === 0) {
        sendJson(res, 200, { data: [] });
        return;
      }
      const unitIds = occupancies.map((o: any) => o.unitId);

      // Get all leases for those units
      const leases = await prisma.lease.findMany({
        where: { orgId, unitId: { in: unitIds } },
        include: { unit: { include: { building: true } } },
      });
      if (leases.length === 0) {
        sendJson(res, 200, { data: [] });
        return;
      }
      const leaseIds = leases.map((l: any) => l.id);

      // Get all invoices linked to those leases
      const invoices = await prisma.invoice.findMany({
        where: { orgId, leaseId: { in: leaseIds } },
        orderBy: { createdAt: 'desc' },
      });

      // Build a lease lookup for enrichment
      const leaseMap = new Map(leases.map((l: any) => [l.id, l]));

      const data = invoices.map((inv: any) => {
        const lease = leaseMap.get(inv.leaseId);
        return {
          id: inv.id,
          leaseId: inv.leaseId,
          description: inv.description,
          totalAmount: inv.totalAmount,
          totalAmountChf: inv.totalAmount / 100,
          currency: inv.currency || 'CHF',
          status: inv.status,
          invoiceNumber: inv.invoiceNumber || null,
          issueDate: inv.issueDate?.toISOString() || null,
          dueDate: inv.dueDate?.toISOString() || null,
          paidAt: inv.paidAt?.toISOString() || null,
          createdAt: inv.createdAt.toISOString(),
          unit: lease?.unit ? {
            unitNumber: lease.unit.unitNumber,
            building: lease.unit.building ? {
              name: lease.unit.building.name,
              address: lease.unit.building.address,
            } : null,
          } : null,
        };
      });

      sendJson(res, 200, { data });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to get tenant invoices", String(e));
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
  router.post("/auth/register", async ({ req, res, prisma, orgId }) => {
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
        data: { orgId, email, name, passwordHash, role: role || "TENANT" },
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
  router.post("/auth/login", async ({ req, res, prisma, orgId }) => {
    try {
      const raw = await readJson(req);
      const parsed = LoginSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid login input", parsed.error.flatten());

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({
        where: { user_org_email_unique: { orgId, email } },
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
  router.post("/__dev/create-contractor-user", async ({ res, req, prisma, orgId }) => {
    if (process.env.NODE_ENV === "production") return sendError(res, 403, "FORBIDDEN", "Not allowed in production");
    try {
      const raw = await readJson(req);
      const { email, password, name, phone } = raw;
      if (!email || !password || !name || !phone) return sendError(res, 400, "VALIDATION_ERROR", "Missing fields");
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { orgId, email, name, passwordHash, role: "CONTRACTOR" },
      });
      const contractor = await prisma.contractor.create({
        data: {
          orgId: String(orgId),
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

/**
 * Resolve a tenantId to a userId for notification lookups.
 * Tries: 1) direct User with id=tenantId, 2) User with matching tenant email, 3) falls back to tenantId.
 */
async function resolveTenantUserId(prisma: any, orgId: string, tenantId: string): Promise<string> {
  // First check if tenantId is already a User id
  const directUser = await prisma.user.findFirst({
    where: { id: tenantId, orgId },
    select: { id: true },
  });
  if (directUser) return directUser.id;

  // Look up the tenant record to get their email
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { email: true },
  });
  if (tenant?.email) {
    const userByEmail = await prisma.user.findFirst({
      where: { orgId, email: tenant.email, role: 'TENANT' },
      select: { id: true },
    });
    if (userByEmail) return userByEmail.id;
  }

  // Fallback: use tenantId as userId (notifications will still be created with this id)
  return tenantId;
}
