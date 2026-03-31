/**
 * Debt Enforcement Verifier — shared extraction logic.
 *
 * Both LocalOcrScanner and AzureDocumentIntelligenceScanner delegate
 * debt-enforcement analysis to this module, ensuring a single source of
 * truth for positive / negative / ambiguous classification.
 *
 * Design principles:
 *   - Explicit negative evidence ("aucune poursuite", "keine Betreibung", …) → CLEAR
 *   - Specific positive evidence (amounts owed, case numbers, creditor references) → HAS_ENTRIES
 *   - Generic header words like "poursuite" or "Betreibungsamt" do NOT count as positive —
 *     every debt-enforcement extract contains these in its title.
 *   - If evidence is absent, contradictory, or unreadable → UNKNOWN (never auto-fill)
 *   - Multilingual: French, German, English, and common Swiss official formats.
 */

/* ══════════════════════════════════════════════════════════════
   Public types
   ══════════════════════════════════════════════════════════════ */

/**
 * Tri-state result of debt-enforcement classification.
 *
 * - CLEAR      — document explicitly states no enforcement entries
 * - HAS_ENTRIES — document contains specific enforcement entries
 * - UNKNOWN    — insufficient, conflicting, or corrupted evidence
 */
export type DebtEnforcementStatus = "CLEAR" | "HAS_ENTRIES" | "UNKNOWN";

export interface DebtEnforcementVerification {
  /** null when status is UNKNOWN — prevents false auto-fill */
  hasDebtEnforcement: boolean | null;
  extractStatus: DebtEnforcementStatus;
  /** Confidence delta to add to the base score (can be negative) */
  confidenceDelta: number;
}

/* ══════════════════════════════════════════════════════════════
   Pattern dictionaries — kept explicit and readable
   ══════════════════════════════════════════════════════════════ */

/**
 * Explicit negative patterns — phrases that unambiguously mean
 * "this person has NO enforcement entries".
 *
 * These cover French, German, English, and common Swiss official
 * extract formats. Order does not matter; any single match suffices.
 */
const NEGATIVE_PATTERNS: RegExp[] = [
  // ── French ──
  /aucune\s+poursuite/i,
  /aucune\s+inscription/i,
  /aucun\s+acte\s+de\s+d[eé]faut/i,
  /n[eé]ant/i,
  /pas\s+de\s+poursuite/i,
  /aucune\s+proc[eé]dure/i,
  /pas\s+d['']inscription/i,
  /pas\s+d['']entr[eé]e/i,
  /sans\s+poursuite/i,
  /sans\s+inscription/i,

  // ── German ──
  /keine\s+betreibung/i,
  /keine\s+eintr[aä]ge/i,
  /keine\s+verl[uü]stschein/i,
  /keine\s+offenen/i,
  /nichts\s+zu\s+verzeichnen/i,
  /keine\s+pendenten/i,
  /keine\s+hängigen/i,
  /keine\s+laufenden/i,

  // ── English ──
  /no\s+(?:open\s+)?enforcement\s+cases?/i,
  /no\s+entries/i,
  /no\s+outstanding/i,
  /no\s+proceedings/i,
  /no\s+records?\s+found/i,
  /no\s+debt\s+enforcement/i,

  // ── Geneva/Vaud official extract ──
  /ne\s+fait\s+l.{0,3}objet\s+d.{0,3}aucune\s+poursuite/i,
  /ne\s+font\s+pas\s+l.{0,3}objet/i,
  /aucune\s+poursuite\s+ni\s+acte/i,
  /ni\s+acte\s+de\s+d[eé]faut\s+de\s+biens/i,
  /pas\s+l.{0,3}objet\s+d.{0,3}aucune/i,

  // ── Structured "key: value" formats ──
  /(?:open\s+)?enforcement\s+cases?\s*:\s*none/i,
  /entries\s*:\s*none/i,
  /cases?\s*:\s*none/i,
  /result\s*:\s*(?:clean|clear|none|nil)/i,
  /status\s*:\s*(?:clean|clear|none|nil)/i,
  /:\s*none\b/i,
  /:\s*n[eé]ant\b/i,
  /:\s*0\s*(?:entr|record|case|inscription|poursuite|betreibung)/i,
];

