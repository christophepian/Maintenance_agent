import * as http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { computeEffectiveConfig } from "../services/buildingConfig";
import { DEFAULT_ORG_ID } from "../services/orgConfig";
import { createManagerToken, getAuthHeaders } from "./testHelpers";

const API_ROOT = path.resolve(__dirname, "..", "..");
const TS_NODE = path.resolve(API_ROOT, "node_modules", ".bin", "ts-node");
const PORT = 3203;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const prisma = new PrismaClient();

function startServer(envOverrides: Record<string, string>, port: number) {
  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    const child = spawn(TS_NODE, ["src/server.ts"], {
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
    }, 20000);

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

function httpRequest(method: string, path: string, body?: object): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const token = createManagerToken();
    const authHeaders = getAuthHeaders(token);
    
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 
        "Content-Type": "application/json",
        ...authHeaders,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, data: { error: "Parse error" } });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe("Owner-direct foundations", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  let buildingId: string;

  beforeAll(async () => {
    proc = await startServer({ AUTH_OPTIONAL: "true", NODE_ENV: "test" }, PORT);
    // Reset org mode to MANAGED
    await httpRequest("PUT", "/org-config", { mode: "MANAGED" });
  }, 30000);

  afterAll(() => {
    proc?.kill();
  });

  it("returns org mode default as MANAGED", async () => {
    const result = await httpRequest("GET", "/org-config");
    expect(result.status).toBe(200);
    expect(result.data.data).toHaveProperty("mode", "MANAGED");
  }, 10000);

  it("updates org config autoApproveLimit", async () => {
    const result = await httpRequest("PUT", "/org-config", { autoApproveLimit: 250 });
    expect(result.status).toBe(200);
    expect(result.data.data).toHaveProperty("autoApproveLimit", 250);
  }, 10000);

  it("creates building config overrides and computes effective config", async () => {
    const buildingRes = await httpRequest("POST", "/buildings", {
      name: "Owner Direct Building",
      address: "1 Owner Direct Way",
    });
    expect(buildingRes.status).toBe(201);
    buildingId = buildingRes.data.data.id;

    const emptyConfig = await httpRequest("GET", `/buildings/${buildingId}/config`);
    expect(emptyConfig.status).toBe(200);

    const configRes = await httpRequest("PUT", `/buildings/${buildingId}/config`, {
      autoApproveLimit: 300,
      emergencyAutoDispatch: true,
      requireOwnerApprovalAbove: 400,
    });
    expect(configRes.status).toBe(200);
    expect(configRes.data.data).toHaveProperty("autoApproveLimit", 300);
    expect(configRes.data.data).toHaveProperty("emergencyAutoDispatch", true);
    expect(configRes.data.data).toHaveProperty("requireOwnerApprovalAbove", 400);

    const effective = await computeEffectiveConfig(prisma, DEFAULT_ORG_ID, buildingId);
    expect(effective.effectiveAutoApproveLimit).toBe(300);
    expect(effective.effectiveEmergencyAutoDispatch).toBe(true);
    expect(effective.effectiveRequireOwnerApprovalAbove).toBe(400);

    const clearRes = await httpRequest("PUT", `/buildings/${buildingId}/config`, {
      autoApproveLimit: null,
      emergencyAutoDispatch: null,
      requireOwnerApprovalAbove: null,
    });
    expect(clearRes.status).toBe(200);

    const fallback = await computeEffectiveConfig(prisma, DEFAULT_ORG_ID, buildingId);
    expect(fallback.effectiveAutoApproveLimit).toBe(250);
    expect(fallback.effectiveEmergencyAutoDispatch).toBe(false);
    expect(fallback.effectiveRequireOwnerApprovalAbove).toBe(250);
  }, 15000);
});
