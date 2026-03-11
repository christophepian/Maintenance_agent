/**
 * Legal Decision Engine
 *
 * Evaluates legal obligations for maintenance requests using:
 *   1. Statutory rules (CO 259a, 256 etc.)
 *   2. Depreciation signals (Paritätische Lebensdauertabelle)
 *   3. Category mappings (request category → legal topic)
 *
 * All evaluation is deterministic (JSON DSL), no LLM reasoning.
 * Results are logged in LegalEvaluationLog for audit.
 */

import { LegalObligation, LegalAuthority, AssetType, LegalRuleScope } from "@prisma/client";
import * as crypto from "crypto";
import prisma from "./prismaClient";
import { REQUEST_LEGAL_DECISION_INCLUDE } from "./legalIncludes";
import {
  resolveRequestOrg,
  assertOrgScope,
} from "../governance/orgScope";
import { computeDepreciationSignal, DepreciationSignalDTO } from "./depreciation";
import {
  cantonFromPostalCode,
  extractPostalCode,
} from "./cantonMapping";

// ==========================================
// DTOs
// ==========================================

export interface LegalDecisionDTO {
  requestId: string;
  legalTopic: string | null;
  legalObligation: LegalObligation;
  confidence: number; // 0–100
  reasons: string[];
  citations: Citation[];
  depreciationSignal: DepreciationSignalDTO | null;
  recommendedActions: string[];
  rfpId: string | null;
  evaluationLogId: string;
}

export interface Citation {
  article: string;
  text: string;
  authority: LegalAuthority;
}

// ==========================================
// Errors
// ==========================================

export class RequestNotFoundError extends Error {
  constructor(requestId: string) {
    super(`Request ${requestId} not found`);
    this.name = "RequestNotFoundError";
  }
}

// ==========================================
// Core: evaluateRequestLegalDecision
// ==========================================

/**
 * Main entry point for legal evaluation.
 *
 * Steps:
 *   1. Resolve org scope
 *   2. Load request with canonical include
 *   3. Derive canton if needed
 *   4. Map category → legalTopic
 *   5. Evaluate statutory rules
 *   6. Compute depreciation signal
 *   7. Produce DecisionResult
 *   8. Write LegalEvaluationLog
 */
export async function evaluateRequestLegalDecision(
  callerOrgId: string,
  requestId: string,
): Promise<LegalDecisionDTO> {
  // 1. Resolve org scope
  const orgRes = await resolveRequestOrg(prisma, requestId);
  assertOrgScope(callerOrgId, orgRes);

  // 2. Load request with canonical include
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: REQUEST_LEGAL_DECISION_INCLUDE,
  });

  if (!request) {
    throw new RequestNotFoundError(requestId);
  }

  // 3. Derive canton if building exists and canton not set
  let canton: string | null = null;
  if (request.unit?.building) {
    canton = request.unit.building.canton;
    if (!canton) {
      canton = await deriveBuildingCanton(request.unit.building.id, request.unit.building.address);
    }
  }

  // 4. Map category → legalTopic
  const legalTopic = await mapCategoryToLegalTopic(
    request.category,
    callerOrgId,
  );

  // 5. Evaluate statutory rules
  const ruleEvaluation = await evaluateStatutoryRules(
    legalTopic,
    canton,
    request,
  );

  // 6. Compute depreciation signal
  let depreciationSignal: DepreciationSignalDTO | null = null;
  if (request.unit && legalTopic) {
    depreciationSignal = await computeDepreciationForRequest(
      request,
      legalTopic,
      canton,
    );
  }

  // 7. Produce decision
  const obligation = determineObligation(ruleEvaluation, depreciationSignal);
  const confidence = computeConfidence(ruleEvaluation, legalTopic, depreciationSignal);
  const reasons = buildReasons(ruleEvaluation, depreciationSignal, obligation);
  const citations = ruleEvaluation.citations;
  const recommendedActions = buildRecommendedActions(obligation, depreciationSignal);

  // 8. Write evaluation log
  const contextJson = {
    requestId,
    category: request.category,
    legalTopic,
    canton,
    unitId: request.unitId,
    buildingId: request.unit?.buildingId ?? null,
    hasAppliance: !!request.appliance,
  };
  const contextHash = sha256(JSON.stringify(contextJson));

  const evalLog = await prisma.legalEvaluationLog.create({
    data: {
      orgId: callerOrgId,
      buildingId: request.unit?.buildingId ?? null,
      unitId: request.unitId ?? null,
      requestId,
      contextJson,
      contextHash,
      resultJson: {
        legalTopic,
        obligation,
        confidence,
        reasons,
        citations: citations.map((c) => ({
          article: c.article,
          text: c.text,
          authority: c.authority,
        })),
        recommendedActions,
        depreciationSignal: depreciationSignal
          ? {
              remainingLifePct: depreciationSignal.remainingLifePct,
              ageMonths: depreciationSignal.ageMonths,
              usefulLifeMonths: depreciationSignal.usefulLifeMonths,
              fullyDepreciated: depreciationSignal.fullyDepreciated,
            }
          : null,
        matchedRuleCount: ruleEvaluation.matchedVersionIds.length,
      },
      matchedRuleVersionIdsJson: ruleEvaluation.matchedVersionIds,
    },
  });

  return {
    requestId,
    legalTopic,
    legalObligation: obligation,
    confidence,
    reasons,
    citations,
    depreciationSignal,
    recommendedActions,
    rfpId: null, // Set by the route handler after RFP creation
    evaluationLogId: evalLog.id,
  };
}

