import { encodeToken, TokenPayload } from "../services/auth";

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
