import * as http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";

process.env.AUTH_SECRET = "test-secret";
const { encodeToken } = require("../services/auth");

const API_ROOT = path.resolve(__dirname, "..", "..");

function startServer(envOverrides: Record<string, string>, port: number) {
  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    const child = spawn("npx", ["ts-node", "src/server.ts"], {
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

function httpRequest(
  port: number,
  method: string,
  pathName: string,
  body?: object,
  token?: string
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

describe("Owner-direct governance access", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  const port = 3103;

  const managerToken = encodeToken({
    userId: "manager-user",
    orgId: "default-org",
    email: "manager@example.com",
    role: "MANAGER",
  });

  const ownerToken = encodeToken({
    userId: "owner-user",
    orgId: "default-org",
    email: "owner@example.com",
    role: "OWNER",
  });

  beforeAll(async () => {
    proc = await startServer({ AUTH_OPTIONAL: "false", NODE_ENV: "test" }, port);
    // Ensure org mode is MANAGED for test start
    await httpRequest(port, "PUT", "/org-config", { mode: "MANAGED" }, ownerToken);
  }, 20000);

  afterAll(() => {
    proc?.kill();
  });

  it("enforces governance access by org mode", async () => {
    const buildingRes = await httpRequest(
      port,
      "POST",
      "/buildings",
      { name: "Governance Building", address: "1 Governance Way" },
      managerToken
    );
    expect(buildingRes.status).toBe(201);
    const buildingId = buildingRes.data?.data?.id;
    expect(buildingId).toBeTruthy();

    const managedUpdate = await httpRequest(
      port,
      "PUT",
      `/buildings/${buildingId}/config`,
      { autoApproveLimit: 300 },
      managerToken
    );
    expect(managedUpdate.status).toBe(200);

    const managerModeSwitch = await httpRequest(
      port,
      "PUT",
      "/org-config",
      { mode: "OWNER_DIRECT" },
      managerToken
    );
    expect(managerModeSwitch.status).toBe(403);

    const ownerModeSwitch = await httpRequest(
      port,
      "PUT",
      "/org-config",
      { mode: "OWNER_DIRECT" },
      ownerToken
    );
    expect(ownerModeSwitch.status).toBe(200);

    const managerBlocked = await httpRequest(
      port,
      "PUT",
      `/buildings/${buildingId}/config`,
      { autoApproveLimit: 350 },
      managerToken
    );
    expect(managerBlocked.status).toBe(403);

    const ownerUpdate = await httpRequest(
      port,
      "PUT",
      `/buildings/${buildingId}/config`,
      { autoApproveLimit: 350 },
      ownerToken
    );
    expect(ownerUpdate.status).toBe(200);
  }, 20000);
});
