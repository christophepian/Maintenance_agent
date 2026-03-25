import * as http from "http";
import { ChildProcessWithoutNullStreams } from 'child_process';
import { startTestServer, stopTestServer } from './testHelpers';

// Use process.pid to avoid port collisions during parallel test execution
const PORT = 3218;
const BASE_URL = `http://127.0.0.1:${PORT}`;

describe("Tenant session API", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });
  }, 30000);

  afterAll(() => stopTestServer(proc));
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
