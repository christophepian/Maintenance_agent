/**
 * Integration tests for Tenant Maintenance Attachment Upload.
 *
 * Covers:
 *   - POST /tenant-portal/maintenance-attachments/:requestId → 201 (tenant uploads to own request)
 *   - POST → 403 (tenant uploads to another tenant's request)
 *   - POST → 404 (non-existent request)
 *   - GET  /tenant-portal/maintenance-attachments/:requestId → 200 (list own)
 *   - GET  → 403 (list another tenant's request)
 *   - GET  /tenant-portal/maintenance-attachments/:id/download → 200 (binary download)
 */

// Must be set BEFORE importing auth modules.
process.env.AUTH_SECRET = "test-secret";

import * as http from "http";
import { ChildProcessWithoutNullStreams } from 'child_process';
import { createManagerToken, getAuthHeaders, startTestServer, stopTestServer } from "./testHelpers";
import { encodeToken } from "../services/auth";

/** Create a tenant JWT with tenantId claim. */
function createTenantPortalToken(tenantId: string, orgId = "default-org"): string {
  return encodeToken({
    userId: tenantId,
    orgId,
    email: "attach-tenant@test.ch",
    role: "TENANT",
    tenantId,
  } as any);
}

const PORT = 3213;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/* ── HTTP helpers ──────────────────────────────────────────── */

function apiRequest(
  method: string,
  urlPath: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; data: any; rawBuffer?: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const payload = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      ...(payload ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    };
    const req = http.request(url, { method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks);
        try {
          resolve({ status: res.statusCode!, data: JSON.parse(raw.toString()), rawBuffer: raw });
        } catch {
          resolve({ status: res.statusCode!, data: raw.toString(), rawBuffer: raw });
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Send a multipart/form-data upload request with a single file field.
 */
function multipartUpload(
  urlPath: string,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const boundary = "----TestBoundary" + Date.now();
    const url = new URL(urlPath, BASE_URL);

    const preamble = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
    );
    const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([preamble, fileBuffer, epilogue]);

    const headers: Record<string, string> = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length),
      ...extraHeaders,
    };

    const req = http.request(url, { method: "POST", headers }, (res) => {
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
    req.write(body);
    req.end();
  });
}

/* ── Tests ─────────────────────────────────────────────────── */

