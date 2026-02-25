import "dotenv/config";

import * as http from "http";
import { sendError } from "./http/json";
import { parseQuery } from "./http/query";
import { getOrgIdForRequest, AuthedRequest } from "./authz";
import { ensureDefaultOrgConfig } from "./services/orgConfig";
import prisma from "./services/prismaClient";
import { Router } from "./http/router";

/* ── Route registration ─────────────────────────────────────── */
import { registerAuthRoutes } from "./routes/auth";
import { registerConfigRoutes } from "./routes/config";
import { registerInventoryRoutes } from "./routes/inventory";
import { registerRequestRoutes } from "./routes/requests";
import { registerTenantRoutes } from "./routes/tenants";
import { registerInvoiceRoutes } from "./routes/invoices";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerLeaseRoutes } from "./routes/leases";

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
registerNotificationRoutes(router);
registerLeaseRoutes(router);

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
    /* CORS */
    const isProd = process.env.NODE_ENV === "production";
    const corsOrigin = process.env.CORS_ORIGIN || (isProd ? "" : "*");
    if (corsOrigin) {
      res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    }
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type, authorization, x-dev-role, x-dev-org-id, x-dev-user-id, x-dev-email",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    /* Parse URL + resolve org */
    const { path, query } = parseQuery(req.url);
    const orgId = getOrgIdForRequest(req);

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

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("[SHUTDOWN] Stopping new connections…");

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
