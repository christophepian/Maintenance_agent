/**
 * seed-legal-test-requests.js
 *
 * Creates 6 test requests for frontend legal engine testing:
 *   1. heating      → HEATING topic    → OBLIGATED
 *   2. leak         → PLUMBING topic   → OBLIGATED
 *   3. electrical   → ELECTRICAL topic → OBLIGATED
 *   4. roof         → STRUCTURAL topic → OBLIGATED
 *   5. smoke detector → SAFETY topic   → OBLIGATED
 *   6. painting     → no mapping       → UNKNOWN → owner approval
 *
 * All created in PENDING_REVIEW status on the Legal Test Building unit L01.
 */

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const REQUESTS = [
  {
    category: "heating",
    description: "Radiator in bedroom not producing any heat — apartment is freezing",
    estimatedCost: 800,
  },
  {
    category: "leak",
    description: "Kitchen pipe leaking under sink, water pooling on floor",
    estimatedCost: 450,
  },
  {
    category: "electrical",
    description: "Multiple power sockets in living room stopped working, fuse keeps tripping",
    estimatedCost: 600,
  },
  {
    category: "roof",
    description: "Water stains on ceiling from apparent roof leak during rain",
    estimatedCost: 2500,
  },
  {
    category: "smoke detector",
    description: "Smoke detector in hallway beeping intermittently, battery replacement didn't help",
    estimatedCost: 150,
  },
  {
    category: "painting",
    description: "Living room walls need repainting, paint is peeling in several spots",
    estimatedCost: 1200,
  },
];

(async () => {
  // Find the Legal Test Building unit
  const unit = await p.unit.findFirst({
    where: { unitNumber: "L01", building: { name: "Legal Test Building" } },
    include: { building: true },
  });

  if (!unit) {
    console.error("❌ Unit L01 in Legal Test Building not found");
    process.exit(1);
  }

  console.log(`Using unit ${unit.unitNumber} in "${unit.building.name}" (canton: ${unit.building.canton})\n`);

  const orgId = unit.building.orgId;

  for (const req of REQUESTS) {
    const created = await p.request.create({
      data: {
        unit: { connect: { id: unit.id } },
        description: req.description,
        category: req.category,
        estimatedCost: req.estimatedCost,
        status: "PENDING_REVIEW",
      },
    });
    console.log(`✅ Created: ${req.category.padEnd(16)} | ${created.id.slice(0, 8)} | ${req.description.slice(0, 60)}`);
  }

  console.log("\n🎯 Done — 6 test requests created. Open http://localhost:3000/manager/requests");
  console.log("   Click any PENDING_REVIEW row to expand and see the legal recommendation.");
  console.log("   Expected: heating/leak/electrical/roof/smoke detector → OBLIGATED");
  console.log("   Expected: painting → UNKNOWN (routes to owner approval)");

  await p.$disconnect();
})();
