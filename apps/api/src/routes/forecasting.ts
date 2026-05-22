/**
 * Forecasting routes
 *
 * Read-only endpoints — all use maybeRequireManager.
 *
 * Endpoints:
 *   GET /forecasting/asset-health                — portfolio asset-health summary
 *   GET /forecasting/capex-projection            — 5-year CapEx projection with bundling + timing
 *   GET /forecasting/renovation-catalog          — Swiss renovation classification catalog
 *   GET /buildings/:id/capex-schedule            — per-building forward capex schedule
 *   GET /buildings/:id/npv-scenarios             — 3-scenario NPV (Invest / Defer / Neglect)
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first } from "../http/query";
import { maybeRequireManager } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { getAssetHealthForecast } from "../services/assetHealthService";
import { getCapExProjection } from "../services/capexProjectionService";
import { getAssetInventoryForBuilding } from "../services/assetInventory";
import { findBuildingByIdAndOrg } from "../repositories/inventoryRepository";
import { computeNPVScenarios } from "../services/npvService";
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

  // ── GET /buildings/:id/capex-schedule ───────────────────────
  // Per-building forward capex schedule derived from asset depreciation timelines.
  // Calls the full portfolio projection and slices the result for the requested building.
  router.get("/buildings/:id/capex-schedule", withAuthRequired(async ({ req, res, params, orgId, prisma }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const horizonStr = url.searchParams.get("horizonYears");
      const horizonYears = horizonStr ? Math.min(10, Math.max(1, Number(horizonStr))) : undefined;

      // Verify building exists and belongs to this org
      const dbBuilding = await findBuildingByIdAndOrg(prisma, params.id, orgId);
      if (!dbBuilding) {
        return sendError(res, 404, "NOT_FOUND", `Building ${params.id} not found`);
      }

      const projection = await getCapExProjection(prisma, orgId, { horizonYears });
      const building = projection.buildings.find((b) => b.buildingId === params.id);

      // Get all assets for this building (for excluded-asset diagnostics)
      const allAssets = await getAssetInventoryForBuilding(
        prisma, orgId, params.id,
        { canton: dbBuilding.canton ?? undefined, buildingLevelOnly: false },
      );

      // Assets excluded from capex: those with no depreciation data (missing installedAt / no standard)
      const excludedAssets = allAssets
        .filter((a) => a.depreciation === null)
        .map((a) => ({
          assetId: a.id,
          assetName: a.name ?? a.topic,
          assetType: a.type,
          topic: a.topic,
          reason: a.installedAt == null
            ? "MISSING_INSTALLATION_DATE"
            : "NO_DEPRECIATION_STANDARD",
        }));

      if (!building) {
        // Building exists but no assets passed the capex filter — return empty schedule with diagnostics
        sendJson(res, 200, {
          data: {
            buildingId: params.id,
            buildingName: dbBuilding.name,
            horizonYears: projection.projectionHorizonYears,
            fromYear: projection.fromYear,
            toYear: projection.toYear,
            totalProjectedChf: 0,
            schedule: [] as Array<{ year: number; totalChf: number; deductibleChf: number; capitalizedChf: number; assetCount: number; items: unknown[] }>,
            excludedAssets,
          },
        });
        return;
      }

      const schedule = building.yearlyBuckets.map((bucket) => ({
        year: bucket.year,
        totalChf: bucket.totalChf,
        deductibleChf: bucket.deductibleChf,
        capitalizedChf: bucket.capitalizedChf,
        assetCount: bucket.assetCount,
        items: bucket.items.map((item) => ({
          assetId: item.assetId,
          assetName: item.assetName,
          topic: item.topic,
          estimatedCostChf: item.estimatedCostChf,
          deductiblePct: item.deductiblePct,
          taxClassification: item.taxClassification,
        })),
      }));

      sendJson(res, 200, {
        data: {
          buildingId: building.buildingId,
          buildingName: building.buildingName,
          horizonYears: projection.projectionHorizonYears,
          fromYear: projection.fromYear,
          toYear: projection.toYear,
          totalProjectedChf: building.totalProjectedChf,
          schedule,
          excludedAssets,
        },
      });
    } catch (e) {
      sendError(res, 500, "FORECAST_ERROR", "Failed to compute capex schedule", String(e));
    }
  }));

  // ── GET /buildings/:id/npv-scenarios ─────────────────────────
  // 3-scenario NPV: Invest (on schedule) / Defer (+N years) / Neglect (zero capex).
  router.get("/buildings/:id/npv-scenarios", withAuthRequired(async ({ req, res, params, orgId, prisma }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const discountRatePct = url.searchParams.get("discountRatePct")
        ? Number(url.searchParams.get("discountRatePct")) : undefined;
      const incomeGrowthRatePct = url.searchParams.get("incomeGrowthRatePct")
        ? Number(url.searchParams.get("incomeGrowthRatePct")) : undefined;
      const horizonYears = url.searchParams.get("horizonYears")
        ? Number(url.searchParams.get("horizonYears")) : undefined;
      const deferYears = url.searchParams.get("deferYears")
        ? Number(url.searchParams.get("deferYears")) : undefined;

      const result = await computeNPVScenarios(prisma, orgId, params.id, {
        discountRatePct,
        incomeGrowthRatePct,
        horizonYears,
        deferYears,
      });
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      if (e?.statusCode === 404) {
        return sendError(res, 404, "NOT_FOUND", e.message);
      }
      sendError(res, 500, "NPV_ERROR", "Failed to compute NPV scenarios", String(e));
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
