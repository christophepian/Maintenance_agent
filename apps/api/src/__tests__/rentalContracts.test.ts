/**
 * G10: API Contract Tests — Rental Applications
 *
 * Asserts response shapes of rental endpoints to prevent silent DTO drift.
 * Requires the server to be running with test data seeded.
 */

import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";

const API_ROOT = path.resolve(__dirname, "..", "..");
const PORT = 3206;
const API_BASE = `http://127.0.0.1:${PORT}`;

function startServer(envOverrides: Record<string, string>, port: number) {
  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    const child = spawn("npx", ["tsx", "src/server.ts"], {
      cwd: API_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        AUTH_OPTIONAL: "true",
        BG_JOBS_ENABLED: "false",
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

    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
      child.off("error", onError);
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", onError);

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Server did not start within 20s"));
    }, 20000);
  });
}

async function fetchJson(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, opts);
  return { status: res.status, body: await res.json().catch(() => null) };
}

function expectKeys(obj: Record<string, any>, keys: string[], label: string) {
  for (const key of keys) {
    expect(obj).toHaveProperty(key);
  }
}

describe("G10: Rental Application Contract Tests", () => {
  let proc: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    proc = await startServer({}, PORT);
  }, 25000);

  afterAll(() => {
    if (proc) proc.kill();
  });

  // ── Vacant Units ──
  describe("GET /vacant-units", () => {
    it("returns an array with expected unit shape", async () => {
      const { status, body } = await fetchJson("/vacant-units");
      expect(status).toBe(200);
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const unit = body.data[0];
        expectKeys(unit, ["id", "unitNumber"], "VacantUnit");
        // building relation (optional but expected in practice)
        if (unit.building) {
          expectKeys(unit.building, ["id", "name"], "VacantUnit.building");
        }
      }
    });
  });

  // ── Manager: List Applications per Unit ──
  describe("GET /manager/rental-applications?unitId=...", () => {
    it("returns 400 without unitId", async () => {
      const { status } = await fetchJson("/manager/rental-applications", {
        headers: { "x-dev-role": "MANAGER" },
      });
      expect(status).toBe(400);
    });

    it("returns summary DTOs with unitApplications when seeded", async () => {
      // First get a vacant unit to use as unitId
      const { body: unitsBody } = await fetchJson("/vacant-units");
      const vacantUnits = unitsBody?.data || [];

      // Also try with a known unit that has applications
      // We'll use a broad approach: try each vacant unit
      let testedAtLeastOne = false;

      for (const unit of vacantUnits.slice(0, 3)) {
        const { status, body } = await fetchJson(
          `/manager/rental-applications?unitId=${unit.id}&view=summary`,
          { headers: { "x-dev-role": "MANAGER" } },
        );
        expect(status).toBe(200);
        expect(Array.isArray(body.data)).toBe(true);

        if (body.data.length > 0) {
          const app = body.data[0];
          expectKeys(
            app,
            ["id", "orgId", "status", "createdAt", "applicantCount", "unitApplications"],
            "RentalApplicationSummaryDTO",
          );

          // unitApplications must be present
          expect(Array.isArray(app.unitApplications)).toBe(true);

          if (app.unitApplications.length > 0) {
            const au = app.unitApplications[0];
            expectKeys(au, ["id", "unitId", "status", "disqualified"], "unitApplication");
          }

          testedAtLeastOne = true;
          break;
        }
      }

      // If no applications exist yet, that's OK — the endpoint still returned valid shape
      if (!testedAtLeastOne) {
        console.warn(
          "[RENTAL CONTRACTS] No applications found — shape test skipped (seed data needed)",
        );
      }
    });
  });

  // ── Manager: Get Application Detail ──
  describe("GET /manager/rental-applications/:id", () => {
    it("returns 404 for non-existent ID", async () => {
      const { status } = await fetchJson(
        "/manager/rental-applications/00000000-0000-0000-0000-000000000000",
        { headers: { "x-dev-role": "MANAGER" } },
      );
      expect(status).toBe(404);
    });
  });

  // ── Owner: List Applications ──
  describe("GET /owner/rental-applications?unitId=...", () => {
    it("returns 400 without unitId", async () => {
      const { status } = await fetchJson("/owner/rental-applications", {
        headers: { "x-dev-role": "OWNER" },
      });
      expect(status).toBe(400);
    });
  });

  // ── Dev: Email Outbox ──
  describe("GET /dev/emails", () => {
    it("returns an array of email DTOs", async () => {
      const { status, body } = await fetchJson("/dev/emails");
      expect(status).toBe(200);
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const email = body.data[0];
        expectKeys(
          email,
          ["id", "orgId", "toEmail", "template", "subject", "bodyText", "status", "createdAt"],
          "EmailOutboxDTO",
        );
      }
    });
  });

  // ── Dev: Background Jobs Route ──
  describe("POST /__dev/rental/run-jobs", () => {
    it("returns timeoutsProcessed and attachmentsDeleted", async () => {
      const { status, body } = await fetchJson("/__dev/rental/run-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(status).toBe(200);
      expect(typeof body.timeoutsProcessed).toBe("number");
      expect(typeof body.attachmentsDeleted).toBe("number");
    });
  });

  // ── POST /rental-applications: Create Draft ──
  describe("POST /rental-applications", () => {
    it("rejects empty body with 400", async () => {
      const { status } = await fetchJson("/rental-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(status).toBe(400);
    });

    it("creates a draft when given valid payload", async () => {
      // Get a vacant unit first
      const { body: unitsBody } = await fetchJson("/vacant-units");
      const vacantUnits = unitsBody?.data || [];
      if (vacantUnits.length === 0) {
        console.warn("[RENTAL CONTRACTS] No vacant units — create draft test skipped");
        return;
      }

      const { status, body } = await fetchJson("/rental-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicants: [
            {
              role: "PRIMARY",
              firstName: "ContractTest",
              lastName: "Applicant",
              email: "contract-test@example.com",
              netMonthlyIncome: 5000,
            },
          ],
          unitIds: [vacantUnits[0].id],
          householdSize: 1,
        }),
      });

      expect(status).toBe(201);
      expect(body.data).toBeDefined();
      expectKeys(
        body.data,
        ["id", "orgId", "status", "createdAt", "updatedAt"],
        "RentalApplicationDTO",
      );
      expect(body.data.status).toBe("DRAFT");

      // Verify nested applicants
      expect(Array.isArray(body.data.applicants)).toBe(true);
      if (body.data.applicants.length > 0) {
        expectKeys(
          body.data.applicants[0],
          ["id", "role", "firstName", "lastName"],
          "RentalApplicantDTO",
        );
      }

      // Verify nested applicationUnits
      expect(Array.isArray(body.data.applicationUnits)).toBe(true);
      if (body.data.applicationUnits.length > 0) {
        expectKeys(
          body.data.applicationUnits[0],
          ["id", "unitId", "status", "disqualified"],
          "RentalApplicationUnitDTO",
        );
      }
    });
  });
});
