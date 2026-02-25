/**
 * Typed HTTP error classes.
 *
 * Route handlers can `throw` any of these instead of manually calling
 * `sendError(res, …)`.  The Router's per-route error handler will
 * catch them and send the corresponding HTTP response automatically.
 *
 * Usage in a handler:
 *   throw new NotFoundError("Lease not found");
 *   throw new ValidationError("Invalid input", zodResult.error.flatten());
 *   throw new ConflictError("Cannot cancel an ACTIVE lease");
 *
 * All classes extend `HttpError` so the router can do a single
 * `instanceof HttpError` check.
 */

export class HttpError extends Error {
  /** HTTP status code (e.g. 400, 404, 409, 500) */
  readonly status: number;
  /** Machine-readable error code (e.g. "NOT_FOUND", "VALIDATION_ERROR") */
  readonly code: string;
  /** Optional structured details (Zod flatten output, etc.) */
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/* ── 400 Bad Request ───────────────────────────────────────── */

export class ValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

export class InvalidJsonError extends HttpError {
  constructor() {
    super(400, "INVALID_JSON", "Invalid JSON");
    this.name = "InvalidJsonError";
  }
}

/* ── 401 Unauthorized ──────────────────────────────────────── */

export class UnauthorizedError extends HttpError {
  constructor(message = "Not authenticated") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

/* ── 403 Forbidden ─────────────────────────────────────────── */

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

/* ── 404 Not Found ─────────────────────────────────────────── */

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

/* ── 409 Conflict ──────────────────────────────────────────── */

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
    this.name = "ConflictError";
  }
}

/* ── 413 Payload Too Large ─────────────────────────────────── */

export class PayloadTooLargeError extends HttpError {
  constructor() {
    super(413, "BODY_TOO_LARGE", "Body too large");
    this.name = "PayloadTooLargeError";
  }
}
