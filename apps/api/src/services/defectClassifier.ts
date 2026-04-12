/**
 * Defect Classifier — Keyword-Based Signal Extraction
 *
 * Extracts structured defect signals from free-text tenant complaints.
 * Deterministic (no LLM) — uses trilingual keyword dictionaries (FR/DE/EN)
 * mapped to the 7 ASLOCA rent reduction categories.
 *
 * Part of Legal Engine Hardening Phase B (B-1).
 */

// ==========================================
// Public types
// ==========================================

export interface DefectKeyword {
  /** The matched keyword */
  term: string;
  /** ASLOCA category this keyword maps to */
  category: string;
  /** Weight: 1.0 = strong signal, 0.5 = moderate, 0.3 = weak */
  weight: number;
}

export type DefectSeverity = "mild" | "moderate" | "severe" | "critical";

export interface AffectedArea {
  /** Number of rooms mentioned (e.g. "3 pièces" → 3) */
  roomCount?: number;
  /** % of area affected (e.g. "80% de la pièce" → 80) */
  percentAffected?: number;
  /** Named rooms found in the text */
  rooms: string[];
}

export interface DurationInfo {
  /** Estimated months of issue duration */
  months?: number;
  /** Whether the issue is described as ongoing */
  ongoing: boolean;
  /** Whether the defect is seasonal (heating: Oct–Apr) */
  seasonal: boolean;
}

export interface DefectSignals {
  /** Detected defect keywords with source positions */
  keywords: DefectKeyword[];
  /** Inferred severity: mild | moderate | severe | critical */
  severity: DefectSeverity;
  /** Affected area indicators */
  affectedArea: AffectedArea;
  /** Duration indicators */
  duration: DurationInfo;
  /** Raw category inference before legal topic mapping */
  inferredCategories: string[];
}

// ==========================================
// Keyword dictionaries
// ==========================================

/**
 * Trilingual keyword → ASLOCA category mapping.
 *
 * Each entry: [keyword, category, weight]
 * Weight: 1.0 = strong/unambiguous, 0.5 = moderate, 0.3 = weak/context-dependent
 */
interface KeywordEntry {
  term: string;
  category: string;
  weight: number;
}

