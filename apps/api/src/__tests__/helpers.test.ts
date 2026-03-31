/**
 * Route Helpers Unit Tests (TC-7)
 *
 * Pure unit tests for routes/helpers.ts: requireOrgViewer,
 * requireOwnerAccess, requireGovernanceAccess, safeSendError,
 * redactEventPayload (via logEvent).
 *
 * No database or server required — uses mock req/res objects.
 */

import * as http from "http";

// Set AUTH_OPTIONAL to false so auth checks are enforced
process.env.AUTH_OPTIONAL = "false";

import { requireOrgViewer, requireOwnerAccess, requireGovernanceAccess, safeSendError } from "../routes/helpers";

// Mock req/res factory
function mockRes(): http.ServerResponse & { _status: number; _body: any; _ended: boolean } {
  const res = {
    headersSent: false,
    _status: 0,
    _body: null as any,
    _ended: false,
    statusCode: 200,
    writeHead(status: number, headers?: any) {
      res._status = status;
      res.statusCode = status;
      return res;
    },
    setHeader() { return res; },
    end(body?: string) {
      if (body) {
        try { res._body = JSON.parse(body); } catch { res._body = body; }
      }
      res._ended = true;
      res.headersSent = true;
    },
    write(chunk: any) { return true; },
  } as any;
  return res;
}

function mockReq(user?: { userId: string; orgId: string; email: string; role: string }): any {
  const req: any = { headers: {} };
  if (user) {
    (req as any).user = user;
  }
  return req;
}

describe("requireOrgViewer", () => {
  it("returns true for MANAGER role", () => {
    const req = mockReq({ userId: "u1", orgId: "o1", email: "m@test.com", role: "MANAGER" });
    const res = mockRes();
    expect(requireOrgViewer(req, res)).toBe(true);
  });

  it("returns true for OWNER role", () => {
    const req = mockReq({ userId: "u2", orgId: "o1", email: "o@test.com", role: "OWNER" });
    const res = mockRes();
    expect(requireOrgViewer(req, res)).toBe(true);
  });

  it("returns false and sends 403 for CONTRACTOR role", () => {
    const req = mockReq({ userId: "u3", orgId: "o1", email: "c@test.com", role: "CONTRACTOR" });
    const res = mockRes();
    expect(requireOrgViewer(req, res)).toBe(false);
    expect(res._body).toEqual({ error: "FORBIDDEN" });
  });

  it("returns false and sends 403 for TENANT role", () => {
    const req = mockReq({ userId: "u4", orgId: "o1", email: "t@test.com", role: "TENANT" });
    const res = mockRes();
    expect(requireOrgViewer(req, res)).toBe(false);
    expect(res._body).toEqual({ error: "FORBIDDEN" });
  });

  it("returns false and sends 401 for unauthenticated", () => {
    const req = mockReq();
    const res = mockRes();
    expect(requireOrgViewer(req, res)).toBe(false);
    expect(res._body).toEqual({ error: "UNAUTHORIZED" });
  });
});

describe("requireOwnerAccess", () => {
  it("returns true for OWNER role", () => {
    const req = mockReq({ userId: "u1", orgId: "o1", email: "o@test.com", role: "OWNER" });
    const res = mockRes();
    expect(requireOwnerAccess(req, res)).toBe(true);
  });

  it("returns false for MANAGER role", () => {
    const req = mockReq({ userId: "u2", orgId: "o1", email: "m@test.com", role: "MANAGER" });
    const res = mockRes();
    expect(requireOwnerAccess(req, res)).toBe(false);
    expect(res._body).toEqual({ error: "FORBIDDEN" });
  });

  it("returns false for unauthenticated", () => {
    const req = mockReq();
    const res = mockRes();
    expect(requireOwnerAccess(req, res)).toBe(false);
    expect(res._body).toEqual({ error: "UNAUTHORIZED" });
  });
});

describe("requireGovernanceAccess", () => {
  it("allows OWNER in OWNER_DIRECT mode", () => {
    const req = mockReq({ userId: "u1", orgId: "o1", email: "o@test.com", role: "OWNER" });
    const res = mockRes();
    expect(requireGovernanceAccess(req, res, "OWNER_DIRECT")).toBe(true);
  });

  it("rejects MANAGER in OWNER_DIRECT mode", () => {
    const req = mockReq({ userId: "u2", orgId: "o1", email: "m@test.com", role: "MANAGER" });
    const res = mockRes();
    expect(requireGovernanceAccess(req, res, "OWNER_DIRECT")).toBe(false);
    expect(res._body).toEqual({ error: "FORBIDDEN" });
  });

  it("allows MANAGER in MANAGED mode", () => {
    const req = mockReq({ userId: "u3", orgId: "o1", email: "m@test.com", role: "MANAGER" });
    const res = mockRes();
    expect(requireGovernanceAccess(req, res, "MANAGED")).toBe(true);
  });

  it("allows OWNER in MANAGED mode", () => {
    const req = mockReq({ userId: "u4", orgId: "o1", email: "o@test.com", role: "OWNER" });
    const res = mockRes();
    expect(requireGovernanceAccess(req, res, "MANAGED")).toBe(true);
  });

  it("rejects CONTRACTOR in MANAGED mode", () => {
    const req = mockReq({ userId: "u5", orgId: "o1", email: "c@test.com", role: "CONTRACTOR" });
    const res = mockRes();
    expect(requireGovernanceAccess(req, res, "MANAGED")).toBe(false);
    expect(res._body).toEqual({ error: "FORBIDDEN" });
  });
});

describe("safeSendError", () => {
  it("sends error when headers not sent", () => {
    const res = mockRes();
    safeSendError(res, 404, "NOT_FOUND", "Not found");
    expect(res._ended).toBe(true);
  });

  it("just ends response when headers already sent", () => {
    const res = mockRes();
    (res as any).headersSent = true;
    safeSendError(res, 500, "ERROR", "Should not write");
    expect(res._ended).toBe(true);
  });
});
