/**
 * verify-legal-engine.ts
 *
 * Post-remediation verification:
 *   1. Confirm 5 active MAINTENANCE_OBLIGATION rules, all STATUTE, all with topic
 *   2. Confirm zero dishwasher-leak dupes active
 *   3. Confirm zero INDUSTRY_STANDARD maintenance obligation rules
 *   4. Simulate DSL evaluation for topic_match, always_true, always_false, AND, OR, legacy
 *   5. Confirm category mapping → legal topic for heating, painting
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Copy of evaluateSingleCondition for offline testing ──────
function evaluateSingleCondition(
  cond: any,
  request: any,
  resolvedTopic?: string | null,
): boolean {
  if (!cond || typeof cond !== "object") return true;

  if (cond.type === "topic_match") return resolvedTopic === cond.topic;
  if (cond.type === "always_true") return true;
  if (cond.type === "always_false") return false;
  if (cond.type === "AND" && Array.isArray(cond.conditions)) {
    return cond.conditions.every((sub: any) => evaluateSingleCondition(sub, request, resolvedTopic));
  }
  if (cond.type === "OR" && Array.isArray(cond.conditions)) {
    return cond.conditions.some((sub: any) => evaluateSingleCondition(sub, request, resolvedTopic));
  }
  if (cond.field && cond.op) {
    const fieldValue = request[cond.field];
    switch (cond.op) {
      case "eq": return fieldValue === cond.value;
      case "neq": return fieldValue !== cond.value;
      case "gt": return typeof fieldValue === "number" && fieldValue > cond.value;
      case "gte": return typeof fieldValue === "number" && fieldValue >= cond.value;
      case "lt": return typeof fieldValue === "number" && fieldValue < cond.value;
      case "in": return Array.isArray(cond.value) && cond.value.includes(fieldValue);
      case "exists": return cond.value ? !!fieldValue : !fieldValue;
      default: return true;
    }
  }
  return true;
}

function evaluateDslConditions(conditions: any[], request: any, resolvedTopic?: string | null): boolean {
  if (!Array.isArray(conditions)) return true;
  for (const cond of conditions) {
    if (!evaluateSingleCondition(cond, request, resolvedTopic)) return false;
  }
  return true;
}

// ─── Assertions ────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(name: string, actual: any, expected: any) {
  if (actual === expected) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

async function main() {
  console.log("=== Legal Engine Verification ===\n");

  // ── 1. Database state assertions ──────────────────────────
  console.log("1. Database state:");

  const activeOblRules = await prisma.legalRule.findMany({
    where: { ruleType: "MAINTENANCE_OBLIGATION", isActive: true },
    select: { key: true, authority: true, topic: true },
  });
  assert("5 active MAINTENANCE_OBLIGATION rules", activeOblRules.length, 5);
  assert("All are STATUTE", activeOblRules.every((r) => r.authority === "STATUTE"), true);
  assert("All have non-null topic", activeOblRules.every((r) => r.topic !== null), true);

  const topics = activeOblRules.map((r) => r.topic).sort();
  assert(
    "Topics are [ELECTRICAL, HEATING, PLUMBING, SAFETY, STRUCTURAL]",
    JSON.stringify(topics),
    JSON.stringify(["ELECTRICAL", "HEATING", "PLUMBING", "SAFETY", "STRUCTURAL"]),
  );

  const activeDishwasherLeaks = await prisma.legalRule.count({
    where: { key: { startsWith: "co-259a-dishwasher-leak-" }, isActive: true },
  });
  assert("Zero active dishwasher-leak dupes", activeDishwasherLeaks, 0);

  const industryStd = await prisma.legalRule.count({
    where: { ruleType: "MAINTENANCE_OBLIGATION", authority: "INDUSTRY_STANDARD" },
  });
  assert("Zero MAINTENANCE_OBLIGATION with INDUSTRY_STANDARD", industryStd, 0);

  // ── 2. DSL evaluator tests ────────────────────────────────
  console.log("\n2. DSL evaluator (topic_match):");

  const heatingConditions = [{ type: "topic_match", topic: "HEATING" }];
  assert(
    "topic_match HEATING with resolvedTopic=HEATING → true",
    evaluateDslConditions(heatingConditions, {}, "HEATING"),
    true,
  );
  assert(
    "topic_match HEATING with resolvedTopic=PLUMBING → false",
    evaluateDslConditions(heatingConditions, {}, "PLUMBING"),
    false,
  );
  assert(
    "topic_match HEATING with resolvedTopic=null → false",
    evaluateDslConditions(heatingConditions, {}, null),
    false,
  );

  console.log("\n3. DSL evaluator (always_true / always_false):");
  assert(
    "always_true → true",
    evaluateDslConditions([{ type: "always_true" }], {}),
    true,
  );
  assert(
    "always_false → false",
    evaluateDslConditions([{ type: "always_false" }], {}),
    false,
  );

  console.log("\n4. DSL evaluator (AND / OR):");
  const andCond = [
    {
      type: "AND",
      conditions: [
        { type: "topic_match", topic: "PLUMBING" },
        { type: "always_true" },
      ],
    },
  ];
  assert("AND(topic_match PLUMBING, always_true) with PLUMBING → true", evaluateDslConditions(andCond, {}, "PLUMBING"), true);
  assert("AND(topic_match PLUMBING, always_true) with HEATING → false", evaluateDslConditions(andCond, {}, "HEATING"), false);

  const orCond = [
    {
      type: "OR",
      conditions: [
        { type: "topic_match", topic: "PLUMBING" },
        { type: "topic_match", topic: "HEATING" },
      ],
    },
  ];
  assert("OR(PLUMBING, HEATING) with PLUMBING → true", evaluateDslConditions(orCond, {}, "PLUMBING"), true);
  assert("OR(PLUMBING, HEATING) with HEATING → true", evaluateDslConditions(orCond, {}, "HEATING"), true);
  assert("OR(PLUMBING, HEATING) with SAFETY → false", evaluateDslConditions(orCond, {}, "SAFETY"), false);

  console.log("\n5. DSL evaluator (legacy field/op/value):");
  assert(
    "legacy eq match → true",
    evaluateDslConditions([{ field: "category", op: "eq", value: "stove" }], { category: "stove" }),
    true,
  );
  assert(
    "legacy eq mismatch → false",
    evaluateDslConditions([{ field: "category", op: "eq", value: "stove" }], { category: "heating" }),
    false,
  );
  assert(
    "legacy gt match → true",
    evaluateDslConditions([{ field: "estimatedCost", op: "gt", value: 500 }], { estimatedCost: 1000 }),
    true,
  );

  // ── 3. Category mapping ───────────────────────────────────
  console.log("\n6. Category mapping:");

  const heatingMapping = await prisma.legalCategoryMapping.findFirst({
    where: { requestCategory: "heating", orgId: null, isActive: true },
  });
  assert("heating → HEATING mapping exists", heatingMapping?.legalTopic, "HEATING");
  assert("heating confidence ≥ 0.7", (heatingMapping?.confidence ?? 0) >= 0.7, true);

  const paintingMapping = await prisma.legalCategoryMapping.findFirst({
    where: { requestCategory: "painting", orgId: null, isActive: true },
  });
  assert("painting → no mapping (null)", paintingMapping, null);

  // ── 4. Rule version DSL check ────────────────────────────
  console.log("\n7. Rule version DSL shape:");

  const heatingRule = await prisma.legalRule.findUnique({
    where: { key: "CH_CO259A_HEATING" },
    include: {
      versions: {
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });
  const heatingDsl = heatingRule?.versions[0]?.dslJson as any;
  assert("HEATING rule has version", !!heatingRule?.versions[0], true);
  assert("HEATING DSL obligation = OBLIGATED", heatingDsl?.obligation, "OBLIGATED");
  assert(
    "HEATING DSL condition type = topic_match",
    heatingDsl?.conditions?.[0]?.type,
    "topic_match",
  );
  assert(
    "HEATING DSL condition topic = HEATING",
    heatingDsl?.conditions?.[0]?.topic,
    "HEATING",
  );

  // ── Summary ────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ Verification failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