const KEYWORD_DICTIONARY: KeywordEntry[] = [
  // ── Température ──
  { term: "chauffage", category: "Température", weight: 1.0 },
  { term: "heizung", category: "Température", weight: 1.0 },
  { term: "heating", category: "Température", weight: 1.0 },
  { term: "radiateur", category: "Température", weight: 1.0 },
  { term: "radiator", category: "Température", weight: 1.0 },
  { term: "heizkörper", category: "Température", weight: 1.0 },
  { term: "thermostat", category: "Température", weight: 0.8 },
  { term: "froid", category: "Température", weight: 0.5 },
  { term: "cold", category: "Température", weight: 0.5 },
  { term: "kalt", category: "Température", weight: 0.5 },
  { term: "gel", category: "Température", weight: 0.5 },
  { term: "frost", category: "Température", weight: 0.5 },
  { term: "eau chaude", category: "Température", weight: 1.0 },
  { term: "warmwasser", category: "Température", weight: 1.0 },
  { term: "hot water", category: "Température", weight: 1.0 },
  { term: "boiler", category: "Température", weight: 0.8 },
  { term: "chaudière", category: "Température", weight: 1.0 },
  { term: "température", category: "Température", weight: 0.8 },
  { term: "temperatur", category: "Température", weight: 0.8 },

  // ── Humidité ──
  { term: "moisissure", category: "Humidité", weight: 1.0 },
  { term: "schimmel", category: "Humidité", weight: 1.0 },
  { term: "mould", category: "Humidité", weight: 1.0 },
  { term: "mold", category: "Humidité", weight: 1.0 },
  { term: "humidité", category: "Humidité", weight: 1.0 },
  { term: "feuchtigkeit", category: "Humidité", weight: 1.0 },
  { term: "moisture", category: "Humidité", weight: 1.0 },
  { term: "champignon", category: "Humidité", weight: 0.8 },
  { term: "fungus", category: "Humidité", weight: 0.8 },
  { term: "pilz", category: "Humidité", weight: 0.8 },
  { term: "condensation", category: "Humidité", weight: 0.8 },
  { term: "kondenswasser", category: "Humidité", weight: 0.8 },
  { term: "taches noires", category: "Humidité", weight: 0.8 },
  { term: "black spots", category: "Humidité", weight: 0.8 },
  { term: "humid", category: "Humidité", weight: 0.5 },
  { term: "damp", category: "Humidité", weight: 0.5 },
  { term: "feucht", category: "Humidité", weight: 0.5 },

  // ── Dégâts d'eau ──
  { term: "infiltration", category: "Dégâts d'eau", weight: 1.0 },
  { term: "inondation", category: "Dégâts d'eau", weight: 1.0 },
  { term: "überschwemmung", category: "Dégâts d'eau", weight: 1.0 },
  { term: "flood", category: "Dégâts d'eau", weight: 1.0 },
  { term: "fuite", category: "Dégâts d'eau", weight: 1.0 },
  { term: "leak", category: "Dégâts d'eau", weight: 1.0 },
  { term: "leck", category: "Dégâts d'eau", weight: 1.0 },
  { term: "wasserschaden", category: "Dégâts d'eau", weight: 1.0 },
  { term: "water damage", category: "Dégâts d'eau", weight: 1.0 },
  { term: "dégât d'eau", category: "Dégâts d'eau", weight: 1.0 },
  { term: "plafond mouillé", category: "Dégâts d'eau", weight: 1.0 },
  { term: "wet ceiling", category: "Dégâts d'eau", weight: 1.0 },
  { term: "nasse decke", category: "Dégâts d'eau", weight: 1.0 },
  { term: "tuyau", category: "Dégâts d'eau", weight: 0.5 },
  { term: "pipe", category: "Dégâts d'eau", weight: 0.5 },
  { term: "rohr", category: "Dégâts d'eau", weight: 0.5 },
  { term: "gouttière", category: "Dégâts d'eau", weight: 0.5 },
  { term: "gutter", category: "Dégâts d'eau", weight: 0.5 },

  // ── Rénovations ──
  { term: "travaux", category: "Rénovations", weight: 1.0 },
  { term: "renovation", category: "Rénovations", weight: 1.0 },
  { term: "rénovation", category: "Rénovations", weight: 1.0 },
  { term: "umbau", category: "Rénovations", weight: 1.0 },
  { term: "chantier", category: "Rénovations", weight: 1.0 },
  { term: "baustelle", category: "Rénovations", weight: 1.0 },
  { term: "construction", category: "Rénovations", weight: 0.8 },
  { term: "poussière", category: "Rénovations", weight: 0.8 },
  { term: "dust", category: "Rénovations", weight: 0.5 },
  { term: "staub", category: "Rénovations", weight: 0.5 },
  { term: "échafaudage", category: "Rénovations", weight: 1.0 },
  { term: "scaffold", category: "Rénovations", weight: 1.0 },
  { term: "gerüst", category: "Rénovations", weight: 1.0 },

  // ── Immissions ──
  { term: "bruit", category: "Immissions", weight: 1.0 },
  { term: "noise", category: "Immissions", weight: 1.0 },
  { term: "lärm", category: "Immissions", weight: 1.0 },
  { term: "odeur", category: "Immissions", weight: 1.0 },
  { term: "smell", category: "Immissions", weight: 1.0 },
  { term: "geruch", category: "Immissions", weight: 1.0 },
  { term: "fumée", category: "Immissions", weight: 1.0 },
  { term: "smoke", category: "Immissions", weight: 1.0 },
  { term: "rauch", category: "Immissions", weight: 1.0 },
  { term: "vibration", category: "Immissions", weight: 0.8 },
  { term: "nuisance", category: "Immissions", weight: 0.8 },
  { term: "tapage", category: "Immissions", weight: 1.0 },
  { term: "puanteur", category: "Immissions", weight: 1.0 },
  { term: "stench", category: "Immissions", weight: 1.0 },
  { term: "gestank", category: "Immissions", weight: 1.0 },

  // ── Défauts (appliance/equipment defects) ──
  { term: "panne", category: "Défauts", weight: 1.0 },
  { term: "defekt", category: "Défauts", weight: 1.0 },
  { term: "broken", category: "Défauts", weight: 1.0 },
  { term: "kaputt", category: "Défauts", weight: 1.0 },
  { term: "cassé", category: "Défauts", weight: 1.0 },
  { term: "lave-vaisselle", category: "Défauts", weight: 1.0 },
  { term: "dishwasher", category: "Défauts", weight: 1.0 },
  { term: "geschirrspüler", category: "Défauts", weight: 1.0 },
  { term: "spülmaschine", category: "Défauts", weight: 1.0 },
  { term: "ascenseur", category: "Défauts", weight: 1.0 },
  { term: "elevator", category: "Défauts", weight: 1.0 },
  { term: "lift", category: "Défauts", weight: 0.8 },
  { term: "aufzug", category: "Défauts", weight: 1.0 },
  { term: "interphone", category: "Défauts", weight: 1.0 },
  { term: "intercom", category: "Défauts", weight: 1.0 },
  { term: "gegensprechanlage", category: "Défauts", weight: 1.0 },
  { term: "machine à laver", category: "Défauts", weight: 1.0 },
  { term: "washing machine", category: "Défauts", weight: 1.0 },
  { term: "waschmaschine", category: "Défauts", weight: 1.0 },
  { term: "réfrigérateur", category: "Défauts", weight: 1.0 },
  { term: "fridge", category: "Défauts", weight: 1.0 },
  { term: "kühlschrank", category: "Défauts", weight: 1.0 },
  { term: "four", category: "Défauts", weight: 0.8 },
  { term: "oven", category: "Défauts", weight: 0.8 },
  { term: "ofen", category: "Défauts", weight: 0.8 },
  { term: "cuisinière", category: "Défauts", weight: 1.0 },
  { term: "stove", category: "Défauts", weight: 1.0 },
  { term: "herd", category: "Défauts", weight: 0.8 },
  { term: "store", category: "Défauts", weight: 0.5 },
  { term: "volet", category: "Défauts", weight: 0.8 },
  { term: "shutter", category: "Défauts", weight: 0.8 },
  { term: "rolladen", category: "Défauts", weight: 0.8 },
  { term: "serrure", category: "Défauts", weight: 0.8 },
  { term: "lock", category: "Défauts", weight: 0.5 },
  { term: "schloss", category: "Défauts", weight: 0.5 },
  { term: "fenêtre", category: "Défauts", weight: 0.5 },
  { term: "window", category: "Défauts", weight: 0.5 },
  { term: "fenster", category: "Défauts", weight: 0.5 },
  { term: "porte", category: "Défauts", weight: 0.3 },
  { term: "door", category: "Défauts", weight: 0.3 },
  { term: "tür", category: "Défauts", weight: 0.3 },

  // ── Autres ──
  { term: "conciergerie", category: "Autres", weight: 0.8 },
  { term: "hauswart", category: "Autres", weight: 0.8 },
  { term: "caretaker", category: "Autres", weight: 0.5 },
  { term: "parquet", category: "Autres", weight: 0.5 },
  { term: "flooring", category: "Autres", weight: 0.5 },
  { term: "boden", category: "Autres", weight: 0.3 },
  { term: "plafond", category: "Autres", weight: 0.5 },
  { term: "ceiling", category: "Autres", weight: 0.5 },
  { term: "decke", category: "Autres", weight: 0.3 },
  { term: "mur", category: "Autres", weight: 0.3 },
  { term: "wall", category: "Autres", weight: 0.3 },
  { term: "wand", category: "Autres", weight: 0.3 },
  { term: "peinture", category: "Autres", weight: 0.3 },
  { term: "paint", category: "Autres", weight: 0.3 },
  { term: "farbe", category: "Autres", weight: 0.3 },
];

