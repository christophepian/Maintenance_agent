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
import { getThreadHistory, resolveConversationTenantId } from "../repositories/conversationRepository";

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