// ==========================================
// Canton Derivation
// ==========================================

/**
 * Derive canton from building address and persist it.
 * Never overwrites manual canton values.
 */
async function deriveBuildingCanton(
  buildingId: string,
  address: string,
): Promise<string | null> {
  const postalCode = extractPostalCode(address);
  if (!postalCode) return null;

  const canton = cantonFromPostalCode(postalCode);
  if (!canton) return null;

  // Persist derived canton
  await prisma.building.update({
    where: { id: buildingId },
    data: {
      canton,
      cantonDerivedAt: new Date(),
    },
  });

  return canton;
}

// ==========================================
// Category Mapping
// ==========================================

/**
 * Map Request.category → legalTopic using LegalCategoryMapping.
 *
 * Priority:
 *   1. Org-specific mapping (confidence ≥ threshold)
 *   2. Global default (orgId = null, confidence ≥ threshold)
 *   3. null if below threshold — route to owner, not legal path
 */
const CONFIDENCE_THRESHOLD = 0.7;

async function mapCategoryToLegalTopic(
  category: string | null,
  orgId: string,
): Promise<string | null> {
  if (!category) return null;

  // Try org-specific first
  const orgMapping = await prisma.legalCategoryMapping.findFirst({
    where: {
      orgId,
      requestCategory: category,
      isActive: true,
    },
  });
  if (orgMapping && orgMapping.confidence >= CONFIDENCE_THRESHOLD) {
    return orgMapping.legalTopic;
  }

  // Fall back to global
  const globalMapping = await prisma.legalCategoryMapping.findFirst({
    where: {
      orgId: null,
      requestCategory: category,
      isActive: true,
    },
  });

  if (globalMapping && globalMapping.confidence >= CONFIDENCE_THRESHOLD) {
    return globalMapping.legalTopic;
  }

  // Below threshold → treat as unmapped, route to owner not legal path
  return null;
}

// ==========================================
// Statutory Rule Evaluation
// ==========================================

interface RuleEvaluationResult {
  federalObligation: LegalObligation | null;
  cantonalObligation: LegalObligation | null;
  matchedVersionIds: string[];
  citations: Citation[];
  highestPriority: number;
}

/**
 * Evaluate statutory rules for a given legal topic and canton.
 *
 * Rule selection:
 *   1. Active rules matching the topic
 *   2. Filtered by jurisdiction (CH) and canton
 *   3. Ordered by priority descending
 *
 * DSL evaluation:
 *   Each LegalRuleVersion.dslJson contains a deterministic JSON structure
 *   with fields: { obligation, conditions?, citations? }
 */
