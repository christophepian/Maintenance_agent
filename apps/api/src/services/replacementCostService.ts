/**
 * Replacement Cost Service
 *
 * Produces cost estimates for replacing an asset by combining:
 *   1. Historical data (past AssetIntervention REPLACEMENT costs, Job actualCost)
 *   2. Industry benchmarks (ReplacementBenchmark table)
 *
 * Returns a cost range (low/median/high) with source attribution.
 *
 * Layer: service (delegates to taxRuleRepository + assetRepository for data).
 */

import { PrismaClient, AssetType } from "@prisma/client";
import { normalizeTopicKey } from "../utils/topicKey";
import * as taxRuleRepo from "../repositories/taxRuleRepository";
import { findReplacementInterventionsByTypeAndTopic } from "../repositories/assetRepository";

// ─── Static Fallback Benchmarks (HEV 2024) ─────────────────────
// Used when no row exists in the ReplacementBenchmark table.
// Values mirror apps/api/prisma/seed.ts — keep in sync when seed changes.

type BenchmarkKey = string; // `${AssetType}::${topic}`
const STATIC_BENCHMARKS: Record<BenchmarkKey, { lowChf: number; medianChf: number; highChf: number }> = {
  "SYSTEM::ELEVATOR":                      { lowChf: 70000,  medianChf: 110000, highChf: 160000 },
  "SYSTEM::ELEVATOR_ELECTRICS":            { lowChf: 8000,   medianChf: 16000,  highChf: 28000  },
  "SYSTEM::CENTRAL_HEATING":               { lowChf: 12000,  medianChf: 22000,  highChf: 38000  },
  "SYSTEM::BOILER":                        { lowChf: 4500,   medianChf: 7500,   highChf: 12000  },
  "SYSTEM::CIRCULATION_PUMP":              { lowChf: 600,    medianChf: 1100,   highChf: 1800   },
  "SYSTEM::HEATING_CONTROL":               { lowChf: 1800,   medianChf: 3200,   highChf: 5500   },
  "SYSTEM::WATER_PIPES":                   { lowChf: 7000,   medianChf: 14000,  highChf: 24000  },
  "SYSTEM::PIPE_COLD_COPPER":              { lowChf: 5000,   medianChf: 9000,   highChf: 16000  },
  "SYSTEM::PIPE_HOT_COPPER_INSULATED":     { lowChf: 6000,   medianChf: 11000,  highChf: 19000  },
  "SYSTEM::ELECTRICAL_INSTALLATION":       { lowChf: 10000,  medianChf: 20000,  highChf: 35000  },
  "SYSTEM::ELECTRICAL_CABLES":             { lowChf: 8000,   medianChf: 16000,  highChf: 28000  },
  "SYSTEM::INTERCOM":                      { lowChf: 1500,   medianChf: 3000,   highChf: 5500   },
  "SYSTEM::POWER_SOCKET":                  { lowChf: 80,     medianChf: 130,    highChf: 220    },
  "SYSTEM::SWITCH":                        { lowChf: 40,     medianChf: 70,     highChf: 120    },
  "STRUCTURAL::STAIRCASE":                 { lowChf: 15000,  medianChf: 35000,  highChf: 65000  },
  "STRUCTURAL::ROOF_COVERING":             { lowChf: 18000,  medianChf: 38000,  highChf: 65000  },
  "STRUCTURAL::PITCHED_ROOF_TILES":        { lowChf: 20000,  medianChf: 42000,  highChf: 72000  },
  "STRUCTURAL::EXTERIOR_WALL_COATING":     { lowChf: 15000,  medianChf: 30000,  highChf: 52000  },
  "STRUCTURAL::RENDER_MINERAL":            { lowChf: 12000,  medianChf: 25000,  highChf: 44000  },
  "STRUCTURAL::BALCONY_METAL":             { lowChf: 2500,   medianChf: 4500,   highChf: 8000   },
  "FIXTURE::ENTRANCE_DOOR":                { lowChf: 2500,   medianChf: 4500,   highChf: 7500   },
  "FIXTURE::WINDOW_INSULATED_PLASTIC_WOOD":{ lowChf: 700,    medianChf: 1100,   highChf: 1800   },
  "FIXTURE::ROLLER_SHUTTER_PLASTIC":       { lowChf: 350,    medianChf: 550,    highChf: 900    },
  "FIXTURE::DOOR_CHIPBOARD":               { lowChf: 250,    medianChf: 450,    highChf: 750    },
  "FIXTURE::KITCHEN_CABINET_CHIPBOARD":    { lowChf: 2500,   medianChf: 4500,   highChf: 8000   },
  "FIXTURE::COUNTERTOP_SYNTHETIC":         { lowChf: 700,    medianChf: 1200,   highChf: 2200   },
  "FIXTURE::KITCHEN_TAP":                  { lowChf: 200,    medianChf: 400,    highChf: 700    },
  "FIXTURE::BATHTUB_ACRYLIC":              { lowChf: 500,    medianChf: 900,    highChf: 1600   },
  "FIXTURE::SANITARY_CERAMIC":             { lowChf: 600,    medianChf: 1200,   highChf: 2000   },
  "FIXTURE::BATHROOM_TAP":                 { lowChf: 200,    medianChf: 400,    highChf: 700    },
  "FIXTURE::BALCONY_RAILING_METAL":        { lowChf: 400,    medianChf: 800,    highChf: 1400   },
  "FIXTURE::COMBINED_LOCK_SYSTEM":         { lowChf: 1200,   medianChf: 2200,   highChf: 3800   },
  "FINISH::PAINT_WALLS_DISPERSION":        { lowChf: 1200,   medianChf: 2200,   highChf: 3800   },
  "FINISH::PARQUET_MOSAIC":                { lowChf: 2000,   medianChf: 3500,   highChf: 6000   },
  "FINISH::KITCHEN_TILES_CERAMIC":         { lowChf: 800,    medianChf: 1600,   highChf: 2800   },
  "FINISH::BATHROOM_TILES_CERAMIC":        { lowChf: 1200,   medianChf: 2200,   highChf: 3800   },
  "APPLIANCE::WASHING_MACHINE_COMMON":     { lowChf: 700,    medianChf: 1100,   highChf: 1800   },
  "APPLIANCE::DRYER_COMMON":               { lowChf: 700,    medianChf: 1100,   highChf: 1800   },
};

