import "dotenv/config";

import * as http from "http";
import { sendError, sendJson } from "./http/json";
import { parseQuery } from "./http/query";
import { getOrgIdForRequest, AuthedRequest, requireAuth } from "./authz";
import { ensureDefaultOrgConfig, DEFAULT_ORG_ID } from "./services/orgConfig";
import { bootstrapLegalEngine } from "./services/bootstrapLegalEngine";
import prisma from "./services/prismaClient";
import { Router } from "./http/router";
import { readJson } from "./http/body";
import { encodeToken, resolveSupabaseToken, extractToken } from "./services/auth";

/* ── Route registration ─────────────────────────────────────── */
import { registerAuthRoutes } from "./routes/auth";
import { registerConfigRoutes } from "./routes/config";
import { registerInventoryRoutes } from "./routes/inventory";
import { registerRequestRoutes } from "./routes/requests";
import { registerTenantRoutes } from "./routes/tenants";
import { registerInvoiceRoutes } from "./routes/invoices";
import { registerContractorRoutes } from "./routes/contractor";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerLeaseRoutes } from "./routes/leases";
import { registerRentalRoutes } from "./routes/rentalApplications";
import { registerRentEstimationRoutes } from "./routes/rentEstimation";
import { registerFinancialRoutes } from "./routes/financials";
import { registerLegalRoutes } from "./routes/legal";
import { registerMaintenanceAttachmentRoutes } from "./routes/maintenanceAttachments";
import { registerSchedulingRoutes } from "./routes/scheduling";
import { registerCompletionRoutes } from "./routes/completion";
import { registerCoaRoutes } from "./routes/coa";
import { registerLedgerRoutes } from "./routes/ledger";
import { registerCaptureSessionRoutes } from "./routes/captureSessions";
import { registerCashflowPlanRoutes } from "./routes/cashflowPlans";
import { registerForecastingRoutes } from "./routes/forecasting";
import { registerBillingScheduleRoutes } from "./routes/billingSchedules";
import { registerChargeReconciliationRoutes } from "./routes/chargeReconciliations";
import { registerRentAdjustmentRoutes } from "./routes/rentAdjustments";
import { registerContractorBillingRoutes } from "./routes/contractorBillingSchedules";
import { registerStrategyRoutes } from "./routes/strategy";
import { registerRecommendationRoutes } from "./routes/recommendations";
import { registerTenantConversationRoutes } from "./routes/tenantConversation";
import { registerImportedStatementRoutes } from "./routes/importedStatements";
import { registerSandboxRoutes } from "./routes/sandbox";
import { registerEventHandlers } from "./events";
import {
  processSelectionTimeouts,
  processAttachmentRetention,
} from "./services/ownerSelection";
import { processSchedulingEscalations } from "./workflows/schedulingWorkflow";
import { flushPendingEmails } from "./services/emailTransport";
import { processRecurringBilling } from "./services/recurringBillingService";
import { processOverdueInvoices } from "./services/overdueInvoiceService";
import { flushLegalVariableIngestion } from "./services/legalVariableIngestion";

/* ── Supabase → Prisma user identity resolution ─────────────
   Bridges the gap between Supabase auth UUIDs and Prisma User.id values.
   prismaUserId is not reliably set in app_metadata, so we query once per
   distinct Supabase user and cache the result.

   Slice 5: entries carry a TTL so the cache cannot grow unbounded over a
   long-lived process and so identity changes (e.g. user re-keyed) are picked
   up within the TTL window instead of persisting for the whole process life. */
const IDENTITY_CACHE_TTL_MS = Number(process.env.IDENTITY_CACHE_TTL_MS) || 10 * 60 * 1000; // 10 min
const IDENTITY_CACHE_MAX_ENTRIES = 10_000;
const _prismaUserIdCache = new Map<string, { id: string; expiresAt: number }>(); // supabaseId|email → { User.id, expiresAt }