async function evaluateStatutoryRules(
  legalTopic: string | null,
  canton: string | null,
  request: any,
): Promise<RuleEvaluationResult> {
  if (!legalTopic) {
    return {
      federalObligation: null,
      cantonalObligation: null,
      matchedVersionIds: [],
      citations: [],
      highestPriority: 0,
    };
  }

  // Find active rules that match the topic — filter at query level
  const now = new Date();
  const rules = await prisma.legalRule.findMany({
    where: {
      isActive: true,
      ruleType: "MAINTENANCE_OBLIGATION",
      jurisdiction: "CH",
      topic: legalTopic,
      OR: [
        { canton: null }, // national rules
        { canton: canton ?? undefined }, // canton-specific
      ],
    },
    include: {
      versions: {
        where: {
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: now } },
          ],
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1, // latest version only
      },
    },
    orderBy: [
      { scope: "asc" },     // FEDERAL first (enum order: FEDERAL < CANTONAL < MUNICIPAL)
      { priority: "desc" },
    ],
  });

  const matchedVersionIds: string[] = [];
  const citationMap = new Map<string, Citation>();
  let federalObligation: LegalObligation | null = null;
  let cantonalObligation: LegalObligation | null = null;
  let highestPriority = 0;

  for (const rule of rules) {
    const version = rule.versions[0];
    if (!version) continue;

    // Evaluate DSL
    const dsl = version.dslJson as any;
    if (!dsl) continue;

    // Topic already filtered at query level; skip legacy in-DSL topic check
    // only if rule.topic is set (migrated rules). Unmigrated rules still
    // carry topic in dslJson — honour that for backwards compat.
    if (!rule.topic && dsl.topic && dsl.topic !== legalTopic) continue;

    // DSL condition evaluation (simple match for MVP)
    if (dsl.conditions) {
      const conditionsMet = evaluateDslConditions(dsl.conditions, request);
      if (!conditionsMet) continue;
    }

    matchedVersionIds.push(version.id);

    // Extract obligation, tracking scope separately
    if (dsl.obligation) {
      const ob = dsl.obligation as LegalObligation;
      if (rule.scope === LegalRuleScope.FEDERAL || rule.scope === undefined) {
        if (!federalObligation || rule.priority > highestPriority) {
          federalObligation = ob;
        }
      } else if (rule.scope === LegalRuleScope.CANTONAL) {
        if (!cantonalObligation || rule.priority > highestPriority) {
          cantonalObligation = ob;
        }
      }
      // MUNICIPAL can be added later
      if (rule.priority > highestPriority) {
        highestPriority = rule.priority;
      }
    }

    // Extract citations (deduplicate by article + text + authority)
    if (version.citationsJson) {
      const ruleCitations = version.citationsJson as any[];
      for (const c of ruleCitations) {
        const key = `${c.article || ""}|${c.text || ""}|${rule.authority}`;
        if (!citationMap.has(key)) {
          citationMap.set(key, {
            article: c.article || "",
            text: c.text || "",
            authority: rule.authority,
          });
        }
      }
    }
  }

  const citations = Array.from(citationMap.values());

  return { federalObligation, cantonalObligation, matchedVersionIds, citations, highestPriority };
}

/**
 * Simple DSL condition evaluator.
 *
 * Conditions are objects like:
 *   { field: "category", op: "eq", value: "stove" }
 *   { field: "estimatedCost", op: "gt", value: 500 }
 */
function evaluateDslConditions(
  conditions: any[],
  request: any,
): boolean {
  if (!Array.isArray(conditions)) return true;

  for (const cond of conditions) {
    const fieldValue = request[cond.field];
    switch (cond.op) {
      case "eq":
        if (fieldValue !== cond.value) return false;
        break;
      case "neq":
        if (fieldValue === cond.value) return false;
        break;
      case "gt":
        if (typeof fieldValue !== "number" || fieldValue <= cond.value) return false;
        break;
      case "gte":
        if (typeof fieldValue !== "number" || fieldValue < cond.value) return false;
        break;
      case "lt":
        if (typeof fieldValue !== "number" || fieldValue >= cond.value) return false;
        break;
      case "in":
        if (!Array.isArray(cond.value) || !cond.value.includes(fieldValue)) return false;
        break;
      case "exists":
        if (cond.value && !fieldValue) return false;
        if (!cond.value && fieldValue) return false;
        break;
      default:
        // Unknown operator — skip
        break;
    }
  }

  return true;
}

// ==========================================
// Depreciation for Request
// ==========================================

/**
 * Try to compute depreciation for the request.
 *
 * If there's an Asset matching the unit + topic, use it.
 * Otherwise fall back to the appliance install date if available.
 */
