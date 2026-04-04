/**
 * Swiss Renovation Classification Catalog
 *
 * Canonical, single-source-of-truth catalog of common Swiss renovation jobs
 * and their usual tax / accounting treatment for privately owned rental buildings.
 *
 * ⚠️  This is decision-support guidance, NOT legal advice.
 *     Wording uses "usually", "likely", "typical" — never guarantees.
 *
 * Coverage:
 *   - 51 common renovation job types
 *   - 4 tax categories: WERTERHALTEND, WERTVERMEHREND, MIXED, ENERGY_ENVIRONMENT
 *   - Accounting treatment guidance
 *   - Timing sensitivity for tax planning
 *   - Asset-linkable flag for tying to inventory
 *   - Searchable aliases
 *
 * Architecture:
 *   - Static typed catalog (no DB dependency)
 *   - Lookup helpers for code, asset type/topic, free-text search
 *   - Robust fallback for unmapped jobs
 *   - Used by read-model endpoints — frontend should NOT duplicate this catalog
 *
 * Layer: service (reusable static helper — no Prisma, no side effects)
 */

import { TaxClassification } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────────────

export type AccountingTreatment =
  | "IMMEDIATE_DEDUCTION"
  | "CAPITALIZED"
  | "SPLIT"
  | "ENERGY_DEDUCTION";

export type TimingSensitivity = "HIGH" | "MODERATE" | "LOW";

export type BuildingSystem =
  | "FACADE"
  | "WINDOWS"
  | "ROOF"
  | "INTERIOR"
  | "COMMON_AREAS"
  | "BATHROOM"
  | "KITCHEN"
  | "APPLIANCES"
  | "MEP"
  | "EXTERIOR"
  | "LAUNDRY";

export interface RenovationCatalogEntry {
  /** Unique stable code, e.g. "FAC-01" */
  code: string;
  /** Human label */
  label: string;
  /** Searchable aliases / alternative terms */
  aliases: string[];
  /** Building system grouping */
  buildingSystem: BuildingSystem;
  /** Swiss tax classification */
  taxCategory: TaxClassification;
  /** Accounting treatment guidance */
  accountingTreatment: AccountingTreatment;
  /** Plain-language deductibility guidance */
  typicalDeductibility: string;
  /** Estimated deductible percentage (0-100) */
  deductiblePct: number;
  /** Notes / caveats */
  notes: string;
  /** Whether this can be linked to an existing asset */
  assetLinkable: boolean;
  /** Whether timing is likely to matter for tax planning */
  timingSensitivity: TimingSensitivity;
  /** Asset type/topic pairs this typically maps to (for auto-linking) */
  assetMappings?: Array<{ assetType: string; topic: string }>;
}

export interface RenovationLookupResult {
  entry: RenovationCatalogEntry | null;
  source: "EXACT" | "ASSET_MAPPING" | "SEARCH" | "FALLBACK";
  confidence: number;
}

// ─── Accounting Treatment Labels ───────────────────────────────

export const ACCOUNTING_TREATMENT_LABELS: Record<AccountingTreatment, string> = {
  IMMEDIATE_DEDUCTION: "Usually expensed in current year",
  CAPITALIZED: "Usually capitalized over useful life",
  SPLIT: "Usually split between maintenance and improvement",
  ENERGY_DEDUCTION: "Usually deductible as energy/environment measure",
};

// ─── Tax Category Labels ───────────────────────────────────────

export const TAX_CATEGORY_LABELS: Record<TaxClassification, string> = {
  WERTERHALTEND: "Value preserving",
  WERTVERMEHREND: "Value enhancing",
  MIXED: "Mixed",
  ENERGY_ENVIRONMENT: "Energy / environment",
};

// ─── Timing Sensitivity Labels ─────────────────────────────────

export const TIMING_SENSITIVITY_LABELS: Record<TimingSensitivity, string> = {
  HIGH: "Timing likely matters a lot",
  MODERATE: "Timing likely matters moderately",
  LOW: "Timing likely matters little",
};

export const TIMING_SENSITIVITY_GUIDANCE: Record<TimingSensitivity, string> = {
  HIGH: "Usually more relevant to schedule in a higher-income year — the full amount is typically deductible immediately.",
  MODERATE: "Timing may matter for the deductible portion — consider income levels when scheduling.",
  LOW: "Timing is often less tax-sensitive because the work is usually capitalized or the deductible portion is small.",
};

// ─── The Catalog ───────────────────────────────────────────────