async function resolvePrismaUserId(supabaseId: string | undefined, email: string): Promise<string | null> {
  if (!supabaseId && !email) return null;
  const cacheKey = supabaseId || email;
  const cached = _prismaUserIdCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.id;
  if (cached) _prismaUserIdCache.delete(cacheKey); // expired — drop and re-resolve

  try {
    // Try supabaseId first (populated after backfill-supabase-ids.sql is run),
    // then fall back to email so the fix works even before the backfill.
    let user = supabaseId
      ? await prisma.user.findFirst({ where: { supabaseId }, select: { id: true } })
      : null;
    if (!user && email) {
      user = await prisma.user.findFirst({ where: { email }, select: { id: true } });
    }
    if (user) {
      // Opportunistic eviction: if the cache is full, clear expired entries first,
      // then fall back to dropping the oldest-inserted key to bound memory.
      if (_prismaUserIdCache.size >= IDENTITY_CACHE_MAX_ENTRIES) {
        const now = Date.now();
        for (const [k, v] of _prismaUserIdCache) {
          if (now >= v.expiresAt) _prismaUserIdCache.delete(k);
        }
        if (_prismaUserIdCache.size >= IDENTITY_CACHE_MAX_ENTRIES) {
          const oldestKey = _prismaUserIdCache.keys().next().value;
          if (oldestKey !== undefined) _prismaUserIdCache.delete(oldestKey);
        }
      }
      _prismaUserIdCache.set(cacheKey, { id: user.id, expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS });
      return user.id;
    }
  } catch (err) {
    console.error("[auth] resolvePrismaUserId failed:", err);
  }
  return null;
}

/* ── F1: Production boot guard ─────────────────────────────── */
const isProdEnv = process.env.NODE_ENV === "production";
if (isProdEnv) {
  if (!process.env.AUTH_SECRET) {
    console.error(
      "[FATAL] AUTH_SECRET is required in production. Set it before starting the server.",
    );
    process.exit(1);
  }
  if (process.env.AUTH_OPTIONAL === "true") {
    console.error(
      "[FATAL] AUTH_OPTIONAL must not be 'true' in production. Remove it or set to 'false'.",
    );
    process.exit(1);
  }
  if (process.env.DEV_IDENTITY_ENABLED === "true") {
    console.error(
      "[FATAL] DEV_IDENTITY_ENABLED=true is not permitted in production. Refusing to start.",
    );
    process.exit(1);
  }
  // Guard against deploying from a branch other than main.
  // RENDER_GIT_BRANCH is injected automatically by Render at build time.
  const deployedBranch = process.env.RENDER_GIT_BRANCH;
  if (deployedBranch && deployedBranch !== "main") {
    console.error(
      `[FATAL] Production must deploy from 'main'. Currently on '${deployedBranch}'. Update the Render service branch setting.`,
    );
    process.exit(1);
  }
  // Slice 6: durable storage required in production. Local-disk attachments are
  // ephemeral on Render (lost on every deploy/restart), so refuse to boot unless
  // an object-store backend (s3) is configured.
  if ((process.env.ATTACHMENTS_STORAGE || "local") !== "s3") {
    console.error(
      `[FATAL] ATTACHMENTS_STORAGE must be 's3' in production (got '${process.env.ATTACHMENTS_STORAGE || "local"}'). ` +
        "Local-disk storage is ephemeral and loses uploaded files on restart. Configure S3 before starting.",
    );
    process.exit(1);
  }
}

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 30_000;
const DRAIN_TIMEOUT_MS = 10_000;

/* ── Build router ───────────────────────────────────────────── */
const router = new Router();
registerAuthRoutes(router);
registerRequestRoutes(router);
registerConfigRoutes(router);
registerInventoryRoutes(router);
registerTenantRoutes(router);
registerInvoiceRoutes(router);
registerContractorRoutes(router);
registerNotificationRoutes(router);
registerLeaseRoutes(router);
registerRentalRoutes(router);
registerRentEstimationRoutes(router);
registerFinancialRoutes(router);
registerLegalRoutes(router);
registerMaintenanceAttachmentRoutes(router);
registerSchedulingRoutes(router);
registerCompletionRoutes(router);
registerCoaRoutes(router);
registerLedgerRoutes(router);
registerCaptureSessionRoutes(router);
registerCashflowPlanRoutes(router);
registerForecastingRoutes(router);
registerBillingScheduleRoutes(router);
registerChargeReconciliationRoutes(router);
registerRentAdjustmentRoutes(router);
registerContractorBillingRoutes(router);
registerStrategyRoutes(router);
registerRecommendationRoutes(router);
registerTenantConversationRoutes(router);
registerImportedStatementRoutes(router);
registerSandboxRoutes(router);

