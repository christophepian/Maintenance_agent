const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const withUnit = await p.request.findMany({
    where: { unitId: { not: null } },
    select: { id: true, status: true, category: true, description: true, unitId: true },
    orderBy: { createdAt: "desc" },
  });
  console.log("Requests WITH unitId:", withUnit.length);
  withUnit.forEach((r) =>
    console.log("  " + r.status.padEnd(25) + " | " + (r.category || "null").padEnd(15) + " | " + r.id.slice(0, 8))
  );

  const buildings = await p.building.findMany({ select: { id: true, name: true, canton: true }, take: 5 });
  console.log("\nBuildings:", buildings.length);
  buildings.forEach((b) => console.log("  " + b.id.slice(0, 8) + " | " + (b.name || "-") + " | canton: " + (b.canton || "null")));

  const units = await p.unit.findMany({ select: { id: true, unitNumber: true, buildingId: true }, take: 5 });
  console.log("\nUnits:", units.length);
  units.forEach((u) => console.log("  " + u.id.slice(0, 8) + " | unit: " + (u.unitNumber || "-") + " | bld: " + u.buildingId.slice(0, 8)));

  const orgs = await p.organization.findMany({ select: { id: true, name: true }, take: 3 });
  console.log("\nOrgs:", orgs.length);
  orgs.forEach((o) => console.log("  " + o.id.slice(0, 12) + " | " + o.name));

  await p.$disconnect();
})();
