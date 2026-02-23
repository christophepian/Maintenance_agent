import * as http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";

const API_ROOT = path.resolve(__dirname, "..", "..");
const TS_NODE = path.resolve(API_ROOT, "node_modules", ".bin", "ts-node");
const PORT = 3202;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
    }, 8000);

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

describe("Tenant session API", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;

  beforeAll(async () => {
    proc = await startServer({ AUTH_OPTIONAL: "true", NODE_ENV: "test" }, PORT);
  }, 20000);

  afterAll(() => {
    proc?.kill();
  });
  it("should return tenant session or 404", (done) => {
    const payload = JSON.stringify({ phone: "+41790000000" });
    const req = http.request(
      `${BASE_URL}/tenant-session`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          expect([200, 404]).toContain(res.statusCode);
          if (res.statusCode === 200) {
            expect(() => JSON.parse(data)).not.toThrow();
            const parsed = JSON.parse(data);
            expect(parsed).toHaveProperty("data");
            expect(parsed.data).toHaveProperty("tenant");
          }
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
