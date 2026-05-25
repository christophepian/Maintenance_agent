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
import { getCapExProjection, estimateReplacementYear } from "../services/capexProjectionService";
import { getAssetInventoryForBuilding } from "../services/assetInventory";
import { estimateReplacementCost } from "../services/replacementCostService";
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
import { TaxClassification, AssetType } from "@prisma/client";
import { getBuildingProfileByBuildingId } from "../repositories/strategyProfileRepository";
import type { NPVScenarioResult } from "../services/npvService";

// ─── Strategy recommendation ──────────────────────────────────

interface StrategyContext {
  hasProfile: boolean;
  roleIntent?: string;
  archetype?: string | null;
  recommendedScenario?: "invest" | "defer" | "neglect";
  rationale?: string;
}

function computeRecommendation(
  archetype: string | null | undefined,
  dims: Record<string, number> | null,
  fciCurrentPct: number,
  scenarios: { invest: NPVScenarioResult; defer: NPVScenarioResult; neglect: NPVScenarioResult },
  deferYears: number,
): { scenario: "invest" | "defer" | "neglect"; rationale: string } {
  const capexTolerance = dims?.capexTolerance ?? 50;
  const saleReadiness = dims?.saleReadiness ?? 50;

  // Critical FCI — recommend invest regardless of profile
  if (fciCurrentPct >= 30) {
    return {
      scenario: "invest",
      rationale: `Facility condition is critical (FCI ${fciCurrentPct.toFixed(1)}%). Continued deferral will accelerate deterioration and increase tenant risk.`,
    };
  }

  // Archetype-first rules
  if (archetype === "exit_optimizer" && saleReadiness >= 65) {
    return {
      scenario: "defer",
      rationale: "Exit-oriented profile with high sale readiness — minimising near-term capex preserves liquidity for a planned exit.",
    };
  }
  if (archetype === "yield_maximizer") {
    return {
      scenario: "invest",
      rationale: "Yield-maximiser profile — executing capex on schedule protects rental income and prevents NOI erosion.",
    };
  }
  if (archetype === "value_builder") {
    return {
      scenario: "invest",
      rationale: "Value-builder profile — full investment on schedule maximises long-term equity and NPV.",
    };
  }
  if (archetype === "capital_preserver") {
    const scenario = fciCurrentPct >= 10 ? "invest" : "defer";
    return {
      scenario,
      rationale: fciCurrentPct >= 10
        ? "Capital-preserver profile — fair facility condition warrants proactive investment to avoid accelerating decline."
        : "Capital-preserver profile — good facility condition allows near-term deferral without material risk.",
    };
  }

  // Dimension-based fallback
  if (saleReadiness >= 70 && capexTolerance < 40) {
    return {
      scenario: "defer",
      rationale: "High sale readiness and limited capex appetite — deferring preserves cash for the exit transaction.",
    };
  }
  if (capexTolerance >= 65 && fciCurrentPct >= 10) {
    return {
      scenario: "invest",
      rationale: "Strong capex tolerance and fair facility condition — investing now avoids compounding deferred-maintenance costs.",
    };
  }

  // NPV tie-breaker
  const bestNpv = Math.max(scenarios.invest.npvChf, scenarios.defer.npvChf, scenarios.neglect.npvChf);
  const scenario =
    scenarios.invest.npvChf === bestNpv ? "invest"
    : scenarios.defer.npvChf === bestNpv ? "defer"
    : "neglect";
  const rationaleByScenario: Record<string, string> = {
    invest: "Full investment produces the highest projected NPV given current assumptions.",
    defer: `Deferring ${deferYears} years maximises NPV given the near-term capex schedule.`,
    neglect: "Caution: NPV-optimal under current assumptions, but carries significant long-term condition risk.",
  };
  return { scenario, rationale: rationaleByScenario[scenario] };
}

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

      // Assets nearing EOL but beyond the projection horizon (≥60% depreciated, due after toYear)
      // These are silently dropped by projectBuilding — surface them as a forward planning signal.
      const NEARING_EOL_THRESHOLD_PCT = 60;
      const nearingEolCostCache = new Map<string, number>();
      const nearingEolAssets: Array<{
        assetId: string;
        assetName: string;
        topic: string;
        depreciationPct: number;
        estimatedReplacementYear: number;
        estimatedCostChf: number;
      }> = [];

      for (const asset of allAssets) {
        const dep = asset.depreciation;
        if (!dep) continue; // already in excludedAssets
        if (dep.depreciationPct < NEARING_EOL_THRESHOLD_PCT) continue;

        const replacementYear = estimateReplacementYear(dep);
        if (replacementYear === null || replacementYear <= projection.toYear) continue; // within horizon

        const costKey = `${asset.type}::${asset.topic}`;
        let estimatedCostChf = nearingEolCostCache.get(costKey);
        if (estimatedCostChf === undefined) {
          const cost = await estimateReplacementCost(prisma, orgId, asset.type as AssetType, asset.topic);
          estimatedCostChf = cost.bestEstimate.medianChf;
          nearingEolCostCache.set(costKey, estimatedCostChf);
        }

        nearingEolAssets.push({
          assetId: asset.id,
          assetName: asset.name,
          topic: asset.topic,
          depreciationPct: dep.depreciationPct,
          estimatedReplacementYear: replacementYear,
          estimatedCostChf,
        });
      }
      nearingEolAssets.sort((a, b) => a.estimatedReplacementYear - b.estimatedReplacementYear);

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
            nearingEolAssets,
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
          nearingEolAssets,
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
      const propertyValueChf = url.searchParams.get("propertyValueChf")
        ? Number(url.searchParams.get("propertyValueChf")) : undefined;
      const neglectNoiErosionRatePct = url.searchParams.get("neglectNoiErosionRatePct")
        ? Number(url.searchParams.get("neglectNoiErosionRatePct")) : undefined;

      const result = await computeNPVScenarios(prisma, orgId, params.id, {
        discountRatePct,
        incomeGrowthRatePct,
        horizonYears,
        deferYears,
        propertyValueChf,
        neglectNoiErosionRatePct,
      });

      // ── Strategy context + recommendation ─────────────────────
      const strategyProfile = await getBuildingProfileByBuildingId(prisma, params.id, orgId);
      let strategyContext: StrategyContext = { hasProfile: false };
      if (strategyProfile) {
        let dims: Record<string, number> | null = null;
        try {
          dims = JSON.parse(strategyProfile.effectiveDimensionsJson) as Record<string, number>;
        } catch { /* malformed JSON — proceed without dims */ }
        const { scenario, rationale } = computeRecommendation(
          strategyProfile.primaryArchetype,
          dims,
          result.fciCurrentPct,
          result.scenarios,
          result.deferYears,
        );
        strategyContext = {
          hasProfile: true,
          roleIntent: strategyProfile.roleIntent ?? undefined,
          archetype: strategyProfile.primaryArchetype,
          recommendedScenario: scenario,
          rationale,
        };
      }

      sendJson(res, 200, { data: { ...result, strategyContext } });
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
