/**
 * Asset Health Forecast Service
 *
 * Schema-free read-model that composes existing depreciation and legal-coverage
 * data into a forward-looking portfolio / per-building exposure summary.
 *
 * Reuses:
 *   - getAssetInventoryForBuilding()  (assetInventory.ts)
 *   - getMappingCoverage()            (legalService.ts)
 *   - inventoryRepository.listBuildings()
 *
 * Does NOT:
 *   - Persist anything (computed read-model only)
 *   - Invent cost estimates (no canonical price source exists)
 *   - Duplicate depreciation logic (delegates entirely to assetInventory)
 *   - Create a second legal-interpretation system
 *
 * Layer: service — no direct Prisma calls for assets/buildings (uses
 *        existing service + repository functions).  getMappingCoverage()
 *        calls prisma directly (same pattern as legalService.ts).
 */

import { PrismaClient } from "@prisma/client";
import { listBuildings } from "../repositories/inventoryRepository";
import { getAssetInventoryForBuilding, AssetInventoryItem } from "./assetInventory";
import { getMappingCoverage } from "./legalService";

// ─── Types ─────────────────────────────────────────────────────

export type HealthBucket = "GOOD" | "ATTENTION" | "CRITICAL";

export interface AssetTypeBreakdown {
  total: number;
  aging: number;
  endOfLife: number;
}

export interface BuildingForecast {
  buildingId: string;
  buildingName: string;
  canton: string | null;
  totalAssets: number;
  agingAssetsCount: number;
  endOfLifeAssetsCount: number;
  missingDepreciationCount: number;
  healthBucket: HealthBucket;
  byType: Record<string, AssetTypeBreakdown>;
}

export interface PortfolioSummary {
  totalBuildings: number;
  totalAssets: number;
  agingAssetsCount: number;
  endOfLifeAssetsCount: number;
  missingDepreciationCount: number;
  buildingsWithExposureCount: number;
}

export interface LegalCoverageSummary {
  totalCategories: number;
  mappedCategories: number;
  unmappedCategories: number;
}

export interface AssetHealthForecast {
  portfolio: PortfolioSummary;
  buildings: BuildingForecast[];
  legalCoverageSummary: LegalCoverageSummary | null;
}

// ─── Health Bucket Derivation ──────────────────────────────────

/**
 * Derive a simple health bucket from asset aging counts.
 *
 *   CRITICAL  — any asset past end-of-life (depreciationPct >= 100)
 *   ATTENTION — any asset aging (depreciationPct >= 75) but none past EOL
 *   GOOD      — all assets below 75% depreciation (or building has no assets)
 */
function deriveHealthBucket(
  agingCount: number,
  endOfLifeCount: number,
): HealthBucket {
  if (endOfLifeCount > 0) return "CRITICAL";
  if (agingCount > 0) return "ATTENTION";
  return "GOOD";
}

// ─── Per-Building Forecast ─────────────────────────────────────

function computeBuildingForecast(
  building: { id: string; name: string; canton: string | null },
  assets: AssetInventoryItem[],
): BuildingForecast {
  let agingCount = 0;
  let endOfLifeCount = 0;
  let missingCount = 0;
  const byType: Record<string, AssetTypeBreakdown> = {};

  for (const asset of assets) {
    const dep = asset.depreciation;
    const typeKey = asset.type;

    if (!byType[typeKey]) {
      byType[typeKey] = { total: 0, aging: 0, endOfLife: 0 };
    }
    byType[typeKey].total += 1;

    if (dep === null) {
      // No depreciation data — either missing standard or missing install date
      missingCount += 1;
    } else if (dep.depreciationPct >= 100) {
      endOfLifeCount += 1;
      byType[typeKey].endOfLife += 1;
    } else if (dep.depreciationPct >= 75) {
      agingCount += 1;
      byType[typeKey].aging += 1;
    }
  }

  return {
    buildingId: building.id,
    buildingName: building.name,
    canton: building.canton,
    totalAssets: assets.length,
    agingAssetsCount: agingCount,
    endOfLifeAssetsCount: endOfLifeCount,
    missingDepreciationCount: missingCount,
    healthBucket: deriveHealthBucket(agingCount, endOfLifeCount),
    byType,
  };
}

// ─── Portfolio Forecast (public) ───────────────────────────────

/**
 * Compute the full asset-health forecast for an org.
 *
 * Steps:
 *   1. Fetch all active buildings for the org.
 *   2. For each building, fetch asset inventory with depreciation.
 *   3. Aggregate counts into per-building and portfolio summaries.
 *   4. Optionally attach legal coverage summary.
 */
export async function getAssetHealthForecast(
  prisma: PrismaClient,
  orgId: string,
  options: { includeLegalCoverage?: boolean } = {},
): Promise<AssetHealthForecast> {
  const { includeLegalCoverage = true } = options;

  // 1. Fetch buildings
  const buildings = await listBuildings(prisma, orgId);

  // 2–3. Compute per-building forecasts
  const buildingForecasts: BuildingForecast[] = [];

  for (const building of buildings) {
    const assets = await getAssetInventoryForBuilding(
      prisma,
      orgId,
      building.id,
      { canton: building.canton },
    );
    buildingForecasts.push(computeBuildingForecast(building, assets));
  }

  // 4. Aggregate portfolio summary
  let totalAssets = 0;
  let agingTotal = 0;
  let endOfLifeTotal = 0;
  let missingTotal = 0;
  let exposedBuildings = 0;

  for (const bf of buildingForecasts) {
    totalAssets += bf.totalAssets;
    agingTotal += bf.agingAssetsCount;
    endOfLifeTotal += bf.endOfLifeAssetsCount;
    missingTotal += bf.missingDepreciationCount;
    if (bf.agingAssetsCount > 0 || bf.endOfLifeAssetsCount > 0) {
      exposedBuildings += 1;
    }
  }

  const portfolio: PortfolioSummary = {
    totalBuildings: buildings.length,
    totalAssets,
    agingAssetsCount: agingTotal,
    endOfLifeAssetsCount: endOfLifeTotal,
    missingDepreciationCount: missingTotal,
    buildingsWithExposureCount: exposedBuildings,
  };

  // 5. Legal coverage (optional — graceful failure)
  let legalCoverageSummary: LegalCoverageSummary | null = null;
  if (includeLegalCoverage) {
    try {
      const coverage = await getMappingCoverage(orgId);
      legalCoverageSummary = coverage.summary;
    } catch {
      // Non-fatal — legal coverage is supplementary
      legalCoverageSummary = null;
    }
  }

  return {
    portfolio,
    buildings: buildingForecasts,
    legalCoverageSummary,
  };
}
