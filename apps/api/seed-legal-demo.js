/**
 * seed-legal-demo.js
 *
 * Seeds:
 *   1. Asset records on real units (for depreciation engine)
 *   2. Updates appliance installDate
 *   3. Cleans up duplicate test requests
 *   4. Creates diverse PENDING_REVIEW requests linked to units
 *
 * Run: cd apps/api && node seed-legal-demo.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ORG = "default-org";

async function main() {
  // ─── 1. Find key units ───────────────────────────────────────

  // Demo Building unit 1A (already has requests)
  const unit1A = await prisma.unit.findFirst({
    where: { orgId: ORG, unitNumber: "1A" },
    include: { building: true },
  });
  if (!unit1A) throw new Error("Unit 1A not found");

  // Bâtiment Bellevue (Lausanne) — unit A1
  const unitA1 = await prisma.unit.findFirst({
    where: { orgId: ORG, unitNumber: "A1", building: { name: { contains: "Bellevue" } } },
    include: { building: true },
  });

  // Immeuble Central (Zürich) — unit 1.1
  const unit11 = await prisma.unit.findFirst({
    where: { orgId: ORG, unitNumber: "1.1", building: { name: { contains: "Central" } } },
    include: { building: true },
  });

  // Demo Building — unit 2A
  const unit2A = await prisma.unit.findFirst({
    where: { orgId: ORG, unitNumber: "2A" },
    include: { building: true },
  });

  console.log("Found units:");
  [unit1A, unitA1, unit11, unit2A].forEach((u) => {
    if (u) console.log(`  ${u.unitNumber} @ ${u.building.name} (${u.id.slice(0, 8)})`);
  });

  // ─── 2. Seed Asset records ──────────────────────────────────

  const assetsToSeed = [
    // Unit 1A — Demo Building
    { unitId: unit1A.id, type: "APPLIANCE", topic: "OVEN_APPLIANCE", name: "Bosch Oven HBA5780S0", installedAt: new Date("2014-03-15") },
    { unitId: unit1A.id, type: "APPLIANCE", topic: "STOVE_COOKTOP", name: "Siemens Induction Cooktop", installedAt: new Date("2017-06-01") },
    { unitId: unit1A.id, type: "APPLIANCE", topic: "DISHWASHER", name: "Miele Dishwasher G5000", installedAt: new Date("2019-09-10") },
    { unitId: unit1A.id, type: "FIXTURE", topic: "BATHROOM_PLUMBING", name: "Bathroom fixtures (bathtub, taps)", installedAt: new Date("2010-01-01") },
    { unitId: unit1A.id, type: "FIXTURE", topic: "LIGHTING_ELECTRICAL", name: "Lighting system (switches, sockets)", installedAt: new Date("2016-08-01") },
    { unitId: unit1A.id, type: "SYSTEM", topic: "PLUMBING_WATER", name: "Water heater & plumbing", installedAt: new Date("2005-04-01") },
  ];

  // Unit A1 — Bellevue (Lausanne)
  if (unitA1) {
    assetsToSeed.push(
      { unitId: unitA1.id, type: "APPLIANCE", topic: "DISHWASHER", name: "V-ZUG Adora SL", installedAt: new Date("2016-02-15") },
      { unitId: unitA1.id, type: "FIXTURE", topic: "BATHROOM_PLUMBING", name: "Shower, basin, WC", installedAt: new Date("2008-06-01") },
      { unitId: unitA1.id, type: "APPLIANCE", topic: "OVEN_APPLIANCE", name: "Electrolux Oven EOC5654AOX", installedAt: new Date("2012-11-01") },
      { unitId: unitA1.id, type: "FIXTURE", topic: "LIGHTING_ELECTRICAL", name: "Electrical panel + ceiling lights", installedAt: new Date("2008-06-01") },
    );
  }

  // Unit 1.1 — Central (Zürich)
  if (unit11) {
    assetsToSeed.push(
      { unitId: unit11.id, type: "APPLIANCE", topic: "STOVE_COOKTOP", name: "Gaggenau Gas Cooktop", installedAt: new Date("2011-03-01") },
      { unitId: unit11.id, type: "SYSTEM", topic: "PLUMBING_WATER", name: "Hot water boiler + pipes", installedAt: new Date("2000-01-01") },
      { unitId: unit11.id, type: "FIXTURE", topic: "BATHROOM_PLUMBING", name: "Bathroom (tub, shower, WC)", installedAt: new Date("2015-07-01") },
    );
  }

  // Unit 2A — Demo Building
  if (unit2A) {
    assetsToSeed.push(
      { unitId: unit2A.id, type: "APPLIANCE", topic: "OVEN_APPLIANCE", name: "Samsung Dual Cook Flex", installedAt: new Date("2020-01-15") },
      { unitId: unit2A.id, type: "APPLIANCE", topic: "DISHWASHER", name: "Bosch SMV4HAX48E", installedAt: new Date("2020-01-15") },
      { unitId: unit2A.id, type: "FIXTURE", topic: "LIGHTING_ELECTRICAL", name: "LED lighting + dimmer switches", installedAt: new Date("2020-01-15") },
    );
  }

  let assetCount = 0;
  for (const a of assetsToSeed) {
    // Upsert by unit + topic (avoid duplicates)
    const existing = await prisma.asset.findFirst({
      where: { unitId: a.unitId, topic: a.topic, orgId: ORG },
    });
    if (existing) {
      await prisma.asset.update({
        where: { id: existing.id },
        data: { installedAt: a.installedAt, name: a.name, isActive: true },
      });
      console.log(`  Updated asset: ${a.name} (${a.topic})`);
    } else {
      await prisma.asset.create({
        data: { ...a, orgId: ORG, isActive: true },
      });
      console.log(`  Created asset: ${a.name} (${a.topic})`);
    }
    assetCount++;
  }
  console.log(`\n✓ ${assetCount} assets seeded\n`);

  // ─── 3. Update demo appliance installDate ────────────────────

  const kitchenOven = await prisma.appliance.findFirst({
    where: { orgId: ORG, name: "Kitchen Oven" },
  });
  if (kitchenOven) {
    await prisma.appliance.update({
      where: { id: kitchenOven.id },
      data: { installDate: new Date("2014-03-15") },
    });
    console.log("✓ Updated Kitchen Oven installDate to 2014-03-15\n");
  }

  // ─── 4. Clean duplicate oven requests ────────────────────────

  const ovenDupes = await prisma.request.findMany({
    where: {
      category: "oven",
      description: "Oven is overheating and smells hot",
      status: "PENDING_REVIEW",
    },
    orderBy: { createdAt: "asc" },
  });

  if (ovenDupes.length > 1) {
    // Keep the first, delete the rest
    const toDelete = ovenDupes.slice(1).map((r) => r.id);
    // Delete associated events first
    await prisma.requestEvent.deleteMany({ where: { requestId: { in: toDelete } } });
    const deleted = await prisma.request.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`✓ Cleaned ${deleted.count} duplicate oven requests (kept 1)\n`);
  }

  // ─── 5. Create diverse PENDING_REVIEW requests ──────────────

  // Get a tenant for demo
  const tenant = await prisma.tenant.findFirst({ where: { orgId: ORG } });

  const newRequests = [
    // Unit 1A — various categories
    {
      description: "The dishwasher is leaking water from the bottom — discovered a puddle this morning. The floor under the unit is warped.",
      category: "dishwasher",
      unitId: unit1A.id,
      estimatedCost: 450,
    },
    {
      description: "Several bathroom tiles have cracked and the grouting around the bathtub is turning black with mould. Water seeps behind the tiles.",
      category: "bathroom",
      unitId: unit1A.id,
      estimatedCost: 1200,
    },
    {
      description: "All kitchen ceiling lights flicker when turned on and one socket near the stove gives off a burning smell.",
      category: "lighting",
      unitId: unit1A.id,
      estimatedCost: 350,
    },
    {
      description: "Water pressure in the kitchen has dropped significantly. The hot water takes over 5 minutes to come through.",
      category: "plumbing",
      unitId: unit1A.id,
      estimatedCost: 800,
    },
    {
      description: "The oven door seal is broken and heat escapes during cooking. The thermostat seems unreliable — food burns at low settings.",
      category: "oven",
      unitId: unit1A.id,
      estimatedCost: 600,
    },
  ];

  // Bellevue A1 requests
  if (unitA1) {
    newRequests.push(
      {
        description: "The dishwasher stopped mid-cycle and now displays error code E24. Water is standing in the bottom of the drum.",
        category: "dishwasher",
        unitId: unitA1.id,
        estimatedCost: 380,
      },
      {
        description: "The shower drain is completely blocked. Water backs up within seconds and floods the bathroom floor.",
        category: "bathroom",
        unitId: unitA1.id,
        estimatedCost: 250,
      },
    );
  }

  // Central 1.1 requests
  if (unit11) {
    newRequests.push(
      {
        description: "One burner on the gas cooktop won't ignite — the spark clicks but no flame catches. Possible gas valve issue.",
        category: "stove",
        unitId: unit11.id,
        estimatedCost: 500,
      },
      {
        description: "A pipe behind the bathroom wall is leaking — damp patch visible on the living room side. Urgent before mould develops.",
        category: "plumbing",
        unitId: unit11.id,
        estimatedCost: 1500,
      },
    );
  }

  let created = 0;
  for (const r of newRequests) {
    await prisma.request.create({
      data: {
        ...r,
        status: "PENDING_REVIEW",
        tenantId: tenant?.id ?? null,
      },
    });
    created++;
  }
  console.log(`✓ Created ${created} diverse PENDING_REVIEW requests\n`);

  // ─── Summary ─────────────────────────────────────────────────

  const assetTotal = await prisma.asset.count({ where: { orgId: ORG } });
  const pendingTotal = await prisma.request.count({ where: { status: "PENDING_REVIEW" } });
  console.log(`Summary: ${assetTotal} assets, ${pendingTotal} PENDING_REVIEW requests`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
