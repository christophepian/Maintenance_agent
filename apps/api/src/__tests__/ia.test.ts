import * as http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";

const API_ROOT = path.resolve(__dirname, "..", "..");
const TS_NODE = path.resolve(API_ROOT, "node_modules", ".bin", "ts-node");
const PORT = 3206;
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

function getJson(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http
      .get(`${BASE_URL}${path}`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode || 0, body: parsed });
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", (err) => reject(err));
  });
}

describe("IA alias endpoints", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;

  beforeAll(async () => {
    proc = await startServer({ AUTH_OPTIONAL: "true", NODE_ENV: "test" }, PORT);
  }, 20000);

  afterAll(() => {
    proc?.kill();
  });
  it("GET /properties mirrors /buildings", async () => {
    const properties = await getJson("/properties");
    const buildings = await getJson("/buildings");

    expect(properties.status).toBe(200);
    expect(buildings.status).toBe(200);
    expect(Array.isArray(properties.body.data)).toBe(true);
    expect(Array.isArray(buildings.body.data)).toBe(true);
    const propertyIds = new Set(properties.body.data.map((item: any) => item.id));
    const buildingIds = new Set(buildings.body.data.map((item: any) => item.id));

    expect(propertyIds.size).toBeLessThanOrEqual(buildingIds.size);
    for (const id of propertyIds) {
      expect(buildingIds.has(id)).toBe(true);
    }
  }, 10000);

  it("GET /work-requests mirrors /requests", async () => {
    const workRequests = await getJson("/work-requests");
    const requests = await getJson("/requests");

    expect(workRequests.status).toBe(200);
    expect(requests.status).toBe(200);
    expect(Array.isArray(workRequests.body.data)).toBe(true);
    expect(Array.isArray(requests.body.data)).toBe(true);
    expect(workRequests.body.data.length).toBe(requests.body.data.length);
  }, 10000);

  it("GET /people/tenants returns contact DTOs", async () => {
    const tenants = await getJson("/people/tenants");

    expect(tenants.status).toBe(200);
    expect(Array.isArray(tenants.body.data)).toBe(true);
    if (tenants.body.data.length > 0) {
      expect(tenants.body.data[0]).toHaveProperty("role", "TENANT");
    }
  }, 10000);

  it("GET /people/vendors returns contact DTOs", async () => {
    const vendors = await getJson("/people/vendors");

    expect(vendors.status).toBe(200);
    expect(Array.isArray(vendors.body.data)).toBe(true);
    if (vendors.body.data.length > 0) {
      expect(vendors.body.data[0]).toHaveProperty("role", "CONTRACTOR");
    }
  }, 10000);
});
