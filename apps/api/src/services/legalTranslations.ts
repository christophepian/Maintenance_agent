/**
 * Legal Translation Dictionary — ASLOCA Rent Reduction Rules
 *
 * Provides English translations for the ~53 ASLOCA RENT_REDUCTION rules that
 * are stored in French.  Each entry also carries:
 *   - `searchTermsEn` — enriched English search tokens (synonyms, appliance
 *     names, colloquial phrasing) that a tenant might use when filing a request
 *   - `searchTermsFr` — explicit French tokens to improve French→French matching
 *     (accent-stripped, root forms)
 *   - `nature` — request-nature tag for applicability narrowing
 *
 * These are keyed by `ruleKey` so they can be joined at scoring time without
 * touching the database or the Prisma schema.
 */

// ==========================================
// Request nature classification
// ==========================================

/**
 * Coarse "nature" tags that describe what kind of problem a tenant reports.
 * Used to narrow which ASLOCA categories are relevant.
 */
export type RequestNature =
  | "appliance_failure"
  | "water_damage"
  | "temperature_issue"
  | "humidity_mould"
  | "noise_immission"
  | "renovation_disruption"
  | "structural_defect"
  | "maintenance_general"
  | "access_common_area"
  | "other";

// ==========================================
// Rule translation entries
// ==========================================

export interface RuleTranslation {
  /** English translation of the French defect description */
  defectEn: string;
  /** ASLOCA category in English */
  categoryEn: string;
  /** Extra English search terms (synonyms, colloquial) */
  searchTermsEn: string[];
  /** Extra French search terms (root forms, no accents) */
  searchTermsFr: string[];
  /** Request-nature tag for applicability */
  nature: RequestNature;
}

/**
 * Complete translation dictionary keyed by LegalRule.key.
 */
