/**
 * Generate the static fixtures behind the public onboarding demo.
 *
 * Runs a régie package through the REAL ingestion pipeline into a scratch org on
 * the local database, then calls the same service functions the reporting routes
 * call and writes their responses to a JSON file. The demo then serves those
 * responses instead of hitting a backend, so the walkthrough can end on the real
 * building page with no session, no sandbox and no live database.
 *
 * The numbers are therefore genuinely produced by the pipeline — this freezes its
 * output rather than faking it.
 *
 *   npx tsx scripts/generate-demo-fixtures.ts [path/to/package-dir]
 *
 * With no argument it uses the built-in synthetic package (demoPackage.ts). Pass
 * a directory of CSVs to use a real régie package instead; every *.csv in it is
 * submitted as one fiscal year's package.
 *
 * Requires the local Postgres (docker: maint_agent_pg). Writes to
 * apps/web/lib/demo/fixtures.json.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { seedDemoBuilding, demoFiscalYears } from "../src/services/demoSeedService";
import { commitPackage } from "../src/services/packageOnboardingService";
import * as inventoryRepo from "../src/repositories/inventoryRepository";
import { mapBuildingToDetailDTO } from "../src/dto/buildingDetail";
import {
  getBuildingPeriodReport,
  getBuildingVendorSpend,
  getBuildingTimeSeries,
  getUnitFinancialSummaries,
  getUnitProfitability,
  getPortfolioSummary,
} from "../src/services/financials";
import { getBuildingKpis, listUnits } from "../src/services/inventory";
import { mapUnitToListDTO } from "../src/dto/unitList";

/** The id the demo building is addressed by. Not a UUID on purpose: it can never
 *  collide with a real building, so serving a fixture for it is self-limiting. */
export const DEMO_BUILDING_ID = "demo-building";

// Emitted as ES modules rather than .json so a plain `import` works everywhere
// the app and its tests run — Node's ESM loader requires an import attribute
// for .json, which the bundler and node:test disagree about.
const OUT = path.resolve(__dirname, "../../web/lib/demo/fixtures.js");
// Written separately and kept small: client components import it (via
// lib/demo/constants.js) and must not pull the whole snapshot into the bundle.
const META_OUT = path.resolve(__dirname, "../../web/lib/demo/meta.js");
const SCRATCH_ORG = "demo-fixture-org";

const prisma = new PrismaClient();

