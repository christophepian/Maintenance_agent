import * as http from "http";
import { decodeToken, extractToken, TokenPayload } from "./services/auth";
import { sendJson } from "./http/json";
import { DEFAULT_ORG_ID } from "./services/orgConfig";

export type AuthedRequest = http.IncomingMessage & { user?: TokenPayload | null };

export function isAuthOptional(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  // H4: Auth required by default; must explicitly opt out with AUTH_OPTIONAL=true
  return process.env.AUTH_OPTIONAL === "true";
}

export function getAuthUser(req: AuthedRequest): TokenPayload | null {
  if (req.user !== undefined) return req.user;

  const token = extractToken(req.headers["authorization"] as string | undefined);
  if (token) {
    const decoded = decodeToken(token);
    if (decoded) {
      req.user = decoded;
      return decoded;
    }
    // Token was present but invalid — fall through to dev identity
  }

  if (process.env.DEV_IDENTITY_ENABLED === "true") {
    const role = req.headers["x-dev-role"];
    if (typeof role === "string" && role.trim()) {
      const user = {
        userId: (req.headers["x-dev-user-id"] as string) || "dev-user",
        orgId: (req.headers["x-dev-org-id"] as string) || process.env.DEV_ORG_ID || DEFAULT_ORG_ID,
        email: (req.headers["x-dev-email"] as string) || "dev@local",
        role: role.toUpperCase(),
      } as TokenPayload;
      req.user = user;
      return user;
    }
  }

  req.user = null;
  return null;
}

export function getOrgIdForRequest(req: AuthedRequest): string | null {
  const user = getAuthUser(req);
  if (user?.orgId) return user.orgId;

  // Production: never fall back to DEFAULT_ORG_ID for unauthenticated requests.
  // This prevents silent data leakage across orgs.
  if (process.env.NODE_ENV === "production") return null;

  // Dev/test only: fall back so AUTH_OPTIONAL workflows are not broken.
  return process.env.DEV_ORG_ID || DEFAULT_ORG_ID;
}

function sendAuthError(res: http.ServerResponse, status: 401 | 403, code: "UNAUTHORIZED" | "FORBIDDEN") {
  return sendJson(res, status, { error: code });
}

export function requireAuth(
  req: AuthedRequest,
  res: http.ServerResponse
): TokenPayload | null {
  const user = getAuthUser(req);
  if (isAuthOptional()) return user || ({ userId: "dev-user", orgId: process.env.DEV_ORG_ID || DEFAULT_ORG_ID, email: "dev@local", role: "MANAGER" } as TokenPayload);
  if (!user) {
    sendAuthError(res, 401, "UNAUTHORIZED");
    return null;
  }
  return user;
}

export function requireRole(
  req: AuthedRequest,
  res: http.ServerResponse,
  role: string
): TokenPayload | null {
  const user = getAuthUser(req);
  if (!user) {
    if (isAuthOptional()) {
      console.warn(`[AUTH_OPTIONAL] requireRole(${role}): no auth — dev bypass`);
      const devUser = { userId: "dev-user", orgId: process.env.DEV_ORG_ID || DEFAULT_ORG_ID, email: "dev@local", role } as TokenPayload;
      req.user = devUser;
      return devUser;
    }
    sendAuthError(res, 401, "UNAUTHORIZED");
    return null;
  }
  if (user.role !== role) {
    sendAuthError(res, 403, "FORBIDDEN");
    return null;
  }
  return user;
}

export function requireAnyRole(
  req: AuthedRequest,
  res: http.ServerResponse,
  roles: string[]
): TokenPayload | null {
  const user = getAuthUser(req);
  if (!user) {
    if (isAuthOptional()) {
      console.warn(`[AUTH_OPTIONAL] requireAnyRole(${roles.join(",")}): no auth — dev bypass`);
      const devUser = { userId: "dev-user", orgId: process.env.DEV_ORG_ID || DEFAULT_ORG_ID, email: "dev@local", role: roles[0] } as TokenPayload;
      req.user = devUser;
      return devUser;
    }
    sendAuthError(res, 401, "UNAUTHORIZED");
    return null;
  }
  if (!roles.includes(user.role)) {
    sendAuthError(res, 403, "FORBIDDEN");
    return null;
  }
  return user;
}

export function maybeRequireManager(
  req: AuthedRequest,
  res: http.ServerResponse
): boolean {
  const user = getAuthUser(req);
  if (isAuthOptional()) {
    // SA-17: Warn when dev mode bypasses role check without a dev-role header
    if (!user) {
      const devRole = req.headers["x-dev-role"];
      if (!devRole || (typeof devRole === "string" && devRole.toUpperCase() !== "MANAGER" && devRole.toUpperCase() !== "OWNER")) {
        console.warn("[AUTH_OPTIONAL] maybeRequireManager: no role header present — request allowed in dev mode only");
      }
    }
    return true;
  }
  if (!user) {
    sendAuthError(res, 401, "UNAUTHORIZED");
    return false;
  }
  if (user.role !== "MANAGER") {
    sendAuthError(res, 403, "FORBIDDEN");
    return false;
  }
  return true;
}

// ── Staff auth ─────────────────────────────────────────────────────
// Staff roles that can access shared endpoints (notifications, etc.)
// Add new roles here only — no other files need to change.
const STAFF_ROLES = ['MANAGER', 'OWNER', 'CONTRACTOR', 'VENDOR', 'INSURANCE'] as const;

export function requireStaffAuth(
  req: AuthedRequest,
  res: http.ServerResponse
): TokenPayload | null {
  const user = getAuthUser(req);
  if (!user) {
    if (isAuthOptional()) {
      return { userId: 'dev-user', orgId: process.env.DEV_ORG_ID || DEFAULT_ORG_ID, email: 'dev@local', role: 'MANAGER' } as TokenPayload;
    }
    sendAuthError(res, 401, 'UNAUTHORIZED');
    return null;
  }
  if (!(STAFF_ROLES as readonly string[]).includes(user.role)) {
    sendAuthError(res, 403, 'FORBIDDEN');
    return null;
  }
  return user;
}

export function requireTenantSession(req: http.IncomingMessage, res: http.ServerResponse): string | null {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Tenant authentication required" }));
    return null;
  }
  try {
    const token = authHeader.slice(7);
    const decoded = decodeToken(token) as { tenantId?: string; role?: string; userId?: string } | null;
    if (!decoded || decoded.role !== "TENANT") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Tenant role required" }));
      return null;
    }
    return decoded.tenantId || decoded.userId || null;
  } catch {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid or expired token" }));
    return null;
  }
}