export const RENOVATION_CATALOG: RenovationCatalogEntry[] = [
  // ── Facade / exterior ────────────────────────────────────────
  {
    code: "FAC-01",
    label: "Exterior repainting of façade",
    aliases: ["facade painting", "exterior paint", "Fassadenanstrich", "peinture façade"],
    buildingSystem: "FACADE",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like restoration",
    deductiblePct: 100,
    notes: "Standard repainting restoring existing appearance. If colour/material significantly changes, consider MIXED.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
  },
  {
    code: "FAC-02",
    label: "Façade cleaning",
    aliases: ["facade wash", "pressure washing facade", "Fassadenreinigung", "nettoyage façade"],
    buildingSystem: "FACADE",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — maintenance work",
    deductiblePct: 100,
    notes: "Routine cleaning / pressure washing to restore appearance.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
  },
  {
    code: "FAC-03",
    label: "Façade recladding (upgrade from simple paint)",
    aliases: ["facade cladding", "new facade material", "Fassadenverkleidung", "revêtement façade"],
    buildingSystem: "FACADE",
    taxCategory: "MIXED",
    accountingTreatment: "SPLIT",
    typicalDeductibility: "Split — maintenance portion deductible, enhancement portion capitalized",
    deductiblePct: 50,
    notes: "Replacing simple paint with new cladding material typically involves both value preservation and enhancement.",
    assetLinkable: false,
    timingSensitivity: "MODERATE",
  },
  {
    code: "FAC-04",
    label: "Natural-stone façade renovation",
    aliases: ["stone facade repair", "Natursteinsanierung", "rénovation pierre naturelle"],
    buildingSystem: "FACADE",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — restoration of existing material",
    deductiblePct: 100,
    notes: "Restoring existing natural stone. If upgrading material quality significantly, may be MIXED.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
  },
  {
    code: "FAC-05",
    label: "Façade thermal insulation",
    aliases: ["facade insulation", "exterior insulation", "Fassadendämmung", "isolation façade", "ETICS"],
    buildingSystem: "FACADE",
    taxCategory: "ENERGY_ENVIRONMENT",
    accountingTreatment: "ENERGY_DEDUCTION",
    typicalDeductibility: "Usually deductible as energy-saving measure",
    deductiblePct: 100,
    notes: "Energy-saving investments on existing buildings are typically fully deductible under federal and most cantonal rules.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
  },

  // ── Windows / openings ───────────────────────────────────────
  {
    code: "WIN-01",
    label: "Window repair or like-for-like replacement",
    aliases: ["window replacement", "Fensterersatz", "remplacement fenêtres", "window repair"],
    buildingSystem: "WINDOWS",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Replacing windows with equivalent standard. If upgrading to significantly higher spec, consider MIXED.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "FIXTURE", topic: "WINDOWS" }],
  },
  {
    code: "WIN-02",
    label: "Energy-efficient window upgrade",
    aliases: ["triple glazing", "energy windows", "Energiefenster", "fenêtres énergie", "low-e windows"],
    buildingSystem: "WINDOWS",
    taxCategory: "ENERGY_ENVIRONMENT",
    accountingTreatment: "ENERGY_DEDUCTION",
    typicalDeductibility: "Usually deductible as energy-saving measure",
    deductiblePct: 100,
    notes: "Upgraded glazing primarily for energy efficiency. Must demonstrate energy improvement to qualify.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "FIXTURE", topic: "WINDOWS" }],
  },
  {
    code: "WIN-03",
    label: "New entrance vestibule / windbreak for efficiency",
    aliases: ["vestibule", "windbreak", "Windfang", "sas d'entrée"],
    buildingSystem: "WINDOWS",
    taxCategory: "ENERGY_ENVIRONMENT",
    accountingTreatment: "ENERGY_DEDUCTION",
    typicalDeductibility: "Usually deductible as energy-saving measure",
    deductiblePct: 100,
    notes: "Unheated vestibule added primarily to reduce heat loss.",
    assetLinkable: false,
    timingSensitivity: "MODERATE",
  },
  {
    code: "WIN-04",
    label: "New awnings / sun blinds (new or enhanced amenity)",
    aliases: ["awning", "sun blinds", "Markise", "Sonnenschutz", "store"],
    buildingSystem: "WINDOWS",
    taxCategory: "WERTVERMEHREND",
    accountingTreatment: "CAPITALIZED",
    typicalDeductibility: "Usually capitalized — new amenity",
    deductiblePct: 0,
    notes: "First-time installation or significant upgrade. If replacing existing like-for-like, use WIN-05.",
    assetLinkable: true,
    timingSensitivity: "LOW",
    assetMappings: [{ assetType: "FIXTURE", topic: "BLINDS" }],
  },
  {
    code: "WIN-05",
    label: "Awning / sun blind repair or like-for-like replacement",
    aliases: ["awning repair", "blind replacement", "Markisenersatz", "réparation store"],
    buildingSystem: "WINDOWS",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Replacing existing awnings/blinds with equivalent.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "FIXTURE", topic: "BLINDS" }],
  },
  {
    code: "WIN-06",
    label: "New shutters / roller shutters for thermal benefit",
    aliases: ["shutters", "roller shutters", "Rollläden", "volets roulants"],
    buildingSystem: "WINDOWS",
    taxCategory: "ENERGY_ENVIRONMENT",
    accountingTreatment: "ENERGY_DEDUCTION",
    typicalDeductibility: "Usually deductible as energy-saving measure",
    deductiblePct: 100,
    notes: "New shutters installed primarily for thermal benefit. Must have energy justification.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "FIXTURE", topic: "SHUTTERS" }],
  },
  {
    code: "WIN-07",
    label: "Shutter / roller shutter repair or like-for-like replacement",
    aliases: ["shutter repair", "Rollladenersatz", "réparation volets"],
    buildingSystem: "WINDOWS",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Replacing existing shutters with equivalent.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "FIXTURE", topic: "SHUTTERS" }],
  },

  // ── Roof / terrace / balcony ─────────────────────────────────
  {
    code: "ROF-01",
    label: "Terrace waterproofing + replacement finish",
    aliases: ["terrace waterproofing", "Terrassenabdichtung", "étanchéité terrasse"],
    buildingSystem: "ROOF",
    taxCategory: "MIXED",
    accountingTreatment: "SPLIT",
    typicalDeductibility: "Split — waterproofing is maintenance, new finish may be enhancement",
    deductiblePct: 60,
    notes: "Waterproofing is typically value-preserving; a significantly upgraded finish may be partly capitalized.",
    assetLinkable: false,
    timingSensitivity: "MODERATE",
  },
  {
    code: "ROF-02",
    label: "Terrace / balcony repair like-for-like",
    aliases: ["balcony repair", "terrace repair", "Balkonsanierung", "réparation balcon"],
    buildingSystem: "ROOF",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like restoration",
    deductiblePct: 100,
    notes: "Standard repair / restoration of existing terrace or balcony.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
  },
  {
    code: "ROF-03",
    label: "Thermal insulation of terrace floor",
    aliases: ["terrace insulation", "Terrassendämmung", "isolation terrasse"],
    buildingSystem: "ROOF",
    taxCategory: "ENERGY_ENVIRONMENT",
    accountingTreatment: "ENERGY_DEDUCTION",
    typicalDeductibility: "Usually deductible as energy-saving measure",
    deductiblePct: 100,
    notes: "Energy-saving investment on existing building.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
  },
  {
    code: "ROF-04",
    label: "Roof repair / like-for-like reroofing",
    aliases: ["roof repair", "reroofing", "Dachsanierung", "réfection toiture"],
    buildingSystem: "ROOF",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like restoration",
    deductiblePct: 100,
    notes: "Standard roof repair or replacement with equivalent materials.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "STRUCTURAL", topic: "ROOF" }],
  },
  {
    code: "ROF-05",
    label: "Roof thermal insulation improvement",
    aliases: ["roof insulation", "Dachdämmung", "isolation toiture"],
    buildingSystem: "ROOF",
    taxCategory: "ENERGY_ENVIRONMENT",
    accountingTreatment: "ENERGY_DEDUCTION",
    typicalDeductibility: "Usually deductible as energy-saving measure",
    deductiblePct: 100,
    notes: "Adding or improving roof insulation for energy efficiency.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "STRUCTURAL", topic: "ROOF" }],
  },
  {
    code: "ROF-06",
    label: "Attic conversion into habitable space",
    aliases: ["attic conversion", "loft conversion", "Dachausbau", "aménagement combles"],
    buildingSystem: "ROOF",
    taxCategory: "WERTVERMEHREND",
    accountingTreatment: "CAPITALIZED",
    typicalDeductibility: "Usually capitalized — creates new living space",
    deductiblePct: 0,
    notes: "Converting unused attic into habitable space is almost always value-enhancing.",
    assetLinkable: false,
    timingSensitivity: "LOW",
  },

  // ── Interior finishes ────────────────────────────────────────
  {
    code: "INT-01",
    label: "Interior repainting / plaster repair / like-for-like wall & ceiling work",
    aliases: ["interior painting", "plaster repair", "Malerarbeiten", "peinture intérieure", "wall repair"],
    buildingSystem: "INTERIOR",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — standard maintenance",
    deductiblePct: 100,
    notes: "Standard interior painting, plaster repair, wall/ceiling restoration.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "FINISH", topic: "WALL_COVERING" }, { assetType: "FINISH", topic: "CEILING" }],
  },
  {
    code: "INT-02",
    label: "Interior insulation of façade walls / cellar ceiling",
    aliases: ["interior insulation", "cellar insulation", "Innendämmung", "isolation intérieure"],
    buildingSystem: "INTERIOR",
    taxCategory: "ENERGY_ENVIRONMENT",
    accountingTreatment: "ENERGY_DEDUCTION",
    typicalDeductibility: "Usually deductible as energy-saving measure",
    deductiblePct: 100,
    notes: "Energy-saving interior insulation on existing building.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
  },
  {
    code: "INT-03",
    label: "Floor finish replacement like-for-like (incl. modest modernization)",
    aliases: ["floor replacement", "flooring", "Bodenbelag", "revêtement sol", "parquet", "tiles"],
    buildingSystem: "INTERIOR",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like including modest updates",
    deductiblePct: 100,
    notes: "Replacing worn flooring with comparable quality. Modest material changes are typically still value-preserving.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "FINISH", topic: "FLOORING" }],
  },
  {
    code: "INT-04",
    label: "Significantly higher-spec interior finishes",
    aliases: ["luxury finishes", "premium interior", "gehobene Ausstattung", "finitions haut de gamme"],
    buildingSystem: "INTERIOR",
    taxCategory: "MIXED",
    accountingTreatment: "SPLIT",
    typicalDeductibility: "Split — maintenance portion deductible, luxury upgrade capitalized",
    deductiblePct: 40,
    notes: "When interior finish quality is meaningfully upgraded beyond like-for-like, a portion is typically capitalized.",
    assetLinkable: false,
    timingSensitivity: "MODERATE",
  },

  // ── Garage / stairs / common areas ───────────────────────────
  {
    code: "COM-01",
    label: "Garage door repair or like-for-like replacement",
    aliases: ["garage door repair", "Garagentorersatz", "réparation porte garage"],
    buildingSystem: "COMMON_AREAS",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Replacing existing garage door with equivalent.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "FIXTURE", topic: "GARAGE_DOOR" }],
  },
  {
    code: "COM-02",
    label: "Garage door upgrade with new automation / enhanced functionality",
    aliases: ["garage door automation", "motorized garage door", "automatisches Garagentor"],
    buildingSystem: "COMMON_AREAS",
    taxCategory: "MIXED",
    accountingTreatment: "SPLIT",
    typicalDeductibility: "Split — door replacement deductible, automation upgrade capitalized",
    deductiblePct: 50,
    notes: "Adding new motor/automation to existing manual door involves both maintenance and enhancement.",
    assetLinkable: true,
    timingSensitivity: "MODERATE",
    assetMappings: [{ assetType: "FIXTURE", topic: "GARAGE_DOOR" }],
  },
  {
    code: "COM-03",
    label: "Stair / stairwell repair like-for-like",
    aliases: ["stair repair", "stairwell renovation", "Treppensanierung", "réparation escalier"],
    buildingSystem: "COMMON_AREAS",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like restoration",
    deductiblePct: 100,
    notes: "Standard repair of existing stairs/stairwell.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
  },
  {
    code: "COM-04",
    label: "Stair replacement with substantially upgraded construction",
    aliases: ["stair upgrade", "new staircase", "Treppenneubau", "nouvel escalier"],
    buildingSystem: "COMMON_AREAS",
    taxCategory: "MIXED",
    accountingTreatment: "SPLIT",
    typicalDeductibility: "Split — basic replacement deductible, quality upgrade capitalized",
    deductiblePct: 40,
    notes: "Replacing simple stairs with significantly upgraded construction involves enhancement.",
    assetLinkable: false,
    timingSensitivity: "MODERATE",
  },
  {
    code: "COM-05",
    label: "New elevator installation",
    aliases: ["elevator installation", "lift installation", "Lifteinbau", "installation ascenseur"],
    buildingSystem: "COMMON_AREAS",
    taxCategory: "WERTVERMEHREND",
    accountingTreatment: "CAPITALIZED",
    typicalDeductibility: "Usually capitalized — new building capability",
    deductiblePct: 0,
    notes: "Installing an elevator where none existed is almost always value-enhancing.",
    assetLinkable: true,
    timingSensitivity: "LOW",
    assetMappings: [{ assetType: "SYSTEM", topic: "ELEVATOR" }],
  },
  {
    code: "COM-06",
    label: "Elevator repair / service / like-for-like replacement",
    aliases: ["elevator repair", "lift service", "Liftreparatur", "réparation ascenseur"],
    buildingSystem: "COMMON_AREAS",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — maintenance of existing system",
    deductiblePct: 100,
    notes: "Servicing, repairing, or like-for-like replacement of existing elevator components.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "SYSTEM", topic: "ELEVATOR" }],
  },

  // ── Bathroom ─────────────────────────────────────────────────
  {
    code: "BAT-01",
    label: "Bathroom fixture replacement like-for-like",
    aliases: ["bathroom repair", "fixture replacement", "Badezimmersanierung", "rénovation salle de bain"],
    buildingSystem: "BATHROOM",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Replacing worn fixtures (toilet, sink, tub) with equivalent quality.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [
      { assetType: "FIXTURE", topic: "TOILET" },
      { assetType: "FIXTURE", topic: "SINK" },
      { assetType: "FIXTURE", topic: "BATHTUB" },
      { assetType: "FIXTURE", topic: "SHOWER" },
    ],
  },
  {
    code: "BAT-02",
    label: "Bathroom full modernization with comfort enhancement",
    aliases: ["bathroom remodel", "luxury bathroom", "Badezimmerumbau", "salle de bain complète"],
    buildingSystem: "BATHROOM",
    taxCategory: "MIXED",
    accountingTreatment: "SPLIT",
    typicalDeductibility: "Split — basic fixture replacement deductible, comfort upgrades capitalized",
    deductiblePct: 50,
    notes: "Full bathroom modernization that meaningfully raises comfort/quality standard.",
    assetLinkable: true,
    timingSensitivity: "MODERATE",
    assetMappings: [
      { assetType: "FIXTURE", topic: "TOILET" },
      { assetType: "FIXTURE", topic: "SINK" },
      { assetType: "FIXTURE", topic: "BATHTUB" },
      { assetType: "FIXTURE", topic: "SHOWER" },
    ],
  },

  // ── Kitchen ──────────────────────────────────────────────────
  {
    code: "KIT-01",
    label: "Kitchen repair or like-for-like replacement",
    aliases: ["kitchen repair", "Küchenersatz", "réparation cuisine", "kitchen replacement"],
    buildingSystem: "KITCHEN",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Replacing existing kitchen with equivalent quality and configuration.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "FIXTURE", topic: "KITCHEN_CABINETS" }],
  },
  {
    code: "KIT-02",
    label: "Kitchen replacement with meaningful upgrade in standard",
    aliases: ["kitchen upgrade", "new kitchen", "Küchenumbau", "cuisine neuve"],
    buildingSystem: "KITCHEN",
    taxCategory: "MIXED",
    accountingTreatment: "SPLIT",
    typicalDeductibility: "Split — basic replacement deductible, quality upgrade capitalized",
    deductiblePct: 50,
    notes: "Replacing existing kitchen with meaningfully higher-spec version.",
    assetLinkable: true,
    timingSensitivity: "MODERATE",
    assetMappings: [{ assetType: "FIXTURE", topic: "KITCHEN_CABINETS" }],
  },
  {
    code: "KIT-03",
    label: "First-time fitted kitchen installation",
    aliases: ["new kitchen install", "Ersteinbauküche", "première cuisine"],
    buildingSystem: "KITCHEN",
    taxCategory: "MIXED",
    accountingTreatment: "SPLIT",
    typicalDeductibility: "Usually mostly capitalized — may be partly deductible if replacing a basic setup",
    deductiblePct: 20,
    notes: "First-time installation is typically value-enhancing. May be MIXED if replacing a very basic existing setup. Conservative default: mostly capitalized.",
    assetLinkable: true,
    timingSensitivity: "LOW",
    assetMappings: [{ assetType: "FIXTURE", topic: "KITCHEN_CABINETS" }],
  },

  // ── Appliances ───────────────────────────────────────────────
  {
    code: "APP-01",
    label: "Appliance replacement like-for-like (fridge, oven, dishwasher, washer/dryer)",
    aliases: ["appliance replacement", "Geräteersatz", "remplacement appareil", "fridge", "oven", "dishwasher"],
    buildingSystem: "APPLIANCES",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement of existing units",
    deductiblePct: 100,
    notes: "Replacing existing installed appliances with equivalent.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [
      { assetType: "APPLIANCE", topic: "FRIDGE" },
      { assetType: "APPLIANCE", topic: "OVEN" },
      { assetType: "APPLIANCE", topic: "STOVE" },
      { assetType: "APPLIANCE", topic: "DISHWASHER" },
      { assetType: "APPLIANCE", topic: "WASHER" },
      { assetType: "APPLIANCE", topic: "DRYER" },
      { assetType: "APPLIANCE", topic: "TUMBLE_DRYER" },
    ],
  },
  {
    code: "APP-02",
    label: "First-time appliance installation where none existed",
    aliases: ["new appliance", "first appliance", "Erstinstallation Gerät"],
    buildingSystem: "APPLIANCES",
    taxCategory: "WERTVERMEHREND",
    accountingTreatment: "CAPITALIZED",
    typicalDeductibility: "Usually capitalized — new equipment",
    deductiblePct: 0,
    notes: "Installing an appliance where none existed before is typically value-enhancing.",
    assetLinkable: true,
    timingSensitivity: "LOW",
    assetMappings: [
      { assetType: "APPLIANCE", topic: "FRIDGE" },
      { assetType: "APPLIANCE", topic: "OVEN" },
      { assetType: "APPLIANCE", topic: "DISHWASHER" },
    ],
  },

  // ── MEP / utilities ──────────────────────────────────────────
  {
    code: "MEP-01",
    label: "Water / wastewater line repair like-for-like",
    aliases: ["plumbing repair", "pipe repair", "Sanitärreparatur", "réparation plomberie"],
    buildingSystem: "MEP",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Repairing or replacing existing water/wastewater lines with equivalent.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "SYSTEM", topic: "PLUMBING" }],
  },
  {
    code: "MEP-02",
    label: "New water / wastewater lines adding capability",
    aliases: ["new plumbing", "additional plumbing", "neue Sanitärinstallation", "nouvelle plomberie"],
    buildingSystem: "MEP",
    taxCategory: "WERTVERMEHREND",
    accountingTreatment: "CAPITALIZED",
    typicalDeductibility: "Usually capitalized — new building capability",
    deductiblePct: 0,
    notes: "Adding new plumbing capacity (e.g. new bathroom supply) is value-enhancing.",
    assetLinkable: true,
    timingSensitivity: "LOW",
    assetMappings: [{ assetType: "SYSTEM", topic: "PLUMBING" }],
  },
  {
    code: "MEP-03",
    label: "Electrical repair / like-for-like rewiring",
    aliases: ["electrical repair", "rewiring", "Elektroreparatur", "réparation électrique"],
    buildingSystem: "MEP",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Replacing existing wiring/panels with equivalent.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "SYSTEM", topic: "ELECTRICAL" }],
  },
  {
    code: "MEP-04",
    label: "New electrical installations adding new capability",
    aliases: ["new electrical", "additional circuits", "neue Elektroinstallation", "nouvelle installation électrique"],
    buildingSystem: "MEP",
    taxCategory: "WERTVERMEHREND",
    accountingTreatment: "CAPITALIZED",
    typicalDeductibility: "Usually capitalized — new building capability",
    deductiblePct: 0,
    notes: "Adding new electrical capacity (e.g. EV charging, new circuits) is value-enhancing.",
    assetLinkable: true,
    timingSensitivity: "LOW",
    assetMappings: [{ assetType: "SYSTEM", topic: "ELECTRICAL" }],
  },
  {
    code: "MEP-05",
    label: "Heating system repair / like-for-like replacement",
    aliases: ["heating repair", "Heizungsreparatur", "réparation chauffage", "boiler repair"],
    buildingSystem: "MEP",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Repairing or replacing existing heating components with equivalent.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "SYSTEM", topic: "HEATING" }],
  },
  {
    code: "MEP-06",
    label: "Energy-saving heating improvements",
    aliases: ["pipe insulation", "thermostatic valves", "metering", "Heizungsoptimierung", "optimisation chauffage"],
    buildingSystem: "MEP",
    taxCategory: "ENERGY_ENVIRONMENT",
    accountingTreatment: "ENERGY_DEDUCTION",
    typicalDeductibility: "Usually deductible as energy-saving measure",
    deductiblePct: 100,
    notes: "Pipe insulation, thermostatic valves, heat metering, efficiency upgrades.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "SYSTEM", topic: "HEATING" }],
  },
  {
    code: "MEP-07",
    label: "Heating enhancements without efficiency rationale",
    aliases: ["additional radiators", "decorative fireplace", "Kamin", "cheminée décorative"],
    buildingSystem: "MEP",
    taxCategory: "WERTVERMEHREND",
    accountingTreatment: "CAPITALIZED",
    typicalDeductibility: "Usually capitalized — comfort/amenity enhancement",
    deductiblePct: 0,
    notes: "Additional radiators, decorative fireplaces, or comfort heating without clear energy benefit.",
    assetLinkable: false,
    timingSensitivity: "LOW",
  },
  {
    code: "MEP-08",
    label: "Boiler replacement like-for-like",
    aliases: ["boiler replacement", "Kesselersatz", "remplacement chaudière"],
    buildingSystem: "MEP",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Replacing existing boiler with equivalent capacity and type.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "SYSTEM", topic: "BOILER" }],
  },
  {
    code: "MEP-09",
    label: "Boiler upgrade (larger or functionally enhanced)",
    aliases: ["boiler upgrade", "Kesselupgrade", "chaudière améliorée"],
    buildingSystem: "MEP",
    taxCategory: "MIXED",
    accountingTreatment: "SPLIT",
    typicalDeductibility: "Split — basic replacement deductible, capacity/feature upgrade capitalized",
    deductiblePct: 50,
    notes: "Replacing with a larger or more capable boiler involves both maintenance and enhancement.",
    assetLinkable: true,
    timingSensitivity: "MODERATE",
    assetMappings: [{ assetType: "SYSTEM", topic: "BOILER" }],
  },
  {
    code: "MEP-10",
    label: "District heating connection replacing existing system",
    aliases: ["district heating", "Fernwärme", "chauffage à distance"],
    buildingSystem: "MEP",
    taxCategory: "ENERGY_ENVIRONMENT",
    accountingTreatment: "ENERGY_DEDUCTION",
    typicalDeductibility: "Usually deductible as energy-saving measure",
    deductiblePct: 100,
    notes: "Connecting to district heating to replace fossil-fuel system for efficiency.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "SYSTEM", topic: "HEATING" }],
  },
  {
    code: "MEP-11",
    label: "Ventilation / AC repair like-for-like",
    aliases: ["ventilation repair", "AC repair", "Lüftungsreparatur", "réparation ventilation"],
    buildingSystem: "MEP",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Repairing or replacing existing ventilation/AC with equivalent.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [{ assetType: "SYSTEM", topic: "VENTILATION" }],
  },
  {
    code: "MEP-12",
    label: "Measures reducing cooling need / improving efficiency",
    aliases: ["cooling efficiency", "solar film", "natural ventilation", "Kühlungsoptimierung"],
    buildingSystem: "MEP",
    taxCategory: "ENERGY_ENVIRONMENT",
    accountingTreatment: "ENERGY_DEDUCTION",
    typicalDeductibility: "Usually deductible as energy-saving measure",
    deductiblePct: 100,
    notes: "Measures that reduce cooling demand or improve HVAC efficiency.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
  },

  // ── Laundry / exterior / grounds ─────────────────────────────
  {
    code: "EXT-01",
    label: "Washer/dryer repair or like-for-like replacement in common laundry",
    aliases: ["laundry repair", "Waschküche", "buanderie", "washing machine replacement"],
    buildingSystem: "LAUNDRY",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — like-for-like replacement",
    deductiblePct: 100,
    notes: "Replacing existing common laundry equipment with equivalent.",
    assetLinkable: true,
    timingSensitivity: "HIGH",
    assetMappings: [
      { assetType: "APPLIANCE", topic: "WASHER" },
      { assetType: "APPLIANCE", topic: "DRYER" },
      { assetType: "APPLIANCE", topic: "TUMBLE_DRYER" },
    ],
  },
  {
    code: "EXT-02",
    label: "First-time washer/dryer installation",
    aliases: ["new laundry", "neue Waschküche", "nouvelle buanderie"],
    buildingSystem: "LAUNDRY",
    taxCategory: "WERTVERMEHREND",
    accountingTreatment: "CAPITALIZED",
    typicalDeductibility: "Usually capitalized — new equipment",
    deductiblePct: 0,
    notes: "Installing laundry equipment where none existed is value-enhancing.",
    assetLinkable: true,
    timingSensitivity: "LOW",
    assetMappings: [
      { assetType: "APPLIANCE", topic: "WASHER" },
      { assetType: "APPLIANCE", topic: "DRYER" },
    ],
  },
  {
    code: "EXT-03",
    label: "Ordinary garden / grounds maintenance",
    aliases: ["garden maintenance", "Gartenpflege", "entretien jardin", "landscaping maintenance"],
    buildingSystem: "EXTERIOR",
    taxCategory: "WERTERHALTEND",
    accountingTreatment: "IMMEDIATE_DEDUCTION",
    typicalDeductibility: "Immediately deductible — routine maintenance",
    deductiblePct: 100,
    notes: "Routine garden care, tree trimming, lawn maintenance, path repair.",
    assetLinkable: false,
    timingSensitivity: "HIGH",
  },
  {
    code: "EXT-04",
    label: "New landscaping / amenity upgrade / luxury exterior works",
    aliases: ["new landscaping", "luxury garden", "Gartengestaltung", "aménagement paysager"],
    buildingSystem: "EXTERIOR",
    taxCategory: "WERTVERMEHREND",
    accountingTreatment: "CAPITALIZED",
    typicalDeductibility: "Usually capitalized — new amenity",
    deductiblePct: 0,
    notes: "New landscaping, swimming pool, luxury exterior features are value-enhancing.",
    assetLinkable: false,
    timingSensitivity: "LOW",
  },
];

