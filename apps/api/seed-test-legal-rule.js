/**
 * Seeds a minimal legal rule for DISHWASHER topic into the test database.
 * Run with: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maint_agent_test node seed-test-legal-rule.js
 */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const existing = await p.legalRule.findFirst({ where: { key: "co-259a-dishwasher-seed" } });
  if (existing) {
    console.log("Rule already exists, skipping");
    await p.$disconnect();
    return;
  }

  const rule = await p.legalRule.create({
    data: {
      key: "co-259a-dishwasher-seed",
      ruleType: "MAINTENANCE_OBLIGATION",
      authority: "STATUTE",
      jurisdiction: "CH",
      priority: 100,
      isActive: true,
      versions: {
        create: {
          effectiveFrom: new Date("2024-01-01"),
          dslJson: {
            topic: "DISHWASHER",
            conditions: [],
            obligation: "OBLIGATED",
          },
          citationsJson: [
            {
              article: "CO Art. 259a",
              text: "Landlord must repair defects not caused by tenant.",
            },
          ],
          summary: "Dishwasher repair is landlord obligation under Swiss CO Art. 259a",
        },
      },
    },
  });
  console.log("Created rule:", rule.id);
  await p.$disconnect();
})();