// ─── Types ─────────────────────────────────────────────────────

export interface CostRange {
  lowChf: number;
  medianChf: number;
  highChf: number;
}

export interface ReplacementCostEstimate {
  assetType: AssetType;
  topic: string;
  historicalRange: CostRange | null;
  benchmarkRange: CostRange | null;
  bestEstimate: CostRange;
  confidence: number; // 0.0-1.0
  sources: string[];
}

// ─── Historical Cost Lookup ────────────────────────────────────

/**
 * Query past replacement costs from AssetIntervention records.
 * Groups by (assetType, topic) across the entire org for statistical relevance.
 */
async function getHistoricalReplacementCosts(
  prisma: PrismaClient,
  orgId: string,
  assetType: AssetType,
  topic: string,
): Promise<CostRange | null> {
  // Normalize topic for matching — topic is the primary depreciation key
  const topicKey = normalizeTopicKey(topic);

  // Find all REPLACEMENT interventions for this asset type+topic in the org
  const interventions = await findReplacementInterventionsByTypeAndTopic(
    prisma, orgId, assetType, topicKey,
  );

  if (interventions.length === 0) return null;

  const costs = interventions.map((i) => i.costChf!).sort((a, b) => a - b);
  const low = costs[0];
  const high = costs[costs.length - 1];
  const mid = Math.floor(costs.length / 2);
  const median = costs.length % 2 === 0
    ? Math.round((costs[mid - 1] + costs[mid]) / 2)
    : costs[mid];

  return { lowChf: low, medianChf: median, highChf: high };
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Estimate replacement cost for a single (assetType, topic).
 * Combines historical data and industry benchmarks into a unified range.
 */
export async function estimateReplacementCost(
  prisma: PrismaClient,
  orgId: string,
  assetType: AssetType,
  topic: string,
): Promise<ReplacementCostEstimate> {
  const [historicalRange, benchmark] = await Promise.all([
    getHistoricalReplacementCosts(prisma, orgId, assetType, topic),
    taxRuleRepo.findBenchmark(prisma, assetType, topic),
  ]);

  // Use DB benchmark if available, otherwise fall back to static HEV 2024 table
  const staticKey = `${assetType}::${normalizeTopicKey(topic)}`;
  const staticFallback = !benchmark ? STATIC_BENCHMARKS[staticKey] ?? null : null;

  const benchmarkRange: CostRange | null = benchmark
    ? { lowChf: benchmark.lowChf, medianChf: benchmark.medianChf, highChf: benchmark.highChf }
    : staticFallback
      ? { lowChf: staticFallback.lowChf, medianChf: staticFallback.medianChf, highChf: staticFallback.highChf }
      : null;

  const sources: string[] = [];
  let confidence = 0.2; // base confidence (no data)
  let bestEstimate: CostRange;

  if (historicalRange && benchmarkRange) {
    // Both sources: blend them (weight historical data slightly more)
    bestEstimate = {
      lowChf: Math.round(historicalRange.lowChf * 0.6 + benchmarkRange.lowChf * 0.4),
      medianChf: Math.round(historicalRange.medianChf * 0.6 + benchmarkRange.medianChf * 0.4),
      highChf: Math.round(historicalRange.highChf * 0.6 + benchmarkRange.highChf * 0.4),
    };
    confidence = 0.9;
    sources.push("Historical replacement data", "Industry benchmark");
  } else if (historicalRange) {
    bestEstimate = historicalRange;
    confidence = 0.7;
    sources.push("Historical replacement data");
  } else if (benchmarkRange) {
    bestEstimate = benchmarkRange;
    confidence = staticFallback ? 0.5 : 0.6; // slightly lower for static fallback vs DB row
    sources.push(staticFallback ? "Industry benchmark (HEV 2024 static)" : "Industry benchmark");
  } else {
    // No data at all — return a zero estimate with very low confidence
    bestEstimate = { lowChf: 0, medianChf: 0, highChf: 0 };
    confidence = 0.0;
    sources.push("No cost data available");
  }

  return {
    assetType,
    topic,
    historicalRange,
    benchmarkRange,
    bestEstimate,
    confidence,
    sources,
  };
}

/**
 * Batch estimate costs for multiple (assetType, topic) pairs.
 * Caches results by key to avoid duplicate queries.
 */
export async function batchEstimateReplacementCosts(
  prisma: PrismaClient,
  orgId: string,
  items: Array<{ assetType: AssetType; topic: string }>,
): Promise<Map<string, ReplacementCostEstimate>> {
  const results = new Map<string, ReplacementCostEstimate>();

  for (const item of items) {
    const key = `${item.assetType}::${item.topic}`;
    if (results.has(key)) continue;
    const estimate = await estimateReplacementCost(prisma, orgId, item.assetType, item.topic);
    results.set(key, estimate);
  }

  return results;
}
