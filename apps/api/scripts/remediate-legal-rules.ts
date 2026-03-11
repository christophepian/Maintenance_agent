/**
 * remediate-legal-rules.ts
 *
 * One-time data cleanup script for the legal engine.
 * Run manually after the RENT_REDUCTION migration:
 *
 *   cd apps/api
 *   npx ts-node --transpile-only scripts/remediate-legal-rules.ts
 *
 * Idempotent — safe to run multiple times.
 *
 * Steps:
 *   1. Deactivate 33 co-259a-dishwasher-leak-* duplicates + duplicate-test-key-for-conflict
 *   2. Deactivate 4 per-appliance rules (CH_CO_259A_OVEN, _DISHWASHER_V2, _STOVE, _BATHROOM)
 *   3. Update CH_CO_259A_PLUMBING → topic: PLUMBING (in-place)
 *   4. Update CH_CO_259A_LIGHTING → topic: ELECTRICAL (in-place)
 *   5. Reclassify 53 INDUSTRY_STANDARD rules → ruleType: RENT_REDUCTION
 *   6. Seed 3 missing canonical rules: HEATING, STRUCTURAL, SAFETY
 *   7. Upsert global category mappings (orgId: null)
 */

import { PrismaClient, LegalRuleScope } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Canonical DSL builders ────────────────────────────────────

function canonicalDsl(topic: string) {
  return {
    obligation: "OBLIGATED",
    conditions: [{ type: "topic_match", topic }],
  };
}

function canonicalCitations() {
  return [
    {
      article: "CO Art. 259a",
      text: "The landlord is required to carry out repairs necessary to maintain the premises in a condition suitable for the agreed use.",
      authority: "STATUTE",
    },
    {
      article: "CO Art. 256",
      text: "The landlord must deliver the premises in a condition suitable for the agreed use and maintain them accordingly.",
      authority: "STATUTE",
    },
  ];
}

// ─── Category mapping definitions ──────────────────────────────