// ── Multi-word terms sorted by length desc for greedy matching ──
// Includes both space-separated and hyphenated terms
const MULTI_WORD_ENTRIES = KEYWORD_DICTIONARY
  .filter((e) => e.term.includes(" ") || e.term.includes("-"))
  .sort((a, b) => b.term.length - a.term.length);

const SINGLE_WORD_MAP = new Map<string, KeywordEntry>();
for (const entry of KEYWORD_DICTIONARY) {
  if (!entry.term.includes(" ") && !entry.term.includes("-") && !SINGLE_WORD_MAP.has(entry.term)) {
    SINGLE_WORD_MAP.set(entry.term, entry);
  }
}

// ==========================================
// Severity rules
// ==========================================

interface SeverityPattern {
  pattern: RegExp;
  severity: DefectSeverity;
  /** If true, this pattern only upgrades, never downgrades */
  upgradeOnly?: boolean;
}

const SEVERITY_PATTERNS: SeverityPattern[] = [
  // ── Critical ──
  { pattern: /\b(inhabitable|unbewohnbar|uninhabitable)\b/i, severity: "critical" },
  { pattern: /\b(sans eau|kein wasser|no water)\b/i, severity: "critical" },
  { pattern: /\b(sans chauffage|keine heizung|no heating)\b/i, severity: "critical" },
  { pattern: /\b(dangere(ux|use)|gefährlich|dangerous)\b/i, severity: "critical" },
  { pattern: /\b(urgente?|dringend|urgent)\b/i, severity: "critical" },
  { pattern: /(?:(?:[5-9]\d|100)\s*%)/i, severity: "critical" },
  { pattern: /\b(grave|schwer|serious)\b/i, severity: "severe", upgradeOnly: true },

  // ── Severe ──
  { pattern: /(?:(?:[3-4]\d)\s*%)/i, severity: "severe" },
  { pattern: /\b(gravement|schwerwiegend|severely)\b/i, severity: "severe" },
  { pattern: /\b(pourrissement|verrottung|rotting)\b/i, severity: "severe" },
  { pattern: /\b(majeur|gross|major)\b/i, severity: "severe" },
  { pattern: /\b(total(e|ement)?|vollständig|completely?)\b/i, severity: "severe" },
  { pattern: /\b(structurel|strukturell|structural)\b/i, severity: "severe" },
  { pattern: /\b(effondrement|einsturz|collapse)\b/i, severity: "critical" },

  // ── Moderate ──
  { pattern: /\b(traces?|spuren|traces?)\b/i, severity: "moderate" },
  { pattern: /\b(taches?|flecken|stains?)\b/i, severity: "moderate" },
  { pattern: /\b(insuffisant|unzureichend|insufficient)\b/i, severity: "moderate" },
  { pattern: /\b(endommagé|beschädigt|damaged)\b/i, severity: "moderate" },
  { pattern: /\b(dégradé|abgenutzt|degraded)\b/i, severity: "moderate" },
  { pattern: /\b(partiel(le)?|teilweise|partial)\b/i, severity: "moderate" },
  { pattern: /(?:(?:1\d|2\d)\s*%)/i, severity: "moderate" },

  // ── Mild ──
  { pattern: /\b(léger|leicht|slight)\b/i, severity: "mild" },
  { pattern: /\b(petit(e)?|klein|small|minor)\b/i, severity: "mild" },
  { pattern: /\b(mineur(e)?|geringfügig|minor)\b/i, severity: "mild" },
  { pattern: /\b(cosmétique|kosmetisch|cosmetic)\b/i, severity: "mild" },
  { pattern: /\b(esthétique|ästhetisch|aesthetic)\b/i, severity: "mild" },
];

