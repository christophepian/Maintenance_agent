const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  // 1. Delete orphan test mappings (have timestamp suffixes)
  const all = await p.legalCategoryMapping.findMany();
  const orphans = all.filter(
    (m) =>
      /^\d+$/.test(m.requestCategory.split("_").pop()) || // test_cat_17727...
      m.legalTopic === "test_legal_topic" ||
      m.legalTopic === "test_topic",
  );
  console.log(`Deleting ${orphans.length} orphan test mappings...`);
  for (const o of orphans) {
    await p.legalCategoryMapping.delete({ where: { id: o.id } });
    console.log(`  - ${o.requestCategory} -> ${o.legalTopic}`);
  }

  // 2. Also delete the one real "dishwasher" org-level mapping so we can replace with global
  const dishwasherOrg = all.find(
    (m) => m.requestCategory === "dishwasher" && m.orgId,
  );
  if (dishwasherOrg) {
    await p.legalCategoryMapping.delete({ where: { id: dishwasherOrg.id } });
    console.log("  - deleted org-level dishwasher mapping");
  }

  // 3. Seed global default mappings (orgId = null)
  const DEFAULTS = [
    {
      requestCategory: "stove",
      legalTopic: "STOVE_COOKTOP",
      description: "Gas/electric stoves, cooktops, hob repairs",
    },
    {
      requestCategory: "oven",
      legalTopic: "OVEN_APPLIANCE",
      description: "Built-in ovens, oven door, thermostat",
    },
    {
      requestCategory: "dishwasher",
      legalTopic: "DISHWASHER",
      description: "Dishwasher repair, leaks, drainage",
    },
    {
      requestCategory: "bathroom",
      legalTopic: "BATHROOM_PLUMBING",
      description: "Bathroom fixtures, taps, bathtubs, showers, toilets, tiles",
    },
    {
      requestCategory: "lighting",
      legalTopic: "LIGHTING_ELECTRICAL",
      description: "Light fixtures, switches, dimmers, electrical outlets",
    },
    {
      requestCategory: "plumbing",
      legalTopic: "PLUMBING_WATER",
      description: "Pipes, drains, taps, water damage, leaks",
    },
    {
      requestCategory: "other",
      legalTopic: "GENERAL_MAINTENANCE",
      description: "General maintenance requests not matching specific categories",
    },
  ];

  console.log(`\nSeeding ${DEFAULTS.length} global default mappings...`);
  for (const d of DEFAULTS) {
    const existing = await p.legalCategoryMapping.findFirst({
      where: { orgId: null, requestCategory: d.requestCategory },
    });
    if (existing) {
      await p.legalCategoryMapping.update({
        where: { id: existing.id },
        data: { legalTopic: d.legalTopic, isActive: true },
      });
      console.log(`  ~ Updated: ${d.requestCategory} -> ${d.legalTopic}`);
    } else {
      await p.legalCategoryMapping.create({
        data: {
          orgId: null,
          requestCategory: d.requestCategory,
          legalTopic: d.legalTopic,
          isActive: true,
        },
      });
      console.log(`  + Created: ${d.requestCategory} -> ${d.legalTopic}`);
    }
  }

  const total = await p.legalCategoryMapping.count();
  console.log(`\nDone. Total mappings: ${total}`);
  await p.$disconnect();
})();
