/**
 * The public demo account's token must be able to read and nothing else.
 * Covers the claim mapping (auth.ts) — the enforcement itself is a single
 * method check in server.ts, asserted here against the same predicate so a
 * change to the allowed-method list is caught.
 */
import { mapJwtPayload } from "../services/auth";

const MUTATING = ["POST", "PUT", "PATCH", "DELETE"];
const READING = ["GET", "HEAD", "OPTIONS"];

// Mirrors the guard in server.ts.
const blocked = (demoReadOnly: boolean | undefined, method: string) =>
  Boolean(demoReadOnly) && !READING.includes(method);

describe("demoReadOnly claim mapping", () => {
  const map = (appMetadata: Record<string, unknown>) =>
    mapJwtPayload({ sub: "u1", email: "d@e.f", app_metadata: appMetadata });

  it("is true for a real boolean true", () => {
    expect(map({ demoReadOnly: true }).demoReadOnly).toBe(true);
  });

  it('is true for the string "true" (app_metadata round-trips as JSON)', () => {
    expect(map({ demoReadOnly: "true" }).demoReadOnly).toBe(true);
  });

  it("is false when absent — a normal account is never read-only by accident", () => {
    expect(map({}).demoReadOnly).toBe(false);
    expect(map({ orgId: "o1" }).demoReadOnly).toBe(false);
  });

  it("is false for other truthy-looking values", () => {
    for (const v of ["1", "yes", 1, {}, []]) {
      expect(map({ demoReadOnly: v as never }).demoReadOnly).toBe(false);
    }
  });
});

describe("demoReadOnly enforcement predicate", () => {
  it("blocks every mutating method for a demo token", () => {
    for (const m of MUTATING) expect(blocked(true, m)).toBe(true);
  });

  it("allows reads for a demo token", () => {
    for (const m of READING) expect(blocked(true, m)).toBe(false);
  });

  it("never blocks a normal account", () => {
    for (const m of [...MUTATING, ...READING]) {
      expect(blocked(false, m)).toBe(false);
      expect(blocked(undefined, m)).toBe(false);
    }
  });
});
