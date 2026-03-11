/**
 * Quick inspection script — run with: npx ts-node --transpile-only scripts/inspect-legal-rules.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.legalRule.count({ where: { ruleType: "MAINTENANCE_OBLIGATION" } });
  const active = await prisma.legalRule.count({ where: { ruleType: "MAINTENANCE_OBLIGATION", isActive: true } });
  const statutes = await prisma.legalRule.count({ where: { ruleType: "MAINTENANCE_OBLIGATION", authority: "STATUTE" } });
  const industry = await prisma.legalRule.count({ where: { ruleType: "MAINTENANCE_OBLIGATION", authority: "INDUSTRY_STANDARD" } });
  const withTopic = await prisma.legalRule.count({ where: { ruleType: "MAINTENANCE_OBLIGATION", topic: { not: null } } });
  const dupes = await prisma.legalRule.count({ where: { key: { startsWith: "co-259a-dishwasher-leak-" } } });
  const conflict = await prisma.legalRule.count({ where: { key: "duplicate-test-key-for-conflict" } });
  const mappings = await prisma.legalCategoryMapping.count({ where: { isActive: true } });

  console.log("=== Legal Rule DB State ===");
  console.log(`  Total MAINTENANCE_OBLIGATION rules: ${total}`);
  console.log(`  Active:                             ${active}`);
  console.log(`  STATUTE authority:                  ${statutes}`);
  console.log(`  INDUSTRY_STANDARD authority:        ${industry}`);
  console.log(`  With non-null topic:                ${withTopic}`);
  console.log(`  co-259a-dishwasher-leak-* dupes:    ${dupes}`);
  console.log(`  duplicate-test-key-for-conflict:    ${conflict}`);
  console.log(`  Active category mappings:           ${mappings}`);

  // List the STATUTE rules with their keys
  const statuteRules = await prisma.legalRule.findMany({
    where: { ruleType: "MAINTENANCE_OBLIGATION", authority: "STATUTE" },
    select: { id: true, key: true, topic: true, isActive: true, scope: true },
    orderBy: { key: "asc" },
  });
  console.log("\n=== STATUTE Rules ===");
  for (const r of statuteRules) {
    console.log(`  ${r.isActive ? "✅" : "❌"} ${r.key} | topic: ${r.topic ?? "null"} | scope: ${r.scope}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