const SEVERITY_RANK: Record<DefectSeverity, number> = {
  mild: 1,
  moderate: 2,
  severe: 3,
  critical: 4,
};

// ==========================================
// Room detection
// ==========================================

/**
 * Room name patterns (FR/DE/EN).
 * Returns the canonical French room name for consistency.
 */
const ROOM_PATTERNS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\b(chambre|schlafzimmer|bedroom)\b/i, canonical: "chambre" },
  { pattern: /\b(séjour|salon|wohnzimmer|living\s*room)\b/i, canonical: "séjour" },
  { pattern: /\b(cuisine|küche|kitchen)\b/i, canonical: "cuisine" },
  { pattern: /\b(salle\s*de\s*bain|badezimmer|bathroom)\b/i, canonical: "salle de bain" },
  { pattern: /\b(toilettes?|wc|toilet)\b/i, canonical: "toilettes" },
  { pattern: /\b(couloir|flur|hallway|corridor)\b/i, canonical: "couloir" },
  { pattern: /\b(cave|keller|cellar|basement)\b/i, canonical: "cave" },
  { pattern: /\b(balcon|balkon|balcony)\b/i, canonical: "balcon" },
  { pattern: /\b(grenier|dachboden|attic)\b/i, canonical: "grenier" },
  { pattern: /\b(garage)\b/i, canonical: "garage" },
  { pattern: /\b(buanderie|waschküche|laundry)\b/i, canonical: "buanderie" },
  { pattern: /\b(entrée|eingang|entrance)\b/i, canonical: "entrée" },
  { pattern: /\b(bureau|büro|office)\b/i, canonical: "bureau" },
  { pattern: /\b(terrasse|terrass?e|terrace)\b/i, canonical: "terrasse" },
];