// ─── Lookup Indexes (built once) ───────────────────────────────

const _byCode = new Map<string, RenovationCatalogEntry>();
const _byAssetMapping = new Map<string, RenovationCatalogEntry[]>();
const _allSearchTokens: Array<{ entry: RenovationCatalogEntry; tokens: string[] }> = [];

function _ensureIndexes(): void {
  if (_byCode.size > 0) return; // Already built

  for (const entry of RENOVATION_CATALOG) {
    _byCode.set(entry.code, entry);

    // Index by asset type + topic
    if (entry.assetMappings) {
      for (const mapping of entry.assetMappings) {
        const key = `${mapping.assetType}::${mapping.topic}`;
        const existing = _byAssetMapping.get(key) || [];
        existing.push(entry);
        _byAssetMapping.set(key, existing);
      }
    }

    // Build search tokens
    const tokens = [
      entry.label.toLowerCase(),
      ...entry.aliases.map((a) => a.toLowerCase()),
      entry.code.toLowerCase(),
      entry.buildingSystem.toLowerCase(),
    ];
    _allSearchTokens.push({ entry, tokens });
  }
}

// ─── Public Lookup API ─────────────────────────────────────────

/**
 * Look up a catalog entry by its exact code (e.g. "FAC-01").
 */
export function lookupByCode(code: string): RenovationLookupResult {
  _ensureIndexes();
  const entry = _byCode.get(code) ?? null;
  return {
    entry,
    source: entry ? "EXACT" : "FALLBACK",
    confidence: entry ? 1.0 : 0,
  };
}

