import * as http from "http";
import { PrismaClient } from "@prisma/client";
import { AuthedRequest } from "../authz";
import { QueryParams } from "./query";
import { sendError } from "./json";

/* ─────────────────────────── Types ─────────────────────────── */

export interface RouteParams {
  [key: string]: string;
}

/**
 * Context handed to every route handler.  Identical to the old
 * `RouteContext` but adds typed `params` extracted from the URL.
 */
export interface HandlerContext {
  req: AuthedRequest;
  res: http.ServerResponse;
  path: string;
  query: QueryParams;
  orgId: string;
  prisma: PrismaClient;
  params: RouteParams;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Handler = (ctx: HandlerContext) => Promise<void>;

/* ─────────────────────────── Router ─────────────────────────── */

interface RegisteredRoute {
  method: HttpMethod;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
  label: string;
}

/**
 * Lightweight HTTP router with **per-route error isolation**.
 *
 * Each registered handler runs in its own `try/catch` so a bug in one
 * route cannot crash the server process.
 *
 * Safety features:
 *  • If a handler finishes without sending a response → auto 500.
 *  • If a handler throws after headers were already sent → connection
 *    is closed cleanly.
 *  • If a path matches but no method matches → automatic 405 with
 *    `Allow` header.
 */
export class Router {
  private routes: RegisteredRoute[] = [];

  /* ── Registration helpers ─────────────────────────────────── */

  get(path: string, handler: Handler): this {
    return this.add("GET", path, handler);
  }
  post(path: string, handler: Handler): this {
    return this.add("POST", path, handler);
  }
  put(path: string, handler: Handler): this {
    return this.add("PUT", path, handler);
  }
  patch(path: string, handler: Handler): this {
    return this.add("PATCH", path, handler);
  }
  delete(path: string, handler: Handler): this {
    return this.add("DELETE", path, handler);
  }

  /**
   * Register a route with a raw regex pattern.
   * Use this for paths that don't follow the standard `:param` UUID syntax,
   * e.g. paths containing dots like `/invoices/:id/qr-code.png`.
   */
  addCustom(
    method: HttpMethod,
    pattern: RegExp,
    paramNames: string[],
    handler: Handler,
    label?: string,
  ): this {
    this.routes.push({
      method,
      pattern,
      paramNames,
      handler,
      label: label ?? `${method} <custom>`,
    });
    return this;
  }

  /**
   * Register a route.
   *
   * Path patterns use `:name` for UUID parameters:
   *   `/leases/:id/generate-pdf`  →  params.id = "abc-123-…"
   *
   * Each `:name` segment matches `[a-f0-9-]{36}` (standard UUID).
   */
  private add(method: HttpMethod, pathPattern: string, handler: Handler): this {
    const paramNames: string[] = [];
    const regexParts = pathPattern.split("/").map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([a-f0-9\\-]{36})";
      }
      // Escape regex-special characters in literal segments
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });

    this.routes.push({
      method,
      pattern: new RegExp("^" + regexParts.join("\\/") + "$", "i"),
      paramNames,
      handler,
      label: `${method} ${pathPattern}`,
    });
    return this;
  }

  /* ── Dispatch ─────────────────────────────────────────────── */

  /**
   * Try to match `path` against registered routes and execute the
   * handler.  Returns `true` if a route matched (response sent),
   * `false` if no route matched at all.
   */
  async dispatch(
    req: AuthedRequest,
    res: http.ServerResponse,
    path: string,
    query: QueryParams,
    orgId: string,
    prisma: PrismaClient,
  ): Promise<boolean> {
    const method = req.method as HttpMethod;
    let pathMatched = false;

    for (const route of this.routes) {
      const m = path.match(route.pattern);
      if (!m) continue;

      pathMatched = true;
      if (route.method !== method) continue;

      /* ── Extract URL params ── */
      const params: RouteParams = {};
      route.paramNames.forEach((name, i) => {
        params[name] = m[i + 1];
      });

      /* ── Execute with per-route isolation ── */
      try {
        await route.handler({ req, res, path, query, orgId, prisma, params });
      } catch (err: any) {
        console.error(`[ROUTE ERROR] ${route.label}:`, err);
        if (res.headersSent) {
          res.end();
        } else {
          sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
        }
      }

      /* ── Safety: make sure a response was sent ── */
      if (!res.writableEnded && !res.headersSent) {
        console.warn(
          `[BUG] Handler ${route.label} completed without sending a response`,
        );
        sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
      }

      return true;
    }

    /* ── Path matched but method didn't → 405 ── */
    if (pathMatched) {
      const allowed = [
        ...new Set(
          this.routes
            .filter((r) => path.match(r.pattern))
            .map((r) => r.method),
        ),
      ];
      res.setHeader("Allow", allowed.join(", "));
      sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
      return true;
    }

    return false;
  }
}
