const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const buildings = await p.building.findMany({
    select: { id: true, name: true, canton: true },
    orderBy: { name: "asc" },
  });
  console.log("BUILDINGS (" + buildings.length + "):");
  buildings.forEach((b) =>
    console.log("  " + b.id.substring(0, 8) + " | " + b.name + " | " + (b.canton || "none"))
  );

  const units = await p.unit.findMany({
    select: { id: true, unitNumber: true, buildingId: true },
    orderBy: { unitNumber: "asc" },
  });
  console.log("\nUNITS (" + units.length + "):");
  units.forEach((u) =>
    console.log("  " + u.id.substring(0, 8) + " | " + u.unitNumber + " | bld:" + u.buildingId.substring(0, 8))
  );

  const assets = await p.asset.findMany({
    select: { id: true, name: true, type: true, topic: true, installedAt: true, unitId: true },
    orderBy: { name: "asc" },
  });
  console.log("\nASSETS (" + assets.length + "):");
  assets.forEach((a) =>
    console.log(
      "  " + a.name + " | " + a.type + "/" + a.topic +
      " | inst:" + (a.installedAt ? a.installedAt.toISOString().substring(0, 10) : "none") +
      " | unit:" + a.unitId.substring(0, 8)
    )
  );

  const depStds = await p.depreciationStandard.count();
  console.log("\nDEPRECIATION STANDARDS: " + depStds);

  // Show a sample of topics covered
  const topics = await p.depreciationStandard.findMany({
    select: { topic: true, assetType: true, usefulLifeMonths: true },
    orderBy: { topic: "asc" },
    take: 20,
  });
  console.log("\nSAMPLE DEP STANDARDS:");
  topics.forEach((t) =>
    console.log("  " + t.topic + " | " + t.assetType + " | " + t.usefulLifeMonths + " months")
  );

  await p.$disconnect();
}

main().catch(console.error);
