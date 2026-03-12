const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  // Find a building with address containing Swiss postal code or create one
  const buildings = await p.building.findMany({
    select: { id: true, name: true, address: true, canton: true, orgId: true },
    take: 10,
    orderBy: { createdAt: "desc" },
  });
  console.log("Buildings:");
  buildings.forEach((b) =>
    console.log(`  ${b.id.slice(0, 8)} | ${(b.name || "-").padEnd(30)} | canton: ${(b.canton || "null").padEnd(5)} | org: ${b.orgId.slice(0, 8)} | addr: ${(b.address || "-").slice(0, 50)}`)
  );

  // Find the "Legal Test Building" specifically since that has units with requests
  const legalBuilding = buildings.find((b) => b.name && b.name.includes("Legal"));
  if (legalBuilding) {
    console.log("\nLegal Test Building found:", legalBuilding.id.slice(0, 8), "| orgId:", legalBuilding.orgId.slice(0, 12));
    
    // Find its units
    const units = await p.unit.findMany({
      where: { buildingId: legalBuilding.id },
      select: { id: true, unitNumber: true },
    });
    console.log("Units in this building:", units.length);
    units.forEach((u) => console.log(`  ${u.id.slice(0, 8)} | ${u.unitNumber}`));
  }

  await p.$disconnect();
})();
