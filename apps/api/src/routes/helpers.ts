import * as http from "http";
import { PrismaClient, OrgMode } from "@prisma/client";
import { sendJson, sendError } from "../http/json";
import { getAuthUser, isAuthOptional, AuthedRequest } from "../authz";

// ───────────── Auth / Access Helpers ─────────────

export function requireOrgViewer(req: AuthedRequest, res: http.ServerResponse): boolean {
  if (isAuthOptional()) return true;
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "UNAUTHORIZED" });
    return false;
  }
  if (user.role !== "MANAGER" && user.role !== "OWNER") {
    sendJson(res, 403, { error: "FORBIDDEN" });
    return false;
  }
  return true;
}

export function requireGovernanceAccess(
  req: AuthedRequest,
  res: http.ServerResponse,
  orgMode: OrgMode
): boolean {
  if (isAuthOptional()) return true;
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "UNAUTHORIZED" });
    return false;
  }
  if (orgMode === "OWNER_DIRECT") {
    if (user.role !== "OWNER") {
      sendJson(res, 403, { error: "FORBIDDEN" });
      return false;
    }
    return true;
  }
  if (user.role !== "MANAGER" && user.role !== "OWNER") {
    sendJson(res, 403, { error: "FORBIDDEN" });
    return false;
  }
  return true;
}

export function requireOwnerAccess(req: AuthedRequest, res: http.ServerResponse): boolean {
  if (isAuthOptional()) return true;
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "UNAUTHORIZED" });
    return false;
  }
  if (user.role !== "OWNER") {
    sendJson(res, 403, { error: "FORBIDDEN" });
    return false;
  }
  return true;
}

export function safeSendError(res: http.ServerResponse, status: number, code: string, message: string, detail?: string) {
  if (res.headersSent) {
    res.end();
  } else {
    sendError(res, status, code, message, detail);
  }
}

// ───────────── Event log helper ─────────────

export async function logEvent(
  prisma: PrismaClient,
  { orgId, type, actorUserId, requestId, payload }: {
    orgId: string;
    type: string;
    actorUserId?: string;
    requestId?: string;
    payload?: any;
  }
) {
  await (prisma as any).event.create({
    data: {
      orgId,
      type,
      actorUserId: actorUserId || null,
      requestId: requestId || null,
      payload: payload ? JSON.stringify(payload) : "{}",
    },
  });
  console.log("[EVENT]", type, { orgId, actorUserId, requestId, payload });
}
