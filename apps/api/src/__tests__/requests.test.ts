import * as http from "http";
import { ChildProcessWithoutNullStreams } from 'child_process';
import { createManagerToken, getAuthHeaders, startTestServer, stopTestServer } from "./testHelpers";

const PORT = 3201;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Helper for promise-based HTTP requests
function apiRequest(
  method: string,
  urlPath: string,
  body?: unknown,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const payload = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      ...(payload ? { "Content-Type": "application/json" } : {}),
    };
    const req = http.request(url, { method, headers }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode!, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode!, data: raw }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe("Requests API Integration Tests", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  let unitId: string;

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });

    // Create a building + unit for request creation tests
    const bRes = await apiRequest("POST", "/buildings", {
      name: "Requests Test Building",
      address: "1 Request Test Ave",
    });
    const buildingId = bRes.data.data.id;
    const uRes = await apiRequest("POST", `/buildings/${buildingId}/units`, {
      unitNumber: "RT-01",
      type: "RESIDENTIAL",
    });
    unitId = uRes.data.data.id;
  }, 20000);

  afterAll(() => stopTestServer(proc));

  it("should fetch requests list (GET /requests)", (done) => {
    http.get(`${BASE_URL}/requests`, (res) => {
      expect(res.statusCode).toBe(200);
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        expect(() => JSON.parse(data)).not.toThrow();
        const parsed = JSON.parse(data);
        expect(parsed).toHaveProperty('data');
        expect(Array.isArray(parsed.data)).toBe(true);
        done();
      });
    }).on("error", (err) => {
      console.error("Connection error (server may not be running):", err.message);
      done(err);
    });
  }, 10000);

  it("should return org config (GET /org-config)", (done) => {
    const token = createManagerToken();
    const headers = getAuthHeaders(token);
    
    const req = http.get(`${BASE_URL}/org-config`, { headers }, (res) => {
      expect(res.statusCode).toBe(200);
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        expect(() => JSON.parse(data)).not.toThrow();
        const parsed = JSON.parse(data);
        expect(parsed).toHaveProperty('data');
        expect(parsed.data).toHaveProperty('autoApproveLimit');
        done();
      });
    });
    req.on("error", (err) => {
      console.error("Connection error (server may not be running):", err.message);
      done(err);
    });
  }, 10000);

  it("should list contractors (GET /contractors)", (done) => {
    http.get(`${BASE_URL}/contractors`, (res) => {
      expect(res.statusCode).toBe(200);
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        expect(() => JSON.parse(data)).not.toThrow();
        const parsed = JSON.parse(data);
        expect(parsed).toHaveProperty('data');
        expect(Array.isArray(parsed.data)).toBe(true);
        done();
      });
    }).on("error", (err) => {
      console.error("Connection error (server may not be running):", err.message);
      done(err);
    });
  }, 10000);

  it("should create request without estimatedCost (POST /requests)", (done) => {
    const payload = JSON.stringify({
      description: "Oven is overheating and smells hot",
      category: "oven",
      unitId,
    });

    const req = http.request(
      `${BASE_URL}/requests`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => {
        let data = '';
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          expect(res.statusCode).toBe(201);
          expect(() => JSON.parse(data)).not.toThrow();
          const parsed = JSON.parse(data);
          expect(parsed).toHaveProperty('data');
          expect(parsed.data).toHaveProperty('status');
          // After legal routing, status may be PENDING_REVIEW, PENDING_OWNER_APPROVAL, or RFP_PENDING
          expect([
            'PENDING_REVIEW',
            'PENDING_OWNER_APPROVAL',
            'RFP_PENDING',
          ]).toContain(parsed.data.status);
          done();
        });
      }
    );

    req.on("error", (err) => {
      console.error("Connection error (server may not be running):", err.message);
      done(err);
    });

    req.write(payload);
    req.end();
  }, 10000);
});

