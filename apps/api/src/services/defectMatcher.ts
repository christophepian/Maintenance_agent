/**
 * Defect Matcher — Match DefectSignals Against ASLOCA Rent Reduction Rules
 *
 * Scores each of the ~55 ASLOCA RENT_REDUCTION rules against the extracted
 * DefectSignals, producing ranked matches with confidence scores and reasons.
 *
 * Part of Legal Engine Hardening Phase B (B-2).
 */

import prisma from "./prismaClient";
import type { DefectSignals, DefectSeverity } from "./defectClassifier";
import {
  getTranslation,
  classifyRequestNature,
  normaliseForMatch,
  basicStem,
  type RequestNature,
} from "./legalTranslations";

// ==========================================
// Public types
// ==========================================

export interface DefectMatch {
  ruleKey: string;
  ruleId: string;
  defect: string;           // ASLOCA defect description (French)
  category: string;         // ASLOCA category
  reductionPercent: number;
  reductionMax?: number;
  matchConfidence: number;  // 0–100
  matchReasons: string[];   // Why this rule matched
  citation: { article: string; text: string };
}

export interface MatchResult {
  matches: DefectMatch[];       // Sorted by confidence desc
  bestMatch: DefectMatch | null;
  totalConfidence: number;      // Weighted aggregate of top matches
  unmatchedSignals: string[];   // Keywords that didn't match any rule
}

// ==========================================
// Scoring weights
// ==========================================

// ==========================================
// Scoring thresholds
// ==========================================

const MIN_CONFIDENCE_THRESHOLD = 20;
const MAX_RESULTS = 5;

// ==========================================
// Main matching function
// ==========================================

/**
 * Match extracted DefectSignals against ASLOCA rent reduction rules in the DB.
 *
 * @param signals - Structured signals from extractDefectSignals()
 * @param canton - Optional canton for jurisdiction filtering
 * @param description - Optional original description for nature classification
 * @param category - Optional request category for nature classification
 * @returns MatchResult with ranked matches, best match, and unmatched signals
 */
export async function matchDefectsToRules(
  signals: DefectSignals,
  canton?: string | null,
  description?: string | null,
  category?: string | null,
): Promise<MatchResult> {
  if (!signals.keywords.length && !signals.inferredCategories.length) {
    return {
      matches: [],
      bestMatch: null,
      totalConfidence: 0,
      unmatchedSignals: [],
    };
  }

  // 1. Load all active RENT_REDUCTION rules
  const rules = await loadRentReductionRules(canton);

  // 1b. Classify request nature for applicability scoring
  const requestNature = classifyRequestNature(description ?? "", category ?? null);

  // 2. Score each rule against signals
  const scored: DefectMatch[] = [];
  const matchedKeywords = new Set<string>();

  for (const rule of rules) {
    const { confidence, reasons, keywordsUsed } = scoreRule(rule, signals, requestNature);
    if (confidence >= MIN_CONFIDENCE_THRESHOLD) {
      scored.push({
        ruleKey: rule.key,
        ruleId: rule.id,
        defect: rule.defect,
        category: rule.category,
        reductionPercent: rule.reductionPercent,
        reductionMax: rule.reductionMax,
        matchConfidence: Math.min(100, confidence),
        matchReasons: reasons,
        citation: rule.citation,
      });
      for (const kw of keywordsUsed) matchedKeywords.add(kw);
    }
  }

  // 3. Sort by confidence desc, then reduction % desc
  scored.sort((a, b) =>
    b.matchConfidence - a.matchConfidence || b.reductionPercent - a.reductionPercent
  );

  // 4. Limit to top N
  const matches = scored.slice(0, MAX_RESULTS);

  // 5. Compute unmatched signals
  const unmatchedSignals = signals.keywords
    .filter((kw) => !matchedKeywords.has(kw.term))
    .map((kw) => kw.term);

  // 6. Compute aggregate confidence
  const totalConfidence = computeAggregateConfidence(matches);

  return {
    matches,
    bestMatch: matches[0] ?? null,
    totalConfidence,
    unmatchedSignals,
  };
}

// ==========================================
// Internal: rule loading
// ==========================================

interface ParsedRule {
  id: string;
  key: string;
  defect: string;
  category: string;
  reductionPercent: number;
  reductionMax?: number;
  citation: { article: string; text: string };
}