/**
 * Look up catalog entries that match an asset type + topic combination.
 * Returns the best match (first entry, typically value-preserving default).
 */
export function lookupByAssetType(
  assetType: string,
  topic: string,
): RenovationLookupResult {
  _ensureIndexes();
  const key = `${assetType}::${topic}`;
  const entries = _byAssetMapping.get(key);
  if (entries && entries.length > 0) {
    return {
      entry: entries[0],
      source: "ASSET_MAPPING",
      confidence: 0.8,
    };
  }
  return fallbackResult();
}

/**
 * Find catalog entries matching a free-text query.
 * Returns all matches, sorted by relevance (token match count).
 */
export function searchCatalog(query: string): RenovationLookupResult[] {
  _ensureIndexes();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored: Array<{ entry: RenovationCatalogEntry; score: number }> = [];

  for (const { entry, tokens } of _allSearchTokens) {
    let score = 0;
    for (const term of terms) {
      for (const token of tokens) {
        if (token.includes(term)) {
          score += 1;
        }
      }
    }
    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.map(({ entry, score }) => ({
    entry,
    source: "SEARCH" as const,
    confidence: Math.min(1.0, score / (terms.length * 2)),
  }));
}

/**
 * Get all catalog entries, optionally filtered.
 */
export function getAllEntries(filters?: {
  buildingSystem?: BuildingSystem;
  taxCategory?: TaxClassification;
  timingSensitivity?: TimingSensitivity;
}): RenovationCatalogEntry[] {
  let results = [...RENOVATION_CATALOG];

  if (filters?.buildingSystem) {
    results = results.filter((e) => e.buildingSystem === filters.buildingSystem);
  }
  if (filters?.taxCategory) {
    results = results.filter((e) => e.taxCategory === filters.taxCategory);
  }
  if (filters?.timingSensitivity) {
    results = results.filter((e) => e.timingSensitivity === filters.timingSensitivity);
  }

  return results;
}

/**
 * Robust fallback when no mapping exists.
 */
export function fallbackResult(): RenovationLookupResult {
  return {
    entry: null,
    source: "FALLBACK",
    confidence: 0,
  };
}

/**
 * Get a human-readable summary for a tax classification.
 */
export function getTaxCategoryInfo(classification: TaxClassification): {
  label: string;
  description: string;
} {
  switch (classification) {
    case "WERTERHALTEND":
      return { label: "Value preserving", description: "Restores existing function without enhancement — typically immediately deductible" };
    case "WERTVERMEHREND":
      return { label: "Value enhancing", description: "Adds new function or quality — typically capitalized over useful life" };
    case "MIXED":
      return { label: "Mixed treatment", description: "Part maintenance, part improvement — typically split between deduction and capitalization" };
    case "ENERGY_ENVIRONMENT":
      return { label: "Energy / environment", description: "Energy-saving or environmental improvement — typically fully deductible under Swiss energy incentives" };
    default:
      return { label: "Unknown", description: "Classification not determined" };
  }
}
