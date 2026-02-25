/**
 * Unit tests for M3: HTTP error classes, Router error handling, and parseBody.
 */
import {
  HttpError,
  ValidationError,
  InvalidJsonError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
} from "../http/errors";
import { OrgScopeMismatchError } from "../governance/orgScope";

/* ── Error class hierarchy ──────────────────────────────────── */

describe("HttpError hierarchy", () => {
  test("HttpError has correct properties", () => {
    const err = new HttpError(418, "TEAPOT", "I'm a teapot", { brew: "earl grey" });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(418);
    expect(err.code).toBe("TEAPOT");
    expect(err.message).toBe("I'm a teapot");
    expect(err.details).toEqual({ brew: "earl grey" });
  });

  test("ValidationError → 400 VALIDATION_ERROR", () => {
    const err = new ValidationError("bad input", { fieldErrors: {} });
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("bad input");
    expect(err.details).toEqual({ fieldErrors: {} });
    expect(err.name).toBe("ValidationError");
  });

  test("InvalidJsonError → 400 INVALID_JSON", () => {
    const err = new InvalidJsonError();
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("INVALID_JSON");
    expect(err.message).toBe("Invalid JSON");
  });

  test("UnauthorizedError → 401", () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Not authenticated");
  });

  test("UnauthorizedError with custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });

  test("ForbiddenError → 403", () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("Forbidden");
  });

  test("NotFoundError → 404", () => {
    const err = new NotFoundError("Lease not found");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Lease not found");
  });

  test("ConflictError → 409", () => {
    const err = new ConflictError("Already exists");
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  test("PayloadTooLargeError → 413", () => {
    const err = new PayloadTooLargeError();
    expect(err.status).toBe(413);
    expect(err.code).toBe("BODY_TOO_LARGE");
    // Message must match what existing handlers check for
    expect(err.message).toBe("Body too large");
  });
});

/* ── Backward compat: message strings match old Error ──────── */

describe("readJson backward compat", () => {
  test("InvalidJsonError.message matches old string", () => {
    // Handlers check: if (msg === "Invalid JSON")
    expect(new InvalidJsonError().message).toBe("Invalid JSON");
  });

  test("PayloadTooLargeError.message matches old string", () => {
    // Handlers check: if (msg === "Body too large")
    expect(new PayloadTooLargeError().message).toBe("Body too large");
  });
});

/* ── OrgScopeMismatchError is not HttpError ─────────────────── */

describe("OrgScopeMismatchError", () => {
  test("is an Error but not HttpError", () => {
    const err = new OrgScopeMismatchError("org-1", "org-2", "tenant");
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(HttpError);
    expect(err.callerOrgId).toBe("org-1");
    expect(err.entityOrgId).toBe("org-2");
    expect(err.via).toBe("tenant");
  });
});

/* ── instanceof checks work correctly ──────────────────────── */

describe("instanceof discrimination", () => {
  test("can distinguish error types", () => {
    const errors = [
      new ValidationError("v"),
      new NotFoundError("n"),
      new ConflictError("c"),
      new ForbiddenError(),
    ];

    for (const e of errors) {
      expect(e instanceof HttpError).toBe(true);
      expect(e instanceof Error).toBe(true);
    }

    expect(errors[0] instanceof ValidationError).toBe(true);
    expect(errors[0] instanceof NotFoundError).toBe(false);
    expect(errors[1] instanceof NotFoundError).toBe(true);
    expect(errors[1] instanceof ValidationError).toBe(false);
  });
});
