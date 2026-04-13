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
import { extractDefectSignals, type DefectSignals } from "./defectClassifier";
import { matchDefectsToRules, type MatchResult, type DefectMatch } from "./defectMatcher";
import {
  calculateRentReductionForUnit,
  type RentReductionResult,
} from "./rentReductionCalculator";
import {
  getTranslation,
  classifyRequestNature,
  normaliseForMatch,
  tokenizeAndStem,
  type RequestNature,
} from "./legalTranslations";

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
  matchedReductions: RentReductionMatch[];
  /** Phase B: structured defect signals from complaint text */
  defectSignals: DefectSignals | null;
  /** Phase B: ranked defect matches with confidence scores */
  defectMatches: DefectMatch[];
  /** Phase B: CHF rent reduction estimate (null if no active lease) */
  rentReductionEstimate: RentReductionResult | null;
  recommendedActions: string[];
  rfpId: string | null;
  evaluationLogId: string;
}

export interface RentReductionMatch {
  ruleKey: string;
  defect: string;          // French (kept for audit)
  defectEn: string;        // English display text
  category: string;        // French ASLOCA category
  categoryEn: string;      // English category
  reductionPercent: number;
  basis: string;
  source: string;
  relevanceScore: number; // 0–100 keyword match confidence
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

  // 6b. Evaluate rent reduction case law (ASLOCA jurisprudence)
  const matchedReductions = await evaluateRentReductionRules(
    request,
    legalTopic,
    canton,
  );

  // 6c. Phase B: Extract structured defect signals from complaint text
  const defectSignals = extractDefectSignals(
    request.description ?? "",
    request.category ?? null,
  );

  // 6d. Phase B: Match defect signals against ASLOCA rules (DB-backed scoring)
  let defectMatchResult: MatchResult = {
    bestMatch: null, matches: [], requestNature: "other", unmatchedSignals: [],
  };
  if (defectSignals.keywords.length > 0 || defectSignals.inferredCategories.length > 0) {
    defectMatchResult = await matchDefectsToRules(
      defectSignals,
      canton,
      request.description ?? null,
      request.category ?? null,
    );
  }

  // 6e. Phase B: Compute CHF rent reduction estimate if unit has an active lease
  let rentReductionEstimate: RentReductionResult | null = null;
  if (defectMatchResult.matches.length > 0 && request.unitId) {
    rentReductionEstimate = await calculateRentReductionForUnit(
      defectMatchResult.matches,
      request.unitId,
      defectSignals.duration,
    );
  }

  // 7. Produce decision
  const obligation = determineObligation(ruleEvaluation, depreciationSignal);
  const confidence = computeConfidence(ruleEvaluation, legalTopic, depreciationSignal, matchedReductions, defectMatchResult);
  const reasons = buildReasons(ruleEvaluation, depreciationSignal, obligation, matchedReductions, defectMatchResult, rentReductionEstimate);
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
        matchedReductions: matchedReductions.map((r) => ({
          ruleKey: r.ruleKey,
          defect: r.defect,
          category: r.category,
          reductionPercent: r.reductionPercent,
          relevanceScore: r.relevanceScore,
        })),
        // Phase B structured analysis
        defectSignals: defectSignals.keywords.length > 0 ? {
          keywordCount: defectSignals.keywords.length,
          severity: defectSignals.severity,
          inferredCategories: defectSignals.inferredCategories,
          rooms: defectSignals.affectedArea.rooms,
          durationMonths: defectSignals.duration.months ?? null,
          seasonal: defectSignals.duration.seasonal,
        } : null,
        defectMatches: defectMatchResult.matches.map((m) => ({
          ruleKey: m.ruleKey,
          defect: m.defect,
          defectEn: m.defectEn,
          category: m.category,
          categoryEn: m.categoryEn,
          reductionPercent: m.reductionPercent,
          matchConfidence: m.matchConfidence,
        })),
        rentReductionEstimate: rentReductionEstimate ? {
          netRentChf: rentReductionEstimate.netRentChf,
          totalReductionPercent: rentReductionEstimate.totalReductionPercent,
          totalReductionChf: rentReductionEstimate.totalReductionChf,
          capApplied: rentReductionEstimate.capApplied,
        } : null,
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
    matchedReductions,
    defectSignals: defectSignals.keywords.length > 0 ? defectSignals : null,
    defectMatches: defectMatchResult.matches,
    rentReductionEstimate,
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
      authority: "STATUTE",
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

