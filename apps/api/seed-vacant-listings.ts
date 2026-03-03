/**
 * Seed script: creates 5 Swiss buildings with 3-5 vacant units each,
 * plus BuildingConfig (rental policies).
 *
 * Run:  cd apps/api && npx tsx seed-vacant-listings.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ORG_ID = "default-org";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

interface SeedUnit {
  unitNumber: string;
  floor: string;
  monthlyRentChf: number;
  monthlyChargesChf: number;
}

interface SeedBuilding {
  name: string;
  address: string;
  units: SeedUnit[];
}

const buildings: SeedBuilding[] = [
  {
    name: "Résidence du Lac",
    address: "Rue du Lac 15, 1003 Lausanne",
    units: [
      { unitNumber: "1.1", floor: "1", monthlyRentChf: 1350, monthlyChargesChf: 180 },
      { unitNumber: "1.2", floor: "1", monthlyRentChf: 1680, monthlyChargesChf: 200 },
      { unitNumber: "2.1", floor: "2", monthlyRentChf: 1420, monthlyChargesChf: 180 },
      { unitNumber: "3.1", floor: "3", monthlyRentChf: 2100, monthlyChargesChf: 250 },
      { unitNumber: "3.2", floor: "3", monthlyRentChf: 2450, monthlyChargesChf: 280 },
    ],
  },
  {
    name: "Haus Bellevue",
    address: "Bellevuestrasse 42, 8001 Zürich",
    units: [
      { unitNumber: "EG-1", floor: "0", monthlyRentChf: 2200, monthlyChargesChf: 300 },
      { unitNumber: "1-L", floor: "1", monthlyRentChf: 2850, monthlyChargesChf: 340 },
      { unitNumber: "1-R", floor: "1", monthlyRentChf: 2750, monthlyChargesChf: 340 },
      { unitNumber: "2-L", floor: "2", monthlyRentChf: 3100, monthlyChargesChf: 360 },
    ],
  },
  {
    name: "Palazzo Riviera",
    address: "Via Nassa 22, 6900 Lugano",
    units: [
      { unitNumber: "A1", floor: "1", monthlyRentChf: 1580, monthlyChargesChf: 200 },
      { unitNumber: "A2", floor: "1", monthlyRentChf: 1250, monthlyChargesChf: 170 },
      { unitNumber: "B1", floor: "2", monthlyRentChf: 1900, monthlyChargesChf: 230 },
    ],
  },
  {
    name: "Les Terrasses",
    address: "Avenue de la Gare 8, 1201 Genève",
    units: [
      { unitNumber: "101", floor: "1", monthlyRentChf: 2650, monthlyChargesChf: 310 },
      { unitNumber: "102", floor: "1", monthlyRentChf: 1950, monthlyChargesChf: 240 },
      { unitNumber: "201", floor: "2", monthlyRentChf: 2800, monthlyChargesChf: 320 },
      { unitNumber: "301", floor: "3", monthlyRentChf: 3400, monthlyChargesChf: 380 },
      { unitNumber: "302", floor: "3", monthlyRentChf: 2100, monthlyChargesChf: 260 },
    ],
  },
  {
    name: "Alpina Park",
    address: "Bundesgasse 10, 3011 Bern",
    units: [
      { unitNumber: "W01", floor: "0", monthlyRentChf: 980, monthlyChargesChf: 140 },
      { unitNumber: "W02", floor: "0", monthlyRentChf: 1150, monthlyChargesChf: 160 },
      { unitNumber: "W11", floor: "1", monthlyRentChf: 1750, monthlyChargesChf: 210 },
      { unitNumber: "W21", floor: "2", monthlyRentChf: 2050, monthlyChargesChf: 240 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  SEED LOGIC                                                         */
/* ------------------------------------------------------------------ */

async function main() {
  // Ensure org exists
  await prisma.org.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Default Org" },
  });

  let totalUnits = 0;

  for (const b of buildings) {
    // Upsert building
    const existing = await prisma.building.findFirst({
      where: { orgId: ORG_ID, name: b.name },
    });

    const building = existing
      ? existing
      : await prisma.building.create({
          data: { orgId: ORG_ID, name: b.name, address: b.address },
        });

    console.log(`📍 ${building.name} (${building.id})`);

    // Upsert BuildingConfig (rental policies)
    const existingConfig = await prisma.buildingConfig.findUnique({
      where: { buildingId: building.id },
    });
    if (!existingConfig) {
      await prisma.buildingConfig.create({
        data: {
          orgId: ORG_ID,
          buildingId: building.id,
          autoApproveLimit: 500,
          rentalIncomeMultiplier: 3,
          rentalSignatureDeadlineDays: 7,
          rentalManualReviewConfidenceThreshold: 60,
        },
      });
    }

    // Upsert vacant units
    for (const u of b.units) {
      const existingUnit = await prisma.unit.findFirst({
        where: { buildingId: building.id, unitNumber: u.unitNumber },
      });

      if (!existingUnit) {
        await prisma.unit.create({
          data: {
            buildingId: building.id,
            orgId: ORG_ID,
            unitNumber: u.unitNumber,
            floor: u.floor,
            isVacant: true,
            monthlyRentChf: u.monthlyRentChf,
            monthlyChargesChf: u.monthlyChargesChf,
          },
        });
        console.log(
          `   🏠 Unit ${u.unitNumber} (floor ${u.floor}) — CHF ${u.monthlyRentChf} + ${u.monthlyChargesChf}`
        );
        totalUnits++;
      } else {
        // Make sure it's marked vacant with prices
        await prisma.unit.update({
          where: { id: existingUnit.id },
          data: {
            isVacant: true,
            monthlyRentChf: u.monthlyRentChf,
            monthlyChargesChf: u.monthlyChargesChf,
          },
        });
        console.log(`   ✅ Unit ${u.unitNumber} already exists — ensured vacant`);
      }
    }
  }

  console.log(`\n✨ Done — ${buildings.length} buildings, ${totalUnits} new vacant units seeded.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
