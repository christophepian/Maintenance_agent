/**
 * seed-comprehensive-assets.js
 *
 * Fixes all data gaps preventing the legal decision engine from producing
 * meaningful depreciation results:
 *
 * 1. Sets cantons on buildings that lack them
 * 2. Adds DepreciationStandard entries for mapped topics that are missing
 * 3. Deletes broken Asset records (missing type) and re-creates them properly
 * 4. Creates rich asset inventories for every unit that has requests
 * 5. Adds extra assets beyond just the request categories for realism
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// =============================================
// CONFIGURATION
// =============================================

/**
 * Category → legalTopic → (AssetType, realistic lifespan)
 * These MUST match the LegalCategoryMapping topics in the DB.
 */
const CATEGORY_TOPIC_MAP = {
  dishwasher:  { topic: 'DISHWASHER',          type: 'APPLIANCE', lifespanMonths: 180 },
  oven:        { topic: 'OVEN_APPLIANCE',       type: 'APPLIANCE', lifespanMonths: 180 },
  stove:       { topic: 'STOVE_COOKTOP',        type: 'APPLIANCE', lifespanMonths: 180 },
  lighting:    { topic: 'LIGHTING_ELECTRICAL',   type: 'SYSTEM',    lifespanMonths: 240 },
  plumbing:    { topic: 'PLUMBING_WATER',        type: 'SYSTEM',    lifespanMonths: 360 },
  bathroom:    { topic: 'BATHROOM_PLUMBING',     type: 'FIXTURE',   lifespanMonths: 360 },
};

/**
 * Extra assets to add to units for realistic inventories.
 * Picked from REAL DepreciationStandard topics in the DB.
 */
const EXTRA_ASSETS = [
  // Kitchen
  { topic: 'FRIDGE',                       type: 'APPLIANCE', name: 'Réfrigérateur' },
  { topic: 'KITCHEN_HOOD',                 type: 'APPLIANCE', name: 'Hotte aspirante' },
  { topic: 'KITCHEN_CABINET_CHIPBOARD',    type: 'FIXTURE',   name: 'Meubles de cuisine (aggloméré)' },
  { topic: 'COUNTERTOP_STONE_STEEL',       type: 'FIXTURE',   name: 'Plan de travail (pierre/inox)' },
  { topic: 'KITCHEN_TAP',                  type: 'FIXTURE',   name: 'Robinetterie cuisine' },
  // Bathroom
  { topic: 'BATHTUB_ACRYLIC',             type: 'FIXTURE',   name: 'Baignoire acrylique' },
  { topic: 'SANITARY_CERAMIC',            type: 'FIXTURE',   name: 'Appareils sanitaires (céramique)' },
  { topic: 'BATHROOM_TAP',                type: 'FIXTURE',   name: 'Robinetterie salle de bain' },
  { topic: 'BATHROOM_TILES_CERAMIC',      type: 'FINISH',    name: 'Carrelage salle de bain' },
  { topic: 'BATHROOM_MIRROR',             type: 'FIXTURE',   name: 'Miroir salle de bain' },
  // Floors & walls
  { topic: 'PARQUET_MOSAIC',              type: 'FINISH',    name: 'Parquet mosaïque' },
  { topic: 'PAINT_WALLS_DISPERSION',      type: 'FINISH',    name: 'Peinture murale (dispersion)' },
  // Doors & windows
  { topic: 'WINDOW_INSULATED_PLASTIC_WOOD', type: 'FIXTURE', name: 'Fenêtres isolantes (bois/plastique)' },
  { topic: 'DOOR_CHIPBOARD',              type: 'FIXTURE',   name: 'Portes intérieures (aggloméré)' },
  { topic: 'LOCK_INTERIOR',               type: 'FIXTURE',   name: 'Serrures intérieures' },
  // Electrical
  { topic: 'SWITCH',                       type: 'SYSTEM',    name: 'Interrupteurs' },
  { topic: 'POWER_SOCKET',                type: 'SYSTEM',    name: 'Prises électriques' },
  { topic: 'LIGHTING_KITCHEN_BATH',       type: 'FIXTURE',   name: 'Éclairage cuisine/salle de bain' },
  // Heating
  { topic: 'RADIATOR',                    type: 'FIXTURE',   name: 'Radiateurs' },
  { topic: 'THERMOSTATIC_VALVE',          type: 'SYSTEM',    name: 'Vannes thermostatiques' },
];

