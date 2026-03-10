// Authentication and authorization service
// Provides token generation, verification, and user lookup

import * as jwt from "jsonwebtoken";

export interface TokenPayload {
  userId: string;
  orgId: string;
  email: string;
  role: string;
}

const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-key-change-in-prod";
// SA-19: Require AUTH_SECRET in all non-test environments (covers both dev and production)
if (process.env.NODE_ENV !== "test" && !process.env.AUTH_SECRET) {
  console.error("FATAL: AUTH_SECRET must be set in non-test environments.");
  process.exit(1);
}
const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24h

/**
 * Encode token using JWT
 */
export function encodeToken(payload: TokenPayload): string {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

/**
 * Decode and verify token
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, AUTH_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ', 2);
  return scheme === 'Bearer' ? token : null;
}
