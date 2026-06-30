/**
 * GET /health + /readyz Contract Test (T-03)
 *
 * Two distinct probes (split so the deploy health check never gates on the DB):
 *   - /health + /healthz — LIVENESS: reachable WITHOUT auth, 200 as soon as the
 *     HTTP server is up, NO DB dependency. Shape: status:"ok", shuttingDown:false,
 *     uptimeSeconds, version. (503 + status:"shutting_down" while draining.)
 *   - /readyz — READINESS: includes the DB check. Shape: status:"ready",
 *     db:"connected", dbLatencyMs, checkedInMs, uptimeSeconds, shuttingDown.
 *
 * Port: 3271 (unique)
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from "child_process";
import { startTestServer, stopTestServer } from "./testHelpers";

const PORT = 3271;

function get(pathName: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: PORT, path: pathName, method: "GET" },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode || 0, data: data ? JSON.parse(data) : null });
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("GET /health (T-03 contract)", () => {
  let serverProc: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    serverProc = await startTestServer(PORT);
  }, 30_000);

  afterAll(async () => {
    await stopTestServer(serverProc);
  });

  it("/health returns 200 + liveness shape WITHOUT auth header (no DB dependency)", async () => {
    const { status, data } = await get("/health");

    expect(status).toBe(200);
    expect(data).toMatchObject({
      status: "ok",
      shuttingDown: false,
    });
    expect(typeof data.uptimeSeconds).toBe("number");
    expect(typeof data.version).toBe("string");
    // Liveness is DB-independent — the db/latency fields live on /readyz, not here.
    expect(data.db).toBeUndefined();
  });

  it("/healthz alias also works", async () => {
    const { status, data } = await get("/healthz");
    expect(status).toBe(200);
    expect(data.status).toBe("ok");
  });

  it("/readyz returns 200 + readiness shape incl. DB check when DB is up", async () => {
    const { status, data } = await get("/readyz");
    expect(status).toBe(200);
    expect(data).toMatchObject({
      status: "ready",
      db: "connected",
      shuttingDown: false,
    });
    expect(typeof data.uptimeSeconds).toBe("number");
    expect(typeof data.checkedInMs).toBe("number");
    expect(data.dbLatencyMs === null || typeof data.dbLatencyMs === "number").toBe(true);
  });

  it("rejects non-GET methods via standard 404 (not registered for POST)", async () => {
    const result = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: PORT, path: "/health", method: "POST" },
        (res) => resolve(res.statusCode || 0),
      );
      req.on("error", reject);
      req.end();
    });
    // POST falls through health early-return → org resolution → 401
    // (no auth header). Either 401 or 404 is acceptable; the key invariant
    // is that the inline /health handler only intercepts GET.
    expect([401, 404]).toContain(result);
  });
});
