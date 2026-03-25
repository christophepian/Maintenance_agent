import * as bcrypt from "bcryptjs";
import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { encodeToken } from "../services/auth";
import { requireTenantSession } from "../authz";
import { getTenantSession } from "../services/tenantSession";
import { listTenantLeases, getTenantLease, tenantAcceptLease } from "../services/tenantPortal";
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, getUnreadNotificationCount, deleteNotification } from "../services/notifications";
import { triageIssue } from "../services/triage";
import { TenantSessionSchema } from "../validation/tenantSession";
import { TriageSchema } from "../validation/triage";
import { LoginSchema, RegisterSchema } from "../validation/auth";
import { LEASE_FULL_INCLUDE } from "../repositories/leaseRepository";
import { tenantSelfPayWorkflow } from "../workflows/tenantSelfPayWorkflow";
import { InvalidTransitionError } from "../workflows/transitions";
import { resolveTenantUserId } from "../services/tenantIdentity";
import { parseBody } from "../http/body";
import { CreateRequestSchema } from "../validation/requests";
import { createRequestWorkflow } from "../workflows/createRequestWorkflow";
import { SubmitRatingSchema } from "../validation/completionSchemas";
import {
  confirmCompletionWorkflow,
  submitRatingWorkflow,
  CompletionError,
} from "../workflows/completionRatingWorkflow";

// SA-18: In-memory rate limiter for POST /triage (10 calls/IP/minute)
// NOTE: Resets on server restart — replace with Redis-backed limiter before multi-tenant production
const triageRateMap = new Map<string, { count: number; resetAt: number }>();
const TRIAGE_RATE_LIMIT = 10;
const TRIAGE_RATE_WINDOW_MS = 60_000;

function checkTriageRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = triageRateMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    triageRateMap.set(ip, { count: 1, resetAt: now + TRIAGE_RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= TRIAGE_RATE_LIMIT;
}

export function registerAuthRoutes(router: Router) {
  // POST /tenant-session
  router.post("/tenant-session", async ({ req, res, prisma, orgId }) => {
    try {
      const raw = await readJson(req);
      const parsed = TenantSessionSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid tenant session input", parsed.error.flatten());
      const session = await getTenantSession(prisma, orgId, parsed.data.phone);
      if (!session) return sendError(res, 404, "NOT_FOUND", "Tenant not found");
      // Issue a JWT for subsequent tenant-portal requests
      const token = encodeToken({
        userId: session.tenant.id,
        orgId,
        email: session.tenant.email || "",
        role: "TENANT",
        tenantId: session.tenant.id,
      } as any);
      sendJson(res, 200, { data: { ...session, token } });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      sendError(res, 500, "DB_ERROR", "Failed to create tenant session", String(e));
    }
  });

  // GET /tenant-portal/leases
  router.get("/tenant-portal/leases", async ({ req, res, query, orgId }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const unitId = first(query, "unitId") || undefined;
      const leases = await listTenantLeases(tenantId, orgId, unitId);
      sendJson(res, 200, { data: leases });
    } catch (e: any) {
      if (e.message?.includes("does not occupy")) return sendError(res, 403, "FORBIDDEN", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to list tenant leases", String(e));
    }
  });

  // GET /tenant-portal/leases/:id
  router.get("/tenant-portal/leases/:id", async ({ req, res, query, params, orgId }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const lease = await getTenantLease(params.id, tenantId, orgId);
      if (!lease) return sendError(res, 404, "NOT_FOUND", "Lease not found");
      sendJson(res, 200, { data: lease });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to get tenant lease", String(e));
    }
  });

  // POST /tenant-portal/leases/:id/accept
  router.post("/tenant-portal/leases/:id/accept", async ({ req, res, params, orgId }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
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
  router.get("/tenant-portal/notifications", async ({ req, res, query, orgId, prisma }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
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
  router.get("/tenant-portal/notifications/unread-count", async ({ req, res, query, orgId, prisma }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const userId = await resolveTenantUserId(prisma, orgId, tenantId);
      const count = await getUnreadNotificationCount(orgId, userId);
      sendJson(res, 200, { data: { count } });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to get unread count", String(e));
    }
  });

  // POST /tenant-portal/notifications/:id/read
  router.post("/tenant-portal/notifications/:id/read", async ({ req, res, params, orgId }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const result = await markNotificationAsRead(params.id, orgId);
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to mark as read", String(e));
    }
  });

  // POST /tenant-portal/notifications/mark-all-read
  router.post("/tenant-portal/notifications/mark-all-read", async ({ req, res, query, orgId, prisma }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const userId = await resolveTenantUserId(prisma, orgId, tenantId);
      const count = await markAllNotificationsAsRead(orgId, userId);
      sendJson(res, 200, { data: { marked: count } });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to mark all as read", String(e));
    }
  });

  // DELETE /tenant-portal/notifications/:id
  router.delete("/tenant-portal/notifications/:id", async ({ req, res, params, orgId }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      await deleteNotification(params.id, orgId);
      sendJson(res, 200, { data: { ok: true } });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to delete notification", String(e));
    }
  });

  // ─── Tenant Self-Pay ────────────────────────────────────────

  // POST /tenant-portal/requests/:id/self-pay
  router.post("/tenant-portal/requests/:id/self-pay", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const result = await tenantSelfPayWorkflow(
        { orgId, prisma, actorUserId: tenantId },
        { requestId: params.id, tenantId },
      );
      sendJson(res, 200, { data: result.dto, rfpId: result.rfpId });
    } catch (e: any) {
      if (e instanceof InvalidTransitionError) {
        return sendError(res, 409, "INVALID_TRANSITION", e.message);
      }
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.code === "FORBIDDEN") return sendError(res, 403, "FORBIDDEN", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to accept self-pay", String(e));
    }
  });

  // GET /tenant-portal/requests
  router.get("/tenant-portal/requests", async ({ req, res, query, orgId, prisma }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const rows = await prisma.request.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        include: {
          unit: { select: { unitNumber: true, building: { select: { name: true } } } },
          assignedContractor: { select: { name: true } },
          job: {
            select: {
              id: true,
              status: true,
              confirmedAt: true,
              completedAt: true,
              ratings: {
                select: { raterRole: true, score: true },
              },
            },
          },
        },
      });
      const data = rows.map((r: any) => {
        const job = r.job ?? null;
        return {
          id: r.id,
          requestNumber: r.requestNumber,
          description: r.description,
          category: r.category,
          status: r.status,
          payingParty: r.payingParty,
          rejectionReason: r.rejectionReason,
          unitNumber: r.unit?.unitNumber ?? null,
          buildingName: r.unit?.building?.name ?? null,
          assignedContractorName: r.assignedContractor?.name ?? null,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
          job: job
            ? {
                id: job.id,
                status: job.status,
                completedAt: job.completedAt instanceof Date ? job.completedAt.toISOString() : job.completedAt,
                confirmedAt: job.confirmedAt instanceof Date ? job.confirmedAt.toISOString() : job.confirmedAt,
                tenantRated: job.ratings?.some((rr: any) => rr.raterRole === "TENANT") ?? false,
              }
            : null,
        };
      });
      sendJson(res, 200, { data });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to list tenant requests", String(e));
    }
  });

  // POST /tenant-portal/requests
  router.post("/tenant-portal/requests", async ({ req, res, orgId, prisma }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const input = await parseBody(req, CreateRequestSchema);

      // Resolve unitId: prefer explicit value from body, then fall back to
      // the tenant's active occupancy (Tenant has no direct unitId field).
      let unitId: string | null = input.unitId ?? null;
      if (!unitId) {
        const occupancy = await prisma.occupancy.findFirst({
          where: { tenantId },
          select: { unitId: true },
        });
        unitId = occupancy?.unitId ?? null;
      }

      if (!unitId) {
        return sendError(res, 422, "UNIT_REQUIRED", "Could not determine your unit. Please contact your property manager.");
      }

      const result = await createRequestWorkflow(
        { orgId, prisma },
        { input, tenantId, unitId },
      );
      sendJson(res, 201, { data: result.dto });
    } catch (e: any) {
      if (e.name === "ValidationError" || e.code === "VALIDATION_ERROR") {
        return sendError(res, 400, "VALIDATION_ERROR", e.message, e.details);
      }
      sendError(res, 500, "DB_ERROR", "Failed to create request", String(e));
    }
  });

  // ─── Tenant Job Review ──────────────────────────────────────

  // POST /tenant-portal/jobs/:jobId/confirm
  router.post("/tenant-portal/jobs/:jobId/confirm", async ({ req, res, params, orgId, prisma }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const result = await confirmCompletionWorkflow(
        { orgId, prisma, actorUserId: tenantId },
        { jobId: params.jobId, tenantId },
      );
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      if (e instanceof CompletionError) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS: 409, ALREADY_CONFIRMED: 409,
        };
        return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
      }
      sendError(res, 500, "DB_ERROR", "Failed to confirm completion", String(e));
    }
  });

  // POST /tenant-portal/jobs/:jobId/rate
  router.post("/tenant-portal/jobs/:jobId/rate", async ({ req, res, params, orgId, prisma }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const body = await parseBody(req, SubmitRatingSchema);
      const score =
        body.score ??
        Math.round(
          ((body.scorePunctuality ?? 0) + (body.scoreAccuracy ?? 0) + (body.scoreCourtesy ?? 0)) / 3,
        );
      const result = await submitRatingWorkflow(
        { orgId, prisma, actorUserId: tenantId },
        {
          jobId: params.jobId,
          raterRole: "TENANT",
          raterId: tenantId,
          score,
          scorePunctuality: body.scorePunctuality ?? null,
          scoreAccuracy: body.scoreAccuracy ?? null,
          scoreCourtesy: body.scoreCourtesy ?? null,
          comment: body.comment,
        },
      );
      sendJson(res, 201, { data: result.rating });
    } catch (e: any) {
      if (e instanceof CompletionError) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS: 409, DUPLICATE_RATING: 409,
        };
        return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
      }
      sendError(res, 500, "DB_ERROR", "Failed to submit rating", String(e));
    }
  });

  // ─── Tenant Invoices ────────────────────────────────────────

  // GET /tenant-portal/invoices
  router.get("/tenant-portal/invoices", async ({ req, res, query, orgId, prisma }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      // ── 1. Lease-based invoices (rent, charges linked to a lease) ──
      const occupancies = await prisma.occupancy.findMany({
        where: { tenantId },
        select: { unitId: true },
      });
      const unitIds = occupancies.map((o: any) => o.unitId);

      let leaseInvoices: any[] = [];
      const leaseMap = new Map<string, any>();

      if (unitIds.length > 0) {
        const leases = await prisma.lease.findMany({
          where: { orgId, unitId: { in: unitIds } },
          include: LEASE_FULL_INCLUDE,
        });
        for (const l of leases) leaseMap.set(l.id, l);
        const leaseIds = leases.map((l: any) => l.id);

        if (leaseIds.length > 0) {
          leaseInvoices = await prisma.invoice.findMany({
            where: { orgId, leaseId: { in: leaseIds } },
            orderBy: { createdAt: 'desc' },
          });
        }
      }

      // ── 2. Job-based invoices (maintenance repairs for this tenant) ──
      const jobInvoices = await prisma.invoice.findMany({
        where: {
          orgId,
          job: { request: { tenantId } },
        },
        include: {
          job: {
            include: {
              request: {
                include: {
                  unit: { include: { building: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // ── 3. Merge + deduplicate ──
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const inv of [...leaseInvoices, ...jobInvoices]) {
        if (seen.has(inv.id)) continue;
        seen.add(inv.id);
        merged.push(inv);
      }
      merged.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

      // ── 4. Map to DTO ──
      const data = merged.map((inv: any) => {
        const lease = inv.leaseId ? leaseMap.get(inv.leaseId) : null;
        const reqUnit = inv.job?.request?.unit;
        return {
          id: inv.id,
          leaseId: inv.leaseId || null,
          jobId: inv.jobId || null,
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
          } : reqUnit ? {
            unitNumber: reqUnit.unitNumber,
            building: reqUnit.building ? {
              name: reqUnit.building.name,
              address: reqUnit.building.address,
            } : null,
          } : null,
        };
      });

      sendJson(res, 200, { data });
    } catch (e: any) {
      sendError(res, 500, "DB_ERROR", "Failed to get tenant invoices", String(e));
    }
  });

  // POST /triage — intentionally public (tenant-facing intake); rate-limited per SA-18
  router.post("/triage", async ({ req, res, prisma }) => {
    // SA-18: Rate limit — 10 calls per IP per minute
    const ip = req.socket.remoteAddress || "unknown";
    if (!checkTriageRateLimit(ip)) {
      return sendJson(res, 429, { error: "Too many requests" });
    }
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
 * Re-exported from services/tenantIdentity for backward compatibility.
 */
export { resolveTenantUserId } from "../services/tenantIdentity";