describe("Tenant Maintenance Attachments API", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  let requestId: string;
  let tenantId: string;

  const managerToken = createManagerToken();
  const managerAuth = getAuthHeaders(managerToken);

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });

    // 1. Create building → unit
    const bRes = await apiRequest("POST", "/buildings", {
      name: "Tenant Attach Test Building",
      address: "10 Attach Lane",
    });
    expect(bRes.status).toBe(201);
    const buildingId = bRes.data.data.id;

    const uRes = await apiRequest("POST", `/buildings/${buildingId}/units`, {
      unitNumber: "TA-01",
      type: "RESIDENTIAL",
    });
    expect(uRes.status).toBe(201);
    const unitId = uRes.data.data.id;

    // 2. Create tenant
    const tRes = await apiRequest("POST", "/tenants", {
      name: "Attach Test Tenant",
      phone: "+41790000088",
      email: "attach-tenant@test.ch",
    });
    expect(tRes.status).toBe(200);
    tenantId = tRes.data.data.id;

    // 3. Create request assigned to that tenant
    const rRes = await apiRequest("POST", "/requests", {
      description: "Broken lock for tenant-attach test",
      category: "bathroom",
      unitId,
      tenantId,
    });
    expect(rRes.status).toBe(201);
    requestId = rRes.data.data.id;
  }, 25000);

  afterAll(() => stopTestServer(proc));

  it("GET /tenant-portal/maintenance-attachments/:requestId → 200 empty list", async () => {
    const tenantToken = createTenantPortalToken(tenantId);
    const tenantAuth = getAuthHeaders(tenantToken);

    const res = await apiRequest(
      "GET",
      `/tenant-portal/maintenance-attachments/${requestId}`,
      undefined,
      tenantAuth,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.data)).toBe(true);
    expect(res.data.data).toHaveLength(0);
  });

  it("POST /tenant-portal/maintenance-attachments/:requestId → 201 on valid upload", async () => {
    const tenantToken = createTenantPortalToken(tenantId);
    const tenantAuth = getAuthHeaders(tenantToken);
    const fakeImage = Buffer.from("fake-tenant-photo-data");

    const res = await multipartUpload(
      `/tenant-portal/maintenance-attachments/${requestId}`,
      "tenant-photo.jpg",
      "image/jpeg",
      fakeImage,
      tenantAuth,
    );
    expect(res.status).toBe(201);
    expect(res.data.data).toMatchObject({
      requestId,
      filename: "tenant-photo.jpg",
      mimeType: "image/jpeg",
    });
    expect(res.data.data.id).toBeDefined();
    expect(res.data.data.url).toContain("/download");
  });

  it("GET /tenant-portal/maintenance-attachments/:requestId → uploaded attachment appears", async () => {
    const tenantToken = createTenantPortalToken(tenantId);
    const tenantAuth = getAuthHeaders(tenantToken);

    const res = await apiRequest(
      "GET",
      `/tenant-portal/maintenance-attachments/${requestId}`,
      undefined,
      tenantAuth,
    );
    expect(res.status).toBe(200);
    expect(res.data.data).toHaveLength(1);
    expect(res.data.data[0].filename).toBe("tenant-photo.jpg");
  });

  it("GET /tenant-portal/maintenance-attachments/:id/download → returns file binary", async () => {
    const tenantToken = createTenantPortalToken(tenantId);
    const tenantAuth = getAuthHeaders(tenantToken);

    // Get attachment id from list
    const listRes = await apiRequest(
      "GET",
      `/tenant-portal/maintenance-attachments/${requestId}`,
      undefined,
      tenantAuth,
    );
    const attachmentId = listRes.data.data[0].id;

    const dlRes = await apiRequest(
      "GET",
      `/tenant-portal/maintenance-attachments/${attachmentId}/download`,
      undefined,
      tenantAuth,
    );
    expect(dlRes.status).toBe(200);
    expect(dlRes.rawBuffer?.toString()).toBe("fake-tenant-photo-data");
  });

  it("POST → 403 when tenant uploads to another tenant's request", async () => {
    // Create a token for a different tenant
    const otherTenantToken = createTenantPortalToken("other-tenant-id-9999");
    const otherAuth = getAuthHeaders(otherTenantToken);
    const fakeImage = Buffer.from("forbidden-upload");

    const res = await multipartUpload(
      `/tenant-portal/maintenance-attachments/${requestId}`,
      "not-mine.png",
      "image/png",
      fakeImage,
      otherAuth,
    );
    expect(res.status).toBe(403);
  });

  it("GET → 403 when tenant lists another tenant's request", async () => {
    const otherTenantToken = createTenantPortalToken("other-tenant-id-9999");
    const otherAuth = getAuthHeaders(otherTenantToken);

    const res = await apiRequest(
      "GET",
      `/tenant-portal/maintenance-attachments/${requestId}`,
      undefined,
      otherAuth,
    );
    expect(res.status).toBe(403);
  });

  it("POST → 404 for non-existent request", async () => {
    const tenantToken = createTenantPortalToken(tenantId);
    const tenantAuth = getAuthHeaders(tenantToken);
    const fakeImage = Buffer.from("test");

    const res = await multipartUpload(
      "/tenant-portal/maintenance-attachments/00000000-0000-0000-0000-000000000000",
      "missing.png",
      "image/png",
      fakeImage,
      tenantAuth,
    );
    expect(res.status).toBe(404);
  });

  it("GET download → 403 when tenant downloads another tenant's attachment", async () => {
    const tenantToken = createTenantPortalToken(tenantId);
    const tenantAuth = getAuthHeaders(tenantToken);

    // Get attachment id (uploaded by our tenant)
    const listRes = await apiRequest(
      "GET",
      `/tenant-portal/maintenance-attachments/${requestId}`,
      undefined,
      tenantAuth,
    );
    const attachmentId = listRes.data.data[0].id;

    // Now try downloading with a different tenant token
    const otherTenantToken = createTenantPortalToken("other-tenant-id-9999");
    const otherAuth = getAuthHeaders(otherTenantToken);

    const dlRes = await apiRequest(
      "GET",
      `/tenant-portal/maintenance-attachments/${attachmentId}/download`,
      undefined,
      otherAuth,
    );
    expect(dlRes.status).toBe(403);
  });
});
