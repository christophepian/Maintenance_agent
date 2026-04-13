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
  defect: string;           // ASLOCA defect description (French, kept for audit)
  defectEn: string;         // English translation for display
  category: string;         // ASLOCA category (French)
  categoryEn: string;       // English category for display
  reductionPercent: number;
  reductionMax?: number;
  matchConfidence: number;  // 0–100
  matchReasons: string[];   // Why this rule matched
  citation: { article: string; text: string };
}

export interface MatchResult {
  bestMatch: DefectMatch | null; // Single highest-confidence match (or null)
  matches: DefectMatch[];       // All matches above threshold (for audit log only)
  requestNature: RequestNature; // Classified nature of the request
  unmatchedSignals: string[];   // Keywords that didn't match any rule
}

// ==========================================
// Scoring weights
// ==========================================

// ==========================================
// Scoring thresholds
// ==========================================

const MIN_CONFIDENCE_THRESHOLD = 30;
/** Minimum token length to participate in substring matching */
const MIN_TOKEN_LENGTH = 4;

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
      bestMatch: null,
      matches: [],
      requestNature: "other",
      unmatchedSignals: [],
    };
  }

  // 1. Load all active RENT_REDUCTION rules
  const rules = await loadRentReductionRules(canton);

  // 1b. Classify request nature for applicability scoring
  const requestNature = classifyRequestNature(description ?? "", category ?? null);

  // 2. Score each rule against signals — nature-gated
  const scored: DefectMatch[] = [];
  const matchedKeywords = new Set<string>();

  for (const rule of rules) {
    const translation = getTranslation(rule.key);

    // ── Nature gate: skip rules whose nature doesn't match ──
    // If we know the request nature (not "other") and the rule has a
    // translation with a different nature, skip it entirely.
    if (
      requestNature !== "other" &&
      translation &&
      translation.nature !== requestNature &&
      translation.nature !== "maintenance_general"
    ) {
      continue;
    }

    const { confidence, reasons, keywordsUsed } = scoreRule(rule, signals, requestNature);
    if (confidence >= MIN_CONFIDENCE_THRESHOLD) {
      scored.push({
        ruleKey: rule.key,
        ruleId: rule.id,
        defect: rule.defect,
        defectEn: translation?.defectEn ?? rule.defect,
        category: rule.category,
        categoryEn: translation?.categoryEn ?? rule.category,
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

  // 4. Compute unmatched signals
  const unmatchedSignals = signals.keywords
    .filter((kw) => !matchedKeywords.has(kw.term))
    .map((kw) => kw.term);

  // 5. Return single best match + full list for audit
  return {
    bestMatch: scored[0] ?? null,
    matches: scored,
    requestNature,
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
 * Scoring dimensions (max 100):
 *   1. Direct keyword match in English translation terms: +20 per hit (max 40)
 *   2. French defect text keyword overlap:                +15 per hit (max 30)
 *   3. Severity alignment:                                +15
 *   4. Room/area match:                                   +10
 *   5. Nature alignment (pre-filtered, bonus for match):  +5
 *
 * Tokens shorter than MIN_TOKEN_LENGTH are excluded from substring matching
 * to avoid false hits like "eau" matching everything water-related.
 */
function scoreRule(rule: ParsedRule, signals: DefectSignals, requestNature?: RequestNature): ScoreResult {
  let confidence = 0;
  const reasons: string[] = [];
  const keywordsUsed: string[] = [];

  const defectNorm = normaliseForMatch(rule.defect);
  const defectTokens = defectNorm.split(/[\s,;.!?()[\]{}'"–—/°+]+/).filter((t) => t.length >= MIN_TOKEN_LENGTH);
  const defectStems = defectTokens.map(basicStem).filter((s) => s.length >= MIN_TOKEN_LENGTH);
  const translation = getTranslation(rule.key);

  // ── 1. English translation keyword match (most reliable) ──
  if (translation) {
    const enTermsNorm = translation.searchTermsEn
      .map(normaliseForMatch)
      .filter((t) => t.length >= MIN_TOKEN_LENGTH);

    let enHits = 0;
    for (const kw of signals.keywords) {
      const kwNorm = normaliseForMatch(kw.term);
      if (kwNorm.length < MIN_TOKEN_LENGTH) continue;
      // Require exact word match, not substring containment
      const hit = enTermsNorm.some((t) => t === kwNorm || t.split(/\s+/).includes(kwNorm));
      if (hit) {
        enHits++;
        if (!keywordsUsed.includes(kw.term)) keywordsUsed.push(kw.term);
        if (enHits <= 3) {
          reasons.push(`"${kw.term}" matches: ${translation.defectEn}`);
        }
      }
    }
    confidence += Math.min(40, enHits * 20);
  }

  // ── 2. French defect text keyword overlap ─────────────────
  let frHits = 0;
  for (const kw of signals.keywords) {
    const kwNorm = normaliseForMatch(kw.term);
    if (kwNorm.length < MIN_TOKEN_LENGTH) continue;
    const kwStem = basicStem(kwNorm);
    // Exact token match or stem prefix match (both directions, min length)
    const directMatch = defectTokens.some((dt) => dt === kwNorm);
    const stemMatch = kwStem.length >= MIN_TOKEN_LENGTH &&
      defectStems.some((ds) => ds === kwStem || (ds.length >= 5 && kwStem.length >= 5 && (ds.startsWith(kwStem) || kwStem.startsWith(ds))));
    if (directMatch || stemMatch) {
      frHits++;
      if (!keywordsUsed.includes(kw.term)) keywordsUsed.push(kw.term);
      if (frHits <= 2) {
        reasons.push(`Keyword "${kw.term}" matches French defect text`);
      }
    }
  }
  confidence += Math.min(30, frHits * 15);

  // ── 3. Severity alignment ─────────────────────────────────
  const impliedSeverity = inferSeverityFromReduction(rule.reductionPercent);
  if (severityAligns(signals.severity, impliedSeverity)) {
    confidence += 15;
    reasons.push(`Severity alignment: ${signals.severity} \u2194 ${impliedSeverity} (${rule.reductionPercent}%)`);
  }

  // ── 4. Area match — rooms in signals that appear in defect ─
  if (signals.affectedArea.rooms.length > 0) {
    const roomMatch = signals.affectedArea.rooms.some((room) => {
      const roomNorm = normaliseForMatch(room);
      return roomNorm.length >= MIN_TOKEN_LENGTH && defectTokens.some((dt) => dt === roomNorm);
    });
    if (roomMatch) {
      confidence += 10;
      reasons.push("Room name match in defect description");
    }
  }

  // ── 5. Nature alignment bonus (already pre-filtered) ──────
  if (requestNature && translation && requestNature !== "other" && translation.nature === requestNature) {
    confidence += 5;
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