    // DSL condition evaluation (async — supports variable_compare DB lookups)
    if (dsl.conditions) {
      const conditionsMet = await evaluateDslConditions(dsl.conditions, request, legalTopic, canton);
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

// ==========================================
// Rent Reduction Case Law (ASLOCA Jurisprudence)
// ==========================================

// CATEGORY_KEYWORD_MAP removed — nature gating + exact-word matching in
// computeRelevance() now handles category alignment more precisely.

/**
 * Evaluate rent reduction rules from ASLOCA/Lachat jurisprudence.
 *
 * Unlike statutory rules, rent reductions have no `topic` field.
 * Matching uses bilingual keyword matching via the translation dictionary
 * (legalTranslations.ts) plus request-nature classification for
 * applicability filtering.
 *
 * Returns RentReductionMatch[] ordered by relevanceScore desc, reductionPercent desc.
 */
async function evaluateRentReductionRules(
  request: any,
  legalTopic: string | null,
  canton: string | null,
): Promise<RentReductionMatch[]> {
  const now = new Date();

  // Load all active INDUSTRY_STANDARD rent reduction rules
  const rules = await prisma.legalRule.findMany({
    where: {
      isActive: true,
      authority: "INDUSTRY_STANDARD",
      jurisdiction: "CH",
      OR: [
        { canton: null },
        { canton: canton ?? undefined },
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
        take: 1,
      },
    },
  });

  // Build enriched search context from request
  const searchCtx = buildSearchContext(request, legalTopic);

  const matches: RentReductionMatch[] = [];

  for (const rule of rules) {
    const version = rule.versions[0];
    if (!version) continue;

    const dsl = version.dslJson as any;
    if (!dsl || dsl.type !== "RENT_REDUCTION") continue;

    // Nature gate: skip rules whose nature doesn't match the request
    const translation = getTranslation(rule.key);
    if (
      searchCtx.nature !== "other" &&
      translation &&
      translation.nature !== searchCtx.nature &&
      translation.nature !== "maintenance_general"
    ) {
      continue;
    }

    const relevanceScore = computeRelevance(dsl, searchCtx, rule.key);
    if (relevanceScore === 0) continue;

    matches.push({
      ruleKey: rule.key,
      defect: dsl.defect || "",
      defectEn: translation?.defectEn ?? dsl.defect ?? "",
      category: dsl.category || "",
      categoryEn: translation?.categoryEn ?? dsl.category ?? "",
      reductionPercent: dsl.reductionPercent ?? 0,
      basis: dsl.basis || "jurisprudence",
      source: dsl.source || "ASLOCA/Lachat",
      relevanceScore,
    });
  }

  // Sort by relevance desc, then reduction % desc
  matches.sort((a, b) =>
    b.relevanceScore - a.relevanceScore || b.reductionPercent - a.reductionPercent
  );

  return matches;
}

// ==========================================
// Search context (replaces old buildSearchTerms)
// ==========================================

interface SearchContext {
  /** All normalized tokens from description + category + legalTopic */
  tokens: string[];
  /** Stemmed versions of those tokens */
  stems: string[];
  /** Classified request nature */
  nature: RequestNature;
  /** Legal topic (e.g. "PLUMBING") if resolved */
  legalTopic: string | null;
}

/**
 * Build a rich search context from the request for bilingual matching.
 * Uses accent stripping + stemming for both request text and rule text.
 */
function buildSearchContext(request: any, legalTopic: string | null): SearchContext {
  const parts: string[] = [];
  if (request.description) parts.push(request.description);
  if (request.category) parts.push(request.category.replace(/[_-]/g, " "));
  if (legalTopic) parts.push(legalTopic.replace(/[_-]/g, " "));

  const combinedText = parts.join(" ");
  const { tokens, stems } = tokenizeAndStem(combinedText);
  const nature = classifyRequestNature(request.description ?? "", request.category ?? null);

  return { tokens, stems, nature, legalTopic };
}

/** Minimum token length to avoid false substring hits */
const MIN_RELEVANCE_TOKEN_LEN = 4;

/**
 * Compute relevance score (0–100) between a rent reduction DSL rule and
 * the search context.
 *
 * Scoring dimensions:
 *   1. English translation keyword match (exact word)    → +15 per hit (max 45)
 *   2. French defect text exact-token match              → +10 per hit (max 20)
 *   3. Request nature ↔ rule nature alignment            → +20
 *   4. Legal topic maps to the ASLOCA category           → +15
 *
 * Max theoretical score = 100.
 */
function computeRelevance(
  dsl: any,
  ctx: SearchContext,
  ruleKey: string,
): number {
  let score = 0;

  const aslocaCategory = dsl.category || "";
  const defectFr = normaliseForMatch(dsl.defect || "");
  const translation = getTranslation(ruleKey);

  // ── 1. English translation exact-word match ────────────────────
  if (translation) {
    const enTermsNorm = translation.searchTermsEn
      .map(normaliseForMatch)
      .filter((t) => t.length >= MIN_RELEVANCE_TOKEN_LEN);

    let translationHits = 0;
    for (const tok of ctx.tokens) {
      if (tok.length < MIN_RELEVANCE_TOKEN_LEN) continue;
      // Exact word match within multi-word translation terms
      const hit = enTermsNorm.some((t) => t === tok || t.split(/\s+/).includes(tok));
      if (hit) translationHits++;
    }
    score += Math.min(45, translationHits * 15);
  }

  // ── 2. French defect text exact-token overlap ──────────────────
  const defectFrTokens = defectFr.split(/[\s,;.!?()[\]{}'"–—/°+]+/).filter((t) => t.length >= MIN_RELEVANCE_TOKEN_LEN);
  let frHits = 0;
  for (const tok of ctx.tokens) {
    if (tok.length < MIN_RELEVANCE_TOKEN_LEN) continue;
    if (defectFrTokens.some((dt) => dt === tok)) frHits++;
  }
  score += Math.min(20, frHits * 10);

  // ── 3. Request nature alignment ───────────────────────────────
  if (translation && ctx.nature !== "other" && translation.nature === ctx.nature) {
    score += 20;
  }

  // ── 4. Legal topic → ASLOCA category mapping bonus ────────────
  if (ctx.legalTopic) {
    const topicLower = ctx.legalTopic.toLowerCase();
    const topicMatch =
      (aslocaCategory === "Température" && (topicLower.includes("heating") || topicLower.includes("hvac"))) ||
      (aslocaCategory === "Humidité" && topicLower.includes("plumbing")) ||
      (aslocaCategory === "Dégâts d'eau" && (topicLower.includes("plumbing") || topicLower.includes("water"))) ||
      (aslocaCategory === "Rénovations" && topicLower.includes("renovation")) ||
      (aslocaCategory === "Immissions" && topicLower.includes("noise")) ||
      (aslocaCategory === "Défauts" && (topicLower.includes("appliance") || topicLower.includes("equipment")));
    if (topicMatch) score += 15;
  }

  return Math.min(100, score);
}

/**
 * DSL condition evaluator.
 *
 * Supported condition types:
 *   { type: "topic_match", topic: "PLUMBING" }  — matches resolved legal topic
 *   { type: "always_true" }                       — unconditional pass
 *   { type: "always_false" }                      — unconditional fail
 *   { type: "AND", conditions: [...] }             — all sub-conditions must pass
 *   { type: "OR",  conditions: [...] }             — any sub-condition must pass
 *   { type: "variable_compare",                    — compare a LegalVariable value
 *           variableKey: "REFERENCE_INTEREST_RATE",
 *           op: "gt" | "gte" | "lt" | "lte" | "eq" | "neq",
 *           value: 1.75 }                           — against a threshold
 *
 * Legacy format (backwards compat):
 *   { field: "category", op: "eq", value: "stove" }
 *   { field: "estimatedCost", op: "gt", value: 500 }
 */
async function evaluateDslConditions(
  conditions: any[],
  request: any,
  resolvedTopic?: string | null,
  canton?: string | null,
): Promise<boolean> {
  if (!Array.isArray(conditions)) return true;

  for (const cond of conditions) {
    if (!(await evaluateSingleCondition(cond, request, resolvedTopic, canton))) return false;
  }

  return true;
}

async function evaluateSingleCondition(
  cond: any,
  request: any,
  resolvedTopic?: string | null,
  canton?: string | null,
): Promise<boolean> {
  if (!cond || typeof cond !== "object") return true;

  // ── Typed condition nodes ──────────────────────────────────
  if (cond.type === "topic_match") {
    return resolvedTopic === cond.topic;
  }
  if (cond.type === "always_true") {
    return true;
  }
  if (cond.type === "always_false") {
    return false;
  }
  if (cond.type === "AND" && Array.isArray(cond.conditions)) {
    for (const sub of cond.conditions) {
      if (!(await evaluateSingleCondition(sub, request, resolvedTopic, canton))) return false;
    }
    return true;
  }
  if (cond.type === "OR" && Array.isArray(cond.conditions)) {
    for (const sub of cond.conditions) {
      if (await evaluateSingleCondition(sub, request, resolvedTopic, canton)) return true;
    }
    return false;
  }

  // ── S-P0-002-02: variable_compare — resolve LegalVariable from DB ──
  if (cond.type === "variable_compare" && cond.variableKey && cond.op) {
    const resolved = await resolveLegalVariable(cond.variableKey, canton);
    if (resolved === null) return true; // Permissive: skip if variable not found
    const numValue = typeof resolved === "number" ? resolved : Number(resolved);
    if (!Number.isFinite(numValue)) return true;
    const threshold = Number(cond.value);
    if (!Number.isFinite(threshold)) return true;
    switch (cond.op) {
      case "gt":  return numValue > threshold;
      case "gte": return numValue >= threshold;
      case "lt":  return numValue < threshold;
      case "lte": return numValue <= threshold;
      case "eq":  return numValue === threshold;
      case "neq": return numValue !== threshold;
      default:    return true;
    }
  }

  // ── Legacy field/op/value format ───────────────────────────
  if (cond.field && cond.op) {
    const fieldValue = request[cond.field];
    switch (cond.op) {
      case "eq":
        return fieldValue === cond.value;
      case "neq":
        return fieldValue !== cond.value;
      case "gt":
        return typeof fieldValue === "number" && fieldValue > cond.value;
      case "gte":
        return typeof fieldValue === "number" && fieldValue >= cond.value;
      case "lt":
        return typeof fieldValue === "number" && fieldValue < cond.value;
      case "in":
        return Array.isArray(cond.value) && cond.value.includes(fieldValue);
      case "exists":
        return cond.value ? !!fieldValue : !fieldValue;
      default:
        return true; // Unknown operator — skip
    }
  }

  // Unknown condition shape — permissive (don't block evaluation)
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
  matchedReductions?: RentReductionMatch[],
  defectMatchResult?: MatchResult,
): number {
  let confidence = 0;

  // ── Statutory rule match: 0–40 points ───────────────────────
  // A statutory rule (CO 259a etc.) is the strongest signal.
  if (ruleEval.matchedVersionIds.length > 0) {
    confidence += 30;
    // Bonus for multiple supporting statutory rules
    if (ruleEval.matchedVersionIds.length > 1) confidence += 10;
  }

  // ── Best defect match quality: 0–40 points (scaled from match confidence) ─
  // This is the core “does the request actually match a known defect" signal.
  if (defectMatchResult?.bestMatch) {
    // Scale linearly: 100% match = 40 pts, 50% match = 20 pts, 30% match = 12 pts
    const matchQuality = defectMatchResult.bestMatch.matchConfidence;
    confidence += Math.round(matchQuality * 0.4);
  }

  // ── Depreciation data: 0–15 points ─────────────────────────
  if (depreciation) {
    if (depreciation.fullyDepreciated) confidence += 15;
    else if (depreciation.remainingLifePct < 20) confidence += 10;
    else confidence += 5;
  }

  // ── Category mapping: 0–5 points ───────────────────────────
  if (legalTopic) confidence += 5;

  return Math.min(100, confidence);
}

function buildReasons(
  ruleEval: RuleEvaluationResult,
  depreciation: DepreciationSignalDTO | null,
  obligation: LegalObligation,
  matchedReductions?: RentReductionMatch[],
  defectMatchResult?: MatchResult,
  rentReductionEstimate?: RentReductionResult | null,
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

  if (matchedReductions && matchedReductions.length > 0) {
    const top = matchedReductions[0];
    reasons.push(
      `${matchedReductions.length} rent reduction precedent(s) found — ` +
        `highest: ${top.reductionPercent}% (${top.defectEn})`,
    );
  }

  // Phase B: structured defect match analysis
  if (defectMatchResult && defectMatchResult.bestMatch) {
    const best = defectMatchResult.bestMatch;
    reasons.push(
      `Best defect match: "${best.defectEn}" (${best.matchConfidence}% confidence, ` +
        `${best.reductionPercent}% reduction)`,
    );
    if (defectMatchResult.matches.length > 1) {
      reasons.push(
        `${defectMatchResult.matches.length - 1} additional matching precedents identified`,
      );
    }
  }

  // Phase B: CHF rent reduction estimate
  if (rentReductionEstimate) {
    const est = rentReductionEstimate;
    reasons.push(
      `Estimated monthly rent reduction: CHF ${est.totalReductionChf} ` +
        `(${est.totalReductionPercent}% of CHF ${est.netRentChf} net rent)`,
    );
    if (est.capApplied) {
      reasons.push(`Aggregate reduction capped at 70% (Swiss judicial practice)`);
    }
    if (est.estimatedBackPayMonths) {
      reasons.push(
        `Potential back-pay: ~${est.estimatedBackPayMonths} months ` +
          `(~CHF ${est.totalReductionChf * est.estimatedBackPayMonths})`,
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
// LegalVariable Resolution (S-P0-002-02)
// ==========================================

/**
 * Resolve the current effective value of a LegalVariable.
 *
 * Lookup priority:
 *   1. Canton-specific variable (if canton is provided)
 *   2. Federal / nationwide variable (canton = null)
 *
 * Returns the valueJson of the latest effective LegalVariableVersion,
 * or null if not found.
 */
async function resolveLegalVariable(
  key: string,
  canton?: string | null,
): Promise<any | null> {
  const now = new Date();

  // Try canton-specific first
  if (canton) {
    const cantonVar = await prisma.legalVariable.findFirst({
      where: { key, jurisdiction: "CH", canton },
      include: {
        versions: {
          where: {
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
          },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
    });
    if (cantonVar?.versions[0]?.valueJson != null) {
      return cantonVar.versions[0].valueJson;
    }
  }

  // Fall back to federal (canton = null)
  const federalVar = await prisma.legalVariable.findFirst({
    where: { key, jurisdiction: "CH", canton: null },
    include: {
      versions: {
        where: {
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });

  return federalVar?.versions[0]?.valueJson ?? null;
}

// ==========================================
// Utilities
// ==========================================

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
