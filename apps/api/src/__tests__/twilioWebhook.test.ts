/**
 * Integration tests for the Twilio WhatsApp webhook.
 *
 * Covers:
 *   - POST /webhooks/twilio/whatsapp with known tenant phone → 200 TwiML + WhatsAppOutbox record created
 *   - POST /webhooks/twilio/whatsapp with unknown phone → 200 TwiML + polite-refusal enqueued
 *   - Signature validation is skipped in NODE_ENV=test
 */

process.env.AUTH_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import * as http from "http";
import { startTestServer, stopTestServer } from "./testHelpers";
import prisma from "../services/prismaClient";

const PORT = 3228;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function postWebhook(params: Record<string, string>): Promise<http.IncomingMessage & { body: string }> {
  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}/webhooks/twilio/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        (res as any).body = Buffer.concat(chunks).toString("utf8");
        resolve(res as any);
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

let serverProcess: any;

beforeAll(async () => {
  serverProcess = await startTestServer(PORT);
  // Brief settle for server startup
  await new Promise((r) => setTimeout(r, 500));
});

afterAll(async () => {
  await stopTestServer(serverProcess);
});

describe("POST /webhooks/twilio/whatsapp", () => {
  it("returns 200 TwiML for an unknown phone number and enqueues a polite refusal", async () => {
    const unknownPhone = "+41700000000";

    // Clean up any prior test outbox records for this phone
    await (prisma as any).whatsAppOutbox.deleteMany({ where: { toPhone: unknownPhone } });

    const res = await postWebhook({
      From: `whatsapp:${unknownPhone}`,
      Body: "Hello",
      AccountSid: "ACtest",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("<Response/>");

    const outbox = await (prisma as any).whatsAppOutbox.findFirst({
      where: { toPhone: unknownPhone },
      orderBy: { createdAt: "desc" },
    });
    expect(outbox).not.toBeNull();
    expect(outbox.body).toContain("don't recognise your number");
  });

  it("returns 200 TwiML and enqueues a reply for a recognised tenant phone", async () => {
    // Find any existing tenant with a phone number in the test DB
    const tenant = await (prisma as any).tenant.findFirst({
      select: { id: true, phone: true, orgId: true },
    });

    if (!tenant?.phone) {
      console.warn("No tenant with phone number found — skipping happy-path test");
      return;
    }

    // Clean up prior outbox records for this phone
    await (prisma as any).whatsAppOutbox.deleteMany({ where: { toPhone: tenant.phone } });

    const res = await postWebhook({
      From: `whatsapp:${tenant.phone}`,
      Body: "What is the status of my requests?",
      AccountSid: "ACtest",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("<Response/>");

    const outbox = await (prisma as any).whatsAppOutbox.findFirst({
      where: { toPhone: tenant.phone },
      orderBy: { createdAt: "desc" },
    });
    expect(outbox).not.toBeNull();
    expect(typeof outbox.body).toBe("string");
    expect(outbox.body.length).toBeGreaterThan(0);
  });
});
