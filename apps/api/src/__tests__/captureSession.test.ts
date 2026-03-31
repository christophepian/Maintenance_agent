/**
 * TC-16 · Capture Session Route Integration Tests
 *
 * Covers:
 *   1. POST /capture-sessions — 401 without token, 201 with MANAGER token
 *   2. GET /capture-sessions/:id — 404 for non-existent, 200 for existing
 *   3. GET /capture-sessions/validate/:token — 200 for valid, 400 for garbage
 *   4. POST /capture-sessions/:token/upload — multipart upload
 *   5. POST /capture-sessions/:token/complete — complete session
 *   6. Auth gates: CONTRACTOR/TENANT/OWNER rejected on MANAGER-only endpoints
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from "child_process";
import {
  startTestServer,
  stopTestServer,
  createManagerToken,
  createContractorToken,
  createTenantToken,
  getAuthHeaders,
} from "./testHelpers";

const PORT = 3221;
const BASE_URL = `http://127.0.0.1:${PORT}`;

process.env.AUTH_SECRET = "test-secret";

/* ── HTTP helpers ─────────────────────────────────────────── */

function jsonRequest(
  method: string,
  urlPath: string,
  headers?: Record<string, string>,
  body?: any,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const payload = body ? JSON.stringify(body) : undefined;
    const hdrs: Record<string, string> = {
      ...(payload ? { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(payload)) } : {}),
      ...headers,
    };

    const req = http.request(url, { method, headers: hdrs }, (res) => {
      let raw = "";
      res.on("data", (c: Buffer) => (raw += c));
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
      res.on("data", (c: Buffer) => (raw += c));
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

describe("Capture Session Routes", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  const managerToken = createManagerToken();
  const managerAuth = getAuthHeaders(managerToken);

  beforeAll(async () => {
    proc = await startTestServer(PORT, { NODE_ENV: "test" });
  }, 20_000);

  afterAll(async () => {
    await stopTestServer(proc);
  });

  // ─── 1. Auth gates on POST /capture-sessions ───────────────
  describe("POST /capture-sessions", () => {
    it("returns 401 without Authorization header", async () => {
      const res = await jsonRequest("POST", "/capture-sessions");
      expect([401, 403]).toContain(res.status);
    });

    it("returns 401/403 with CONTRACTOR token", async () => {
      const res = await jsonRequest("POST", "/capture-sessions", getAuthHeaders(createContractorToken()));
      expect([401, 403]).toContain(res.status);
    });

    it("returns 401/403 with TENANT token", async () => {
      const res = await jsonRequest("POST", "/capture-sessions", getAuthHeaders(createTenantToken()));
      expect([401, 403]).toContain(res.status);
    });

    it("creates a session with MANAGER token (201)", async () => {
      const res = await jsonRequest("POST", "/capture-sessions", managerAuth);
      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty("data");
      expect(res.data).toHaveProperty("token");
      expect(res.data).toHaveProperty("mobileUrl");
      expect(res.data.data).toHaveProperty("id");
      expect(res.data.data).toHaveProperty("status");
    });
  });

  // ─── 2. Full lifecycle: create → validate → upload → complete ──
  describe("Capture session lifecycle", () => {
    let sessionId: string;
    let sessionToken: string;

    it("creates a session", async () => {
      const res = await jsonRequest("POST", "/capture-sessions", managerAuth);
      expect(res.status).toBe(201);
      sessionId = res.data.data.id;
      sessionToken = res.data.token;
      expect(sessionId).toBeTruthy();
      expect(sessionToken).toBeTruthy();
    });

    it("polls session status via GET /capture-sessions/:id", async () => {
      const res = await jsonRequest("GET", `/capture-sessions/${sessionId}`, managerAuth);
      expect(res.status).toBe(200);
      expect(res.data.data.id).toBe(sessionId);
      expect(res.data.data.status).toBe("ACTIVE");
    });

    it("returns 404 for non-existent session", async () => {
      const res = await jsonRequest("GET", "/capture-sessions/nonexistent-id", managerAuth);
      expect(res.status).toBe(404);
    });

    it("validates token via GET /capture-sessions/validate/:token", async () => {
      const res = await jsonRequest("GET", `/capture-sessions/validate/${sessionToken}`);
      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty("status");
      expect(res.data.data).toHaveProperty("expiresAt");
    });

    it("returns 400 for garbage token", async () => {
      const res = await jsonRequest("GET", "/capture-sessions/validate/garbage-token-xyz");
      expect(res.status).toBe(400);
    });

    it("uploads a file via POST /capture-sessions/:token/upload", async () => {
      const fakeFile = Buffer.from("fake-pdf-content-for-test");
      const res = await multipartUpload(
        `/capture-sessions/${sessionToken}/upload`,
        "test-invoice.pdf",
        "application/pdf",
        fakeFile,
      );
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("data");
      expect(res.data).toHaveProperty("fileUrl");
    });

    it("returns 400 on upload without file field", async () => {
      const boundary = "----TestBoundary" + Date.now();
      const body = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="notfile"\r\n\r\n` +
        `some text\r\n` +
        `--${boundary}--\r\n`,
      );

      const res = await new Promise<{ status: number; data: any }>((resolve, reject) => {
        const url = new URL(`/capture-sessions/${sessionToken}/upload`, BASE_URL);
        const req = http.request(url, {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": String(body.length),
          },
        }, (r) => {
          let raw = "";
          r.on("data", (c: Buffer) => (raw += c));
          r.on("end", () => {
            try { resolve({ status: r.statusCode!, data: JSON.parse(raw) }); }
            catch { resolve({ status: r.statusCode!, data: raw }); }
          });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
      });
      expect(res.status).toBe(400);
    });

    it("completes session via POST /capture-sessions/:token/complete", async () => {
      const res = await jsonRequest("POST", `/capture-sessions/${sessionToken}/complete`);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("data");
    });

    it("returns 410 on second complete (session already completed)", async () => {
      const res = await jsonRequest("POST", `/capture-sessions/${sessionToken}/complete`);
      expect(res.status).toBe(410);
    });

    it("returns 410 on upload to completed session", async () => {
      const fakeFile = Buffer.from("another-pdf");
      const res = await multipartUpload(
        `/capture-sessions/${sessionToken}/upload`,
        "test2.pdf",
        "application/pdf",
        fakeFile,
      );
      expect(res.status).toBe(410);
    });
  });
});