async function main() {
  const packageDir = process.argv[2];

  await prisma.org.upsert({
    where: { id: SCRATCH_ORG },
    create: { id: SCRATCH_ORG, name: "Demo Fixture Build" },
    update: {},
  });

  // Start from a clean slate every run so a re-generation can never inherit
  // half of a previous package's data.
  await prisma.$executeRawUnsafe(`DELETE FROM "Org" WHERE id = $1`, SCRATCH_ORG).catch(() => {});
  await prisma.org.upsert({
    where: { id: SCRATCH_ORG },
    create: { id: SCRATCH_ORG, name: "Demo Fixture Build" },
    update: {},
  });

  let buildingId: string;
  let fiscalYear: number;

  if (packageDir) {
    // A real régie package handed to us: one directory of canonical CSVs.
    const files = fs
      .readdirSync(packageDir)
      .filter((f) => f.toLowerCase().endsWith(".csv"))
      .map((f) => ({ fileName: f, text: fs.readFileSync(path.join(packageDir, f), "utf8") }));
    if (files.length === 0) throw new Error(`No .csv files in ${packageDir}`);
    console.log(`Using ${files.length} file(s) from ${packageDir}`);

    const building = await inventoryRepo.createBuilding(prisma, SCRATCH_ORG, {
      name: "Demo building",
      address: "—",
    });
    buildingId = building.id;
    fiscalYear = new Date().getUTCFullYear() - 1;
    const result = await commitPackage(prisma, SCRATCH_ORG, buildingId, files, {
      billingMode: "snapshot",
      fiscalYear,
      allowNewUnits: true,
      allowMultiBuilding: true,
    });
    console.log("Commit:", result.results.map((r) => `${r.type}: ${r.outcome}`).join("; "));
    if (result.warnings.length) console.log("Warnings:", result.warnings.join("; "));
  } else {
    console.log("Using the built-in synthetic package");
    const seeded = await seedDemoBuilding(prisma, SCRATCH_ORG, {});
    buildingId = seeded.buildingId;
    fiscalYear = demoFiscalYears()[1];
    for (const y of seeded.years) console.log(`  ${y.fiscalYear}: ${y.detail}`);
  }

  // The window the Reporting tab opens on: the last complete fiscal year.
  const from = `${fiscalYear}-01-01`;
  const to = `${fiscalYear}-12-31`;
  console.log(`\nCapturing reporting for ${from} → ${to}`);

  const buildingRow = await inventoryRepo.findBuildingByIdDeep(prisma, buildingId, SCRATCH_ORG);
  if (!buildingRow) throw new Error("Building vanished after seeding");

  // Every response is wrapped in { data } — the envelope every route uses.
  const wrap = (data: unknown) => ({ data });

  const [periodReport, unitFinancials, vendorSpend, unitProfitability, portfolio, timeseries, kpis] =
    await Promise.all([
      getBuildingPeriodReport(SCRATCH_ORG, buildingId, from, to, true),
      getUnitFinancialSummaries(SCRATCH_ORG, buildingId, from, to),
      getBuildingVendorSpend(SCRATCH_ORG, buildingId, { from, to }),
      getUnitProfitability(SCRATCH_ORG, buildingId, from, to),
      getPortfolioSummary(SCRATCH_ORG, { from, to }),
      getBuildingTimeSeries(SCRATCH_ORG, buildingId, "year"),
      getBuildingKpis(SCRATCH_ORG, buildingId),
    ]);

  const units = await listUnits(SCRATCH_ORG, buildingId, false);
  const unitDtos = units.map(mapUnitToListDTO);

  const detail: any = mapBuildingToDetailDTO(buildingRow as any);
  // Re-address everything to the demo id so the fixture is self-consistent with
  // the URL the demo opens.
  detail.id = DEMO_BUILDING_ID;

  const fixtures = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: packageDir ? path.basename(packageDir) : "synthetic",
      fiscalYear,
      from,
      to,
      buildingId: DEMO_BUILDING_ID,
    },
    // Keyed by backend path with the demo id substituted in. Query strings are
    // deliberately ignored when matching: the demo shows one period.
    routes: {
      [`/buildings/${DEMO_BUILDING_ID}`]: wrap(detail),
      [`/buildings/${DEMO_BUILDING_ID}/kpis`]: wrap(kpis),
      [`/buildings/${DEMO_BUILDING_ID}/units`]: wrap(unitDtos),
      [`/buildings/${DEMO_BUILDING_ID}/period-report`]: wrap(periodReport),
      [`/buildings/${DEMO_BUILDING_ID}/unit-financials`]: wrap(unitFinancials),
      [`/buildings/${DEMO_BUILDING_ID}/vendor-spend`]: wrap(vendorSpend),
      [`/buildings/${DEMO_BUILDING_ID}/unit-profitability`]: wrap(unitProfitability),
      [`/buildings/${DEMO_BUILDING_ID}/timeseries`]: wrap(timeseries),
      "/financials/portfolio-summary": wrap(portfolio),
    },
  };

  const banner = (what: string) =>
    `/* GENERATED — do not edit by hand.\n * ${what}\n * Regenerate: npx tsx apps/api/scripts/generate-demo-fixtures.ts [package-dir]\n */\n`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    banner("Frozen output of the real ingestion + reporting pipeline.") +
      "export default " + JSON.stringify(fixtures, null, 2) + ";\n",
  );
  fs.writeFileSync(
    META_OUT,
    banner("Small companion to fixtures.js — safe to import client-side.") +
      "export default " + JSON.stringify(fixtures.meta, null, 2) + ";\n",
  );

  const f: any = periodReport.financials;
  console.log(`\nWrote ${OUT}`);
  console.log(`  source            ${fixtures.meta.source}`);
  console.log(`  NOI               CHF ${(f.netOperatingIncomeCents / 100).toLocaleString()}`);
  console.log(`  expenses          CHF ${(f.expensesTotalCents / 100).toLocaleString()}`);
  console.log(`  prior period      ${periodReport.prevFinancials ? "present" : "MISSING"}`);
  console.log(`  monthly points    ${periodReport.monthlyData?.length ?? 0}`);
  console.log(`  units             ${unitDtos.length}`);
  console.log(`  vendors           ${(vendorSpend as any)?.length ?? "n/a"}`);
  console.log(`  size              ${(fs.statSync(OUT).size / 1024).toFixed(0)} kB`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
