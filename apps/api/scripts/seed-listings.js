/**
 * Seed realistic Swiss rental listings (vacant units).
 * Creates 3 buildings with 7 vacant units across Genève, Zürich, and Montreux.
 *
 * Usage: cd apps/api && node scripts/seed-listings.js
 */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const ORG = "default-org";

const buildings = [
  {
    name: "Résidence du Lac",
    address: "Quai du Mont-Blanc 15, 1201 Genève",
    canton: "GE",
    yearBuilt: 2018,
    hasElevator: true,
  },
  {
    name: "Lindenhof Apartments",
    address: "Lindenhofstrasse 8, 8001 Zürich",
    canton: "ZH",
    yearBuilt: 2005,
    hasElevator: true,
  },
  {
    name: "Les Terrasses de Montreux",
    address: "Avenue Claude-Nobs 22, 1820 Montreux",
    canton: "VD",
    yearBuilt: 2015,
    hasElevator: true,
    hasConcierge: true,
  },
];

const units = [
  // Résidence du Lac — Genève
  { bIdx: 0, unitNumber: "1A", floor: "Ground", rooms: 2.5, sqm: 55, rent: 1850, charges: 180, hasBalcony: false },
  { bIdx: 0, unitNumber: "3B", floor: "3rd",    rooms: 3.5, sqm: 78, rent: 2450, charges: 220, hasBalcony: true },

  // Lindenhof Apartments — Zürich
  { bIdx: 1, unitNumber: "2.1", floor: "2nd", rooms: 4.5, sqm: 105, rent: 3200, charges: 310, hasBalcony: true, hasTerrace: true },
  { bIdx: 1, unitNumber: "4.2", floor: "4th", rooms: 2.5, sqm: 52,  rent: 1680, charges: 160, hasBalcony: true },
  { bIdx: 1, unitNumber: "1.3", floor: "1st", rooms: 1.5, sqm: 35,  rent: 1250, charges: 120, hasBalcony: false },

  // Les Terrasses de Montreux
  { bIdx: 2, unitNumber: "A1", floor: "Ground", rooms: 3.5, sqm: 82,  rent: 2100, charges: 200, hasBalcony: true, hasParking: true },
  { bIdx: 2, unitNumber: "C3", floor: "3rd",    rooms: 5.5, sqm: 135, rent: 3800, charges: 380, hasBalcony: true, hasTerrace: true, hasParking: true },
];

async function main() {
  const createdBuildings = [];

  for (const b of buildings) {
    const created = await p.building.create({
      data: {
        orgId: ORG,
        name: b.name,
        address: b.address,
        canton: b.canton,
        yearBuilt: b.yearBuilt,
        hasElevator: b.hasElevator || false,
        hasConcierge: b.hasConcierge || false,
        isActive: true,
      },
    });
    createdBuildings.push(created);
    console.log("✅ Building:", created.name);
  }

  for (const u of units) {
    const building = createdBuildings[u.bIdx];
    await p.unit.create({
      data: {
        orgId: ORG,
        buildingId: building.id,
        unitNumber: u.unitNumber,
        floor: u.floor,
        rooms: u.rooms,
        livingAreaSqm: u.sqm,
        monthlyRentChf: u.rent,
        monthlyChargesChf: u.charges,
        hasBalcony: u.hasBalcony || false,
        hasTerrace: u.hasTerrace || false,
        hasParking: u.hasParking || false,
        isVacant: true,
        isActive: true,
      },
    });
    console.log("  ✅ Unit", u.unitNumber, "|", u.rooms, "rooms |", u.sqm, "m² | CHF", u.rent, "+", u.charges, "| @", building.name);
  }

  console.log("\n🏠 Done — 7 vacant listings created across 3 buildings");
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
