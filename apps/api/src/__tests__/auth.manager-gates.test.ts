import * as http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";

process.env.AUTH_SECRET = "test-secret";
const { encodeToken } = require("../services/auth");

const API_ROOT = path.resolve(__dirname, "..", "..");
const TS_NODE = path.resolve(API_ROOT, "node_modules", ".bin", "ts-node");

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

function sampleContractorPayload() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return {
    name: `Auth Gate Contractor ${suffix}`,
    phone: "+41791234567",
    email: `auth-${suffix}@example.com`,
    hourlyRate: 120,
    serviceCategories: ["oven"],
  };
}

describe("Manager auth gates", () => {
  let requiredProc: ChildProcessWithoutNullStreams | null = null;
  let optionalProc: ChildProcessWithoutNullStreams | null = null;

  const requiredPort = 3101;
  const optionalPort = 3102;

  const managerToken = encodeToken({
    userId: "manager-user",
    orgId: "default-org",
    email: "manager@example.com",
    role: "MANAGER",
  });

  const contractorToken = encodeToken({
    userId: "contractor-user",
    orgId: "default-org",
    email: "contractor@example.com",
    role: "CONTRACTOR",
  });

  beforeAll(async () => {
    requiredProc = await startServer({ AUTH_OPTIONAL: "false", NODE_ENV: "test" }, requiredPort);
    optionalProc = await startServer({ AUTH_OPTIONAL: "true", NODE_ENV: "test" }, optionalPort);
  }, 20000);

  afterAll(() => {
    requiredProc?.kill();
    optionalProc?.kill();
  });

  it("returns 401 without token when auth required", async () => {
    const result = await httpRequest(requiredPort, "POST", "/contractors", sampleContractorPayload());
    expect(result.status).toBe(401);
    expect(result.data).toHaveProperty("error", "UNAUTHORIZED");
  }, 10000);

  it("returns 403 for non-manager token when auth required", async () => {
    const result = await httpRequest(
      requiredPort,
      "POST",
      "/contractors",
      sampleContractorPayload(),
      contractorToken
    );
    expect(result.status).toBe(403);
    expect(result.data).toHaveProperty("error", "FORBIDDEN");
  }, 10000);

  it("allows manager token when auth required", async () => {
    const result = await httpRequest(
      requiredPort,
      "POST",
      "/contractors",
      sampleContractorPayload(),
      managerToken
    );
    expect(result.status).toBe(201);
    expect(result.data).toHaveProperty("data");
  }, 10000);

  it("allows requests without token when auth optional", async () => {
    const result = await httpRequest(optionalPort, "POST", "/contractors", sampleContractorPayload());
    expect(result.status).toBe(201);
    expect(result.data).toHaveProperty("data");
  }, 10000);
});