// ==========================================
// Duration detection
// ==========================================

/**
 * Duration extraction patterns.
 * Matches: "depuis 3 mois", "seit 6 Monaten", "for 2 months", "3 ans", "1 year"
 */
const DURATION_PATTERNS: Array<{ pattern: RegExp; toMonths: (match: RegExpMatchArray) => number }> = [
  // "depuis X mois" / "for X months" / "seit X Monaten"
  {
    pattern: /(?:depuis|for|seit)\s+(\d+)\s*(?:mois|months?|monat(?:en?)?)/i,
    toMonths: (m) => parseInt(m[1], 10),
  },
  // "depuis X ans" / "for X years" / "seit X Jahren"
  {
    pattern: /(?:depuis|for|seit)\s+(\d+)\s*(?:ans?|years?|jahr(?:en?)?)/i,
    toMonths: (m) => parseInt(m[1], 10) * 12,
  },
  // "depuis X semaines" / "for X weeks" / "seit X Wochen"
  {
    pattern: /(?:depuis|for|seit)\s+(\d+)\s*(?:semaines?|weeks?|wochen?)/i,
    toMonths: (m) => Math.max(1, Math.round(parseInt(m[1], 10) / 4)),
  },
  // "X mois" standalone
  {
    pattern: /(\d+)\s*(?:mois|months?|monat(?:en?)?)/i,
    toMonths: (m) => parseInt(m[1], 10),
  },
  // "X ans" standalone
  {
    pattern: /(\d+)\s*(?:ans?|years?|jahr(?:en?)?)/i,
    toMonths: (m) => parseInt(m[1], 10) * 12,
  },
];

const ONGOING_PATTERNS = [
  /\b(depuis|since|seit)\b/i,
  /\b(toujours|still|immer\s*noch)\b/i,
  /\b(persist(e|ant)?|anhaltend|persists?|ongoing)\b/i,
  /\b(continu(e|el)?|fortlaufend|continuous)\b/i,
  /\b(permanent)\b/i,
  /\b(chronique|chronisch|chronic)\b/i,
];

const SEASONAL_KEYWORDS = [
  "chauffage", "heating", "heizung",
  "température", "temperatur", "temperature",
  "froid", "cold", "kalt",
  "gel", "frost",
];

// ==========================================
// Room count detection
// ==========================================

const ROOM_COUNT_PATTERNS = [
  /(\d+(?:\.\d)?)\s*(?:pièces?|p\b|zimmer|rooms?)/i,
  /(?:pièces?|rooms?|zimmer)\s*:?\s*(\d+(?:\.\d)?)/i,
];

const PERCENT_AFFECTED_PATTERNS = [
  /(\d+)\s*%\s*(?:de\s+la\s+(?:pièce|chambre|surface)|of\s+the\s+(?:room|area)|der\s+(?:fläche|zimmer))/i,
  /(\d+)\s*%\s*(?:affected|touché|betroffen)/i,
];

// ==========================================
// Main extraction function
// ==========================================

/**
 * Extract structured defect signals from a free-text complaint.
 *
 * @param description - The tenant complaint text (FR/DE/EN)
 * @param category - Optional request category for additional signal
 * @returns DefectSignals with keywords, severity, area, duration, and categories
 */
