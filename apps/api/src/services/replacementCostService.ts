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
  const interventions = await prisma.assetIntervention.findMany({
    where: {
      type: "REPLACEMENT",
      costChf: { not: null },
      asset: {
        orgId,
        type: assetType,
        topic: topicKey,
      },
    },
    select: { costChf: true },
    orderBy: { costChf: "asc" },
  });

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

  const benchmarkRange: CostRange | null = benchmark
    ? { lowChf: benchmark.lowChf, medianChf: benchmark.medianChf, highChf: benchmark.highChf }
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
    confidence = 0.6;
    sources.push("Industry benchmark");
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
