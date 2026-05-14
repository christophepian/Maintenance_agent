// Authentication and authorization service.
//
// Supabase JWT shape (RS256, verified via JWKS):
//   sub           → Supabase user UUID (= User.supabaseId)
//   email         → user email
//   role          → always "authenticated" (Supabase internal — NOT our app role)
//   app_metadata  → { appRole, orgId, accessLevel, prismaUserId }
//
// Verification strategy:
//   Production  → async JWKS fetch from Supabase (resolveSupabaseToken)
//                 called once per request in server.ts; result cached on req.user
//   Local dev   → synchronous legacy custom-secret verify (decodeToken)
//                 used only when AUTH_OPTIONAL=true / DEV_IDENTITY_ENABLED=true

import * as jwt from "jsonwebtoken";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface TokenPayload {
  userId: string;      // Prisma User.id (from app_metadata.prismaUserId or sub)
  orgId: string;       // from app_metadata.orgId
  email: string;       // from Supabase JWT email claim
  role: string;        // from app_metadata.appRole
  supabaseId?: string; // sub claim
  accessLevel?: string;// ADMIN | APP_USER | DOCS_INVESTOR
  tenantId?: string;   // Tenant.id — set in app_metadata for TENANT role users
  ownerId?: string;    // User.id of an OWNER — set in app_metadata for admin owner-preview
}

// ── Supabase JWKS (production) ───────────────────────────────────────────────
// The JWKS endpoint is public — no secret needed.
// Set SUPABASE_URL in your backend env (e.g. https://znsdygeodyglbyunitcp.supabase.co)
const SUPABASE_URL = process.env.SUPABASE_URL;

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!_jwks && SUPABASE_URL) {
    _jwks = createRemoteJWKSet(
      new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
    );
  }
  if (!_jwks) {
    console.error("[auth] SUPABASE_URL is not set — cannot verify Supabase JWTs");
  }
  return _jwks;
}

/** Map a verified JWT payload to our internal TokenPayload shape. */
function mapJwtPayload(payload: Record<string, unknown>): TokenPayload {
  const meta = (payload["app_metadata"] as Record<string, string> | undefined) ?? {};
  return {
    userId: meta["prismaUserId"] || ((payload["sub"] as string) ?? ""),
    orgId: meta["orgId"] || "default-org",
    email: (payload["email"] as string) || "",
    role: meta["appRole"] || "MANAGER",
    supabaseId: payload["sub"] as string | undefined,
    accessLevel: meta["accessLevel"],
    tenantId: meta["tenantId"] || undefined,
    ownerId: meta["ownerId"] || undefined,
  };
}

/**
 * Verify a Supabase-issued JWT and return a TokenPayload.
 * Called once per request in server.ts; result is stored on req.user.
 *
 * Strategy:
 *   1. ES256/RS256 — JWKS from Supabase (asymmetric key rotation).
 *   2. HS256       — SUPABASE_JWT_SECRET env var (default Supabase config).
 *
 * Returns null if both paths fail or neither secret is configured.
 */
export async function resolveSupabaseToken(token: string): Promise<TokenPayload | null> {
  // ── Path 1: JWKS (ES256 / RS256) ──────────────────────────────────────────
  const jwks = getJwks();
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks);
      return mapJwtPayload(payload as Record<string, unknown>);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "alg" mismatch means the token is likely HS256 — fall through to secret path.
      // Any other error (expired, tampered) is a real failure.
      if (!msg.toLowerCase().includes("alg")) {
        console.error("[auth] resolveSupabaseToken (JWKS) failed:", msg);
        return null;
      }
    }
  }

  // ── Path 2: HS256 via JWT secret (default Supabase signing mode) ──────────
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    try {
      const secretKey = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ["HS256"],
      });
      return mapJwtPayload(payload as Record<string, unknown>);
    } catch (err) {
      console.error("[auth] resolveSupabaseToken (HS256) failed:", err instanceof Error ? err.message : String(err));
    }
  } else if (!jwks) {
    console.error("[auth] resolveSupabaseToken: neither SUPABASE_URL nor SUPABASE_JWT_SECRET is set");
  }

  return null;
}

// ── Legacy custom JWT (local dev only) ───────────────────────────────────────
const LEGACY_JWT_SECRET = process.env.AUTH_SECRET || "dev-secret-key-change-in-prod";
const TOKEN_TTL_SECONDS = 60 * 60 * 24;

/** @deprecated Use Supabase Auth — kept for local dev bootstrap only */
export function encodeToken(payload: TokenPayload): string {
  return jwt.sign(payload, LEGACY_JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

/**
 * Synchronous legacy decode — used only when req.user was not pre-populated
 * (i.e. local dev with AUTH_OPTIONAL=true or DEV_IDENTITY_ENABLED=true).
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, LEGACY_JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ", 2);
  return scheme === "Bearer" ? token : null;
}