export function extractDefectSignals(
  description: string,
  category?: string | null,
): DefectSignals {
  if (!description || typeof description !== "string") {
    return emptySignals();
  }

  const text = normalizeText(description);
  const catText = category ? normalizeText(category) : "";
  const combinedText = catText ? `${text} ${catText}` : text;

  // 1. Extract keywords
  const keywords = extractKeywords(combinedText);

  // 2. Detect severity
  const severity = detectSeverity(combinedText, keywords);

  // 3. Parse affected area
  const affectedArea = parseAffectedArea(combinedText);

  // 4. Parse duration
  const duration = parseDuration(combinedText, keywords);

  // 5. Infer categories from keywords
  const categoryScores = new Map<string, number>();
  for (const kw of keywords) {
    const current = categoryScores.get(kw.category) || 0;
    categoryScores.set(kw.category, current + kw.weight);
  }
  const inferredCategories = Array.from(categoryScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  return {
    keywords,
    severity,
    affectedArea,
    duration,
    inferredCategories,
  };
}

// ==========================================
// Internal helpers
// ==========================================

function emptySignals(): DefectSignals {
  return {
    keywords: [],
    severity: "mild",
    affectedArea: { rooms: [] },
    duration: { ongoing: false, seasonal: false },
    inferredCategories: [],
  };
}

/**
 * Normalize text for keyword matching.
 * Lowercases and strips accents for matching, but keeps original for multi-word.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Normalize a string by removing diacritics for fuzzy matching.
 */
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Extract matching keywords from text using the dictionary.
 * Multi-word phrases matched first (greedy), then single words.
 * Deduplicates by term.
 */
function extractKeywords(text: string): DefectKeyword[] {
  const found: DefectKeyword[] = [];
  const seenTerms = new Set<string>();
  const textNorm = stripAccents(text);

  // Multi-word phrases first (greedy, longest first)
  for (const entry of MULTI_WORD_ENTRIES) {
    const termNorm = stripAccents(entry.term);
    if (textNorm.includes(termNorm) && !seenTerms.has(entry.term)) {
      seenTerms.add(entry.term);
      found.push({ term: entry.term, category: entry.category, weight: entry.weight });
    }
  }

  // Single words — match against tokenized text
  const words = textNorm.split(/[\s,;.!?()[\]{}'"\-–—/]+/).filter(Boolean);
  for (const word of words) {
    // Check direct match
    for (const [term, entry] of SINGLE_WORD_MAP) {
      const termNorm = stripAccents(term);
      if (word === termNorm && !seenTerms.has(term)) {
        seenTerms.add(term);
        found.push({ term: entry.term, category: entry.category, weight: entry.weight });
      }
    }
  }

  return found;
}

/**
 * Detect severity from text patterns and keyword context.
 */
function detectSeverity(text: string, keywords: DefectKeyword[]): DefectSeverity {
  const defaultSeverity: DefectSeverity = keywords.length > 0 ? "moderate" : "mild";
  let explicitSeverity: DefectSeverity | null = null;

  for (const sp of SEVERITY_PATTERNS) {
    if (sp.pattern.test(text)) {
      if (sp.upgradeOnly) {
        // Only upgrade, never downgrade
        if (!explicitSeverity || SEVERITY_RANK[sp.severity] > SEVERITY_RANK[explicitSeverity]) {
          explicitSeverity = sp.severity;
        }
      } else {
        if (!explicitSeverity || SEVERITY_RANK[sp.severity] > SEVERITY_RANK[explicitSeverity]) {
          explicitSeverity = sp.severity;
        }
      }
    }
  }

  // If an explicit severity pattern matched, use it (even if lower than default)
  if (explicitSeverity !== null) return explicitSeverity;
  return defaultSeverity;
}

/**
 * Parse affected area from the text.
 */
function parseAffectedArea(text: string): AffectedArea {
  const rooms: string[] = [];
  for (const rp of ROOM_PATTERNS) {
    if (rp.pattern.test(text) && !rooms.includes(rp.canonical)) {
      rooms.push(rp.canonical);
    }
  }

  let roomCount: number | undefined;
  for (const rc of ROOM_COUNT_PATTERNS) {
    const m = text.match(rc);
    if (m) {
      roomCount = parseFloat(m[1]);
      break;
    }
  }

  let percentAffected: number | undefined;
  for (const pp of PERCENT_AFFECTED_PATTERNS) {
    const m = text.match(pp);
    if (m) {
      percentAffected = parseInt(m[1], 10);
      break;
    }
  }

  return { roomCount, percentAffected, rooms };
}

/**
 * Parse duration from the text.
 */
function parseDuration(text: string, keywords: DefectKeyword[]): DurationInfo {
  let months: number | undefined;
  for (const dp of DURATION_PATTERNS) {
    const m = text.match(dp.pattern);
    if (m) {
      months = dp.toMonths(m);
      break;
    }
  }

  const ongoing = ONGOING_PATTERNS.some((p) => p.test(text));

  // Seasonal: if the defect relates to heating/temperature
  const seasonal = keywords.some((kw) =>
    SEASONAL_KEYWORDS.includes(kw.term.toLowerCase())
  );

  return { months, ongoing, seasonal };
}
