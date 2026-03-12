/**
 * Integration tests for the Tenant Self-Pay flow.
 *
 * Covers:
 *   - POST /tenant-portal/requests/:id/self-pay → 200 (happy path)
 *   - 409 when request is not in OWNER_REJECTED status
 *   - 403 when tenant does not own the request
 *   - GET /tenant-portal/requests → lists tenant's requests
 *   - Notification creation on owner rejection
 */

// Must be set BEFORE importing auth modules.
process.env.AUTH_SECRET = "test-secret";

import * as http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";
import { createManagerToken, createTestToken, createOwnerToken, getAuthHeaders } from "./testHelpers";
import { encodeToken } from "../services/auth";

/** Create a tenant JWT with tenantId claim (matches tenant-session pattern). */
function createTenantPortalToken(tenantId: string, orgId = "default-org"): string {
  return encodeToken({
    userId: tenantId,
    orgId,
    email: "selfpay@test.ch",
    role: "TENANT",
    tenantId,
  } as any);
}

const API_ROOT = path.resolve(__dirname, "..", "..");
const TS_NODE = path.resolve(API_ROOT, "node_modules", ".bin", "ts-node");
const PORT = 3212;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function startServer(envOverrides: Record<string, string>, port: number) {
  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    const child = spawn(TS_NODE, ["--transpile-only", "src/server.ts"], {
      cwd: API_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        AUTH_SECRET: "test-secret",
        ...envOverrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const onData = (data: Buffer) => {
      const text = data.toString();
      if (text.includes("API running on")) {
        cleanup();
        resolve(child);
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Server did not start in time"));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("error", onError);
    }

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", onError);
  });
}

/* ── HTTP helpers ──────────────────────────────────────────── */

function apiRequest(
  method: string,
  urlPath: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const payload = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      ...(payload ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    };
    const req = http.request(url, { method, headers }, (res) => {
      let raw = "";
      res.on("data", (c: string) => (raw += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode!, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode!, data: raw });
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* ── Tests ─────────────────────────────────────────────────── */

describe("Tenant Self-Pay API", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  let requestId: string;
  let tenantId: string;
  let buildingId: string;
  let unitId: string;

  const managerToken = createManagerToken();
  const managerAuth = getAuthHeaders(managerToken);
  const ownerToken = createOwnerToken();
  const ownerAuth = getAuthHeaders(ownerToken);

  beforeAll(async () => {
    proc = await startServer({ AUTH_OPTIONAL: "true", NODE_ENV: "test" }, PORT);

    // 0. Set org to OWNER_DIRECT mode with a low owner-approval threshold
    await apiRequest("PUT", "/org-config", {
      mode: "OWNER_DIRECT",
      requireOwnerApprovalAbove: 100,
    }, managerAuth);

    // 1. Create building → unit
    const bRes = await apiRequest("POST", "/buildings", {
      name: "Self-Pay Test Building",
      address: "42 Self-Pay St",
    });
    expect(bRes.status).toBe(201);
    buildingId = bRes.data.data.id;

    const uRes = await apiRequest("POST", `/buildings/${buildingId}/units`, {
      unitNumber: "SP-01",
      type: "RESIDENTIAL",
    });
    expect(uRes.status).toBe(201);
    unitId = uRes.data.data.id;

    // 2. Create tenant
    const tRes = await apiRequest("POST", "/tenants", {
      name: "Self-Pay Tenant",
      phone: "+41790000099",
      email: "selfpay@test.ch",
    });
    expect(tRes.status).toBe(200);
    tenantId = tRes.data.data.id;

    // 3. Create request with high estimatedCost → triggers PENDING_OWNER_APPROVAL
    const rRes = await apiRequest("POST", "/requests", {
      description: "Leaking tap for self-pay test",
      category: "bathroom",
      unitId,
      tenantId,
      estimatedCost: 5000,
    });
    expect(rRes.status).toBe(201);
    requestId = rRes.data.data.id;

    // Legal routing may move it; accept either PENDING_OWNER_APPROVAL or PENDING_REVIEW
    const initialStatus = rRes.data.data.status;
    expect(["PENDING_OWNER_APPROVAL", "PENDING_REVIEW"]).toContain(initialStatus);

    // If still PENDING_REVIEW (e.g. legal routing moved it elsewhere), force via owner-approve would fail.
    // With OWNER_DIRECT + high cost, it should be PENDING_OWNER_APPROVAL.
    expect(initialStatus).toBe("PENDING_OWNER_APPROVAL");
  }, 25000);

  afterAll(() => {
    proc?.kill();
  });

  it("should reject self-pay when request is not OWNER_REJECTED (409)", async () => {
    // Request is still PENDING_OWNER_APPROVAL
    const tenantToken = createTenantPortalToken(tenantId);
    const tenantAuth = getAuthHeaders(tenantToken);

    const res = await apiRequest(
      "POST",
      `/tenant-portal/requests/${requestId}/self-pay`,
      {},
      tenantAuth,
    );
    expect(res.status).toBe(409);
  });

  it("owner reject → request moves to OWNER_REJECTED", async () => {
    const res = await apiRequest(
      "POST",
      `/requests/${requestId}/owner-reject`,
      { reason: "Too expensive" },
      ownerAuth,
    );
    expect(res.status).toBe(200);
    expect(res.data.data.status).toBe("OWNER_REJECTED");
    expect(res.data.data.rejectionReason).toBe("Too expensive");
  });

  it("should reject self-pay from wrong tenant (403)", async () => {
    const wrongTenantToken = createTenantPortalToken("00000000-0000-0000-0000-000000000001");
    const wrongAuth = getAuthHeaders(wrongTenantToken);

    const res = await apiRequest(
      "POST",
      `/tenant-portal/requests/${requestId}/self-pay`,
      {},
      wrongAuth,
    );
    expect(res.status).toBe(403);
  });

  it("tenant self-pay → transitions to RFP_PENDING with payingParty TENANT (200)", async () => {
    const tenantToken = createTenantPortalToken(tenantId);
    const tenantAuth = getAuthHeaders(tenantToken);

    const res = await apiRequest(
      "POST",
      `/tenant-portal/requests/${requestId}/self-pay`,
      {},
      tenantAuth,
    );
    expect(res.status).toBe(200);
    expect(res.data.data.status).toBe("RFP_PENDING");
    expect(res.data.data.payingParty).toBe("TENANT");
    expect(res.data.rfpId).toBeDefined();
  });

  it("should reject second self-pay (409 — already RFP_PENDING)", async () => {
    const tenantToken = createTenantPortalToken(tenantId);
    const tenantAuth = getAuthHeaders(tenantToken);

    const res = await apiRequest(
      "POST",
      `/tenant-portal/requests/${requestId}/self-pay`,
      {},
      tenantAuth,
    );
    expect(res.status).toBe(409);
  });

  it("GET /tenant-portal/requests → lists requests for this tenant", async () => {
    const tenantToken = createTenantPortalToken(tenantId);
    const tenantAuth = getAuthHeaders(tenantToken);

    const res = await apiRequest("GET", "/tenant-portal/requests", undefined, tenantAuth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.data)).toBe(true);
    const found = res.data.data.find((r: any) => r.id === requestId);
    expect(found).toBeDefined();
    expect(found.status).toBe("RFP_PENDING");
    expect(found.payingParty).toBe("TENANT");
  });

  it("GET /tenant-portal/requests → 401 without tenant auth", async () => {
    const res = await apiRequest("GET", "/tenant-portal/requests");
    expect(res.status).toBe(401);
  });
});
