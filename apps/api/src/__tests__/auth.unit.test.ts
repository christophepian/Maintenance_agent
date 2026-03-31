/**
 * Auth Unit Tests (TC-10)
 *
 * Pure unit tests for services/auth.ts: encodeToken, decodeToken,
 * extractToken. No database or server required.
 *
 * Also covers TC-13 (malformed/expired token tests).
 */

process.env.AUTH_SECRET = "test-secret";

import { encodeToken, decodeToken, extractToken, TokenPayload } from "../services/auth";
import * as jwt from "jsonwebtoken";

const validPayload: TokenPayload = {
  userId: "user-1",
  orgId: "org-1",
  email: "test@example.com",
  role: "MANAGER",
};

describe("encodeToken / decodeToken", () => {
  it("round-trips a valid payload", () => {
    const token = encodeToken(validPayload);
    const decoded = decodeToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(validPayload.userId);
    expect(decoded!.orgId).toBe(validPayload.orgId);
    expect(decoded!.email).toBe(validPayload.email);
    expect(decoded!.role).toBe(validPayload.role);
  });

  it("includes standard JWT fields (iat, exp)", () => {
    const token = encodeToken(validPayload);
    const raw = jwt.decode(token) as any;

    expect(raw.iat).toBeDefined();
    expect(raw.exp).toBeDefined();
    expect(raw.exp - raw.iat).toBe(86400); // 24h
  });

  it("returns null for garbage token", () => {
    expect(decodeToken("not-a-jwt")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeToken("")).toBeNull();
  });

  it("returns null for token signed with wrong secret", () => {
    const wrongToken = jwt.sign(validPayload, "wrong-secret", { expiresIn: 3600 });
    expect(decodeToken(wrongToken)).toBeNull();
  });

  it("returns null for expired token", () => {
    const expired = jwt.sign(validPayload, "test-secret", { expiresIn: -10 });
    expect(decodeToken(expired)).toBeNull();
  });

  it("returns null for truncated token", () => {
    const token = encodeToken(validPayload);
    const truncated = token.substring(0, token.length / 2);
    expect(decodeToken(truncated)).toBeNull();
  });

  it("decodes all four roles", () => {
    for (const role of ["MANAGER", "CONTRACTOR", "TENANT", "OWNER"]) {
      const token = encodeToken({ ...validPayload, role });
      const decoded = decodeToken(token);
      expect(decoded!.role).toBe(role);
    }
  });
});

describe("extractToken", () => {
  it("extracts token from Bearer scheme", () => {
    const token = encodeToken(validPayload);
    expect(extractToken(`Bearer ${token}`)).toBe(token);
  });

  it("returns null for missing header", () => {
    expect(extractToken(undefined)).toBeNull();
  });

  it("returns null for empty header", () => {
    expect(extractToken("")).toBeNull();
  });

  it("returns null for non-Bearer scheme", () => {
    expect(extractToken("Basic abc123")).toBeNull();
  });

  it("returns null for lowercase bearer", () => {
    // According to current implementation, scheme must be exactly "Bearer"
    const token = encodeToken(validPayload);
    const result = extractToken(`bearer ${token}`);
    // This test documents the current behavior
    expect(result).toBeNull();
  });

  it("handles token with no space after scheme", () => {
    expect(extractToken("BearerABC")).toBeNull();
  });
});
