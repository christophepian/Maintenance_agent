/**
 * Tenant Conversation Routes
 *
 * Provides an alternative AI-powered intake path alongside the existing
 * structured maintenance request form. Does not replace the form.
 *
 * POST /tenant/conversation      — send a message, get a reply
 * GET  /tenant/conversation/history — fetch the last 20 messages
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { requireTenantSession, AuthedRequest } from "../authz";
import { processTurnWorkflow } from "../workflows/conversationWorkflow";
import { getThreadHistory } from "../repositories/conversationRepository";
import { PrismaClient } from "@prisma/client";

/**
 * Resolve the internal Tenant.id for a conversation session.
 *
 * `requireTenantSession` returns either:
 *   a) an explicit tenantId from app_metadata  → already correct
 *   b) the Supabase userId (sub UUID)           → need to look up by email
 *
 * This makes chat work for real TENANT Supabase accounts that never had an
 * explicit tenantId set in app_metadata.
 */
async function resolveConversationTenantId(
  prisma: PrismaClient,
  rawTenantId: string,
  orgId: string,
  email: string | undefined
): Promise<string | null> {
  // Fast path: check whether rawTenantId is an existing Tenant record id
  const byId = await prisma.tenant.findFirst({ where: { id: rawTenantId, orgId }, select: { id: true } });
  if (byId) return byId.id;

  // Fallback: resolve by email (raw value is a Supabase sub UUID)
  if (email) {
    const byEmail = await prisma.tenant.findFirst({ where: { email, orgId }, select: { id: true } });
    if (byEmail) return byEmail.id;
  }

  // Still nothing — return the raw value so upstream gets the original 404/empty behaviour
  return rawTenantId;
}

export function registerTenantConversationRoutes(router: Router) {
  // POST /tenant/conversation
  router.post("/tenant/conversation", async ({ req, res, orgId, prisma }) => {
    const rawTenantId = requireTenantSession(req, res);
    if (!rawTenantId) return;

    const email = (req as AuthedRequest).user?.email;
    const tenantId = await resolveConversationTenantId(prisma, rawTenantId, orgId, email);

    let body: { message?: unknown };
    try {
      body = await readJson(req);
    } catch {
      return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
    }

    const messageText = typeof body.message === "string" ? body.message.trim() : "";
    if (!messageText) {
      return sendError(res, 400, "VALIDATION_ERROR", "message is required");
    }
    if (messageText.length > 2000) {
      return sendError(res, 400, "VALIDATION_ERROR", "message must be 2000 characters or fewer");
    }

    try {
      const result = await processTurnWorkflow(
        { orgId, prisma, actorUserId: null },
        { tenantId, channel: "IN_APP", messageText }
      );
      return sendJson(res, 200, { data: { replyText: result.replyText, intent: result.intent } });
    } catch (err: any) {
      console.error("[tenantConversation] processTurnWorkflow error:", err);
      return sendError(res, 500, "CONVERSATION_ERROR", "Failed to process message");
    }
  });

  // GET /tenant/conversation/history
  router.get("/tenant/conversation/history", async ({ req, res, orgId, prisma }) => {
    const rawTenantId = requireTenantSession(req, res);
    if (!rawTenantId) return;

    const email = (req as AuthedRequest).user?.email;
    const tenantId = await resolveConversationTenantId(prisma, rawTenantId, orgId, email);

    try {
      const messages = await getThreadHistory(prisma, tenantId, "IN_APP");
      return sendJson(res, 200, { data: messages });
    } catch (err: any) {
      console.error("[tenantConversation] getThreadHistory error:", err);
      return sendError(res, 500, "DB_ERROR", "Failed to fetch conversation history");
    }
  });
}
