import * as http from "http";
import { decodeToken, extractToken, TokenPayload } from "./services/auth";
import { sendJson } from "./http/json";
import { DEFAULT_ORG_ID } from "./services/orgConfig";

export type AuthedRequest = http.IncomingMessage & { user?: TokenPayload | null };

export function isAuthOptional(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.AUTH_OPTIONAL !== "false";
}

export function getAuthUser(req: AuthedRequest): TokenPayload | null {
  if (req.user !== undefined) return req.user;

  const token = extractToken(req.headers["authorization"] as string | undefined);
  if (token) {
    const decoded = decodeToken(token);
    req.user = decoded;
    return decoded;
  }

  if (process.env.DEV_IDENTITY_ENABLED === "true") {
    const role = req.headers["x-dev-role"];
    if (typeof role === "string" && role.trim()) {
      const user = {
        userId: (req.headers["x-dev-user-id"] as string) || "dev-user",
        orgId: (req.headers["x-dev-org-id"] as string) || DEFAULT_ORG_ID,
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

export function getOrgIdForRequest(req: AuthedRequest): string {
  const user = getAuthUser(req);
  if (user?.orgId) return user.orgId;
  return process.env.DEV_ORG_ID || DEFAULT_ORG_ID;
}

function sendAuthError(res: http.ServerResponse, status: 401 | 403, code: "UNAUTHORIZED" | "FORBIDDEN") {
  return sendJson(res, status, { error: code });
}

export function requireRole(
  req: AuthedRequest,
  res: http.ServerResponse,
  role: string
): TokenPayload | null {
  const user = getAuthUser(req);
  if (!user) {
    sendAuthError(res, 401, "UNAUTHORIZED");
    return null;
  }
  if (user.role !== role) {
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
  if (isAuthOptional()) return true;
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