#!/usr/bin/env node

/**
 * Seed Tax Rules + Replacement Benchmarks
 *
 * Idempotent — safe to re-run.
 *
 * Creates:
 *   - Federal default tax rules for all common asset topics
 *   - Canton-specific overrides for 9 major cantons (VD, GE, ZH, BE, BS, VS, AG, SG, GR)
 *   - Replacement cost benchmarks for all topics with actual assets
 *
 * Usage:
 *   node apps/api/scripts/seed-capex-data.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ─── Tax Rule Definitions ──────────────────────────────────────

/**
 * Federal defaults by (assetType, topic).
 * Classification: WERTERHALTEND (deductible), WERTVERMEHREND (capitalize), MIXED (partial).
 */
const FEDERAL_TAX_RULES = [
  // APPLIANCE — like-for-like replacement = value-preserving
  { assetType: "APPLIANCE", topic: "DISHWASHER", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.9, notes: "Like-for-like appliance replacement is value-preserving (standard tax practice)" },
  { assetType: "APPLIANCE", topic: "FRIDGE", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.9, notes: "Like-for-like appliance replacement" },
  { assetType: "APPLIANCE", topic: "COOKER_OVEN", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.9, notes: "Like-for-like appliance replacement" },
  { assetType: "APPLIANCE", topic: "CERAMIC_HOB", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Replacement with equivalent standard" },
  { assetType: "APPLIANCE", topic: "KITCHEN_HOOD", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.9, notes: "Like-for-like replacement" },
  { assetType: "APPLIANCE", topic: "DRYER_PRIVATE", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.9, notes: "Like-for-like appliance replacement" },
  { assetType: "APPLIANCE", topic: "WASHING_MACHINE_COMMON", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Common area appliance — typically deductible" },
  { assetType: "APPLIANCE", topic: "WATER_HEATER_ELECTRIC", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Like-for-like replacement" },
  { assetType: "APPLIANCE", topic: "WATER_HEATER_GAS", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Like-for-like replacement" },
  { assetType: "APPLIANCE", topic: "MICROWAVE", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.9, notes: "Small appliance replacement" },
  { assetType: "APPLIANCE", topic: "STEAMER", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Like-for-like replacement" },

  // FIXTURE — mostly value-preserving, some mixed
  { assetType: "FIXTURE", topic: "BATHROOM_TAP", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.9, notes: "Tap replacement — value-preserving maintenance" },
  { assetType: "FIXTURE", topic: "BATHTUB_ACRYLIC", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Like-for-like bathtub replacement" },
  { assetType: "FIXTURE", topic: "BLINDS_EXTERIOR_METAL", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Exterior blind replacement" },
  { assetType: "FIXTURE", topic: "COUNTERTOP_STONE_STEEL", classification: "MIXED", deductiblePct: 70, confidence: 0.7, notes: "Countertop — may be upgrade depending on material. 70% deductible baseline" },
  { assetType: "FIXTURE", topic: "DOOR_SOLID_WOOD", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Door replacement with equivalent" },
  { assetType: "FIXTURE", topic: "KITCHEN_CABINET_CHIPBOARD", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Kitchen cabinet replacement — same material class" },
  { assetType: "FIXTURE", topic: "KITCHEN_CABINET_SOLID", classification: "MIXED", deductiblePct: 60, confidence: 0.65, notes: "Solid wood kitchen — may constitute upgrade. Review needed" },
  { assetType: "FIXTURE", topic: "KITCHEN_RENOVATION_BASIC", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.8, notes: "Basic kitchen renovation — typically value-preserving" },
  { assetType: "FIXTURE", topic: "KITCHEN_RENOVATION_PREMIUM", classification: "MIXED", deductiblePct: 50, confidence: 0.6, notes: "Premium kitchen renovation — significant value-enhancement component" },
  { assetType: "FIXTURE", topic: "BATHROOM_FULL_RENOVATION", classification: "MIXED", deductiblePct: 50, confidence: 0.6, notes: "Full bathroom renovation — typically 50/50 split" },
  { assetType: "FIXTURE", topic: "RADIATOR", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Like-for-like radiator replacement" },
  { assetType: "FIXTURE", topic: "SANITARY_CERAMIC", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "WC/washbasin replacement" },
  { assetType: "FIXTURE", topic: "WINDOW_INSULATED_PLASTIC_WOOD", classification: "MIXED", deductiblePct: 60, confidence: 0.7, notes: "Window replacement — energy efficiency component often capitalized" },

  // FINISH — almost always value-preserving
  { assetType: "FINISH", topic: "PAINT_WALLS_DISPERSION", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.95, notes: "Painting is the textbook value-preserving maintenance" },
  { assetType: "FINISH", topic: "FLOOR_LAMINATE_32", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.9, notes: "Flooring replacement with equivalent material" },
  { assetType: "FINISH", topic: "PARQUET_MOSAIC", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Like-for-like parquet replacement" },
  { assetType: "FINISH", topic: "BATHROOM_TILES_CERAMIC", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Tile replacement — value-preserving" },
  { assetType: "FINISH", topic: "KITCHEN_TILES_CERAMIC", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Tile replacement — value-preserving" },

  // STRUCTURAL — mostly value-enhancing or mixed
  { assetType: "STRUCTURAL", topic: "FLAT_ROOF_GRAVEL", classification: "MIXED", deductiblePct: 50, confidence: 0.7, notes: "Roof replacement — maintenance portion deductible, energy improvement capitalized" },
  { assetType: "STRUCTURAL", topic: "PITCHED_ROOF_TILES", classification: "MIXED", deductiblePct: 50, confidence: 0.7, notes: "Roof replacement — similar split as flat roof" },
  { assetType: "STRUCTURAL", topic: "FACADE_PANELS", classification: "MIXED", deductiblePct: 40, confidence: 0.65, notes: "Facade work — significant value-enhancement. Energy savings capitalized" },
  { assetType: "STRUCTURAL", topic: "INSULATION_POLYSTYRENE", classification: "WERTVERMEHREND", deductiblePct: 0, confidence: 0.8, notes: "Insulation is energy-efficiency investment — must be capitalized" },
  { assetType: "STRUCTURAL", topic: "BALCONY_METAL", classification: "MIXED", deductiblePct: 50, confidence: 0.65, notes: "Balcony renovation — maintenance vs enhancement split" },

  // SYSTEM — mixed treatment
  { assetType: "SYSTEM", topic: "BOILER", classification: "MIXED", deductiblePct: 50, confidence: 0.75, notes: "Boiler replacement: like-for-like deductible, efficiency upgrade capitalized" },
  { assetType: "SYSTEM", topic: "HEAT_PUMP", classification: "WERTVERMEHREND", deductiblePct: 0, confidence: 0.8, notes: "Heat pump installation is typically a value-enhancing investment" },
  { assetType: "SYSTEM", topic: "ELEVATOR", classification: "MIXED", deductiblePct: 40, confidence: 0.65, notes: "Elevator modernization — significant capitalization component" },
  { assetType: "SYSTEM", topic: "CIRCULATION_PUMP", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Like-for-like pump replacement" },
  { assetType: "SYSTEM", topic: "SOLAR_PANEL", classification: "WERTVERMEHREND", deductiblePct: 0, confidence: 0.85, notes: "Solar installation is value-enhancing (but may qualify for subsidies)" },
  { assetType: "SYSTEM", topic: "ELECTRICAL_CABLES", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.8, notes: "Electrical rewiring — typically value-preserving" },
  { assetType: "SYSTEM", topic: "HEATING_PIPES", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.8, notes: "Pipe replacement — value-preserving" },
  { assetType: "SYSTEM", topic: "PLUMBING_WATER", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.8, notes: "Plumbing — value-preserving" },
  { assetType: "SYSTEM", topic: "CONTROLLED_VENTILATION", classification: "MIXED", deductiblePct: 50, confidence: 0.7, notes: "Ventilation system — energy component often capitalized" },
  { assetType: "SYSTEM", topic: "INTERCOM", classification: "WERTERHALTEND", deductiblePct: 100, confidence: 0.85, notes: "Intercom replacement" },
];

/**
 * Canton-specific overrides.
 * Only where a canton deviates from the federal default.
 */
const CANTON_OVERRIDES = [
  // ZH — Zürich: stricter on mixed items
  { canton: "ZH", assetType: "STRUCTURAL", topic: "INSULATION_POLYSTYRENE", classification: "WERTVERMEHREND", deductiblePct: 0, confidence: 0.85, notes: "ZH: Insulation strictly capitalized per cantonal tax practice" },
  { canton: "ZH", assetType: "SYSTEM", topic: "BOILER", classification: "MIXED", deductiblePct: 40, confidence: 0.8, notes: "ZH: Boiler replacement — 40% deductible (cantonal practice)" },
  { canton: "ZH", assetType: "FIXTURE", topic: "BATHROOM_FULL_RENOVATION", classification: "MIXED", deductiblePct: 40, confidence: 0.7, notes: "ZH: Full bath renovation — 40% deductible" },

  // VD — Vaud: slightly more generous on maintenance
  { canton: "VD", assetType: "SYSTEM", topic: "BOILER", classification: "MIXED", deductiblePct: 60, confidence: 0.75, notes: "VD: Boiler replacement — 60% deductible (Vaud practice)" },
  { canton: "VD", assetType: "STRUCTURAL", topic: "FLAT_ROOF_GRAVEL", classification: "MIXED", deductiblePct: 60, confidence: 0.7, notes: "VD: Roof — 60% deductible" },
  { canton: "VD", assetType: "FIXTURE", topic: "WINDOW_INSULATED_PLASTIC_WOOD", classification: "MIXED", deductiblePct: 70, confidence: 0.7, notes: "VD: Window replacement — 70% deductible" },

  // GE — Geneva: energy-related work encouraged
  { canton: "GE", assetType: "SYSTEM", topic: "BOILER", classification: "MIXED", deductiblePct: 55, confidence: 0.7, notes: "GE: Boiler — 55% deductible" },
  { canton: "GE", assetType: "STRUCTURAL", topic: "INSULATION_POLYSTYRENE", classification: "MIXED", deductiblePct: 30, confidence: 0.6, notes: "GE: Insulation — 30% deductible when energy efficiency programme" },
  { canton: "GE", assetType: "SYSTEM", topic: "HEAT_PUMP", classification: "MIXED", deductiblePct: 40, confidence: 0.6, notes: "GE: Heat pump — 40% deductible under energy transition incentives" },

  // BE — Bern: standard practice close to federal
  { canton: "BE", assetType: "SYSTEM", topic: "BOILER", classification: "MIXED", deductiblePct: 50, confidence: 0.8, notes: "BE: Boiler — follows federal 50% split" },
  { canton: "BE", assetType: "FIXTURE", topic: "KITCHEN_RENOVATION_PREMIUM", classification: "MIXED", deductiblePct: 45, confidence: 0.65, notes: "BE: Premium kitchen — 45% deductible" },

  // BS — Basel-Stadt
  { canton: "BS", assetType: "SYSTEM", topic: "ELEVATOR", classification: "MIXED", deductiblePct: 35, confidence: 0.65, notes: "BS: Elevator modernization — 35% deductible" },
  { canton: "BS", assetType: "STRUCTURAL", topic: "FACADE_PANELS", classification: "MIXED", deductiblePct: 35, confidence: 0.65, notes: "BS: Facade — 35% deductible" },

  // VS — Valais
  { canton: "VS", assetType: "SYSTEM", topic: "BOILER", classification: "MIXED", deductiblePct: 55, confidence: 0.7, notes: "VS: Boiler — 55% deductible" },
  { canton: "VS", assetType: "STRUCTURAL", topic: "FLAT_ROOF_GRAVEL", classification: "MIXED", deductiblePct: 55, confidence: 0.65, notes: "VS: Roof — 55% deductible" },

  // AG — Aargau
  { canton: "AG", assetType: "SYSTEM", topic: "BOILER", classification: "MIXED", deductiblePct: 50, confidence: 0.8, notes: "AG: Boiler — standard 50% split" },
  { canton: "AG", assetType: "FIXTURE", topic: "BATHROOM_FULL_RENOVATION", classification: "MIXED", deductiblePct: 55, confidence: 0.65, notes: "AG: Full bath — 55% deductible" },

  // SG — St. Gallen
  { canton: "SG", assetType: "SYSTEM", topic: "BOILER", classification: "MIXED", deductiblePct: 50, confidence: 0.75, notes: "SG: Boiler — 50% deductible" },
  { canton: "SG", assetType: "STRUCTURAL", topic: "INSULATION_POLYSTYRENE", classification: "WERTVERMEHREND", deductiblePct: 0, confidence: 0.8, notes: "SG: Insulation strictly capitalized" },

  // GR — Graubünden
  { canton: "GR", assetType: "SYSTEM", topic: "BOILER", classification: "MIXED", deductiblePct: 50, confidence: 0.7, notes: "GR: Boiler — 50% deductible" },
  { canton: "GR", assetType: "STRUCTURAL", topic: "FLAT_ROOF_GRAVEL", classification: "MIXED", deductiblePct: 50, confidence: 0.65, notes: "GR: Roof — 50% deductible" },
];

// ─── Replacement Benchmarks ────────────────────────────────────

/**
 * Swiss market replacement cost ranges (CHF).
 * Sources: contractor association estimates, market surveys.
 */
const BENCHMARKS = [
  // APPLIANCE
  { assetType: "APPLIANCE", topic: "DISHWASHER", lowChf: 800, medianChf: 1500, highChf: 2500, sourceNotes: "Swiss market range 2024 — standard built-in models" },
  { assetType: "APPLIANCE", topic: "FRIDGE", lowChf: 700, medianChf: 1400, highChf: 2800, sourceNotes: "Swiss market range — built-in fridge/freezer combos" },
  { assetType: "APPLIANCE", topic: "COOKER_OVEN", lowChf: 1000, medianChf: 2000, highChf: 4000, sourceNotes: "Swiss market range — built-in ovens" },
  { assetType: "APPLIANCE", topic: "CERAMIC_HOB", lowChf: 600, medianChf: 1200, highChf: 2500, sourceNotes: "Ceramic/glass cooktops" },
  { assetType: "APPLIANCE", topic: "KITCHEN_HOOD", lowChf: 400, medianChf: 900, highChf: 2000, sourceNotes: "Range hoods — standard to premium" },
  { assetType: "APPLIANCE", topic: "DRYER_PRIVATE", lowChf: 800, medianChf: 1500, highChf: 2500, sourceNotes: "Tumble dryers — in-unit" },
  { assetType: "APPLIANCE", topic: "WASHING_MACHINE_COMMON", lowChf: 1500, medianChf: 2800, highChf: 4500, sourceNotes: "Commercial-grade washing machines" },
  { assetType: "APPLIANCE", topic: "WATER_HEATER_ELECTRIC", lowChf: 1200, medianChf: 2500, highChf: 4000, sourceNotes: "Electric boilers — 100-300L" },
  { assetType: "APPLIANCE", topic: "WATER_HEATER_GAS", lowChf: 2500, medianChf: 4500, highChf: 7000, sourceNotes: "Gas water heaters incl. installation" },
  { assetType: "APPLIANCE", topic: "MICROWAVE", lowChf: 200, medianChf: 500, highChf: 1200, sourceNotes: "Built-in microwaves" },
  { assetType: "APPLIANCE", topic: "STEAMER", lowChf: 1500, medianChf: 3000, highChf: 5000, sourceNotes: "Built-in combination steamers" },

  // FIXTURE
  { assetType: "FIXTURE", topic: "BATHROOM_TAP", lowChf: 200, medianChf: 500, highChf: 1200, sourceNotes: "Bathroom taps incl. installation" },
  { assetType: "FIXTURE", topic: "BATHTUB_ACRYLIC", lowChf: 1500, medianChf: 3000, highChf: 5500, sourceNotes: "Acrylic bathtub replacement incl. installation" },
  { assetType: "FIXTURE", topic: "BLINDS_EXTERIOR_METAL", lowChf: 800, medianChf: 1800, highChf: 3500, sourceNotes: "Per window — metal exterior blinds" },
  { assetType: "FIXTURE", topic: "COUNTERTOP_STONE_STEEL", lowChf: 2000, medianChf: 4000, highChf: 8000, sourceNotes: "Kitchen countertop — stone or stainless steel" },
  { assetType: "FIXTURE", topic: "DOOR_SOLID_WOOD", lowChf: 800, medianChf: 1500, highChf: 3000, sourceNotes: "Interior solid wood door incl. frame" },
  { assetType: "FIXTURE", topic: "KITCHEN_CABINET_CHIPBOARD", lowChf: 3000, medianChf: 6000, highChf: 12000, sourceNotes: "Full kitchen cabinet set — chipboard" },
  { assetType: "FIXTURE", topic: "KITCHEN_CABINET_SOLID", lowChf: 8000, medianChf: 15000, highChf: 25000, sourceNotes: "Full kitchen cabinet set — solid wood" },
  { assetType: "FIXTURE", topic: "RADIATOR", lowChf: 500, medianChf: 1000, highChf: 2000, sourceNotes: "Per radiator incl. installation" },
  { assetType: "FIXTURE", topic: "SANITARY_CERAMIC", lowChf: 400, medianChf: 800, highChf: 1800, sourceNotes: "WC or washbasin — ceramic" },
  { assetType: "FIXTURE", topic: "WINDOW_INSULATED_PLASTIC_WOOD", lowChf: 1500, medianChf: 3000, highChf: 5500, sourceNotes: "Per window — insulated wood/PVC frame" },
  { assetType: "FIXTURE", topic: "KITCHEN_RENOVATION_BASIC", lowChf: 8000, medianChf: 15000, highChf: 25000, sourceNotes: "Basic kitchen renovation — complete" },
  { assetType: "FIXTURE", topic: "KITCHEN_RENOVATION_PREMIUM", lowChf: 20000, medianChf: 35000, highChf: 60000, sourceNotes: "Premium kitchen renovation — complete" },
  { assetType: "FIXTURE", topic: "BATHROOM_FULL_RENOVATION", lowChf: 12000, medianChf: 22000, highChf: 40000, sourceNotes: "Full bathroom renovation" },

  // FINISH
  { assetType: "FINISH", topic: "PAINT_WALLS_DISPERSION", lowChf: 15, medianChf: 25, highChf: 40, sourceNotes: "Per m² — wall painting incl. prep" },
  { assetType: "FINISH", topic: "FLOOR_LAMINATE_32", lowChf: 40, medianChf: 70, highChf: 120, sourceNotes: "Per m² — laminate flooring class 32 incl. installation" },
  { assetType: "FINISH", topic: "PARQUET_MOSAIC", lowChf: 60, medianChf: 100, highChf: 180, sourceNotes: "Per m² — mosaic parquet incl. sanding and finish" },
  { assetType: "FINISH", topic: "BATHROOM_TILES_CERAMIC", lowChf: 80, medianChf: 140, highChf: 250, sourceNotes: "Per m² — bathroom tiling incl. waterproofing" },
  { assetType: "FINISH", topic: "KITCHEN_TILES_CERAMIC", lowChf: 70, medianChf: 120, highChf: 200, sourceNotes: "Per m² — kitchen backsplash tiling" },

  // STRUCTURAL
  { assetType: "STRUCTURAL", topic: "FLAT_ROOF_GRAVEL", lowChf: 120, medianChf: 200, highChf: 350, sourceNotes: "Per m² — flat roof renovation incl. insulation" },
  { assetType: "STRUCTURAL", topic: "PITCHED_ROOF_TILES", lowChf: 150, medianChf: 280, highChf: 450, sourceNotes: "Per m² — pitched roof with tiles" },
  { assetType: "STRUCTURAL", topic: "FACADE_PANELS", lowChf: 200, medianChf: 350, highChf: 550, sourceNotes: "Per m² — facade panels incl. insulation" },
  { assetType: "STRUCTURAL", topic: "INSULATION_POLYSTYRENE", lowChf: 100, medianChf: 180, highChf: 300, sourceNotes: "Per m² — exterior insulation (ETICS)" },
  { assetType: "STRUCTURAL", topic: "BALCONY_METAL", lowChf: 5000, medianChf: 12000, highChf: 25000, sourceNotes: "Per balcony — metal balcony renovation" },

  // SYSTEM
  { assetType: "SYSTEM", topic: "BOILER", lowChf: 8000, medianChf: 15000, highChf: 25000, sourceNotes: "Central heating boiler (gas/oil) — incl. installation" },
  { assetType: "SYSTEM", topic: "HEAT_PUMP", lowChf: 20000, medianChf: 35000, highChf: 55000, sourceNotes: "Air-source heat pump — incl. installation" },
  { assetType: "SYSTEM", topic: "ELEVATOR", lowChf: 40000, medianChf: 80000, highChf: 150000, sourceNotes: "Elevator modernization — varies by floors" },
  { assetType: "SYSTEM", topic: "CIRCULATION_PUMP", lowChf: 500, medianChf: 1200, highChf: 2500, sourceNotes: "Heating circulation pump replacement" },
  { assetType: "SYSTEM", topic: "SOLAR_PANEL", lowChf: 15000, medianChf: 25000, highChf: 45000, sourceNotes: "10-15 kWp photovoltaic installation" },
  { assetType: "SYSTEM", topic: "ELECTRICAL_CABLES", lowChf: 5000, medianChf: 12000, highChf: 25000, sourceNotes: "Per unit — complete electrical rewiring" },
  { assetType: "SYSTEM", topic: "HEATING_PIPES", lowChf: 3000, medianChf: 8000, highChf: 15000, sourceNotes: "Per unit — heating pipe replacement" },
  { assetType: "SYSTEM", topic: "PLUMBING_WATER", lowChf: 4000, medianChf: 10000, highChf: 20000, sourceNotes: "Per unit — water plumbing replacement" },
  { assetType: "SYSTEM", topic: "CONTROLLED_VENTILATION", lowChf: 8000, medianChf: 15000, highChf: 28000, sourceNotes: "Controlled ventilation system per unit" },
  { assetType: "SYSTEM", topic: "INTERCOM", lowChf: 1500, medianChf: 3000, highChf: 6000, sourceNotes: "Building intercom system — per unit share" },
];

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  console.log("🏦 Seeding CapEx data (tax rules + replacement benchmarks)...\n");

  const effectiveFrom = new Date("2024-01-01T00:00:00Z");

  // ── Federal tax rules ──
  let fedCount = 0;
  for (const rule of FEDERAL_TAX_RULES) {
    const existing = await prisma.taxRule.findFirst({
      where: {
        jurisdiction: "CH",
        canton: null,
        assetType: rule.assetType,
        topic: rule.topic,
      },
    });

    if (existing) {
      // Update versions
      await prisma.taxRuleVersion.deleteMany({ where: { ruleId: existing.id } });
      await prisma.taxRuleVersion.create({
        data: {
          ruleId: existing.id,
          effectiveFrom,
          classification: rule.classification,
          deductiblePct: rule.deductiblePct,
          confidence: rule.confidence,
          notes: rule.notes,
        },
      });
    } else {
      await prisma.taxRule.create({
        data: {
          jurisdiction: "CH",
          canton: null,
          assetType: rule.assetType,
          topic: rule.topic,
          scope: "FEDERAL",
          versions: {
            create: {
              effectiveFrom,
              classification: rule.classification,
              deductiblePct: rule.deductiblePct,
              confidence: rule.confidence,
              notes: rule.notes,
            },
          },
        },
      });
    }
    fedCount++;
  }
  console.log(`  ✅ ${fedCount} federal tax rules upserted`);

  // ── Canton-specific overrides ──
  let cantonCount = 0;
  for (const rule of CANTON_OVERRIDES) {
    const existing = await prisma.taxRule.findFirst({
      where: {
        jurisdiction: "CH",
        canton: rule.canton,
        assetType: rule.assetType,
        topic: rule.topic,
      },
    });

    if (existing) {
      await prisma.taxRuleVersion.deleteMany({ where: { ruleId: existing.id } });
      await prisma.taxRuleVersion.create({
        data: {
          ruleId: existing.id,
          effectiveFrom,
          classification: rule.classification,
          deductiblePct: rule.deductiblePct,
          confidence: rule.confidence,
          notes: rule.notes,
        },
      });
    } else {
      await prisma.taxRule.create({
        data: {
          jurisdiction: "CH",
          canton: rule.canton,
          assetType: rule.assetType,
          topic: rule.topic,
          scope: "CANTONAL",
          versions: {
            create: {
              effectiveFrom,
              classification: rule.classification,
              deductiblePct: rule.deductiblePct,
              confidence: rule.confidence,
              notes: rule.notes,
            },
          },
        },
      });
    }
    cantonCount++;
  }
  console.log(`  ✅ ${cantonCount} canton-specific overrides upserted`);

  // ── Replacement benchmarks ──
  let benchCount = 0;
  for (const bm of BENCHMARKS) {
    const existing = await prisma.replacementBenchmark.findFirst({
      where: { assetType: bm.assetType, topic: bm.topic },
    });

    if (existing) {
      await prisma.replacementBenchmark.update({
        where: { id: existing.id },
        data: {
          lowChf: bm.lowChf,
          medianChf: bm.medianChf,
          highChf: bm.highChf,
          sourceNotes: bm.sourceNotes,
        },
      });
    } else {
      await prisma.replacementBenchmark.create({ data: bm });
    }
    benchCount++;
  }
  console.log(`  ✅ ${benchCount} replacement benchmarks upserted`);

  // ── Summary ──
  const totalRules = await prisma.taxRule.count();
  const totalVersions = await prisma.taxRuleVersion.count();
  const totalBenchmarks = await prisma.replacementBenchmark.count();

  console.log(`\n📊 Database totals:`);
  console.log(`  Tax rules:     ${totalRules}`);
  console.log(`  Rule versions: ${totalVersions}`);
  console.log(`  Benchmarks:    ${totalBenchmarks}`);
  console.log(`\n✅ CapEx seed data complete.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
