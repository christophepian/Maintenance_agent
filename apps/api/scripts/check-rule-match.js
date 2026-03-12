const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  // Count rules that would match the evaluateStatutoryRules query for HEATING
  const rules = await p.legalRule.findMany({
    where: {
      isActive: true,
      ruleType: "MAINTENANCE_OBLIGATION",
      authority: "STATUTE",
      jurisdiction: "CH",
      topic: "HEATING",
      OR: [
        { canton: null },
        { canton: undefined },
      ],
    },
    select: { id: true, key: true, topic: true, authority: true, ruleType: true },
  });
  
  console.log("Rules matching HEATING query:", rules.length);
  rules.forEach((r) => console.log(`  ${r.key.padEnd(30)} | topic: ${r.topic} | ${r.ruleType}`));

  // Also check: how many total MAINTENANCE_OBLIGATION + STATUTE + active rules?
  const allStatute = await p.legalRule.count({
    where: { isActive: true, ruleType: "MAINTENANCE_OBLIGATION", authority: "STATUTE" },
  });
  console.log("\nTotal active MAINTENANCE_OBLIGATION + STATUTE:", allStatute);
  
  // And check what rules have topic: null but are still active + STATUTE
  const nullTopic = await p.legalRule.count({
    where: { isActive: true, ruleType: "MAINTENANCE_OBLIGATION", authority: "STATUTE", topic: null },
  });
  console.log("Of those, with topic: null:", nullTopic);

  await p.$disconnect();
})();