async function computeDepreciationForRequest(
  request: any,
  legalTopic: string,
  canton: string | null,
): Promise<DepreciationSignalDTO | null> {
  if (!request.unit) return null;

  // Look for an Asset in the unit matching this topic
  const asset = await prisma.asset.findFirst({
    where: {
      unitId: request.unit.id,
      topic: legalTopic,
      isActive: true,
    },
  });

  if (asset) {
    return computeDepreciationSignal(asset, new Date(), canton);
  }

  // Fallback: if request has an appliance with installDate, synthesize
  if (request.appliance?.installDate) {
    const syntheticAsset = {
      id: `appliance:${request.appliance.id}`,
      type: "APPLIANCE" as AssetType,
      topic: legalTopic,
      installedAt: request.appliance.installDate,
      lastRenovatedAt: null,
    };
    return computeDepreciationSignal(syntheticAsset, new Date(), canton);
  }

  return null;
}

// ==========================================
// Decision Logic
// ==========================================

function determineObligation(
  ruleEval: RuleEvaluationResult,
  depreciation: DepreciationSignalDTO | null,
): LegalObligation {
  // Federal obligation always wins over cantonal
  if (ruleEval.federalObligation) return ruleEval.federalObligation;
  if (ruleEval.cantonalObligation) return ruleEval.cantonalObligation;

  // If depreciation shows asset is fully depreciated → landlord obligation
  if (depreciation?.fullyDepreciated) return LegalObligation.OBLIGATED;

  // If depreciation shows >80% depreciated → discretionary
  if (depreciation && depreciation.remainingLifePct < 20) {
    return LegalObligation.DISCRETIONARY;
  }

  return LegalObligation.UNKNOWN;
}

function computeConfidence(
  ruleEval: RuleEvaluationResult,
  legalTopic: string | null,
  depreciation: DepreciationSignalDTO | null,
): number {
  let confidence = 0;

  // Base: category was mapped
  if (legalTopic) confidence += 20;

  // Statutory rule matched
  if (ruleEval.matchedVersionIds.length > 0) confidence += 50;

  // Depreciation data available
  if (depreciation) confidence += 20;

  // Multiple supporting rules
  if (ruleEval.matchedVersionIds.length > 1) confidence += 10;

  return Math.min(100, confidence);
}

function buildReasons(
  ruleEval: RuleEvaluationResult,
  depreciation: DepreciationSignalDTO | null,
  obligation: LegalObligation,
): string[] {
  const reasons: string[] = [];

  if (ruleEval.matchedVersionIds.length > 0) {
    reasons.push(
      `${ruleEval.matchedVersionIds.length} statutory rule(s) evaluated`,
    );
  }

  if (depreciation) {
    if (depreciation.fullyDepreciated) {
      reasons.push(
        `Asset fully depreciated (${depreciation.ageMonths} months, ` +
          `useful life ${depreciation.usefulLifeMonths} months)`,
      );
    } else {
      reasons.push(
        `Asset at ${depreciation.remainingLifePct}% remaining life ` +
          `(${depreciation.ageMonths}/${depreciation.usefulLifeMonths} months)`,
      );
    }
  }

  if (obligation === LegalObligation.OBLIGATED) {
    reasons.push("Landlord maintenance obligation applies");
  } else if (obligation === LegalObligation.TENANT_RESPONSIBLE) {
    reasons.push("Tenant responsibility per applicable rules");
  } else if (obligation === LegalObligation.UNKNOWN) {
    reasons.push("Insufficient data for legal determination — manual review recommended");
  }

  return reasons;
}

function buildRecommendedActions(
  obligation: LegalObligation,
  depreciation: DepreciationSignalDTO | null,
): string[] {
  const actions: string[] = [];

  if (obligation === LegalObligation.OBLIGATED) {
    actions.push("CREATE_RFP");
    actions.push("NOTIFY_MANAGER");
  } else if (obligation === LegalObligation.DISCRETIONARY) {
    actions.push("ROUTE_TO_OWNER");
    actions.push("REVIEW_RECOMMENDED");
    if (depreciation && depreciation.remainingLifePct < 20) {
      actions.push("CONSIDER_REPLACEMENT");
    }
  } else if (obligation === LegalObligation.TENANT_RESPONSIBLE) {
    actions.push("NOTIFY_TENANT");
  } else {
    // UNKNOWN — route to owner for manual decision instead of stalling
    actions.push("ROUTE_TO_OWNER");
    actions.push("MANUAL_REVIEW");
  }

  return actions;
}

// ==========================================
// Utilities
// ==========================================

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
