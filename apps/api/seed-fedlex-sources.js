/**
 * Seed 10 Swiss federal law sources from Fedlex into LegalSource table.
 *
 * Usage:  cd apps/api && node seed-fedlex-sources.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const FEDLEX_SOURCES = [
  {
    name: "OR/CO Art. 253–273c – Tenancy Law",
    url: "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en",
    scope: "Core tenancy articles (rent, maintenance, termination)",
  },
  {
    name: "VMWG – Rent Ordinance",
    url: "https://www.fedlex.admin.ch/eli/cc/1990/835_835_835/de",
    scope: "Reference rate formula, indexation rules",
  },
  {
    name: "ZGB – Swiss Civil Code",
    url: "https://www.fedlex.admin.ch/eli/cc/24/233_245_233/en",
    scope: "Property ownership, servitudes, neighbour law",
  },
  {
    name: "ZPO – Code of Civil Procedure",
    url: "https://www.fedlex.admin.ch/eli/cc/2010/262/en",
    scope: "Dispute resolution, conciliation for rent disputes",
  },
  {
    name: "nFADP/DSG – Data Protection Act",
    url: "https://www.fedlex.admin.ch/eli/cc/2022/491/en",
    scope: "Tenant data handling, consent, breach notification",
  },
  {
    name: "SchKG – Debt Enforcement & Bankruptcy",
    url: "https://www.fedlex.admin.ch/eli/cc/11/529_488_529/en",
    scope: "Rent arrears enforcement, eviction procedures",
  },
  {
    name: "BewG – Foreign Acquisitions of Real Estate",
    url: "https://www.fedlex.admin.ch/eli/cc/1984/1148_1148_1148/en",
    scope: "Restrictions on non-resident property purchases",
  },
  {
    name: "RPG – Spatial Planning Act",
    url: "https://www.fedlex.admin.ch/eli/cc/1979/1573_1573_1573/en",
    scope: "Zoning, building permits, land use",
  },
  {
    name: "EnG – Energy Act",
    url: "https://www.fedlex.admin.ch/eli/cc/2017/683/en",
    scope: "Energy efficiency in buildings, renovation obligations",
  },
  {
    name: "CO₂ Act – CO₂ Levy & Buildings",
    url: "https://www.fedlex.admin.ch/eli/cc/2012/855/en",
    scope: "Carbon levy pass-through, heating system requirements",
  },
];

async function main() {
  console.log("Seeding 10 Fedlex sources…\n");

  for (const src of FEDLEX_SOURCES) {
    // Upsert: match on name to be idempotent
    const existing = await prisma.legalSource.findFirst({
      where: { name: src.name },
    });

    if (existing) {
      await prisma.legalSource.update({
        where: { id: existing.id },
        data: {
          url: src.url,
          fetcherType: "FEDLEX",
          parserType: "HTML",
          updateFrequency: "QUARTERLY",
          status: "ACTIVE",
        },
      });
      console.log(`  ✓ Updated: ${src.name}`);
    } else {
      await prisma.legalSource.create({
        data: {
          name: src.name,
          jurisdiction: "CH",
          url: src.url,
          fetcherType: "FEDLEX",
          parserType: "HTML",
          updateFrequency: "QUARTERLY",
          status: "ACTIVE",
        },
      });
      console.log(`  + Created: ${src.name}`);
    }
  }

  const total = await prisma.legalSource.count();
  console.log(`\nDone. Total sources in DB: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
