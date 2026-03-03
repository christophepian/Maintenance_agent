import * as http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";
import { createManagerToken, getAuthHeaders } from "./testHelpers";

const API_ROOT = path.resolve(__dirname, "..", "..");
const TS_NODE = path.resolve(API_ROOT, "node_modules", ".bin", "ts-node");
const PORT = 3201;
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

describe("Requests API Integration Tests", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;

  beforeAll(async () => {
    proc = await startServer({ AUTH_OPTIONAL: "true", NODE_ENV: "test" }, PORT);
  }, 20000);

  afterAll(() => {
    proc?.kill();
  });

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
          expect(parsed.data.status).toBe('PENDING_REVIEW');
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

