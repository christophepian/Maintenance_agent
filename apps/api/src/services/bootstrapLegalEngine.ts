/**
 * Legal Engine Bootstrap
 *
 * Ensures all canonical legal data exists on server startup so the
 * decision engine produces meaningful results on a fresh database
 * without manual UI intervention.
 *
 * Upserts (idempotent):
 *   1. 5 canonical LegalSource records (one per fetcher type)
 *   2. 7 global LegalCategoryMapping defaults
 *   3. Statutory LegalRules for CO 259a / 256 per topic
 *
 * After seeding, triggers a full ingestion pass if any source was
 * newly created (populates DepreciationStandards, INDUSTRY_STANDARD
 * rules, and LegalVariables).
 *
 * Called from server.ts start() — after ensureDefaultOrgConfig().
 */

import { PrismaClient, LegalSourceScope, LegalSourceStatus } from "@prisma/client";

// ══════════════════════════════════════════════════════════════
// 1. Canonical Legal Sources
// ══════════════════════════════════════════════════════════════

interface CanonicalSource {
  name: string;
  fetcherType: string;
  url: string | null;
  scope: LegalSourceScope;
  updateFrequency: string;
}

const CANONICAL_SOURCES: CanonicalSource[] = [
  {
    name: "BWO Reference Interest Rate",
    fetcherType: "REFERENCE_RATE",
    url: "https://www.bwo.admin.ch/bwo/de/home/mietrecht/referenzzinssatz.html",
    scope: LegalSourceScope.FEDERAL,
    updateFrequency: "quarterly",
  },
  {
    name: "BFS Consumer Price Index (LIK)",
    fetcherType: "CPI",
    url: "https://www.bfs.admin.ch/bfs/de/home/statistiken/preise/landesindex-konsumentenpreise.html",
    scope: LegalSourceScope.FEDERAL,
    updateFrequency: "monthly",
  },
  {
    name: "ASLOCA Depreciation Table (Paritätische Lebensdauertabelle)",
    fetcherType: "ASLOCA_DEPRECIATION",
    url: "https://www.asloca.ch/fiches-information",
    scope: LegalSourceScope.FEDERAL,
    updateFrequency: "yearly",
  },
  {
    name: "ASLOCA Rent Reduction Jurisprudence",
    fetcherType: "ASLOCA_RENT_REDUCTION",
    url: "https://www.asloca.ch/fiches-information",
    scope: LegalSourceScope.FEDERAL,
    updateFrequency: "yearly",
  },
  {
    name: "Swiss Code of Obligations (OR/CO)",
    fetcherType: "FEDLEX",
    url: "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/de",
    scope: LegalSourceScope.FEDERAL,
    updateFrequency: "yearly",
  },
];

// ══════════════════════════════════════════════════════════════
// 2. Default Global Category Mappings
// ══════════════════════════════════════════════════════════════

interface DefaultMapping {
  requestCategory: string;
  legalTopic: string;
}

const DEFAULT_CATEGORY_MAPPINGS: DefaultMapping[] = [
  { requestCategory: "stove", legalTopic: "STOVE_COOKTOP" },
  { requestCategory: "oven", legalTopic: "OVEN_APPLIANCE" },
  { requestCategory: "dishwasher", legalTopic: "DISHWASHER" },
  { requestCategory: "bathroom", legalTopic: "BATHROOM_PLUMBING" },
  { requestCategory: "lighting", legalTopic: "LIGHTING_ELECTRICAL" },
  { requestCategory: "plumbing", legalTopic: "PLUMBING_WATER" },
  { requestCategory: "other", legalTopic: "GENERAL_MAINTENANCE" },
];

// ══════════════════════════════════════════════════════════════
// 3. Statutory Rules (CO 259a / 256 — per legal topic)
// ══════════════════════════════════════════════════════════════

interface StatutoryRuleSeed {
  key: string;
  topic: string;
  priority: number;
  dslJson: Record<string, unknown>;
  citationsJson: Array<{ article: string; text: string }>;
  summary: string;
}

