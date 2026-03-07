const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function seed() {
  const topics = [
    {
      key: "CH_CO_259A_OVEN",
      topic: "OVEN_APPLIANCE",
      article: "CO 259a",
      text: "Landlord must maintain kitchen appliances in usable condition",
    },
    {
      key: "CH_CO_259A_DISHWASHER_V2",
      topic: "DISHWASHER",
      article: "CO 259a",
      text: "Landlord must maintain dishwasher when provided as part of rental",
    },
    {
      key: "CH_CO_259A_LIGHTING",
      topic: "LIGHTING_ELECTRICAL",
      article: "CO 259a",
      text: "Landlord must maintain electrical installations and lighting",
    },
    {
      key: "CH_CO_259A_PLUMBING",
      topic: "PLUMBING_WATER",
      article: "CO 259a",
      text: "Landlord must maintain plumbing and water systems",
    },
    {
      key: "CH_CO_259A_BATHROOM",
      topic: "BATHROOM_PLUMBING",
      article: "CO 259a",
      text: "Landlord must maintain bathroom fixtures and plumbing",
    },
    {
      key: "CH_CO_259A_STOVE",
      topic: "STOVE_COOKTOP",
      article: "CO 259a",
      text: "Landlord must maintain stove/cooktop when provided",
    },
  ];

  for (const t of topics) {
    const existing = await p.legalRule.findUnique({ where: { key: t.key } });
    if (existing) {
      console.log("Rule exists:", t.key, "- skipping");
      continue;
    }

    const rule = await p.legalRule.create({
      data: {
        key: t.key,
        ruleType: "MAINTENANCE_OBLIGATION",
        authority: "STATUTE",
        jurisdiction: "CH",
        canton: null,
        priority: 100,
        isActive: true,
        versions: {
          create: {
            effectiveFrom: new Date("2020-01-01"),
            effectiveTo: null,
            dslJson: {
              topic: t.topic,
              obligation: "OBLIGATED",
              conditions: [],
            },
            citationsJson: [{ article: t.article, text: t.text }],
            summary:
              "Swiss CO 259a: Landlord maintenance obligation for " + t.topic,
          },
        },
      },
    });
    console.log("Created rule:", rule.key, "-> topic:", t.topic);
  }
  console.log("Done seeding statutory rules");
}

seed()
  .catch((e) => console.error(e))
  .finally(() => p.$disconnect());
