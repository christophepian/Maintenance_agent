import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { requireOrgViewer } from "./helpers";
import { requireRole, requireAuth, getAuthUser } from "../authz";
import {
  getBuildingFinancials,
  getPortfolioSummary,
  getPortfolioMonthlyBreakdown,
  setInvoiceExpenseCategory,
  listBuildingSnapshots,
  computeAnnualSnapshots,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../services/financials";
import {
  GetBuildingFinancialsSchema,
  PortfolioSummarySchema,
  SetExpenseCategorySchema,
  RefreshSnapshotsSchema,
} from "../validation/financials";

export function registerFinancialRoutes(router: Router) {
  // ── GET /buildings/:id/financials ─────────────────────────
  router.get(
    "/buildings/:id/financials",
    async ({ req, res, params, query, orgId }) => {
      // SA-16: Upfront auth check — prevents AUTH_OPTIONAL bypass
      if (!requireAuth(req, res)) return;
      if (!requireOrgViewer(req, res)) return;

      // Validate query params
      const parsed = GetBuildingFinancialsSchema.safeParse({
        from: first(query, "from"),
        to: first(query, "to"),
        forceRefresh: first(query, "forceRefresh"),
        groupByAccount: first(query, "groupByAccount"),
      });

      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      try {
        const dto = await getBuildingFinancials(orgId, params.id, {
          from: parsed.data.from,
          to: parsed.data.to,
          forceRefresh: parsed.data.forceRefresh,
          groupByAccount: parsed.data.groupByAccount,
        });
        sendJson(res, 200, { data: dto });
      } catch (e: any) {
        if (e instanceof NotFoundError) {
          return sendError(res, 404, "NOT_FOUND", e.message);
        }
        if (e instanceof ValidationError) {
          return sendError(res, 400, "VALIDATION_ERROR", e.message);
        }
        console.error("[GET /buildings/:id/financials]", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to load financials");
      }
    },
  );

  // ── GET /buildings/:id/financial-summary ──────────────────
  // Clean-URL alias for /buildings/:id/financials — same handler, same auth
  router.get(
    "/buildings/:id/financial-summary",
    async ({ req, res, params, query, orgId }) => {
      if (!requireAuth(req, res)) return;
      if (!requireOrgViewer(req, res)) return;

      const parsed = GetBuildingFinancialsSchema.safeParse({
        from: first(query, "from"),
        to: first(query, "to"),
        forceRefresh: first(query, "forceRefresh"),
        groupByAccount: first(query, "groupByAccount"),
      });

      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      try {
        const dto = await getBuildingFinancials(orgId, params.id, {
          from: parsed.data.from,
          to: parsed.data.to,
          forceRefresh: parsed.data.forceRefresh,
          groupByAccount: parsed.data.groupByAccount,
        });
        sendJson(res, 200, { data: dto });
      } catch (e: any) {
        if (e instanceof NotFoundError) {
          return sendError(res, 404, "NOT_FOUND", e.message);
        }
        if (e instanceof ValidationError) {
          return sendError(res, 400, "VALIDATION_ERROR", e.message);
        }
        console.error("[GET /buildings/:id/financial-summary]", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to load financial summary");
      }
    },
  );

  // ── POST /invoices/:id/set-expense-category ───────────────
  router.post(
    "/invoices/:id/set-expense-category",
    async ({ req, res, params, orgId }) => {
      // SA-16: Upfront auth check — prevents AUTH_OPTIONAL bypass
      if (!requireAuth(req, res)) return;
      // SA-10: Mutations require MANAGER role (not OWNER)
      if (!requireRole(req, res, "MANAGER")) return;

      let body: any;
      try {
        body = await readJson(req);
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg === "Invalid JSON")
          return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
        if (msg === "Body too large")
          return sendError(
            res,
            413,
            "BODY_TOO_LARGE",
            "Request body too large",
          );
        return sendError(res, 400, "BAD_REQUEST", msg);
      }

      const parsed = SetExpenseCategorySchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      try {
        const result = await setInvoiceExpenseCategory(
          params.id,
          orgId,
          parsed.data.expenseCategory,
        );
        sendJson(res, 200, { data: result });
      } catch (e: any) {
        if (e instanceof NotFoundError) {
          return sendError(res, 404, "NOT_FOUND", e.message);
        }
        if (e instanceof ConflictError) {
          return sendError(res, 409, "CONFLICT", e.message);
        }
        console.error("[POST /invoices/:id/set-expense-category]", e);
        sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to set expense category",
        );
      }
    },
  );

  // ── GET /buildings/:id/financial-snapshots ────────────────
  router.get(
    "/buildings/:id/financial-snapshots",
    async ({ req, res, params, orgId }) => {
      if (!requireAuth(req, res)) return;
      if (!requireOrgViewer(req, res)) return;

      try {
        const snapshots = await listBuildingSnapshots(orgId, params.id);
        sendJson(res, 200, { data: snapshots });
      } catch (e: any) {
        if (e instanceof NotFoundError) {
          return sendError(res, 404, "NOT_FOUND", e.message);
        }
        console.error("[GET /buildings/:id/financial-snapshots]", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to load snapshots");
      }
    },
  );

  // ── POST /buildings/:id/financial-snapshots/refresh ───────
  router.post(
    "/buildings/:id/financial-snapshots/refresh",
    async ({ req, res, params, orgId }) => {
      if (!requireAuth(req, res)) return;
      if (!requireRole(req, res, "MANAGER")) return;

      let body: any = {};
      try {
        body = await readJson(req);
      } catch {
        // empty body is fine — defaults apply
      }

      const parsed = RefreshSnapshotsSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      try {
        const snapshots = await computeAnnualSnapshots(orgId, params.id, parsed.data.years);
        sendJson(res, 200, { data: snapshots });
      } catch (e: any) {
        if (e instanceof NotFoundError) {
          return sendError(res, 404, "NOT_FOUND", e.message);
        }
        console.error("[POST /buildings/:id/financial-snapshots/refresh]", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to refresh snapshots");
      }
    },
  );

  // ── GET /financials/portfolio-monthly ──────────────────────
  router.get(
    "/financials/portfolio-monthly",
    async ({ req, res, query, orgId }) => {
      if (!requireAuth(req, res)) return;
      if (!requireOrgViewer(req, res)) return;

      const yearRaw = first(query, "year");
      const year = yearRaw ? parseInt(yearRaw, 10) : new Date().getFullYear();

      if (isNaN(year) || year < 2000 || year > 2100) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid year parameter");
      }

      try {
        const user = getAuthUser(req);
        const ownerId = (user?.role === "OWNER" || user?.ownerId) ? (user.ownerId || user.userId) : undefined;
        const data = await getPortfolioMonthlyBreakdown(orgId, year, ownerId);
        sendJson(res, 200, { data });
      } catch (e: any) {
        console.error("[GET /financials/portfolio-monthly]", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to load monthly breakdown");
      }
    },
  );

  // ── GET /financials/portfolio-summary ──────────────────────
  router.get(
    "/financials/portfolio-summary",
    async ({ req, res, query, orgId }) => {
      // SA-16: Upfront auth check — prevents AUTH_OPTIONAL bypass
      if (!requireAuth(req, res)) return;
      if (!requireOrgViewer(req, res)) return;

      const parsed = PortfolioSummarySchema.safeParse({
        from: first(query, "from"),
        to: first(query, "to"),
      });

      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      try {
        const user = getAuthUser(req);
        const ownerId = (user?.role === "OWNER" || user?.ownerId) ? (user.ownerId || user.userId) : undefined;
        const dto = await getPortfolioSummary(orgId, {
          from: parsed.data.from,
          to: parsed.data.to,
        }, ownerId);
        sendJson(res, 200, { data: dto });
      } catch (e: any) {
        console.error("[GET /financials/portfolio-summary]", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to load portfolio summary");
      }
    },
  );
}