async function loadRentReductionRules(canton?: string | null): Promise<ParsedRule[]> {
  const now = new Date();

  const rules = await prisma.legalRule.findMany({
    where: {
      isActive: true,
      authority: "INDUSTRY_STANDARD",
      jurisdiction: "CH",
      OR: [
        { canton: null },
        ...(canton ? [{ canton }] : []),
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

  const parsed: ParsedRule[] = [];

  for (const rule of rules) {
    const version = rule.versions[0];
    if (!version) continue;

    const dsl = version.dslJson as any;
    if (!dsl || dsl.type !== "RENT_REDUCTION") continue;

    const citations = version.citationsJson as any[] | null;
    const firstCitation = citations?.[0];

    parsed.push({
      id: rule.id,
      key: rule.key,
      defect: dsl.defect || "",
      category: dsl.category || "",
      reductionPercent: dsl.reductionPercent ?? 0,
      reductionMax: dsl.reductionMax ?? undefined,
      citation: {
        article: firstCitation?.article || "ASLOCA/Lachat",
        text: firstCitation?.text || dsl.source || "Swiss tenancy case law",
      },
    });
  }

  return parsed;
}

// ==========================================
// Internal: scoring
// ==========================================

interface ScoreResult {
  confidence: number;
  reasons: string[];
  keywordsUsed: string[];
}

/**
 * Score a single rule against the signals.
 *
 * Scoring dimensions:
 *   1. Category match (signals.inferredCategories ∩ rule.category): +25
 *   2. French keyword overlap (signal keywords vs rule defect text,
 *      accent-stripped + stemmed):                                   +12 per hit, max 30
 *   3. English translation overlap (signal keywords vs searchTermsEn
 *      from translation dictionary):                                 +12 per hit, max 25
 *   4. Severity alignment (signal severity vs rule's implied severity): +10
 *   5. Area match (rooms overlap with rule defect text):              +10
 *   6. Request nature alignment (via translation dictionary):         +10
 */
function scoreRule(rule: ParsedRule, signals: DefectSignals, requestNature?: RequestNature): ScoreResult {
  let confidence = 0;
  const reasons: string[] = [];
  const keywordsUsed: string[] = [];

  const defectNorm = normaliseForMatch(rule.defect);
  const defectTokens = defectNorm.split(/[\s,;.!?()[\]{}'"–—/°+]+/).filter((t) => t.length >= 3);
  const defectStems = defectTokens.map(basicStem).filter((s) => s.length >= 3);
  const translation = getTranslation(rule.key);

  // 1. Category match
  if (signals.inferredCategories.includes(rule.category)) {
    confidence += 25;
    reasons.push(`Category match: ${rule.category}`);
  }

  // 2. French keyword overlap (accent-stripped + stemmed)
  let frHits = 0;
  for (const kw of signals.keywords) {
    const kwNorm = normaliseForMatch(kw.term);
    const kwStem = basicStem(kwNorm);
    const directMatch = defectNorm.includes(kwNorm) || defectTokens.some((dt) => dt.includes(kwNorm) || kwNorm.includes(dt));
    const stemMatch = kwStem.length >= 3 && defectStems.some((ds) => ds.startsWith(kwStem) || kwStem.startsWith(ds));
    if (directMatch || stemMatch) {
      frHits++;
      keywordsUsed.push(kw.term);
      if (frHits <= 3) {
        reasons.push(`Keyword "${kw.term}" matches defect: "${rule.defect}"`);
      }
    }
  }
  confidence += Math.min(30, frHits * 12);

  // 3. English translation overlap
  if (translation) {
    const enTermsNorm = translation.searchTermsEn.map(normaliseForMatch);
    const frTermsNorm = translation.searchTermsFr.map(normaliseForMatch);
    const allTerms = [...enTermsNorm, ...frTermsNorm];

    let translationHits = 0;
    for (const kw of signals.keywords) {
      const kwNorm = normaliseForMatch(kw.term);
      if (kwNorm.length >= 3 && allTerms.some((t) => t.includes(kwNorm) || kwNorm.includes(t))) {
        translationHits++;
        if (!keywordsUsed.includes(kw.term)) keywordsUsed.push(kw.term);
        if (translationHits <= 2) {
          reasons.push(`Keyword "${kw.term}" matches translation for: "${translation.defectEn}"`);
        }
      }
    }
    confidence += Math.min(25, translationHits * 12);
  }

  // 4. Severity alignment
  const impliedSeverity = inferSeverityFromReduction(rule.reductionPercent);
  if (severityAligns(signals.severity, impliedSeverity)) {
    confidence += 10;
    reasons.push(`Severity alignment: ${signals.severity} ↔ ${impliedSeverity} (${rule.reductionPercent}%)`);
  }

  // 5. Area match — rooms mentioned in signals that appear in defect text
  if (signals.affectedArea.rooms.length > 0) {
    const roomMatch = signals.affectedArea.rooms.some((room) =>
      defectNorm.includes(normaliseForMatch(room))
    );
    if (roomMatch) {
      confidence += 10;
      reasons.push("Room name match in defect description");
    }
  }

  // 6. Request nature alignment
  if (requestNature && translation && requestNature !== "other" && translation.nature === requestNature) {
    confidence += 10;
    reasons.push(`Nature alignment: ${requestNature}`);
  }

  return { confidence, reasons, keywordsUsed };
}

/**
 * Infer expected severity from the rule's reduction percentage.
 * Swiss practice: higher % = more severe defect.
 */
function inferSeverityFromReduction(percent: number): DefectSeverity {
  if (percent >= 50) return "critical";
  if (percent >= 25) return "severe";
  if (percent >= 10) return "moderate";
  return "mild";
}

/**
 * Check if detected severity aligns with implied severity.
 * Alignment = same level, or ±1 level (partial match).
 */
const SEVERITY_RANK: Record<DefectSeverity, number> = {
  mild: 1,
  moderate: 2,
  severe: 3,
  critical: 4,
};

function severityAligns(detected: DefectSeverity, implied: DefectSeverity): boolean {
  return Math.abs(SEVERITY_RANK[detected] - SEVERITY_RANK[implied]) <= 1;
}

/**
 * Compute aggregate confidence from top matches.
 * Weighted: best match counts fully, subsequent matches contribute diminishing returns.
 */
function computeAggregateConfidence(matches: DefectMatch[]): number {
  if (matches.length === 0) return 0;

  let total = 0;
  const weights = [1.0, 0.3, 0.15, 0.1, 0.05];
  for (let i = 0; i < matches.length && i < weights.length; i++) {
    total += matches[i].matchConfidence * weights[i];
  }

  return Math.min(100, Math.round(total));
}
