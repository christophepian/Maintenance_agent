import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { requireOrgViewer } from "./helpers";
import { requireRole, requireAuth } from "../authz";
import {
  getBuildingFinancials,
  getPortfolioSummary,
  setInvoiceExpenseCategory,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../services/financials";
import {
  GetBuildingFinancialsSchema,
  PortfolioSummarySchema,
  SetExpenseCategorySchema,
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
        const dto = await getPortfolioSummary(orgId, {
          from: parsed.data.from,
          to: parsed.data.to,
        });
        sendJson(res, 200, { data: dto });
      } catch (e: any) {
        console.error("[GET /financials/portfolio-summary]", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to load portfolio summary");
      }
    },
  );
}