/* ── Dev-only: background job trigger route ─────────────────── */
router.post("/__dev/rental/run-jobs", async ({ res }) => {
  if (isProdEnv) {
    sendError(res, 403, "FORBIDDEN", "Dev route disabled in production");
    return;
  }
  try {
    const timeoutsProcessed = await processSelectionTimeouts();
    const attachmentsDeleted = await processAttachmentRetention();
    sendJson(res, 200, { timeoutsProcessed, attachmentsDeleted });
  } catch (e: any) {
    console.error("[DEV] run-jobs error:", e);
    sendError(res, 500, "INTERNAL_ERROR", e.message);
  }
});

/* ── Dev-only: switch-tenant — issues a JWT for any Tenant ── */
router.post("/dev/switch-tenant", async ({ req, res, prisma, orgId }) => {
  if (isProdEnv) {
    sendError(res, 403, "FORBIDDEN", "Dev route disabled in production");
    return;
  }
  const actor = requireAuth(req, res);
  if (!actor) return;
  const body = await readJson(req);
  const tenantId: string | undefined = body?.tenantId;
  if (!tenantId) {
    sendError(res, 400, "BAD_REQUEST", "tenantId is required");
    return;
  }
  const tenant = await prisma.tenant.findFirst({
    where: {
      id: tenantId,
      occupancies: { some: { unit: { building: { orgId } } } },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      occupancies: {
        select: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
              building: { select: { id: true, name: true } },
            },
          },
        },
        take: 1,
      },
    },
  });
  if (!tenant) {
    sendError(res, 404, "NOT_FOUND", "Tenant not found");
    return;
  }
  const primaryUnit = tenant.occupancies[0]?.unit ?? null;
  const token = encodeToken({ userId: tenant.id, orgId, email: tenant.email || "", role: "TENANT" } as any);
  sendJson(res, 200, {
    data: {
      token,
      tenant: { id: tenant.id, name: tenant.name, phone: tenant.phone, email: tenant.email, unitId: primaryUnit?.id ?? null },
      unit: primaryUnit ? { id: primaryUnit.id, unitNumber: primaryUnit.unitNumber } : null,
      building: primaryUnit?.building ?? null,
    },
  });
});

