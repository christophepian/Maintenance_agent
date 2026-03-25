/**
 * Security Hardening Slice 2 — Tests for SA-10 through SA-20
 *
 * Spawns a real server with AUTH_OPTIONAL=false and verifies that
 * the hardened routes reject unauthenticated / wrong-role requests.
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from 'child_process';
import { startTestServer, stopTestServer } from './testHelpers';

process.env.AUTH_SECRET = "test-secret";
const { encodeToken } = require("../services/auth");


/* ── Server helpers ─────────────────────────────────────────── */

function httpRequest(
  port: number,
  method: string,
  pathName: string,
  body?: object | string,
  token?: string,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path: pathName,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 500, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode || 500, data: { raw: data } });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

/* ── Tokens ──────────────────────────────────────────────────── */

const managerToken = encodeToken({
  userId: "mgr-user",
  orgId: "default-org",
  email: "mgr@example.com",
  role: "MANAGER",
});

const contractorToken = encodeToken({
  userId: "ctr-user",
  orgId: "default-org",
  email: "ctr@example.com",
  role: "CONTRACTOR",
});

/* ── Tests ───────────────────────────────────────────────────── */

describe("Security Hardening Slice 2 (SA-10 → SA-20)", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  const port = 3220;

  beforeAll(async () => {
    proc = await startTestServer(port, { AUTH_OPTIONAL: "false", NODE_ENV: "test" });
  }, 20000);

  afterAll(() => stopTestServer(proc));

  /* SA-12: POST /requests with no auth → 401 */
  it("SA-12: POST /requests without auth returns 401", async () => {
    const result = await httpRequest(port, "POST", "/requests", {
      description: "Broken pipe in kitchen",
      category: "plumbing",
    });
    expect(result.status).toBe(401);
  }, 10000);

  /* SA-13: GET /requests/:id/suggest-contractor with no auth → 401 */
  it("SA-13: GET /requests/:id/suggest-contractor without auth returns 401", async () => {
    const result = await httpRequest(
      port,
      "GET",
      "/requests/00000000-0000-0000-0000-000000000000/suggest-contractor",
    );
    expect(result.status).toBe(401);
  }, 10000);

  /* SA-14: DELETE /__dev/requests with CONTRACTOR token → 403 */
  it("SA-14: DELETE /__dev/requests with CONTRACTOR token returns 403", async () => {
    const result = await httpRequest(
      port,
      "DELETE",
      "/__dev/requests",
      undefined,
      contractorToken,
    );
    expect(result.status).toBe(403);
  }, 10000);

  /* SA-15: POST /document-scan is public (apply wizard) — no auth required.
     Without a multipart body the endpoint returns 400 BAD_REQUEST. */
  it("SA-15: POST /document-scan without body returns 400", async () => {
    const result = await httpRequest(port, "POST", "/document-scan", "test");
    expect(result.status).toBe(400);
  }, 10000);

  /* SA-18: POST /triage rate limit → 11th call returns 429 */
  it("SA-18: POST /triage rate limit — 11th call returns 429", async () => {
    const body = { message: "my oven is broken" };
    let lastStatus = 0;

    // Send 11 requests — first 10 should succeed (or 400/500), 11th should be 429
    for (let i = 0; i < 11; i++) {
      const result = await httpRequest(port, "POST", "/triage", body);
      lastStatus = result.status;
      if (result.status === 429) {
        // Rate limited before the 11th — that's fine, the limit is working
        expect(i).toBeGreaterThanOrEqual(10);
        return;
      }
    }

    // The 11th request should have been rate-limited
    expect(lastStatus).toBe(429);
  }, 30000);
});
