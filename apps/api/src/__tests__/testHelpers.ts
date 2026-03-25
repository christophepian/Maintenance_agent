import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";
import { encodeToken, TokenPayload } from "../services/auth";

/**
 * Shared server lifecycle helpers for integration tests.
 *
 * All 22 server-spawning test suites use startTestServer / stopTestServer
 * instead of copy-pasting the spawn logic. This ensures consistent teardown
 * and prevents port leaks between serially-run suites.
 */

const API_ROOT = path.resolve(__dirname, "..", "..");
const TS_NODE = path.resolve(API_ROOT, "node_modules", ".bin", "ts-node");

/**
 * Spawn a ts-node server process on the given port.
 * Resolves once the process emits "API running on" on stdout/stderr.
 * Rejects after 15 s if the server does not start.
 *
 * @param port        Port to listen on.
 * @param envOverrides  Extra env vars (e.g. AUTH_OPTIONAL, NODE_ENV).
 */
export function startTestServer(
  port: number,
  envOverrides: Record<string, string> = {},
): Promise<ChildProcessWithoutNullStreams> {
  return new Promise((resolve, reject) => {
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
      if (data.toString().includes("API running on")) {
        cleanup();
        resolve(child);
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Server on port ${port} did not start within 15 s`));
    }, 15_000);

    function cleanup() {
      clearTimeout(timer);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("error", onError);
    }

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", onError);
  });
}

/**
 * Kill a server process and wait for it to fully exit before resolving.
 * Passing null is a no-op (safe to call unconditionally in afterAll).
 */
export function stopTestServer(
  proc: ChildProcessWithoutNullStreams | null,
): Promise<void> {
  return new Promise((resolve) => {
    if (!proc) return resolve();
    proc.once("exit", () => resolve());
    proc.kill();
  });
}

/**
 * Test helper for generating auth tokens in integration tests.
 */

export function createTestToken(overrides?: Partial<TokenPayload>): string {
  const payload: TokenPayload = {
    userId: overrides?.userId || "test-user-id",
    orgId: overrides?.orgId || "default-org",
    email: overrides?.email || "test@example.com",
    role: overrides?.role || "MANAGER",
  };
  return encodeToken(payload);
}

export function createManagerToken(orgId = "default-org"): string {
  return createTestToken({ role: "MANAGER", orgId });
}

export function createOwnerToken(orgId = "default-org"): string {
  return createTestToken({ role: "OWNER", orgId });
}

export function createContractorToken(orgId = "default-org"): string {
  return createTestToken({ role: "CONTRACTOR", orgId });
}

export function createTenantToken(orgId = "default-org"): string {
  return createTestToken({ role: "TENANT", orgId });
}

export function getAuthHeaders(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
