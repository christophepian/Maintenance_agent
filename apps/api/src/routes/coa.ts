/**
 * COA Routes — Chart of Accounts
 *
 * Thin HTTP handlers for ExpenseType, Account, and ExpenseMapping CRUD + seed.
 * SA-16: all routes require upfront auth.
 * SA-10: mutations require MANAGER role.
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { requireOrgViewer } from "./helpers";
import { requireRole, requireAuth } from "../authz";
import {
  listExpenseTypes,
  getExpenseType,
  createExpenseType,
  updateExpenseType,
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  listExpenseMappings,
  createExpenseMapping,
  deleteExpenseMapping,
  seedSwissTaxonomy,
  NotFoundError,
  ConflictError,
} from "../services/coaService";
import {
  CreateExpenseTypeSchema,
  UpdateExpenseTypeSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  CreateExpenseMappingSchema,
} from "../validation/coa";

export function registerCoaRoutes(router: Router) {
  // ═══════════════════════════════════════════════════════════
  // ExpenseType endpoints
  // ═══════════════════════════════════════════════════════════

  // ── GET /coa/expense-types ──────────────────────────────────
  router.get("/coa/expense-types", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireOrgViewer(req, res)) return;

    try {
      const data = await listExpenseTypes(prisma, orgId);
      sendJson(res, 200, { data });
    } catch (e: any) {
      console.error("[GET /coa/expense-types]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list expense types");
    }
  });

  // ── GET /coa/expense-types/:id ──────────────────────────────
  router.get("/coa/expense-types/:id", async ({ req, res, params, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireOrgViewer(req, res)) return;

    try {
      const data = await getExpenseType(prisma, params.id);
      if (data.orgId !== orgId) {
        return sendError(res, 404, "NOT_FOUND", "ExpenseType not found");
      }
      sendJson(res, 200, { data });
    } catch (e: any) {
      if (e instanceof NotFoundError) {
        return sendError(res, 404, "NOT_FOUND", e.message);
      }
      console.error("[GET /coa/expense-types/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to get expense type");
    }
  });

  // ── POST /coa/expense-types ─────────────────────────────────
  router.post("/coa/expense-types", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireRole(req, res, "MANAGER")) return;

    let body: any;
    try {
      body = await readJson(req);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 400, "BAD_REQUEST", msg);
    }

    const parsed = CreateExpenseTypeSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return sendError(res, 400, "VALIDATION_ERROR", msg);
    }

    try {
      const data = await createExpenseType(prisma, orgId, parsed.data);
      sendJson(res, 201, { data });
    } catch (e: any) {
      if (e instanceof ConflictError) return sendError(res, 409, "CONFLICT", e.message);
      console.error("[POST /coa/expense-types]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create expense type");
    }
  });

  // ── PATCH /coa/expense-types/:id ────────────────────────────
  router.patch("/coa/expense-types/:id", async ({ req, res, params, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireRole(req, res, "MANAGER")) return;

    let body: any;
    try {
      body = await readJson(req);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 400, "BAD_REQUEST", msg);
    }

    const parsed = UpdateExpenseTypeSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return sendError(res, 400, "VALIDATION_ERROR", msg);
    }

    try {
      const data = await updateExpenseType(prisma, params.id, orgId, parsed.data);
      sendJson(res, 200, { data });
    } catch (e: any) {
      if (e instanceof NotFoundError) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e instanceof ConflictError) return sendError(res, 409, "CONFLICT", e.message);
      console.error("[PATCH /coa/expense-types/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to update expense type");
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Account endpoints
  // ═══════════════════════════════════════════════════════════

  // ── GET /coa/accounts ───────────────────────────────────────
  router.get("/coa/accounts", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireOrgViewer(req, res)) return;

    try {
      const data = await listAccounts(prisma, orgId);
      sendJson(res, 200, { data });
    } catch (e: any) {
      console.error("[GET /coa/accounts]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list accounts");
    }
  });

  // ── GET /coa/accounts/:id ──────────────────────────────────
  router.get("/coa/accounts/:id", async ({ req, res, params, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireOrgViewer(req, res)) return;

    try {
      const data = await getAccount(prisma, params.id);
      if (data.orgId !== orgId) {
        return sendError(res, 404, "NOT_FOUND", "Account not found");
      }
      sendJson(res, 200, { data });
    } catch (e: any) {
      if (e instanceof NotFoundError) return sendError(res, 404, "NOT_FOUND", e.message);
      console.error("[GET /coa/accounts/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to get account");
    }
  });

  // ── POST /coa/accounts ─────────────────────────────────────
  router.post("/coa/accounts", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireRole(req, res, "MANAGER")) return;

    let body: any;
    try {
      body = await readJson(req);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 400, "BAD_REQUEST", msg);
    }

    const parsed = CreateAccountSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return sendError(res, 400, "VALIDATION_ERROR", msg);
    }

    try {
      const data = await createAccount(prisma, orgId, parsed.data);
      sendJson(res, 201, { data });
    } catch (e: any) {
      if (e instanceof ConflictError) return sendError(res, 409, "CONFLICT", e.message);
      console.error("[POST /coa/accounts]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create account");
    }
  });

  // ── PATCH /coa/accounts/:id ────────────────────────────────
  router.patch("/coa/accounts/:id", async ({ req, res, params, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireRole(req, res, "MANAGER")) return;

    let body: any;
    try {
      body = await readJson(req);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 400, "BAD_REQUEST", msg);
    }

    const parsed = UpdateAccountSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return sendError(res, 400, "VALIDATION_ERROR", msg);
    }

    try {
      const data = await updateAccount(prisma, params.id, orgId, parsed.data);
      sendJson(res, 200, { data });
    } catch (e: any) {
      if (e instanceof NotFoundError) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e instanceof ConflictError) return sendError(res, 409, "CONFLICT", e.message);
      console.error("[PATCH /coa/accounts/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to update account");
    }
  });

  // ═══════════════════════════════════════════════════════════
  // ExpenseMapping endpoints
  // ═══════════════════════════════════════════════════════════

  // ── GET /coa/expense-mappings ───────────────────────────────
  router.get("/coa/expense-mappings", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireOrgViewer(req, res)) return;

    try {
      const data = await listExpenseMappings(prisma, orgId);
      sendJson(res, 200, { data });
    } catch (e: any) {
      console.error("[GET /coa/expense-mappings]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list expense mappings");
    }
  });

  // ── POST /coa/expense-mappings ──────────────────────────────
  router.post("/coa/expense-mappings", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireRole(req, res, "MANAGER")) return;

    let body: any;
    try {
      body = await readJson(req);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      return sendError(res, 400, "BAD_REQUEST", msg);
    }

    const parsed = CreateExpenseMappingSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return sendError(res, 400, "VALIDATION_ERROR", msg);
    }

    try {
      const data = await createExpenseMapping(prisma, orgId, parsed.data);
      sendJson(res, 201, { data });
    } catch (e: any) {
      if (e instanceof NotFoundError) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e instanceof ConflictError) return sendError(res, 409, "CONFLICT", e.message);
      console.error("[POST /coa/expense-mappings]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create expense mapping");
    }
  });

  // ── DELETE /coa/expense-mappings/:id ────────────────────────
  router.delete("/coa/expense-mappings/:id", async ({ req, res, params, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireRole(req, res, "MANAGER")) return;

    try {
      await deleteExpenseMapping(prisma, params.id, orgId);
      sendJson(res, 200, { data: { success: true } });
    } catch (e: any) {
      if (e instanceof NotFoundError) return sendError(res, 404, "NOT_FOUND", e.message);
      console.error("[DELETE /coa/expense-mappings/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to delete expense mapping");
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Seed endpoint
  // ═══════════════════════════════════════════════════════════

  // ── POST /coa/seed ──────────────────────────────────────────
  router.post("/coa/seed", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireRole(req, res, "MANAGER")) return;

    try {
      const result = await seedSwissTaxonomy(prisma, orgId);
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      console.error("[POST /coa/seed]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to seed taxonomy");
    }
  });
}