/** Human-readable names for category topics */
const TOPIC_NAMES = {
  DISHWASHER:         'Lave-vaisselle',
  OVEN_APPLIANCE:     'Four',
  STOVE_COOKTOP:      'Plaque de cuisson',
  LIGHTING_ELECTRICAL: 'Installation électrique (éclairage)',
  PLUMBING_WATER:     'Conduites d\'eau',
  BATHROOM_PLUMBING:  'Installation sanitaire (salle de bain)',
};

// =============================================
// HELPERS
// =============================================

/** Random date between yearsAgo and yearsAgoMax years before now */
function randomDate(yearsAgoMin, yearsAgoMax) {
  const now = new Date();
  const min = yearsAgoMin * 365 * 24 * 60 * 60 * 1000;
  const max = yearsAgoMax * 365 * 24 * 60 * 60 * 1000;
  const offset = min + Math.random() * (max - min);
  return new Date(now.getTime() - offset);
}

/** Pick N random items from array */
function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

// =============================================
// MAIN
// =============================================

async function main() {
  console.log('=== Comprehensive Asset Seed ===\n');

  // ------------------------------------------
  // Step 1: Fix building cantons
  // ------------------------------------------
  console.log('Step 1: Setting cantons on buildings...');
  
  const buildingsToFix = [
    { name: 'Demo Building', canton: 'ZH' },
    { name: 'Bâtiment Bellevue', canton: 'VD' },
    { name: 'Immeuble Central', canton: 'ZH' },
  ];
  
  for (const fix of buildingsToFix) {
    const updated = await prisma.building.updateMany({
      where: { name: fix.name, canton: null },
      data: { canton: fix.canton },
    });
    if (updated.count > 0) {
      console.log('  Fixed: ' + fix.name + ' → canton ' + fix.canton + ' (' + updated.count + ' rows)');
    }
  }

  // ------------------------------------------
  // Step 2: Add missing DepreciationStandard entries
  // ------------------------------------------
  console.log('\nStep 2: Adding missing depreciation standards...');
  
  for (const [cat, info] of Object.entries(CATEGORY_TOPIC_MAP)) {
    // Check if national standard exists for this topic
    const existing = await prisma.depreciationStandard.findFirst({
      where: { jurisdiction: 'CH', canton: null, assetType: info.type, topic: info.topic },
    });
    
    if (!existing) {
      await prisma.depreciationStandard.create({
        data: {
          jurisdiction: 'CH',
          canton: null, // national
          authority: 'INDUSTRY_STANDARD',
          assetType: info.type,
          topic: info.topic,
          usefulLifeMonths: info.lifespanMonths,
          notes: 'Paritätische Lebensdauertabelle — aggregate for ' + cat,
        },
      });
      console.log('  Created: ' + info.type + '/' + info.topic + ' (' + info.lifespanMonths + ' months)');
    } else {
      console.log('  Exists:  ' + info.type + '/' + info.topic);
    }
  }

  // ------------------------------------------
  // Step 3: Delete broken Assets (no type set)
  // ------------------------------------------
  console.log('\nStep 3: Cleaning up broken asset records...');
  
  // The old seed left assets with undefined type. We'll delete and recreate.
  const deleted = await prisma.asset.deleteMany({});
  console.log('  Deleted ' + deleted.count + ' old asset records');

  // ------------------------------------------
  // Step 4: Find all units with requests
  // ------------------------------------------
  console.log('\nStep 4: Finding units with requests...');
  
  const requestsByUnit = await prisma.request.groupBy({
    by: ['unitId'],
    _count: { id: true },
  });
  
  const unitIds = requestsByUnit
    .filter(r => r.unitId != null)
    .map(r => r.unitId);
  
  const units = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    include: {
      building: { select: { id: true, name: true, canton: true } },
      requests: { select: { category: true, status: true } },
    },
  });
  
  console.log('  Found ' + units.length + ' units with requests');

  // ------------------------------------------
  // Step 5: Find org for assets
  // ------------------------------------------
  const defaultOrg = await prisma.org.findFirst({ where: { id: 'default-org' } });
  if (!defaultOrg) {
    console.error('ERROR: default-org not found');
    return;
  }

  // ------------------------------------------
  // Step 6: Create comprehensive assets for each unit
  // ------------------------------------------
  console.log('\nStep 5: Creating assets for each unit...\n');
  
  let totalCreated = 0;

  for (const unit of units) {
    const bName = unit.building?.name || '?';
    const canton = unit.building?.canton || 'ZH';
    const uNum = unit.unitNumber || '?';
    
    // Collect unique categories from this unit's requests
    const categories = [...new Set(unit.requests.map(r => r.category).filter(Boolean))];
    
    console.log('  Unit ' + uNum + ' @ ' + bName + ' (' + unit.id.slice(0, 8) + '...)');
    console.log('    Request categories: ' + categories.join(', '));
    
    const assetsToCreate = [];
    
    // 6a. Create an asset for each request category
    for (const cat of categories) {
      const catInfo = CATEGORY_TOPIC_MAP[cat];
      if (!catInfo) {
        console.log('    WARN: no topic mapping for category "' + cat + '"');
        continue;
      }
      
      // Vary ages: older for plumbing/structural, newer for appliances
      let minYears, maxYears;
      if (catInfo.type === 'SYSTEM' || catInfo.type === 'STRUCTURAL') {
        minYears = 8; maxYears = 25;
      } else if (catInfo.type === 'FIXTURE') {
        minYears = 5; maxYears = 20;
      } else {
        minYears = 3; maxYears = 18;
      }
      
      assetsToCreate.push({
        orgId: defaultOrg.id,
        unitId: unit.id,
        type: catInfo.type,
        topic: catInfo.topic,
        name: TOPIC_NAMES[catInfo.topic] || cat,
        installedAt: randomDate(minYears, maxYears),
        lastRenovatedAt: null,
        isActive: true,
      });
    }
    
    // 6b. Add extra assets for realism (8–14 per unit for real buildings, 2–4 for test units)
    const isRealBuilding = ['Demo Building', 'Bâtiment Bellevue', 'Immeuble Central',
      'Résidence du Lac', 'Les Terrasses de Morges', 'Maison Jura'].includes(bName);
    
    const extraCount = isRealBuilding ? 8 + Math.floor(Math.random() * 7) : 2 + Math.floor(Math.random() * 3);
    const extras = pickRandom(EXTRA_ASSETS, extraCount);
    
    for (const extra of extras) {
      // Skip if we already have an asset for this topic
      if (assetsToCreate.some(a => a.topic === extra.topic)) continue;
      
      assetsToCreate.push({
        orgId: defaultOrg.id,
        unitId: unit.id,
        type: extra.type,
        topic: extra.topic,
        name: extra.name,
        installedAt: randomDate(2, 22),
        lastRenovatedAt: Math.random() > 0.7 ? randomDate(0, 5) : null, // 30% chance of recent renovation
        isActive: true,
      });
    }
    
    // Create all assets for this unit
    for (const asset of assetsToCreate) {
      await prisma.asset.create({ data: asset });
    }
    
    totalCreated += assetsToCreate.length;
    console.log('    Created ' + assetsToCreate.length + ' assets');
  }

  // ------------------------------------------
  // Summary
  // ------------------------------------------
  console.log('\n=== DONE ===');
  console.log('Total assets created: ' + totalCreated);
  
  // Quick verification: check one unit's depreciation chain
  console.log('\n=== Verification: checking asset→standard chain for Unit 1A ===');
  const verifyUnit = units.find(u => u.unitNumber === '1A');
  if (verifyUnit) {
    const assets = await prisma.asset.findMany({ where: { unitId: verifyUnit.id } });
    for (const a of assets) {
      const std = await prisma.depreciationStandard.findFirst({
        where: { jurisdiction: 'CH', canton: null, assetType: a.type, topic: a.topic },
      });
      const inst = a.installedAt ? a.installedAt.toISOString().slice(0, 10) : 'NULL';
      const match = std ? 'MATCH (' + std.usefulLifeMonths + 'mo)' : 'NO STANDARD';
      console.log('  ' + a.type + '/' + a.topic + ' installed:' + inst + ' → ' + match);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