const CATEGORY_MAPPINGS: { topic: string; entries: { category: string; confidence: number }[] }[] = [
  {
    topic: "HEATING",
    entries: [
      { category: "heating", confidence: 1.0 },
      { category: "radiator", confidence: 0.95 },
      { category: "boiler", confidence: 1.0 },
      { category: "hot water", confidence: 0.9 },
      { category: "temperature", confidence: 0.85 },
      { category: "chauffage", confidence: 1.0 },
    ],
  },
  {
    topic: "PLUMBING",
    entries: [
      { category: "plumbing", confidence: 1.0 },
      { category: "leak", confidence: 0.9 },
      { category: "pipe", confidence: 0.95 },
      { category: "drain", confidence: 0.95 },
      { category: "water", confidence: 0.75 },
      { category: "dishwasher", confidence: 0.7 },
      { category: "bathroom", confidence: 0.85 },
      { category: "toilet", confidence: 0.95 },
    ],
  },
  {
    topic: "ELECTRICAL",
    entries: [
      { category: "electrical", confidence: 1.0 },
      { category: "wiring", confidence: 1.0 },
      { category: "socket", confidence: 0.95 },
      { category: "fuse", confidence: 0.95 },
      { category: "power", confidence: 0.8 },
      { category: "lighting", confidence: 0.9 },
      { category: "électricité", confidence: 1.0 },
    ],
  },
  {
    topic: "STRUCTURAL",
    entries: [
      { category: "roof", confidence: 1.0 },
      { category: "window", confidence: 0.9 },
      { category: "door", confidence: 0.85 },
      { category: "damp", confidence: 0.95 },
      { category: "mould", confidence: 0.95 },
      { category: "crack", confidence: 0.9 },
      { category: "insulation", confidence: 0.9 },
      { category: "wall", confidence: 0.8 },
    ],
  },
  {
    topic: "SAFETY",
    entries: [
      { category: "smoke detector", confidence: 1.0 },
      { category: "lock", confidence: 0.95 },
      { category: "fire", confidence: 0.9 },
      { category: "alarm", confidence: 0.9 },
      { category: "security", confidence: 0.85 },
    ],
  },
];

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  console.log("=== Legal Engine Remediation ===\n");

  // ── Step 1: Deactivate test artifact duplicates ────────────
  const step1 = await prisma.legalRule.updateMany({
    where: {
      OR: [
        { key: { startsWith: "co-259a-dishwasher-leak-" } },
        { key: "duplicate-test-key-for-conflict" },
      ],
    },
    data: { isActive: false },
  });
  console.log(`✅ Step 1: Deactivated ${step1.count} duplicate/test rules`);

  // ── Step 2: Deactivate per-appliance rules ─────────────────
  const PER_APPLIANCE_KEYS = [
    "CH_CO_259A_OVEN",
    "CH_CO_259A_DISHWASHER_V2",
    "CH_CO_259A_STOVE",
    "CH_CO_259A_BATHROOM",
  ];
  const step2 = await prisma.legalRule.updateMany({
    where: { key: { in: PER_APPLIANCE_KEYS } },
    data: { isActive: false },
  });
  console.log(`✅ Step 2: Deactivated ${step2.count} per-appliance rules`);

  // ── Step 3: Update CH_CO_259A_PLUMBING → topic PLUMBING ───
  const plumbingRule = await prisma.legalRule.findUnique({ where: { key: "CH_CO_259A_PLUMBING" } });
  if (plumbingRule) {
    await prisma.legalRule.update({
      where: { id: plumbingRule.id },
      data: { topic: "PLUMBING", priority: 100 },
    });
    // Update its latest version DSL to canonical shape
    const plumbingVersion = await prisma.legalRuleVersion.findFirst({
      where: { ruleId: plumbingRule.id },
      orderBy: { effectiveFrom: "desc" },
    });
    if (plumbingVersion) {
      await prisma.legalRuleVersion.update({
        where: { id: plumbingVersion.id },
        data: {
          dslJson: canonicalDsl("PLUMBING"),
          citationsJson: canonicalCitations(),
          summary: "CO 259a landlord maintenance obligation — PLUMBING",
        },
      });
    }
    console.log("✅ Step 3: Updated CH_CO_259A_PLUMBING → topic: PLUMBING");
  } else {
    console.log("⏭️  Step 3: CH_CO_259A_PLUMBING not found (skipped)");
  }

  // ── Step 4: Update CH_CO_259A_LIGHTING → topic ELECTRICAL ──
  const lightingRule = await prisma.legalRule.findUnique({ where: { key: "CH_CO_259A_LIGHTING" } });
  if (lightingRule) {
    await prisma.legalRule.update({
      where: { id: lightingRule.id },
      data: { topic: "ELECTRICAL", priority: 100 },
    });
    const lightingVersion = await prisma.legalRuleVersion.findFirst({
      where: { ruleId: lightingRule.id },
      orderBy: { effectiveFrom: "desc" },
    });
    if (lightingVersion) {
      await prisma.legalRuleVersion.update({
        where: { id: lightingVersion.id },
        data: {
          dslJson: canonicalDsl("ELECTRICAL"),
          citationsJson: canonicalCitations(),
          summary: "CO 259a landlord maintenance obligation — ELECTRICAL",
        },
      });
    }
    console.log("✅ Step 4: Updated CH_CO_259A_LIGHTING → topic: ELECTRICAL");
  } else {
    console.log("⏭️  Step 4: CH_CO_259A_LIGHTING not found (skipped)");
  }

  // ── Step 5: Reclassify INDUSTRY_STANDARD → RENT_REDUCTION ──
  const step5 = await prisma.legalRule.updateMany({
    where: {
      ruleType: "MAINTENANCE_OBLIGATION",
      authority: "INDUSTRY_STANDARD",
    },
    data: { ruleType: "RENT_REDUCTION" },
  });
  console.log(`✅ Step 5: Reclassified ${step5.count} INDUSTRY_STANDARD rules → RENT_REDUCTION`);

  // ── Step 6: Seed missing canonical rules ───────────────────
  const SEED_RULES: { key: string; topic: string }[] = [
    { key: "CH_CO259A_HEATING", topic: "HEATING" },
    { key: "CH_CO259A_STRUCTURAL", topic: "STRUCTURAL" },
    { key: "CH_CO259A_SAFETY", topic: "SAFETY" },
  ];

  for (const seed of SEED_RULES) {
    const existing = await prisma.legalRule.findUnique({ where: { key: seed.key } });
    if (existing) {
      // Ensure it's active and has correct topic
      await prisma.legalRule.update({
        where: { id: existing.id },
        data: { topic: seed.topic, isActive: true, priority: 100 },
      });
      console.log(`✅ Step 6: Updated existing ${seed.key} → topic: ${seed.topic}`);
    } else {
      const rule = await prisma.legalRule.create({
        data: {
          key: seed.key,
          ruleType: "MAINTENANCE_OBLIGATION",
          authority: "STATUTE",
          jurisdiction: "CH",
          topic: seed.topic,
          scope: LegalRuleScope.FEDERAL,
          priority: 100,
          isActive: true,
        },
      });
      await prisma.legalRuleVersion.create({
        data: {
          ruleId: rule.id,
          effectiveFrom: new Date("2020-01-01"),
          dslJson: canonicalDsl(seed.topic),
          citationsJson: canonicalCitations(),
          summary: `CO 259a landlord maintenance obligation — ${seed.topic}`,
        },
      });
      console.log(`✅ Step 6: Seeded ${seed.key} → topic: ${seed.topic}`);
    }
  }

  // ── Step 7: Upsert category mappings ───────────────────────
  let mappingCount = 0;
  for (const group of CATEGORY_MAPPINGS) {
    for (const entry of group.entries) {
      // Use findFirst because @@unique([orgId, requestCategory]) with null orgId
      // doesn't work reliably with Prisma upsert
      const existing = await prisma.legalCategoryMapping.findFirst({
        where: {
          orgId: null,
          requestCategory: entry.category,
        },
      });
      if (existing) {
        await prisma.legalCategoryMapping.update({
          where: { id: existing.id },
          data: {
            legalTopic: group.topic,
            confidence: entry.confidence,
            isActive: true,
          },
        });
      } else {
        await prisma.legalCategoryMapping.create({
          data: {
            orgId: null,
            requestCategory: entry.category,
            legalTopic: group.topic,
            confidence: entry.confidence,
            isActive: true,
          },
        });
      }
      mappingCount++;
    }
  }
  console.log(`✅ Step 7: Upserted ${mappingCount} category mappings`);

  // ── Final verification ─────────────────────────────────────
  console.log("\n=== Final State ===");

  const activeObligations = await prisma.legalRule.findMany({
    where: { ruleType: "MAINTENANCE_OBLIGATION", isActive: true },
    select: { key: true, authority: true, topic: true, scope: true },
    orderBy: { key: "asc" },
  });
  console.log(`Active MAINTENANCE_OBLIGATION rules: ${activeObligations.length}`);
  for (const r of activeObligations) {
    console.log(`  └─ ${r.authority} ${r.key} | topic: ${r.topic} | scope: ${r.scope}`);
  }

  const activeMappings = await prisma.legalCategoryMapping.count({ where: { isActive: true } });
  console.log(`Active category mappings: ${activeMappings}`);

  // Assertions
  const industryStd = await prisma.legalRule.count({
    where: { ruleType: "MAINTENANCE_OBLIGATION", authority: "INDUSTRY_STANDARD" },
  });
  const dishwasherLeaks = await prisma.legalRule.count({
    where: { key: { startsWith: "co-259a-dishwasher-leak-" }, isActive: true },
  });
  const nullTopic = activeObligations.filter((r) => !r.topic);

  if (activeObligations.length !== 5) {
    console.error(`❌ Expected 5 active MAINTENANCE_OBLIGATION rules, got ${activeObligations.length}`);
  }
  if (industryStd > 0) {
    console.error(`❌ ${industryStd} MAINTENANCE_OBLIGATION rules still have authority: INDUSTRY_STANDARD`);
  }
  if (dishwasherLeaks > 0) {
    console.error(`❌ ${dishwasherLeaks} co-259a-dishwasher-leak-* rules still active`);
  }
  if (nullTopic.length > 0) {
    console.error(`❌ ${nullTopic.length} active rules have null topic`);
  }
  if (
    activeObligations.length === 5 &&
    industryStd === 0 &&
    dishwasherLeaks === 0 &&
    nullTopic.length === 0
  ) {
    console.log("\n✅ All assertions passed — legal engine data is clean.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ Remediation failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
