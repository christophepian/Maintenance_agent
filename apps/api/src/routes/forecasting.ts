/**
 * Forecasting routes
 *
 * Read-only endpoints — all use maybeRequireManager.
 *
 * Endpoints:
 *   GET /forecasting/asset-health         — portfolio asset-health summary
 *   GET /forecasting/capex-projection     — 5-year CapEx projection with bundling + timing
 *   GET /forecasting/renovation-catalog   — Swiss renovation classification catalog
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first } from "../http/query";
import { maybeRequireManager } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { getAssetHealthForecast } from "../services/assetHealthService";
import { getCapExProjection } from "../services/capexProjectionService";
import {
  getAllEntries,
  searchCatalog,
  lookupByCode,
  TAX_CATEGORY_LABELS,
  ACCOUNTING_TREATMENT_LABELS,
  TIMING_SENSITIVITY_LABELS,
  TIMING_SENSITIVITY_GUIDANCE,
  type BuildingSystem,
  type TimingSensitivity,
} from "../services/swissRenovationCatalog";
import { TaxClassification } from "@prisma/client";

export function registerForecastingRoutes(router: Router) {

  // ── GET /forecasting/asset-health ────────────────────────────
  router.get("/forecasting/asset-health", withAuthRequired(async ({ req, res, orgId, prisma }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      // Optional query param: includeLegalCoverage (default true)
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const includeLegal = url.searchParams.get("includeLegalCoverage") !== "false";

      const forecast = await getAssetHealthForecast(prisma, orgId, {
        includeLegalCoverage: includeLegal,
      });
      sendJson(res, 200, { data: forecast });
    } catch (e) {
      sendError(res, 500, "FORECAST_ERROR", "Failed to compute asset-health forecast", String(e));
    }
  }));

  // ── GET /forecasting/capex-projection ────────────────────────
  router.get("/forecasting/capex-projection", withAuthRequired(async ({ req, res, orgId, prisma }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const horizonStr = url.searchParams.get("horizonYears");
      const horizonYears = horizonStr ? Math.min(10, Math.max(1, Number(horizonStr))) : undefined;

      const projection = await getCapExProjection(prisma, orgId, {
        horizonYears,
      });
      sendJson(res, 200, { data: projection });
    } catch (e) {
      sendError(res, 500, "FORECAST_ERROR", "Failed to compute CapEx projection", String(e));
    }
  }));

  // ── GET /forecasting/renovation-catalog ──────────────────────
  router.get("/forecasting/renovation-catalog", withAuthRequired(async ({ req, res }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const q = url.searchParams.get("q") ?? undefined;
      const buildingSystem = url.searchParams.get("buildingSystem") as BuildingSystem | undefined;
      const taxCategory = url.searchParams.get("taxCategory") as TaxClassification | undefined;
      const timingSensitivity = url.searchParams.get("timingSensitivity") as TimingSensitivity | undefined;

      // If search query provided, use search; otherwise return filtered catalog
      if (q) {
        const results = searchCatalog(q);
        sendJson(res, 200, { data: results.map((r) => r.entry) });
      } else {
        const entries = getAllEntries({
          buildingSystem: buildingSystem || undefined,
          taxCategory: taxCategory || undefined,
          timingSensitivity: timingSensitivity || undefined,
        });
        sendJson(res, 200, { data: entries });
      }
    } catch (e) {
      sendError(res, 500, "CATALOG_ERROR", "Failed to retrieve renovation catalog", String(e));
    }
  }));
}