export const RULE_TRANSLATIONS: Record<string, RuleTranslation> = {
  // ── Température ──────────────────────────────────────────────
  CH_RENT_RED_TEMP_BELOW_18: {
    defectEn: "Below 18°C in winter",
    categoryEn: "Temperature",
    searchTermsEn: [
      "cold", "freezing", "heating", "temperature", "thermostat",
      "radiator", "winter", "degrees", "celsius", "below 18",
      "too cold", "no heat", "insufficient heating",
    ],
    searchTermsFr: [
      "froid", "chauffage", "temperature", "thermostat", "radiateur",
      "hiver", "degres", "18",
    ],
    nature: "temperature_issue",
  },
  CH_RENT_RED_HEATING_FAILURE: {
    defectEn: "Insufficient heating, hot water cut off",
    categoryEn: "Temperature",
    searchTermsEn: [
      "heating failure", "no hot water", "boiler", "broken heating",
      "cold water only", "heating system", "hot water cut",
      "central heating", "furnace", "heat pump",
    ],
    searchTermsFr: [
      "chauffage", "insuffisant", "coupure", "eau chaude", "chaudiere",
      "panne chauffage",
    ],
    nature: "temperature_issue",
  },

  // ── Humidité ─────────────────────────────────────────────────
  CH_RENT_RED_MOULD_LIGHT: {
    defectEn: "Light mould traces (1 bedroom, 4.5-room apt)",
    categoryEn: "Humidity",
    searchTermsEn: [
      "mould", "mold", "mildew", "traces", "light mould",
      "bedroom mould", "black spots", "fungus", "damp spots",
    ],
    searchTermsFr: [
      "moisissure", "traces", "chambre", "legeres",
    ],
    nature: "humidity_mould",
  },
  CH_RENT_RED_MOISTURE_HEAVY: {
    defectEn: "Moisture + ceiling drips + rotting",
    categoryEn: "Humidity",
    searchTermsEn: [
      "moisture", "humidity", "dripping ceiling", "rotting",
      "water drops", "damp", "condensation", "wet ceiling",
      "ceiling leak",
    ],
    searchTermsFr: [
      "humidite", "gouttes", "plafond", "pourrissement",
    ],
    nature: "humidity_mould",
  },
  CH_RENT_RED_WATER_DAMAGE_ROOMS: {
    defectEn: "Living room and bedroom severely water-damaged (3-room apt)",
    categoryEn: "Humidity",
    searchTermsEn: [
      "water damage", "flood damage", "living room", "bedroom",
      "severely damaged", "water damaged rooms", "flooded apartment",
    ],
    searchTermsFr: [
      "salon", "chambre", "endommages", "eau",
    ],
    nature: "water_damage",
  },
  CH_RENT_RED_ROOM_SEVERE_MOULD: {
    defectEn: "Damp bedroom, mouldy furniture (80% of room)",
    categoryEn: "Humidity",
    searchTermsEn: [
      "severe mould", "mouldy furniture", "damp room",
      "80 percent", "entire room", "uninhabitable",
      "mould everywhere", "pervasive mould",
    ],
    searchTermsFr: [
      "chambre", "humide", "moisissure", "meubles", "80",
    ],
    nature: "humidity_mould",
  },

  // ── Dégâts d'eau ─────────────────────────────────────────────
  CH_RENT_RED_WINDOWS_LEAK: {
    defectEn: "Non-airtight windows in living room/bedroom",
    categoryEn: "Water damage",
    searchTermsEn: [
      "window leak", "drafty windows", "airtight", "window seal",
      "wind coming in", "cold draft", "window not closing",
    ],
    searchTermsFr: [
      "fenetres", "hermetiques", "sejour", "chambre",
    ],
    nature: "structural_defect",
  },
  CH_RENT_RED_CELLAR_FLOODED: {
    defectEn: "Flooded cellar",
    categoryEn: "Water damage",
    searchTermsEn: [
      "flooded cellar", "basement flooding", "cellar water",
      "underground water", "wet basement", "water in cellar",
    ],
    searchTermsFr: [
      "cave", "inondee",
    ],
    nature: "water_damage",
  },
  CH_RENT_RED_INFILTRATION: {
    defectEn: "Water infiltration through ceilings/walls in bedrooms and living room",
    categoryEn: "Water damage",
    searchTermsEn: [
      "water infiltration", "leak ceiling", "leak wall",
      "seeping water", "penetration", "damp walls",
      "water stains ceiling",
    ],
    searchTermsFr: [
      "infiltrations", "eau", "plafonds", "parois", "chambres", "sejour",
    ],
    nature: "water_damage",
  },
  CH_RENT_RED_MOISTURE_ROOM: {
    defectEn: "Heavy moisture in room (3-room apt), rotting furniture",
    categoryEn: "Water damage",
    searchTermsEn: [
      "heavy moisture", "damp room", "furniture rotting",
      "high humidity room", "wet room",
    ],
    searchTermsFr: [
      "forte", "humidite", "piece", "pourrissement", "meubles",
    ],
    nature: "humidity_mould",
  },
  CH_RENT_RED_SEVERE_WATER: {
    defectEn: "Walls/ceilings in bedrooms and living room severely water-damaged",
    categoryEn: "Water damage",
    searchTermsEn: [
      "severe water damage", "wall damage", "ceiling damage",
      "water damaged walls", "major water damage",
    ],
    searchTermsFr: [
      "murs", "plafonds", "chambres", "salon", "endommages", "eau",
    ],
    nature: "water_damage",
  },
  CH_RENT_RED_CHRONIC_MOISTURE: {
    defectEn: "Chronic excessive moisture (poor insulation)",
    categoryEn: "Water damage",
    searchTermsEn: [
      "chronic moisture", "poor insulation", "persistent damp",
      "long-term moisture", "bad insulation", "always damp",
    ],
    searchTermsFr: [
      "humidite", "excessive", "durable", "isolation",
    ],
    nature: "humidity_mould",
  },
  CH_RENT_RED_ROOF_LEAK_KITCHEN: {
    defectEn: "Roof water damage, kitchen uninhabitable",
    categoryEn: "Water damage",
    searchTermsEn: [
      "roof leak", "kitchen unusable", "uninhabitable kitchen",
      "water from roof", "roof damage", "kitchen water damage",
    ],
    searchTermsFr: [
      "degat", "eau", "toit", "cuisine", "inhabitable",
    ],
    nature: "water_damage",
  },

  // ── Rénovations ──────────────────────────────────────────────
  CH_RENT_RED_BATH_RENO: {
    defectEn: "Bathtub/plumbing replacement, water cut off",
    categoryEn: "Renovations",
    searchTermsEn: [
      "bathtub replacement", "plumbing work", "water cut",
      "bathroom renovation", "no water", "pipe replacement",
    ],
    searchTermsFr: [
      "baignoire", "tuyauterie", "eau", "coupee",
    ],
    nature: "renovation_disruption",
  },
  CH_RENT_RED_INCOMPLETE_FINISH: {
    defectEn: "Unfinished finishing work at move-in",
    categoryEn: "Renovations",
    searchTermsEn: [
      "unfinished work", "move-in defects", "not completed",
      "construction not done", "finishing work",
    ],
    searchTermsFr: [
      "travaux", "finition", "termines", "emmenagement",
    ],
    nature: "renovation_disruption",
  },
  CH_RENT_RED_RENO_DISRUPTION: {
    defectEn: "Odours, water cuts, laundry unusable, workers on Saturday",
    categoryEn: "Renovations",
    searchTermsEn: [
      "renovation disruption", "odours", "water cut",
      "laundry room", "weekend workers", "construction noise",
      "smell", "dust",
    ],
    searchTermsFr: [
      "odeurs", "coupures", "eau", "buanderie", "inutilisable",
      "ouvriers", "samedi",
    ],
    nature: "renovation_disruption",
  },
  CH_RENT_RED_LUXURY_RENO: {
    defectEn: "3-month renovation in luxury apartment",
    categoryEn: "Renovations",
    searchTermsEn: [
      "long renovation", "3 months", "luxury apartment",
      "extended construction", "major renovation",
    ],
    searchTermsFr: [
      "travaux", "mois", "appartement", "luxe",
    ],
    nature: "renovation_disruption",
  },
  CH_RENT_RED_BUILDING_SITE_SANITARY: {
    defectEn: "Building under construction, sanitary replacement",
    categoryEn: "Renovations",
    searchTermsEn: [
      "building site", "construction site", "sanitary work",
      "bathroom replacement", "building renovation",
      "toilet replacement",
    ],
    searchTermsFr: [
      "immeuble", "chantier", "remplacement", "sanitaires",
    ],
    nature: "renovation_disruption",
  },
  CH_RENT_RED_CONSTRUCTION_MIN: {
    defectEn: "Construction (noise, dust, crane) — minimum disruption",
    categoryEn: "Renovations",
    searchTermsEn: [
      "construction noise", "dust", "crane", "building work",
      "nearby construction", "scaffolding",
    ],
    searchTermsFr: [
      "construction", "bruit", "poussiere", "grue",
    ],
    nature: "renovation_disruption",
  },
  CH_RENT_RED_CONSTRUCTION_MAX: {
    defectEn: "Construction (noise, dust, crane) — maximum disruption",
    categoryEn: "Renovations",
    searchTermsEn: [
      "heavy construction", "major disruption", "extreme noise",
      "constant dust", "crane", "heavy machinery",
    ],
    searchTermsFr: [
      "construction", "bruit", "poussiere", "grue",
    ],
    nature: "renovation_disruption",
  },
  CH_RENT_RED_HEAVY_RENO: {
    defectEn: "Heavy renovation, dust, holes in walls, no elevator (4th floor)",
    categoryEn: "Renovations",
    searchTermsEn: [
      "heavy renovation", "holes walls", "no elevator",
      "4th floor", "major works", "dust everywhere",
      "gros oeuvre",
    ],
    searchTermsFr: [
      "gros", "travaux", "poussiere", "trous", "murs", "ascenseur",
    ],
    nature: "renovation_disruption",
  },

  // ── Immissions ───────────────────────────────────────────────
  CH_RENT_RED_HEATING_NOISE: {
    defectEn: "Heating noise (1 room out of 4)",
    categoryEn: "Immissions",
    searchTermsEn: [
      "heating noise", "radiator noise", "banging pipes",
      "noisy heating", "clicking radiator",
    ],
    searchTermsFr: [
      "bruit", "chauffage", "piece",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_CHIMNEY_SMOKE: {
    defectEn: "Terrace compromised by chimney smoke",
    categoryEn: "Immissions",
    searchTermsEn: [
      "chimney smoke", "terrace smoke", "smoke nuisance",
      "fireplace smoke", "balcony smoke",
    ],
    searchTermsFr: [
      "terrasse", "fumee", "cheminee",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_VENTILATION_NOISE: {
    defectEn: "Defective ventilation noise",
    categoryEn: "Immissions",
    searchTermsEn: [
      "ventilation noise", "noisy fan", "ventilation system",
      "air duct noise", "HVAC noise",
    ],
    searchTermsFr: [
      "bruit", "ventilation", "defectueuse",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_NEARBY_CONSTRUCTION: {
    defectEn: "Nearby construction site at 2.2m — during works",
    categoryEn: "Immissions",
    searchTermsEn: [
      "nearby construction", "construction next door",
      "building site close", "neighbouring works",
    ],
    searchTermsFr: [
      "chantier", "voisin", "travaux",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_NEARBY_PERMANENT: {
    defectEn: "Nearby construction at 2.2m — permanent impact",
    categoryEn: "Immissions",
    searchTermsEn: [
      "permanent obstruction", "building next door",
      "light blocked", "view blocked", "new building",
    ],
    searchTermsFr: [
      "chantier", "voisin", "definitif",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_NEIGHBOR_WORKS: {
    defectEn: "Works in neighbouring building/courtyard (compressor, crane)",
    categoryEn: "Immissions",
    searchTermsEn: [
      "neighbour works", "courtyard construction", "compressor",
      "crane", "noisy works", "building works next door",
    ],
    searchTermsFr: [
      "travaux", "batiment", "voisin", "cour", "compresseur", "grue",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_TOXIC_ODOURS: {
    defectEn: "Toxic odours on certain days",
    categoryEn: "Immissions",
    searchTermsEn: [
      "toxic smell", "chemical odour", "toxic fumes",
      "bad smell", "noxious odour", "gas smell",
    ],
    searchTermsFr: [
      "odeurs", "toxiques", "jours",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_MUSIC_NOISE: {
    defectEn: "Excessively loud orchestra music in the evening",
    categoryEn: "Immissions",
    searchTermsEn: [
      "loud music", "noise complaint", "evening noise",
      "music too loud", "party noise", "neighbour noise",
    ],
    searchTermsFr: [
      "musique", "forte", "orchestre", "soiree",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_ELEVATOR_NOISE_MODERATE: {
    defectEn: "Elevator noise (27-38 dB instead of 22 dB)",
    categoryEn: "Immissions",
    searchTermsEn: [
      "elevator noise", "lift noise", "decibels",
      "noisy elevator", "loud lift",
    ],
    searchTermsFr: [
      "bruit", "ascenseur", "db",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_ELEVATOR_NOISE_SEVERE: {
    defectEn: "Elevator noise in living room/bedroom (SIA-181 exceeded)",
    categoryEn: "Immissions",
    searchTermsEn: [
      "elevator noise bedroom", "lift noise living room",
      "noise standard exceeded", "SIA-181",
    ],
    searchTermsFr: [
      "bruit", "ascenseur", "sejour", "chambre", "sia",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_RESTAURANT_ODOUR: {
    defectEn: "Restaurant odours due to bad ventilation",
    categoryEn: "Immissions",
    searchTermsEn: [
      "restaurant smell", "cooking smell", "kitchen ventilation",
      "grease smell", "food odour", "exhaust smell",
    ],
    searchTermsFr: [
      "odeurs", "restaurant", "ventilation",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_SOUND_INSULATION: {
    defectEn: "Insufficient sound insulation above public venue",
    categoryEn: "Immissions",
    searchTermsEn: [
      "sound insulation", "noise insulation", "pub noise",
      "bar noise", "nightclub noise", "noise from below",
    ],
    searchTermsFr: [
      "isolation", "phonique", "etablissement", "public",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_LIGHT_DEPRIVATION: {
    defectEn: "Light deprivation (construction at 2.2m, ground floor)",
    categoryEn: "Immissions",
    searchTermsEn: [
      "light deprivation", "no sunlight", "blocked light",
      "dark apartment", "shadow", "ground floor light",
    ],
    searchTermsFr: [
      "privation", "lumiere", "construction", "rdc",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_UPSTAIRS_WORKS: {
    defectEn: "Works in the apartment above",
    categoryEn: "Immissions",
    searchTermsEn: [
      "upstairs renovation", "works above", "noise from above",
      "apartment above", "ceiling noise",
    ],
    searchTermsFr: [
      "travaux", "appartement", "dessus",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_SEVERE_CONSTRUCTION: {
    defectEn: "Severe immissions from nearby construction (blasting, etc.)",
    categoryEn: "Immissions",
    searchTermsEn: [
      "blasting", "dynamite", "severe construction",
      "extreme noise", "vibrations", "jackhammer",
    ],
    searchTermsFr: [
      "immissions", "graves", "chantier", "dynamitage",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_COMMON_AREA_WORKS: {
    defectEn: "Renovation of common areas (jackhammer, circular saw)",
    categoryEn: "Immissions",
    searchTermsEn: [
      "common area renovation", "jackhammer", "circular saw",
      "hallway works", "staircase renovation",
    ],
    searchTermsFr: [
      "transformations", "locaux", "communs", "marteau-piqueur", "scie",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_WORKS_BELOW_HEAVY: {
    defectEn: "Heavy construction works below windows",
    categoryEn: "Immissions",
    searchTermsEn: [
      "works below windows", "street construction",
      "heavy works outside", "road works",
    ],
    searchTermsFr: [
      "travaux", "fenetres", "gros", "oeuvre",
    ],
    nature: "noise_immission",
  },
  CH_RENT_RED_WORKS_BELOW_LIGHT: {
    defectEn: "Lighter construction works below windows — until completion",
    categoryEn: "Immissions",
    searchTermsEn: [
      "finishing works outside", "light construction below",
      "works wrapping up", "minor works outside",
    ],
    searchTermsFr: [
      "travaux", "fenetres", "fin",
    ],
    nature: "noise_immission",
  },

  // ── Défauts ──────────────────────────────────────────────────
  CH_RENT_RED_DISHWASHER: {
    defectEn: "Dishwasher broken",
    categoryEn: "Defects",
    searchTermsEn: [
      "dishwasher", "broken dishwasher", "dishwasher not working",
      "dishwasher leaking", "dishwasher fault",
    ],
    searchTermsFr: [
      "lave-vaisselle", "panne",
    ],
    nature: "appliance_failure",
  },
  CH_RENT_RED_FIREPLACE: {
    defectEn: "Decorative fireplace not working (Oct-Apr)",
    categoryEn: "Defects",
    searchTermsEn: [
      "fireplace", "chimney", "decorative fireplace",
      "fireplace broken", "fireplace not working",
    ],
    searchTermsFr: [
      "cheminee", "agrement", "fonctionne",
    ],
    nature: "appliance_failure",
  },
  CH_RENT_RED_MAILBOX: {
    defectEn: "Missing mailbox",
    categoryEn: "Defects",
    searchTermsEn: [
      "mailbox", "letterbox", "post box", "missing mailbox",
      "no mailbox",
    ],
    searchTermsFr: [
      "boite", "lettres", "manquante",
    ],
    nature: "access_common_area",
  },
  CH_RENT_RED_INTERCOM: {
    defectEn: "Intercom out of service (4th floor)",
    categoryEn: "Defects",
    searchTermsEn: [
      "intercom", "buzzer", "door phone", "entry phone",
      "intercom broken", "buzzer not working",
    ],
    searchTermsFr: [
      "interphone", "hors", "usage", "etage",
    ],
    nature: "appliance_failure",
  },
  CH_RENT_RED_ELEVATOR_DOWN: {
    defectEn: "Elevator breakdown (4th floor)",
    categoryEn: "Defects",
    searchTermsEn: [
      "elevator broken", "lift broken", "elevator out of order",
      "lift not working", "elevator breakdown",
    ],
    searchTermsFr: [
      "panne", "ascenseur", "etage",
    ],
    nature: "appliance_failure",
  },
  CH_RENT_RED_LAUNDRY: {
    defectEn: "Laundry room/dryer unusable",
    categoryEn: "Defects",
    searchTermsEn: [
      "laundry room", "dryer broken", "washing machine",
      "laundry unusable", "tumble dryer",
    ],
    searchTermsFr: [
      "buanderie", "sechoir", "inutilisable",
    ],
    nature: "appliance_failure",
  },
  CH_RENT_RED_KITCHEN_VENTILATION: {
    defectEn: "Insufficient ventilation in windowless kitchen",
    categoryEn: "Defects",
    searchTermsEn: [
      "kitchen ventilation", "no window kitchen", "windowless kitchen",
      "extractor fan", "kitchen air", "kitchen exhaust",
    ],
    searchTermsFr: [
      "ventilation", "insuffisante", "cuisine", "borgne",
    ],
    nature: "appliance_failure",
  },
  CH_RENT_RED_SHOWER: {
    defectEn: "Shower out of service",
    categoryEn: "Defects",
    searchTermsEn: [
      "shower broken", "no shower", "shower not working",
      "shower leak", "broken shower",
    ],
    searchTermsFr: [
      "douche", "hors", "usage",
    ],
    nature: "appliance_failure",
  },
  CH_RENT_RED_NO_WATER: {
    defectEn: "Bathroom and kitchen without water",
    categoryEn: "Defects",
    searchTermsEn: [
      "no water", "water cut off", "no running water",
      "water supply", "dry taps", "no tap water",
    ],
    searchTermsFr: [
      "salle de bains", "cuisine", "sans eau",
    ],
    nature: "appliance_failure",
  },

  // ── Autres ───────────────────────────────────────────────────
  CH_RENT_RED_NO_CARETAKER: {
    defectEn: "No building caretaker",
    categoryEn: "Other",
    searchTermsEn: [
      "caretaker", "janitor", "concierge", "building manager",
      "no caretaker", "missing janitor",
    ],
    searchTermsFr: [
      "conciergerie", "absence",
    ],
    nature: "access_common_area",
  },
  CH_RENT_RED_STAINED_CEILING: {
    defectEn: "Stained ceilings, worn wallpaper",
    categoryEn: "Other",
    searchTermsEn: [
      "stained ceiling", "worn wallpaper", "peeling paint",
      "discoloured ceiling", "old wallpaper",
    ],
    searchTermsFr: [
      "plafonds", "taches", "papiers", "peints", "usages",
    ],
    nature: "maintenance_general",
  },
  CH_RENT_RED_DAMAGED_WALLS_FLOOR: {
    defectEn: "Stained walls, damaged parquet flooring",
    categoryEn: "Other",
    searchTermsEn: [
      "damaged walls", "damaged parquet", "floor damage",
      "stained walls", "scratched floor", "worn flooring",
    ],
    searchTermsFr: [
      "parois", "tachees", "parquet", "endommage",
    ],
    nature: "maintenance_general",
  },
  CH_RENT_RED_POORLY_MAINTAINED: {
    defectEn: "Poorly maintained building entrance and courtyard",
    categoryEn: "Other",
    searchTermsEn: [
      "poorly maintained", "dirty entrance", "messy courtyard",
      "building entrance", "common area dirty", "neglected building",
    ],
    searchTermsFr: [
      "entree", "immeuble", "cour", "mal", "tenues",
    ],
    nature: "maintenance_general",
  },
  CH_RENT_RED_MASSAGE_PARLOUR: {
    defectEn: "Massage parlour in building",
    categoryEn: "Other",
    searchTermsEn: [
      "massage parlour", "inappropriate business", "nuisance tenants",
      "massage salon", "unwanted business",
    ],
    searchTermsFr: [
      "salon", "massage", "immeuble",
    ],
    nature: "other",
  },
};

// ==========================================
// Helper: get translation for a rule key
// ==========================================

/**
 * Return the translation entry for a given rule key, or null if not found.
 */
export function getTranslation(ruleKey: string): RuleTranslation | null {
  return RULE_TRANSLATIONS[ruleKey] ?? null;
}

// ==========================================
// Helper: classify request nature
// ==========================================

/**
 * Nature keyword dictionaries — bilingual.
 * Returns the first matching nature, or 'other'.
 */
const NATURE_PATTERNS: Array<{ nature: RequestNature; patterns: RegExp[] }> = [
  {
    nature: "appliance_failure",
    patterns: [
      /\b(dishwasher|lave-vaisselle|geschirrsp[uü]ler|sp[uü]lmaschine)\b/i,
      /\b(washing machine|machine [àa] laver|waschmaschine)\b/i,
      /\b(fridge|r[ée]frig[ée]rateur|k[uü]hlschrank)\b/i,
      /\b(oven|four|ofen|stove|cuisini[èe]re|herd)\b/i,
      /\b(elevator|ascenseur|aufzug|lift)\b/i,
      /\b(intercom|interphone|gegensprechanlage)\b/i,
      /\b(shower|douche|dusche)\b/i,
      /\b(boiler|chaudi[èe]re|heizkessel)\b/i,
      /\b(broken|panne|kaputt|cass[ée]|defekt|en panne|hors d'usage)\b/i,
      /\b(not working|ne fonctionne|funktioniert nicht)\b/i,
    ],
  },
  {
    nature: "water_damage",
    patterns: [
      /\b(water damage|d[ée]g[âa]t.{0,3}d.{0,3}eau|wasserschaden)\b/i,
      /\b(flood|inond|[üu]berschwemm)\b/i,
      /\b(leak|fuite|leck)\b/i,
      /\b(infiltration)\b/i,
      /\b(pipe burst|tuyau|rohrbruch)\b/i,
      /\b(roof leak|fuite.{0,5}toit|dachleck)\b/i,
    ],
  },
  {
    nature: "temperature_issue",
    patterns: [
      /\b(heating|chauffage|heizung)\b/i,
      /\b(too cold|trop froid|zu kalt)\b/i,
      /\b(no hot water|pas d.{0,5}eau chaude|kein.{0,5}warmwasser)\b/i,
      /\b(thermostat|radiator|radiateur|heizk[öo]rper)\b/i,
      /\b(temperature|temp[ée]rature|temperatur)\b/i,
    ],
  },
  {
    nature: "humidity_mould",
    patterns: [
      /\b(mould|mold|moisissure|schimmel)\b/i,
      /\b(humid|humidit[ée]|feucht)\b/i,
      /\b(damp|condensation|kondenswasser)\b/i,
      /\b(mildew)\b/i,
    ],
  },
  {
    nature: "noise_immission",
    patterns: [
      /\b(noise|bruit|l[äa]rm)\b/i,
      /\b(smell|odeur|geruch)\b/i,
      /\b(smoke|fum[ée]e|rauch)\b/i,
      /\b(vibration)\b/i,
      /\b(nuisance)\b/i,
      /\b(too loud|trop fort|zu laut)\b/i,
    ],
  },
  {
    nature: "renovation_disruption",
    patterns: [
      /\b(renovation|r[ée]novation|renovierung)\b/i,
      /\b(construction|chantier|baustelle)\b/i,
      /\b(travaux|works|arbeiten)\b/i,
      /\b(scaffolding|[ée]chafaudage|ger[üu]st)\b/i,
      /\b(dust|poussi[èe]re|staub)\b/i,
    ],
  },
  {
    nature: "structural_defect",
    patterns: [
      /\b(crack|fissure|riss)\b/i,
      /\b(structural|structurel|strukturell)\b/i,
      /\b(foundation|fondation|fundament)\b/i,
      /\b(subsidence|affaissement|absenkung)\b/i,
    ],
  },
  {
    nature: "access_common_area",
    patterns: [
      /\b(mailbox|bo[iî]te aux lettres|briefkasten)\b/i,
      /\b(caretaker|concierge|hauswart)\b/i,
      /\b(laundry room|buanderie|waschk[üu]che)\b/i,
      /\b(common area|parties communes|gemeinschaftsr[äa]um)\b/i,
    ],
  },
  {
    nature: "maintenance_general",
    patterns: [
      /\b(paint|peinture|farbe|anstrich)\b/i,
      /\b(wallpaper|papier peint|tapete)\b/i,
      /\b(floor|parquet|boden|plancher)\b/i,
      /\b(ceiling|plafond|decke)\b/i,
      /\b(worn|us[ée]|abgenutzt)\b/i,
    ],
  },
];

/**
 * Classify the nature of a maintenance request from its description + category.
 * Returns the most likely RequestNature.
 */
export function classifyRequestNature(
  description: string,
  category?: string | null,
): RequestNature {
  const text = `${description || ""} ${category || ""}`.toLowerCase();

  for (const { nature, patterns } of NATURE_PATTERNS) {
    if (patterns.some((p) => p.test(text))) {
      return nature;
    }
  }

  return "other";
}

// ==========================================
// Text normalisation helpers
// ==========================================

/**
 * Strip diacritics / accents for matching.
 */
export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Basic stemming — strip common French/English suffixes to get root forms.
 * Not a full Porter stemmer but covers the most common inflections that
 * cause mismatches (e.g. "moisissures" → "moisissur", "leaking" → "leak").
 */
export function basicStem(word: string): string {
  let w = word.toLowerCase();
  // English -ing, -ed, -tion, -ness, -ment, -able, -ible, -ly, -er, -est, -es, -s
  w = w.replace(/(ation|tion|sion|ness|ment|able|ible)$/, "");
  w = w.replace(/(ing|ed|ly|er|est)$/, "");
  w = w.replace(/(es|s)$/, "");
  // French -tion, -ment, -ure, -age, -eux/-euse, -ais/-aise, -ées, -és, -es, -s
  w = w.replace(/(ement|ement)$/, "");
  w = w.replace(/(euse|eux|aise|ais)$/, "");
  w = w.replace(/(ure|age)$/, "");
  w = w.replace(/(ees|es|ee|e)$/, "");
  w = w.replace(/s$/, "");
  return w;
}

/**
 * Normalise text for matching: lowercase + strip accents.
 */
export function normaliseForMatch(text: string): string {
  return stripAccents(text.toLowerCase());
}

/**
 * Tokenize + normalize + stem a piece of text, returning unique stems
 * alongside the original normalized tokens.
 */
export function tokenizeAndStem(text: string): { tokens: string[]; stems: string[] } {
  const norm = normaliseForMatch(text);
  const tokens = norm.split(/[\s,;.!?()[\]{}'"\-–—/]+/).filter((t) => t.length >= 3);
  const stems = [...new Set(tokens.map(basicStem).filter((s) => s.length >= 3))];
  return { tokens, stems };
}
