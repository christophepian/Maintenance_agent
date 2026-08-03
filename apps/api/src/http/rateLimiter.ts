/**
 * Shared in-process rate limiter.
 *
 * Consolidates the per-route in-memory limiters that were previously duplicated
 * across rentalApplications / captureSessions / tenantConversation / auth into a
 * single namespaced fixed-window counter.
 *
 * ── REDIS EXTENSION POINT (pre-GA — CRITICAL_AUDIT_2026-06-23) ──────────────
 * These counters live in process memory: they reset on restart and are NOT
 * shared across instances, so on a multi-instance deploy each instance enforces
 * the limit independently. To make limits durable + global, back this module
 * with Redis (e.g. ioredis `INCR` + `PEXPIRE`, or a sorted-set sliding window)
 * when `REDIS_URL` is set. That makes the check asynchronous, so callers must
 * switch to `await checkRateLimit(...)`. This module is the single seam to
 * change — route handlers already depend only on `checkRateLimit`.
 */

type Bucket = Map<string, { count: number; resetAt: number }>;

const namespaces = new Map<string, Bucket>();

function bucketFor(namespace: string): Bucket {
  let b = namespaces.get(namespace);
  if (!b) {
    b = new Map();
    namespaces.set(namespace, b);
  }
  return b;
}

/**
 * Fixed-window rate limit check.
 * @returns true if the request is ALLOWED, false if it exceeds `limit` in the window.
 */
export function checkRateLimit(
  namespace: string,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const bucket = bucketFor(namespace);
  const now = Date.now();
  const entry = bucket.get(key);
  if (!entry || now >= entry.resetAt) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

/** Test helper — clear all counters (or one namespace). */
export function __resetRateLimits(namespace?: string): void {
  if (namespace) namespaces.delete(namespace);
  else namespaces.clear();
}
