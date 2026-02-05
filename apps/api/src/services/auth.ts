// Authentication and authorization service
// Provides token generation, verification, and user lookup

export interface TokenPayload {
  userId: string;
  orgId: string;
  email: string;
  role: string;
}

const DEV_TOKEN_SECRET = process.env.AUTH_SECRET || 'dev-secret-key-change-in-prod';

/**
 * Simple JWT-like token encoding (for demo; use jsonwebtoken in production)
 */
export function encodeToken(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `dev.${encoded}`;
}

/**
 * Decode and verify token (for demo; add real verification in production)
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    if (!token.startsWith('dev.')) return null;
    const encoded = token.substring(4);
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString());
    return payload;
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