/**
 * CO Art. 256 — Landlord must deliver the property in a condition
 * suitable for its intended use and maintain it.
 *
 * CO Art. 259a — Tenant may demand that the landlord remedy defects
 * that are not the tenant's responsibility.
 *
 * We create one statutory rule per legal topic so that when the
 * engine maps a request category to a topic, it finds a matching
 * statutory rule with the correct obligation.
 */
const STATUTORY_RULES: StatutoryRuleSeed[] = [
  {
    key: "co-259a-stove-cooktop",
    topic: "STOVE_COOKTOP",
    priority: 100,
    dslJson: {
      obligation: "OBLIGATED",
      conditions: [{ type: "topic_match", topic: "STOVE_COOKTOP" }],
    },
    citationsJson: [
      { article: "CO Art. 259a", text: "Landlord must remedy defects not caused by tenant." },
      { article: "CO Art. 256", text: "Landlord must maintain the property in suitable condition." },
    ],
    summary: "Stove/cooktop repair is landlord obligation under CO 259a/256.",
  },
  {
    key: "co-259a-oven-appliance",
    topic: "OVEN_APPLIANCE",
    priority: 100,
    dslJson: {
      obligation: "OBLIGATED",
      conditions: [{ type: "topic_match", topic: "OVEN_APPLIANCE" }],
    },
    citationsJson: [
      { article: "CO Art. 259a", text: "Landlord must remedy defects not caused by tenant." },
      { article: "CO Art. 256", text: "Landlord must maintain the property in suitable condition." },
    ],
    summary: "Oven repair is landlord obligation under CO 259a/256.",
  },
  {
    key: "co-259a-dishwasher",
    topic: "DISHWASHER",
    priority: 100,
    dslJson: {
      obligation: "OBLIGATED",
      conditions: [{ type: "topic_match", topic: "DISHWASHER" }],
    },
    citationsJson: [
      { article: "CO Art. 259a", text: "Landlord must remedy defects not caused by tenant." },
      { article: "CO Art. 256", text: "Landlord must maintain the property in suitable condition." },
    ],
    summary: "Dishwasher repair is landlord obligation under CO 259a/256.",
  },
  {
    key: "co-259a-bathroom-plumbing",
    topic: "BATHROOM_PLUMBING",
    priority: 100,
    dslJson: {
      obligation: "OBLIGATED",
      conditions: [{ type: "topic_match", topic: "BATHROOM_PLUMBING" }],
    },
    citationsJson: [
      { article: "CO Art. 259a", text: "Landlord must remedy defects not caused by tenant." },
      { article: "CO Art. 256", text: "Landlord must maintain the property in suitable condition." },
    ],
    summary: "Bathroom/plumbing repair is landlord obligation under CO 259a/256.",
  },
  {
    key: "co-259a-lighting-electrical",
    topic: "LIGHTING_ELECTRICAL",
    priority: 100,
    dslJson: {
      obligation: "OBLIGATED",
      conditions: [{ type: "topic_match", topic: "LIGHTING_ELECTRICAL" }],
    },
    citationsJson: [
      { article: "CO Art. 259a", text: "Landlord must remedy defects not caused by tenant." },
      { article: "CO Art. 256", text: "Landlord must maintain the property in suitable condition." },
    ],
    summary: "Lighting/electrical repair is landlord obligation under CO 259a/256.",
  },
  {
    key: "co-259a-plumbing-water",
    topic: "PLUMBING_WATER",
    priority: 100,
    dslJson: {
      obligation: "OBLIGATED",
      conditions: [{ type: "topic_match", topic: "PLUMBING_WATER" }],
    },
    citationsJson: [
      { article: "CO Art. 259a", text: "Landlord must remedy defects not caused by tenant." },
      { article: "CO Art. 256", text: "Landlord must maintain the property in suitable condition." },
    ],
    summary: "Plumbing/water repair is landlord obligation under CO 259a/256.",
  },
  {
    key: "co-259a-general-maintenance",
    topic: "GENERAL_MAINTENANCE",
    priority: 50, // Lower priority — generic catch-all
    dslJson: {
      obligation: "DISCRETIONARY",
      conditions: [{ type: "topic_match", topic: "GENERAL_MAINTENANCE" }],
    },
    citationsJson: [
      { article: "CO Art. 259a", text: "Landlord must remedy defects not caused by tenant." },
    ],
    summary: "General maintenance — obligation depends on defect nature (CO 259a).",
  },
];

