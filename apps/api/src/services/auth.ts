// Authentication and authorization service
// Provides token generation, verification, and user lookup

import jwt from "jsonwebtoken";

export interface TokenPayload {
  userId: string;
  orgId: string;
  email: string;
  role: string;
}

const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-key-change-in-prod";
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