/* ── Dev-only: switch-owner — issues a JWT for any OWNER user ── */
router.post("/dev/switch-owner", async ({ req, res, prisma, orgId }) => {
  if (isProdEnv) {
    sendError(res, 403, "FORBIDDEN", "Dev route disabled in production");
    return;
  }
  const actor = requireAuth(req, res);
  if (!actor) return;
  const body = await readJson(req);
  const ownerId: string | undefined = body?.ownerId;
  if (!ownerId) {
    sendError(res, 400, "BAD_REQUEST", "ownerId is required");
    return;
  }
  const user = await prisma.user.findFirst({
    where: { id: ownerId, orgId, role: "OWNER" },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    sendError(res, 404, "NOT_FOUND", "Owner user not found");
    return;
  }
  const token = encodeToken({ userId: user.id, orgId, email: user.email || "", role: "OWNER" });
  sendJson(res, 200, { data: { token, owner: { id: user.id, name: user.name, email: user.email } } });
});

/* ── Connection tracking for graceful shutdown ──────────────── */
const activeResponses = new Set<http.ServerResponse>();

const server = http.createServer(async (req: AuthedRequest, res) => {
  activeResponses.add(res);
  res.on("close", () => activeResponses.delete(res));

  /* Per-request timeout */
  req.setTimeout(REQUEST_TIMEOUT_MS, () => {
    console.warn(`[TIMEOUT] ${req.method} ${req.url}`);
    if (!res.headersSent) {
      sendError(res, 504, "GATEWAY_TIMEOUT", "Request timed out");
    }
    res.end();
  });

  try {
    /* CORS — explicit origin allowlist; never wildcard.
       Priority: CORS_ORIGIN env var (comma-separated) → built-in Vercel staging
       origin (non-production only) → localhost (dev only).
       In production, CORS_ORIGIN must be set — no hardcoded fallbacks apply. */
    const isProd = process.env.NODE_ENV === "production";
    // Vercel preview/staging URL — allowed in non-production only.
    // In production add it to the CORS_ORIGIN env var if needed.
    const VERCEL_STAGING_ORIGIN = "https://maintenance-agent-api-git-main-christophepians-projects.vercel.app";
    const DEV_ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"];
    const requestOrigin = req.headers["origin"] as string | undefined;
    let corsOrigin = "";
    if (process.env.CORS_ORIGIN) {
      // Support comma-separated list of allowed origins
      const allowed = process.env.CORS_ORIGIN.split(",").map((o) => o.trim());
      if (requestOrigin && allowed.includes(requestOrigin)) {
        corsOrigin = requestOrigin;
      }
    }
    // Hardcoded convenience origins apply in non-production only
    if (!corsOrigin && !isProd && requestOrigin === VERCEL_STAGING_ORIGIN) {
      corsOrigin = requestOrigin;
    }
    if (!corsOrigin && !isProd && requestOrigin && DEV_ALLOWED_ORIGINS.includes(requestOrigin)) {
      corsOrigin = requestOrigin;
    }
    if (corsOrigin) {
      res.setHeader("Access-Control-Allow-Origin", corsOrigin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    // x-dev-* headers only advertised in non-production to avoid revealing
    // the existence of the dev identity bypass mechanism to external observers
    const allowedHeaders = isProd
      ? "content-type, authorization"
      : "content-type, authorization, x-dev-role, x-dev-org-id, x-dev-user-id, x-dev-email";
    res.setHeader("Access-Control-Allow-Headers", allowedHeaders);

    // Security headers — applied to every response
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    /* Parse URL + resolve org */
    const { path, query } = parseQuery(req.url);

    /* T-03: Health endpoint — unauthenticated, used by Render/Vercel uptime probes.
       Must be reachable without AUTH_SECRET, before org resolution, and never throw. */
    if ((path === "/health" || path === "/healthz") && req.method === "GET") {
      const startedAt = Date.now();
      let dbStatus: "connected" | "disconnected" = "disconnected";
      let dbLatencyMs: number | null = null;
      try {
        const t0 = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        dbLatencyMs = Date.now() - t0;
        dbStatus = "connected";
      } catch {
        // fall through with disconnected
      }
      const healthy = dbStatus === "connected" && !isShuttingDown;
      sendJson(res, healthy ? 200 : 503, {
        status: healthy ? "ok" : "degraded",
        db: dbStatus,
        dbLatencyMs,
        shuttingDown: isShuttingDown,
        uptimeSeconds: Math.round(process.uptime()),
        version: process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT || "dev",
        codeVersion: "2026-05-09-public-listings",
        checkedInMs: Date.now() - startedAt,
      });
      return;
    }

    /* ── Pre-resolve Supabase JWT (async JWKS) ──────────────────────────────
       Populates req.user before the router runs so getAuthUser() in authz.ts
       can remain synchronous. Falls back gracefully when no token is present.

       After token verification we resolve the Prisma User.id from the
       supabaseId (JWT sub) so that userId on req.user always equals
       User.id, not the Supabase auth UUID.  prismaUserId in app_metadata
       is never reliably set (the creation script omits it), so we do an
       authoritative DB lookup instead.  Results are cached in a process-
       lifetime Map — one DB hit per distinct user per server restart. */
    if (!req.user) {
      const token = extractToken(req.headers["authorization"] as string | undefined);
      if (token) {
        // Only assign req.user if Supabase verification succeeds.
        // If it returns null (no SUPABASE_URL or invalid token), leave req.user
        // undefined so getAuthUser() in authz.ts can fall back to decodeToken().
        const supabaseUser = await resolveSupabaseToken(token);
        if (supabaseUser) {
          const resolvedId = await resolvePrismaUserId(supabaseUser.supabaseId, supabaseUser.email);
          if (resolvedId) supabaseUser.userId = resolvedId;
          req.user = supabaseUser;
        }
      }
    }

    const orgId = getOrgIdForRequest(req);

    /* ── Public auth routes — must be reachable before org/auth resolution ── */
    if (
      (path === "/auth/login" || path === "/auth/register" || path === "/triage" || path === "/tenant-session") &&
      req.method === "POST"
    ) {
      const handled = await router.dispatch(req, res, path, query, DEFAULT_ORG_ID, prisma);
      if (!handled) sendError(res, 404, "NOT_FOUND", "Not found");
      return;
    }

    /* ── Public rental routes — unauthenticated, use DEFAULT_ORG_ID ── */
    const isPublicRentalRoute =
      (req.method === "GET" && (path === "/listings" || path === "/vacant-units")) ||
      (req.method === "POST" && (
        path === "/document-scan" ||
        path === "/rental-applications" ||
        /^\/rental-applications\/[^/]+\/submit$/.test(path) ||
        /^\/rental-applications\/[^/]+\/attachments$/.test(path)
      ));
    if (isPublicRentalRoute) {
      const handled = await router.dispatch(req, res, path, query, DEFAULT_ORG_ID, prisma);
      if (!handled) sendError(res, 404, "NOT_FOUND", "Not found");
      return;
    }

    /* ── Public capture session routes — token-gated internally, no Supabase session ── */
    // These are called by the phone after scanning the QR code. Auth is enforced
    // by the signed JWT embedded in the session token, not by our Supabase auth.
    const isPublicCaptureRoute =
      (req.method === "GET" && /^\/capture-sessions\/resolve\/[a-zA-Z0-9_-]+$/.test(path)) ||
      (req.method === "GET" && /^\/capture-sessions\/validate\/[a-zA-Z0-9._-]+$/.test(path)) ||
      (req.method === "POST" && /^\/capture-sessions\/[a-zA-Z0-9._-]+\/upload$/.test(path)) ||
      (req.method === "POST" && /^\/capture-sessions\/[a-zA-Z0-9._-]+\/complete$/.test(path));
    if (isPublicCaptureRoute) {
      const handled = await router.dispatch(req, res, path, query, DEFAULT_ORG_ID, prisma);
      if (!handled) sendError(res, 404, "NOT_FOUND", "Not found");
      return;
    }

    if (orgId === null) {
      sendError(res, 401, "UNAUTHORIZED", "Authentication required");
      return;
    }

    /* Dispatch through router */
    const handled = await router.dispatch(req, res, path, query, orgId, prisma);
    if (!handled) {
      sendError(res, 404, "NOT_FOUND", "Not found");
    }
  } catch (err) {
    console.error("[UNHANDLED]", err);
    if (!res.headersSent) {
      sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
    }
  }
});

/* ── Lifecycle ──────────────────────────────────────────────── */

let isShuttingDown = false;

/* ── Background job interval ────────────────────────────────── */
const BG_JOB_INTERVAL_MS = Number(process.env.BG_JOB_INTERVAL_MS) || 60 * 60 * 1000; // default: 1 hour
const BG_JOBS_ENABLED = process.env.BG_JOBS_ENABLED !== "false"; // enabled by default
let bgJobTimer: ReturnType<typeof setInterval> | null = null;

// Slice 4: Postgres advisory-lock key so only ONE instance runs the scheduler
// at a time. Protects the deploy-overlap window (old + new instance both live)
// and any accidental horizontal scale-out. Arbitrary constant unique to this job.
const BG_JOB_ADVISORY_LOCK_KEY = 91237;

async function runBackgroundJobsInner() {
  try {
    const timeouts = await processSelectionTimeouts();
    const attachments = await processAttachmentRetention();
    const escalations = await processSchedulingEscalations(prisma);
    if (timeouts > 0 || attachments > 0 || escalations > 0) {
      console.log(
        `[BG-JOBS] Processed ${timeouts} selection timeout(s), ${attachments} attachment retention(s), ${escalations} scheduling escalation(s)`,
      );
    }
  } catch (e) {
    console.error("[BG-JOBS] Error:", e);
  }

  try {
    await flushPendingEmails();
  } catch (e) {
    console.error("[BG-JOBS] Email flush error:", e);
  }

  try {
    const invoicesGenerated = await processRecurringBilling(prisma);
    if (invoicesGenerated > 0) {
      console.log(`[BG-JOBS] Generated ${invoicesGenerated} recurring invoice(s)`);
    }
  } catch (e) {
    console.error("[BG-JOBS] Recurring billing error:", e);
  }

  try {
    const overdueCount = await processOverdueInvoices(prisma);
    if (overdueCount > 0) {
      console.log(`[BG-JOBS] Sent ${overdueCount} overdue invoice notification(s)`);
    }
  } catch (e) {
    console.error("[BG-JOBS] Overdue invoice error:", e);
  }

  try {
    const legalFlush = await flushLegalVariableIngestion();
    if (legalFlush.variablesUpdated > 0 || legalFlush.errors.length > 0) {
      console.log(
        `[BG-JOBS] Legal variable ingestion: ${legalFlush.sourcesProcessed} source(s), ${legalFlush.variablesUpdated} updated`,
      );
      for (const err of legalFlush.errors) {
        console.warn(`[BG-JOBS] Legal ingestion error: ${err}`);
      }
    }
  } catch (e) {
    console.error("[BG-JOBS] Legal variable ingestion error:", e);
  }
}

async function runBackgroundJobs() {
  // Slice 4: gate the whole run behind a transaction-scoped advisory lock.
  // pg_try_advisory_xact_lock is non-blocking (returns immediately) and the
  // lock auto-releases when the transaction ends — including on crash or
  // connection loss — so it can never leak and permanently wedge the scheduler.
  try {
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${BG_JOB_ADVISORY_LOCK_KEY}) AS locked
        `;
        if (!rows[0]?.locked) {
          console.log(
            "[BG-JOBS] Another instance holds the scheduler lock — skipping this run",
          );
          return;
        }
        await runBackgroundJobsInner();
      },
      {
        // Hold the lock for the full run; floor at 10 min for long batches.
        timeout: Math.max(BG_JOB_INTERVAL_MS, 10 * 60 * 1000),
        maxWait: 5_000,
      },
    );
  } catch (e) {
    console.error("[BG-JOBS] Scheduler lock/transaction error:", e);
  }
}

async function start() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    console.log(`[STARTUP] SUPABASE_URL: ${supabaseUrl ? `set (${supabaseUrl.slice(0, 30)}...)` : "NOT SET — Supabase JWT verification will fail"}`);

    await ensureDefaultOrgConfig(prisma);
    await bootstrapLegalEngine(prisma);
    registerEventHandlers(prisma);
    server.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });

    /* Start background job scheduler */
    if (BG_JOBS_ENABLED) {
      bgJobTimer = setInterval(runBackgroundJobs, BG_JOB_INTERVAL_MS);
      console.log(
        `[BG-JOBS] Scheduler started (interval: ${BG_JOB_INTERVAL_MS / 1000}s)`,
      );
    }
  } catch (e) {
    console.error("Failed to start API:", e);
    process.exit(1);
  }
}

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("[SHUTDOWN] Stopping new connections…");

  /* T-04: Hard upper-bound on shutdown duration. Render sends SIGKILL after
     30s; self-exit before then so the orchestrator records a clean stop. */
  const HARD_EXIT_MS = Number(process.env.SHUTDOWN_HARD_EXIT_MS) || 25_000;
  const hardExit = setTimeout(() => {
    console.error("[SHUTDOWN] Hard exit — drain exceeded budget");
    process.exit(1);
  }, HARD_EXIT_MS);
  hardExit.unref();

  if (bgJobTimer) clearInterval(bgJobTimer);
  server.close();

  /* Give in-flight requests time to finish */
  const drainTimer = setTimeout(() => {
    console.warn("[SHUTDOWN] Force-closing remaining connections");
    for (const r of activeResponses) r.end();
  }, DRAIN_TIMEOUT_MS);

  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (activeResponses.size === 0) {
        clearInterval(check);
        clearTimeout(drainTimer);
        resolve();
      }
    }, 200);
  });

  await prisma.$disconnect();
  console.log("[SHUTDOWN] Clean exit");
  process.exit(0);
}

start();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT EXCEPTION]", err);
  // Give time to flush logs, then exit
  setTimeout(() => process.exit(1), 1000);
});

server.on("error", (err) => {
  console.error("[SERVER ERROR]", err);
});
