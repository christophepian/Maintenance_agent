// Align test-process and server-process secrets so JWTs decode correctly.
// Must be set BEFORE importing auth modules.
process.env.AUTH_SECRET = "test-secret";

import * as http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";
import { createManagerToken, createTestToken, getAuthHeaders } from "./testHelpers";

const API_ROOT = path.resolve(__dirname, "..", "..");
const TS_NODE = path.resolve(API_ROOT, "node_modules", ".bin", "ts-node");
const PORT = 3211;
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
      res.on("data", (c) => (raw += c));
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

describe("Maintenance Attachments API", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  let requestId: string;
  const token = createManagerToken();
  const authHeaders = getAuthHeaders(token);

  beforeAll(async () => {
    proc = await startServer({ AUTH_OPTIONAL: "true", NODE_ENV: "test" }, PORT);

    // Create building → unit → request for attachment tests
    const bRes = await apiRequest("POST", "/buildings", {
      name: "Attach Test Building",
      address: "1 Attach Ave",
    });
    expect(bRes.status).toBe(201);
    const buildingId = bRes.data.data.id;

    const uRes = await apiRequest("POST", `/buildings/${buildingId}/units`, {
      unitNumber: "AT-01",
      type: "RESIDENTIAL",
    });
    expect(uRes.status).toBe(201);
    const unitId = uRes.data.data.id;

    const rRes = await apiRequest("POST", "/requests", {
      description: "Broken window for attachment test",
      unitId,
      category: "bathroom",
    });
    expect(rRes.status).toBe(201);
    requestId = rRes.data.data.id;
  }, 25000);

  afterAll(() => {
    proc?.kill();
  });

  it("GET /maintenance-attachments/:requestId → 200 with empty array", async () => {
    const res = await apiRequest("GET", `/maintenance-attachments/${requestId}`);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("data");
    expect(Array.isArray(res.data.data)).toBe(true);
    expect(res.data.data).toHaveLength(0);
  });

  it("POST /maintenance-attachments/:requestId → 201 on valid upload", async () => {
    const fakeImage = Buffer.from("fake-png-content-for-testing");
    const res = await multipartUpload(
      `/maintenance-attachments/${requestId}`,
      "test-photo.png",
      "image/png",
      fakeImage,
    );
    expect(res.status).toBe(201);
    expect(res.data.data).toMatchObject({
      requestId,
      filename: "test-photo.png",
      mimeType: "image/png",
    });
    expect(res.data.data.id).toBeDefined();
    expect(res.data.data.url).toContain("/download");
  });

  it("GET /maintenance-attachments/:requestId → uploaded attachment appears", async () => {
    const res = await apiRequest("GET", `/maintenance-attachments/${requestId}`);
    expect(res.status).toBe(200);
    expect(res.data.data).toHaveLength(1);
    expect(res.data.data[0].filename).toBe("test-photo.png");
  });

  it("GET /maintenance-attachments/:id/download → returns file binary", async () => {
    const listRes = await apiRequest("GET", `/maintenance-attachments/${requestId}`);
    const attachmentId = listRes.data.data[0].id;
    const dlRes = await apiRequest("GET", `/maintenance-attachments/${attachmentId}/download`);
    expect(dlRes.status).toBe(200);
    // The raw content should match what we uploaded
    expect(dlRes.rawBuffer?.toString()).toBe("fake-png-content-for-testing");
  });

  it("POST /maintenance-attachments/:badId → 404 for non-existent request", async () => {
    const fakeImage = Buffer.from("test");
    const res = await multipartUpload(
      "/maintenance-attachments/00000000-0000-0000-0000-000000000000",
      "test.png",
      "image/png",
      fakeImage,
    );
    expect(res.status).toBe(404);
  });

  it("GET /maintenance-attachments/:requestId → 403 for cross-org", async () => {
    const otherOrgToken = createTestToken({ orgId: "other-org-id", role: "MANAGER" });
    const res = await apiRequest(
      "GET",
      `/maintenance-attachments/${requestId}`,
      undefined,
      getAuthHeaders(otherOrgToken),
    );
    expect(res.status).toBe(403);
  });
});
