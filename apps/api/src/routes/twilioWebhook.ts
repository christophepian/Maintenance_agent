/**
 * Twilio WhatsApp Webhook
 *
 * Receives inbound WhatsApp messages from Twilio, resolves the tenant by phone
 * number, calls the conversation workflow, and enqueues the reply via WhatsAppOutbox.
 *
 * Auth: Twilio signature validation (X-Twilio-Signature header).
 *       Skipped in NODE_ENV === 'test' to allow simulated test POSTs.
 *
 * Twilio requires a 200 response for all webhook calls — we never return 4xx/5xx.
 */

import * as http from "http";
import { Router } from "../http/router";
import { sendJson } from "../http/json";
import { processTurnWorkflow } from "../workflows/conversationWorkflow";
import { enqueue } from "../repositories/whatsAppOutboxRepository";
import prisma from "../services/prismaClient";
import { DEFAULT_ORG_ID } from "../services/orgConfig";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readRawBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseFormBody(raw: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of raw.split("&")) {
    const [k, v] = pair.split("=").map(decodeURIComponent);
    if (k) params[k] = v ?? "";
  }
  return params;
}

function verifyTwilioSignature(
  req: http.IncomingMessage,
  params: Record<string, string>,
): boolean {
  if (process.env.NODE_ENV !== "production" || process.env.TWILIO_SKIP_SIGNATURE === "true") return true;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[twilioWebhook] TWILIO_AUTH_TOKEN not set — rejecting request");
    return false;
  }

  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!signature) return false;

  // Reconstruct the full URL Twilio called
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const url = `${proto}://${host}/webhooks/twilio/whatsapp`;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require("twilio");
  return twilio.validateRequest(authToken, signature, url, params);
}

async function findTenantByPhone(orgId: string, phone: string) {
  return (prisma as any).tenant.findFirst({
    where: { orgId, phone },
    select: { id: true },
  });
}

// ─── Route ───────────────────────────────────────────────────────────────────

export function registerTwilioWebhookRoutes(router: Router) {
  router.post("/webhooks/twilio/whatsapp", async ({ req, res }) => {
    const raw = await readRawBody(req);
    const params = parseFormBody(raw);

    if (!verifyTwilioSignature(req, params)) {
      // Return 403 only for signature failures — not a Twilio-initiated call
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    // Twilio sends From as "whatsapp:+41791234567" — strip the prefix
    const fromRaw = params.From ?? "";
    const phone = fromRaw.replace(/^whatsapp:/, "");
    const body = params.Body ?? "";

    const orgId = DEFAULT_ORG_ID;

    // Resolve tenant by phone — send a polite refusal if unknown
    const tenant = phone ? await findTenantByPhone(orgId, phone) : null;
    if (!tenant) {
      const notFound =
        "I don't recognise your number. Please contact your property manager to link your WhatsApp number to your account.";
      await enqueue(prisma, orgId, phone, notFound).catch(() => {});
      res.writeHead(200, { "Content-Type": "text/xml" });
      res.end("<Response/>");
      return;
    }

    // Process the conversation turn (same service as in-app chat)
    try {
      const result = await processTurnWorkflow(
        { orgId, prisma, actorUserId: null },
        { tenantId: tenant.id, channel: "WHATSAPP", messageText: body },
      );
      await enqueue(prisma, orgId, phone, result.replyText);
    } catch (err) {
      console.error("[twilioWebhook] processTurnWorkflow error:", err);
      const fallback = "Sorry, I encountered an issue processing your message. Please try again or contact your property manager.";
      await enqueue(prisma, orgId, phone, fallback).catch(() => {});
    }

    // Always return empty TwiML — replies are sent asynchronously via the outbox drain job
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end("<Response/>");
  });
}
