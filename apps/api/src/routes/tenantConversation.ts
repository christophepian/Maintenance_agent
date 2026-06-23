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
import { getThreadHistory, resolveConversationTenantId, clearStaleThreadMessages } from "../repositories/conversationRepository";
import { checkRateLimit } from "../http/rateLimiter";

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

// Slice 3: rate limiter for POST /tenant/conversation (keyed by tenantId).
// AI turns are expensive (Claude calls) — cap each tenant at 20 messages/minute.
// Via shared apps/api/src/http/rateLimiter.ts (see its Redis note re: multi-instance).
const CONVERSATION_RATE_LIMIT = 20;
const CONVERSATION_RATE_WINDOW_MS = 60_000;

function checkConversationRateLimit(tenantId: string): boolean {
  return checkRateLimit("tenantConversation", tenantId, CONVERSATION_RATE_LIMIT, CONVERSATION_RATE_WINDOW_MS);
}

export function registerTenantConversationRoutes(router: Router) {
  // POST /tenant/conversation
  router.post("/tenant/conversation", async ({ req, res, orgId, prisma }) => {
    const rawTenantId = requireTenantSession(req, res);
    if (!rawTenantId) return;

    // Slice 3: rate limit per tenant before any expensive AI work
    if (!checkConversationRateLimit(rawTenantId)) {
      return sendError(res, 429, "RATE_LIMITED", "Too many messages. Please wait a moment and try again.");
    }

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

    // Clear stale thread if last message is older than 24h so context stays fresh
    try {
      await clearStaleThreadMessages(prisma, tenantId, "IN_APP", SESSION_TIMEOUT_MS);
    } catch { /* non-fatal */ }

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
