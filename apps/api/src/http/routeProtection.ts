import { HandlerContext } from "./router";
import { getAuthUser, isAuthOptional } from "../authz";
import { UnauthorizedError, ForbiddenError } from "./errors";

/**
 * Route protection level declaration.
 * Ensures consistent auth enforcement across all routes.
 */
export type ProtectionLevel =
  | "PUBLIC" // No auth required
  | "AUTH_OPTIONAL" // Auth optional (dev only, must be refused in production)
  | "AUTH_REQUIRED" // Auth required, any role
  | { role: "MANAGER" | "OWNER" | "CONTRACTOR" | "TENANT" }; // Specific role required

type Handler = (ctx: HandlerContext) => Promise<void>;

/**
 * H1: Wrapper for routes requiring authentication (any role).
 * Throws UnauthorizedError if no valid auth present.
 * Respects AUTH_OPTIONAL in dev/test for backward compatibility with existing tests.
 */
export function withAuthRequired(handler: Handler): Handler {
  return async (ctx: HandlerContext) => {
    const user = getAuthUser(ctx.req);
    if (!user && !isAuthOptional()) {
      throw new UnauthorizedError("Authentication required");
    }
    await handler(ctx);
  };
}

/**
 * H1: Wrapper for routes requiring a specific role.
 * Throws UnauthorizedError if not authenticated.
 * Throws ForbiddenError if wrong role.
 * Respects AUTH_OPTIONAL in dev/test for backward compatibility.
 */
export function withRole(role: "MANAGER" | "OWNER" | "CONTRACTOR" | "TENANT", handler: Handler): Handler {
  return async (ctx: HandlerContext) => {
    const user = getAuthUser(ctx.req);
    if (!user) {
      if (!isAuthOptional()) {
        throw new UnauthorizedError("Authentication required");
      }
      // AUTH_OPTIONAL is true: allow through without role check
      await handler(ctx);
      return;
    }
    if (user.role !== role) {
      throw new ForbiddenError(`${role} role required`);
    }
    await handler(ctx);
  };
}

/**
 * H1: Wrapper for routes with optional auth (dev convenience).
 * In production, this should never be used (enforced by H2 boot guard).
 */
export function withAuthOptional(handler: Handler): Handler {
  return async (ctx: HandlerContext) => {
    // In production, this should have been caught by boot guard
    if (process.env.NODE_ENV === "production" && isAuthOptional()) {
      throw new Error("AUTH_OPTIONAL routes cannot run in production (boot guard failed)");
    }
    await handler(ctx);
  };
}

/**
 * H2: Production boot guard.
 * Ensures AUTH_SECRET is set in production.
 * Call this during server startup before accepting requests.
 * Note: isAuthOptional() already returns false in production, so we only check AUTH_SECRET here.
 */
export function enforceProductionAuthConfig(): void {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.AUTH_SECRET) {
      throw new Error(
        "FATAL: AUTH_SECRET must be set in production for JWT handling."
      );
    }
  }
}