/**
 * Specific positive patterns — phrases that indicate ACTUAL enforcement
 * entries: amounts owed, case numbers, creditor references, dated actions.
 *
 * Generic document-title words (e.g. "Office des poursuites", "Betreibungsamt")
 * are intentionally EXCLUDED — they appear on every extract regardless of status.
 */
const POSITIVE_PATTERNS: RegExp[] = [
  // ── Amounts owed — label context required (CHF alone is not enough: every
  //    clean extract prints a fee line, e.g. "Fr. 17.00", which would
  //    otherwise be a false positive). ──
  /(?:montant|betrag|amount|total|solde)\s*:?\s*(?:CHF|Fr\.?|SFr\.?)\s*[\d',]+/i,

  // ── Case numbers / file references ──
  /(?:n[°o]\s*de?\s*(?:poursuite|dossier)|(?:betreibungs|fall)[-\s]?(?:nr|nummer))\s*:?\s*\d+/i,

  // ── Creditor / Gläubiger explicitly named (suggests active debt) ──
  /(?:cr[eé]ancier|gl[aä]ubiger|creditor)\s*:?\s+[A-Z]/i,

  // ── Explicit active-enforcement statements ──
  /poursuite\s+en\s+cours/i,
  /laufende\s+betreibung/i,
  /active\s+enforcement/i,
  /pending\s+enforcement/i,
  /(?:est|sont|a\s+fait|font)\s+l['']objet\s+d['']un\s+acte\s+de\s+d[eé]faut/i,
  /verl[uü]stschein/i,
  /pf[aä]ndung\s+(?:vom|am|du)\s+\d/i,
  /saisie\s+(?:du|le|en)\s+\d/i,

  // ── Multiple enforcement entries listed (≥ 1) ──
  /[1-9]\d*\s+poursuite/i,
  /[1-9]\d*\s+betreibung/i,
  /[1-9]\d*\s+enforcement/i,
];

/* ══════════════════════════════════════════════════════════════
   Core verification function
   ══════════════════════════════════════════════════════════════ */

/**
 * Analyze document text to determine debt-enforcement status.
 *
 * Decision logic (in priority order):
 * 1. If BOTH negative AND positive patterns match → UNKNOWN (contradictory)
 * 2. If negative patterns match (and no positive) → CLEAR
 * 3. If positive patterns match (and no negative) → HAS_ENTRIES
 * 4. Otherwise → UNKNOWN (insufficient evidence)
 */
export function verifyDebtEnforcement(text: string): DebtEnforcementVerification {
  if (!text || text.trim().length < 10) {
    // Text too short to make any determination
    return {
      hasDebtEnforcement: null,
      extractStatus: "UNKNOWN",
      confidenceDelta: -25,
    };
  }

  const hasNegativeEvidence = NEGATIVE_PATTERNS.some((p) => p.test(text));
  const hasPositiveEvidence = POSITIVE_PATTERNS.some((p) => p.test(text));

  // ── Contradictory evidence ──
  if (hasNegativeEvidence && hasPositiveEvidence) {
    return {
      hasDebtEnforcement: null,
      extractStatus: "UNKNOWN",
      confidenceDelta: -15,
    };
  }

  // ── Explicit clean ──
  if (hasNegativeEvidence) {
    return {
      hasDebtEnforcement: false,
      extractStatus: "CLEAR",
      confidenceDelta: 20,
    };
  }

  // ── Specific positive evidence ──
  if (hasPositiveEvidence) {
    return {
      hasDebtEnforcement: true,
      extractStatus: "HAS_ENTRIES",
      confidenceDelta: 10,
    };
  }

  // ── No definitive signal either way ──
  // Generic header words like "poursuite" / "Betreibungsamt" are expected
  // on every debt-extract document and do NOT constitute positive evidence.
  return {
    hasDebtEnforcement: null,
    extractStatus: "UNKNOWN",
    confidenceDelta: -15,
  };
}
