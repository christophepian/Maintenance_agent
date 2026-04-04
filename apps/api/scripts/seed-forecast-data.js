/**
 * Seed script — populate dev DB with realistic buildings, units, and assets
 * so the Forecast tab shows meaningful health buckets.
 *
 * Usage:  cd apps/api && node scripts/seed-forecast-data.js
 *
 * Safe to re-run: uses upsert on (buildingId, unitNumber) unique and
 * checks for existing assets before creating.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ORG_ID = "default-org";

// ── Buildings ──────────────────────────────────────────────────
const BUILDINGS = [
  { name: "Bahnhofstrasse 42",     address: "Bahnhofstrasse 42, 8001 Zürich",       canton: "ZH" },
  { name: "Marktgasse 15",         address: "Marktgasse 15, 3011 Bern",             canton: "BE" },
  { name: "Rue de la Gare 8",      address: "Rue de la Gare 8, 1003 Lausanne",      canton: "VD" },
  { name: "Boulevard Carl-Vogt 22",address: "Boulevard Carl-Vogt 22, 1205 Genève",  canton: "GE" },
  { name: "Steinenvorstadt 9",     address: "Steinenvorstadt 9, 4051 Basel",         canton: "BS" },
  { name: "Pilatusstrasse 31",     address: "Pilatusstrasse 31, 6003 Luzern",        canton: "LU" },
  { name: "Via Nassa 12",          address: "Via Nassa 12, 6900 Lugano",             canton: "TI" },
  { name: "Badenerstrasse 55",     address: "Badenerstrasse 55, 5400 Baden",         canton: "AG" },
];

// ── Asset templates (type + topic must match DepreciationStandard) ──
// Dates are chosen to produce a mix of GOOD / ATTENTION / CRITICAL
// relative to today (mid-2025) and the usefulLifeMonths for each topic.
//
//   APPLIANCE topics → 120-240 months
//   FIXTURE topics   → 120-480 months
//   FINISH topics    → 96-480 months
//   STRUCTURAL topics→ 240-600 months
//   SYSTEM topics    → 240-480 months

const ASSET_POOL = [
  // ── APPLIANCE ──
  { type: "APPLIANCE", topic: "DISHWASHER",       name: "Dishwasher" },
  { type: "APPLIANCE", topic: "COOKER_OVEN",      name: "Oven" },
  { type: "APPLIANCE", topic: "FRIDGE",            name: "Refrigerator" },
  { type: "APPLIANCE", topic: "KITCHEN_HOOD",      name: "Kitchen Hood" },
  { type: "APPLIANCE", topic: "CERAMIC_HOB",       name: "Ceramic Hob" },
  { type: "APPLIANCE", topic: "DRYER_PRIVATE",     name: "Tumble Dryer" },
  // ── FIXTURE ──
  { type: "FIXTURE",   topic: "BATHROOM_TAP",       name: "Bathroom Taps" },
  { type: "FIXTURE",   topic: "BATHTUB_ACRYLIC",    name: "Bathtub (acrylic)" },
  { type: "FIXTURE",   topic: "BLINDS_EXTERIOR_METAL", name: "Exterior Blinds" },
  { type: "FIXTURE",   topic: "KITCHEN_CABINET_CHIPBOARD", name: "Kitchen Cabinets" },
  { type: "FIXTURE",   topic: "DOOR_SOLID_WOOD",    name: "Interior Doors" },
  { type: "FIXTURE",   topic: "COUNTERTOP_STONE_STEEL", name: "Countertop" },
  // ── FINISH ──
  { type: "FINISH",    topic: "PARQUET_MOSAIC",      name: "Parquet Flooring" },
  { type: "FINISH",    topic: "BATHROOM_TILES_CERAMIC", name: "Bathroom Tiles" },
  { type: "FINISH",    topic: "PAINT_WALLS_DISPERSION", name: "Wall Paint" },
  { type: "FINISH",    topic: "FLOOR_LAMINATE_32",   name: "Laminate Flooring" },
  { type: "FINISH",    topic: "KITCHEN_TILES_CERAMIC", name: "Kitchen Tiles" },
  // ── STRUCTURAL ──
  { type: "STRUCTURAL",topic: "FLAT_ROOF_GRAVEL",    name: "Flat Roof" },
  { type: "STRUCTURAL",topic: "FACADE_PANELS",       name: "Facade Panels" },
  { type: "STRUCTURAL",topic: "BALCONY_METAL",       name: "Metal Balconies" },
  { type: "STRUCTURAL",topic: "INSULATION_POLYSTYRENE", name: "Building Insulation" },
  // ── SYSTEM ──
  { type: "SYSTEM",    topic: "BOILER",              name: "Central Boiler" },
  { type: "SYSTEM",    topic: "ELEVATOR",            name: "Elevator" },
  { type: "SYSTEM",    topic: "CIRCULATION_PUMP",    name: "Circulation Pump" },
  { type: "SYSTEM",    topic: "ELECTRICAL_CABLES",   name: "Electrical Wiring" },
];

// Per-building unit+asset configurations
// installedAt picks create varied depreciation %:
//   - 2004-2008 → CRITICAL for short-life assets, ATTENTION for long-life
//   - 2010-2014 → ATTENTION for short-life, GOOD for long-life
//   - 2018-2024 → GOOD for everything
const BUILDING_CONFIGS = [
  {
    // ZH — upscale, mostly newer assets → GOOD
    units: ["1.1", "1.2", "2.1", "2.2"],
    assets: [
      { pool: 0,  installed: "2022-03-01" },  // Dishwasher → GOOD
      { pool: 1,  installed: "2020-06-15" },  // Oven → GOOD
      { pool: 6,  installed: "2022-01-10" },  // Bathroom Taps → GOOD
      { pool: 12, installed: "2021-09-01" },  // Parquet → GOOD
      { pool: 20, installed: "2019-11-01" },  // Boiler → GOOD
    ],
  },
  {
    // BE — mixed, some aging → ATTENTION
    units: ["EG-1", "EG-2", "OG-1", "OG-2", "DG-1"],
    assets: [
      { pool: 0,  installed: "2012-04-01" },  // Dishwasher 13y → ATTENTION (87%)
      { pool: 2,  installed: "2016-01-15" },  // Fridge 9y → GOOD (90/120=75%) borderline
      { pool: 7,  installed: "2010-03-01" },  // Bathtub 15y → GOOD (180/300=60%)
      { pool: 14, installed: "2017-08-01" },  // Wall Paint 8y → ATTENTION (96/96=100%)
      { pool: 17, installed: "2000-06-01" },  // Flat Roof 25y → ATTENTION (300/360=83%)
      { pool: 21, installed: "2008-01-01" },  // Elevator 17y → GOOD (204/360=57%)
    ],
  },
  {
    // VD — old building, many critical → CRITICAL
    units: ["A1", "A2", "B1", "B2", "B3"],
    assets: [
      { pool: 0,  installed: "2005-01-01" },  // Dishwasher 20y → CRITICAL (240/180>100%)
      { pool: 1,  installed: "2006-06-01" },  // Oven 19y → CRITICAL (228/180>100%)
      { pool: 3,  installed: "2008-09-01" },  // Kitchen Hood 17y → CRITICAL (204/120>100%)
      { pool: 9,  installed: "2007-02-01" },  // Kitchen Cabinets 18y → CRITICAL (216/180>100%)
      { pool: 13, installed: "2006-01-01" },  // Bathroom Tiles 19y → GOOD (228/360=63%)
      { pool: 15, installed: "2005-05-01" },  // Laminate 20y → CRITICAL (240/180>100%)
      { pool: 20, installed: "2005-11-01" },  // Boiler 20y → CRITICAL (240/240=100%)
      { pool: 22, installed: "2006-03-01" },  // Circ Pump 19y → ATTENTION (228/240=95%)
    ],
  },
  {
    // GE — mix of everything
    units: ["101", "102", "201", "202"],
    assets: [
      { pool: 4,  installed: "2011-05-01" },  // Ceramic Hob 14y → ATTENTION (168/180=93%)
      { pool: 5,  installed: "2020-01-15" },  // Dryer 5y → GOOD
      { pool: 8,  installed: "2005-07-01" },  // Exterior Blinds 20y → GOOD (240/300=80%) → ATTENTION
      { pool: 10, installed: "2010-09-01" },  // Interior Doors 15y → GOOD (180/360=50%)
      { pool: 16, installed: "2003-11-01" },  // Kitchen Tiles 22y → GOOD (264/360=73%)
      { pool: 18, installed: "2006-04-01" },  // Facade 19y → GOOD (228/360=63%)
      { pool: 23, installed: "1998-01-01" },  // Electrical Wiring 27y → GOOD (324/480=68%)
    ],
  },
  {
    // BS — brand new renovation → all GOOD
    units: ["EG", "1.OG", "2.OG"],
    assets: [
      { pool: 0,  installed: "2024-01-15" },  // Dishwasher → GOOD
      { pool: 1,  installed: "2024-01-15" },  // Oven → GOOD
      { pool: 2,  installed: "2024-01-15" },  // Fridge → GOOD
      { pool: 6,  installed: "2024-02-01" },  // Taps → GOOD
      { pool: 12, installed: "2024-02-01" },  // Parquet → GOOD
      { pool: 14, installed: "2024-03-01" },  // Paint → GOOD
      { pool: 20, installed: "2023-06-01" },  // Boiler → GOOD
    ],
  },
  {
    // LU — middle-aged → mostly ATTENTION
    units: ["Whg 1", "Whg 2", "Whg 3", "Whg 4"],
    assets: [
      { pool: 0,  installed: "2012-08-01" },  // Dishwasher → ATTENTION
      { pool: 3,  installed: "2013-01-01" },  // Kitchen Hood → CRITICAL (144/120>100%)
      { pool: 7,  installed: "2008-05-01" },  // Bathtub 17y → GOOD (204/300=68%)
      { pool: 11, installed: "2010-03-01" },  // Countertop 15y → GOOD (180/300=60%)
      { pool: 19, installed: "2002-07-01" },  // Insulation 23y → ATTENTION (276/300=92%)
      { pool: 22, installed: "2010-12-01" },  // Circ Pump → ATTENTION (174/240=73%)
    ],
  },
  {
    // TI — mixed
    units: ["Piano Terra", "Primo Piano", "Secondo Piano"],
    assets: [
      { pool: 4,  installed: "2018-06-01" },  // Ceramic Hob → GOOD
      { pool: 5,  installed: "2007-03-01" },  // Dryer 18y → CRITICAL (216/180>100%)
      { pool: 9,  installed: "2014-01-01" },  // Kitchen Cabinets 11y → GOOD (132/180=73%)
      { pool: 13, installed: "2000-09-01" },  // Bathroom Tiles 25y → GOOD (300/360=83%) → ATTENTION
      { pool: 17, installed: "2005-01-01" },  // Flat Roof 20y → GOOD (240/360=67%)
      { pool: 21, installed: "2007-01-01" },  // Elevator 18y → GOOD (216/360=60%)
    ],
  },
  {
    // AG — old building → CRITICAL
    units: ["1", "2", "3", "4", "5"],
    assets: [
      { pool: 0,  installed: "2004-01-01" },  // Dishwasher → CRITICAL
      { pool: 1,  installed: "2003-06-01" },  // Oven → CRITICAL
      { pool: 2,  installed: "2005-09-01" },  // Fridge → CRITICAL (240/120>100%)
      { pool: 6,  installed: "2004-11-01" },  // Taps → ATTENTION (248/240>100%) → CRITICAL
      { pool: 14, installed: "2016-05-01" },  // Paint → CRITICAL (108/96>100%)
      { pool: 15, installed: "2008-03-01" },  // Laminate → CRITICAL (207/180>100%)
      { pool: 20, installed: "2004-04-01" },  // Boiler → CRITICAL
      { pool: 22, installed: "2005-08-01" },  // Circ Pump → ATTENTION (238/240=99%)
    ],
  },
];

async function main() {
  // Ensure default org exists
  await prisma.org.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Default Org" },
  });

  let totalBuildings = 0;
  let totalUnits = 0;
  let totalAssets = 0;

  for (let bi = 0; bi < BUILDINGS.length; bi++) {
    const bld = BUILDINGS[bi];
    const config = BUILDING_CONFIGS[bi];

    // Upsert building (use name+orgId as "natural key" — check first)
    let building = await prisma.building.findFirst({
      where: { orgId: ORG_ID, name: bld.name },
    });
    if (!building) {
      building = await prisma.building.create({
        data: {
          orgId: ORG_ID,
          name: bld.name,
          address: bld.address,
          canton: bld.canton,
        },
      });
      console.log(`  ✓ Created building: ${bld.name} (${bld.canton})`);
    } else {
      // Update canton if missing
      if (!building.canton) {
        await prisma.building.update({
          where: { id: building.id },
          data: { canton: bld.canton },
        });
      }
      console.log(`  · Building exists: ${bld.name} (${building.id})`);
    }
    totalBuildings++;

    // Create units
    for (const unitNum of config.units) {
      let unit = await prisma.unit.findUnique({
        where: { buildingId_unitNumber: { buildingId: building.id, unitNumber: unitNum } },
      });
      if (!unit) {
        unit = await prisma.unit.create({
          data: {
            buildingId: building.id,
            unitNumber: unitNum,
            orgId: ORG_ID,
          },
        });
      }
      totalUnits++;

      // Create assets for this unit (shared per building — each unit gets them)
      for (const assetDef of config.assets) {
        const tmpl = ASSET_POOL[assetDef.pool];
        const assetName = `${tmpl.name} — ${unitNum}`;

        // Check if already exists
        const existing = await prisma.asset.findFirst({
          where: {
            orgId: ORG_ID,
            unitId: unit.id,
            type: tmpl.type,
            topic: tmpl.topic,
          },
        });
        if (!existing) {
          await prisma.asset.create({
            data: {
              orgId: ORG_ID,
              unitId: unit.id,
              type: tmpl.type,
              topic: tmpl.topic,
              name: assetName,
              installedAt: new Date(assetDef.installed),
            },
          });
          totalAssets++;
        }
      }
    }
  }

  console.log(`\nDone! Created/verified: ${totalBuildings} buildings, ${totalUnits} units, ${totalAssets} new assets`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