// ══════════════════════════════════════════════════════════════
// Bootstrap Function
// ══════════════════════════════════════════════════════════════

export async function bootstrapLegalEngine(prisma: PrismaClient): Promise<void> {
  console.log("[LEGAL BOOTSTRAP] Ensuring canonical legal data...");
  let createdSources = 0;

  // ── 1. Legal Sources ────────────────────────────────────────
  for (const src of CANONICAL_SOURCES) {
    const existing = await prisma.legalSource.findFirst({
      where: { fetcherType: src.fetcherType },
    });
    if (!existing) {
      await prisma.legalSource.create({
        data: {
          name: src.name,
          fetcherType: src.fetcherType,
          url: src.url,
          jurisdiction: "CH",
          scope: src.scope,
          updateFrequency: src.updateFrequency,
          status: LegalSourceStatus.ACTIVE,
        },
      });
      createdSources++;
      console.log(`  + Source: ${src.name}`);
    }
  }

  // ── 2. Global Category Mappings ─────────────────────────────
  let createdMappings = 0;
  for (const m of DEFAULT_CATEGORY_MAPPINGS) {
    const existing = await prisma.legalCategoryMapping.findFirst({
      where: { orgId: null, requestCategory: m.requestCategory },
    });
    if (!existing) {
      await prisma.legalCategoryMapping.create({
        data: {
          orgId: null,
          requestCategory: m.requestCategory,
          legalTopic: m.legalTopic,
          confidence: 1.0,
          isActive: true,
        },
      });
      createdMappings++;
    }
  }
  if (createdMappings > 0) {
    console.log(`  + ${createdMappings} global category mapping(s)`);
  }

  // ── 3. Statutory Rules ──────────────────────────────────────
  let createdRules = 0;
  for (const r of STATUTORY_RULES) {
    const existing = await prisma.legalRule.findFirst({
      where: { key: r.key },
    });
    if (!existing) {
      await prisma.legalRule.create({
        data: {
          key: r.key,
          ruleType: "MAINTENANCE_OBLIGATION",
          authority: "STATUTE",
          jurisdiction: "CH",
          scope: "FEDERAL",
          topic: r.topic,
          priority: r.priority,
          isActive: true,
          versions: {
            create: {
              effectiveFrom: new Date("2024-01-01"),
              dslJson: r.dslJson as any,
              citationsJson: r.citationsJson as any,
              summary: r.summary,
            },
          },
        },
      });
      createdRules++;
    }
  }
  if (createdRules > 0) {
    console.log(`  + ${createdRules} statutory rule(s)`);
  }

  // ── 4. Trigger initial ingestion if sources were created ────
  if (createdSources > 0) {
    console.log("[LEGAL BOOTSTRAP] New sources created — triggering initial ingestion...");
    try {
      // Dynamic import to avoid circular dependency
      const { ingestAllSources } = await import("./legalIngestion");
      const results = await ingestAllSources();
      const successCount = results.filter((r) => r.status === "success").length;
      console.log(
        `[LEGAL BOOTSTRAP] Ingestion complete: ${successCount}/${results.length} sources succeeded`,
      );
    } catch (err: any) {
      // Non-fatal — ingestion will retry on next background cycle
      console.warn(`[LEGAL BOOTSTRAP] Initial ingestion failed (non-fatal): ${err.message}`);
    }
  }

  console.log("[LEGAL BOOTSTRAP] Done.");
}
