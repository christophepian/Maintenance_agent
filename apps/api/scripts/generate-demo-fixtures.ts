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
import { getBuildingRenovationOpportunities } from "../src/services/assetInventory";
import { getYieldGoalSeek } from "../src/services/financials";
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
let DEMO_OWNER_USER_ID = "demo-owner";


const API_BASE = process.env.DEMO_FIXTURE_API || "http://127.0.0.1:3001";

/**
 * Capture a route over real HTTP from the locally-running API.
 *
 * Used for routes whose logic lives in the handler rather than a single service
 * function (the NPV scenarios route builds its result inline). Re-implementing
 * those in this script would drift from the real behaviour; calling them does
 * not. Requires `npm run dev` in apps/api with DEV_IDENTITY_ENABLED=true.
 */
async function captureHttp(routePath: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${API_BASE}${routePath}`, {
      headers: {
        "x-dev-role": "MANAGER",
        "x-dev-org-id": SCRATCH_ORG,
        "x-dev-user-id": DEMO_OWNER_USER_ID,
      },
    });
    if (!res.ok) {
      console.error(`  ! ${routePath} → HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e: any) {
    console.error(`  ! ${routePath} → ${String(e?.message || e)} (is apps/api running?)`);
    return null;
  }
}

async function postHttp(routePath: string, body: unknown): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}${routePath}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dev-role": "OWNER",
        "x-dev-org-id": SCRATCH_ORG,
        "x-dev-user-id": DEMO_OWNER_USER_ID,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`  ! POST ${routePath} → HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      return null;
    }
    return await res.json();
  } catch (e: any) {
    console.error(`  ! POST ${routePath} → ${String(e?.message || e)}`);
    return null;
  }
}

/**
 * The investor profiles the onboarding questionnaire can actually produce, and
 * the answers that produce them.
 *
 * Keyed by the questionnaire's first answer (mainGoal), because that is what the
 * demo wizard keys on too — the two must agree, or the profile revealed at the
 * end of onboarding would contradict the rationale on the plan page.
 *
 * Note options 3 and 5 both resolve to value_builder. That is the engine's own
 * behaviour with neutral answers to the other four questions, not a shortcut:
 * opportunistic_repositioner only ever comes out as a SECONDARY archetype here,
 * and the demo must not claim a profile the product wouldn't produce.
 *
 * Two surfaces read the resulting mandate — the NPV verdict's recommendation and
 * the goal-seek's off-strategy lever flags — so each is captured once per
 * profile, and the visitor's answers carry through to the plan page.
 */
const PROFILE_VARIANTS: { mainGoal: number; archetype: string; roleIntent: string }[] = [
  { mainGoal: 1, archetype: "exit_optimizer",    roleIntent: "sell" },
  { mainGoal: 2, archetype: "yield_maximizer",   roleIntent: "income" },
  { mainGoal: 3, archetype: "value_builder",     roleIntent: "long_term_quality" },
  { mainGoal: 4, archetype: "capital_preserver", roleIntent: "stable_hold" },
  { mainGoal: 5, archetype: "value_builder",     roleIntent: "long_term_quality" },
];

/**
 * Rewrite every scratch-database UUID to a stable demo id.
 *
 * This is what lets the demo work as a whole rather than one page: the building
 * page builds links from ids inside the payloads (a unit row links to
 * /units/<id>, the plans list to /cashflow-plans/<id>). Left as scratch UUIDs
 * those links would miss the fixture scoping and fall through to the backend.
 * Rewritten, every id the demo can reach is prefixed `demo-`, which is exactly
 * what lib/demo/serve.js keys on — and no real UUID can ever collide with it.
 */
function rewriteIds(json: string, map: Map<string, string>): string {
  let out = json;
  for (const [real, demo] of map) out = out.split(real).join(demo);
  return out;
}

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

  // A real User row: the strategy profiles below FK to it, and the demo building
  // is linked to it as owner.
  const owner = await prisma.user.upsert({
    where: { user_org_email_unique: { orgId: SCRATCH_ORG, email: "demo-owner@stoneiq.local" } },
    create: { orgId: SCRATCH_ORG, role: "OWNER", name: "Demo Owner", email: "demo-owner@stoneiq.local" },
    update: {},
    select: { id: true },
  });
  DEMO_OWNER_USER_ID = owner.id;

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
    const seeded = await seedDemoBuilding(prisma, SCRATCH_ORG, { ownerUserId: owner.id });
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

  // The prospective half of the journey: what the building could yield, and the
  // renovation opportunities the simulator works from.
  const [renovationOpportunities, yieldGoalSeek] = await Promise.all([
    getBuildingRenovationOpportunities(prisma, SCRATCH_ORG, buildingId).catch((e) => {
      console.error("  ! renovation-opportunities:", String(e?.message || e));
      return null;
    }),
    getYieldGoalSeek(SCRATCH_ORG, buildingId, from, to, { targetYieldPct: 3, mgmtFeePct: 5 }).catch((e) => {
      console.error("  ! yield-goalseek:", String(e?.message || e));
      return null;
    }),
  ]);

  const detail: any = mapBuildingToDetailDTO(buildingRow as any);
  // Re-address everything to the demo id so the fixture is self-consistent with
  // the URL the demo opens.
  detail.id = DEMO_BUILDING_ID;

  // Routes whose logic lives in the handler — captured over HTTP for fidelity.
  const plans: any = await captureHttp(`/cashflow-plans?buildingId=${buildingId}`);
  const planId: string | null = plans?.data?.[0]?.id ?? null;
  const planDetail = planId ? await captureHttp(`/cashflow-plans/${planId}`) : null;
  const planNpv = planId ? await captureHttp(`/cashflow-plans/${planId}/npv-scenarios`) : null;

  // Per-unit routes the Reporting tab and Units tab drill into.
  const perUnit: Record<string, unknown> = {};
  for (const u of unitDtos as any[]) {
    const reports = await captureHttp(`/units/${u.id}/condition-reports`);
    if (reports) perUnit[`/units/${u.id}/condition-reports`] = reports;
    const lines = await captureHttp(`/units/${u.id}/expense-lines?from=${from}&to=${to}`);
    if (lines) perUnit[`/units/${u.id}/expense-lines`] = lines;
  }

  /* ── Per-intent variants ────────────────────────────────────────────────
   * The onboarding questionnaire produces one of five investor intents, and two
   * surfaces read it: the NPV verdict's recommendation, and the goal-seek's
   * off-strategy lever flags. Capturing one payload each means the visitor's
   * answers actually carry through to the plan page, instead of every visitor
   * seeing the same generic verdict.
   *
   * Done over HTTP against the real strategy endpoints so the profiles are built
   * the way the product builds them (the archetype scores and dimension blobs
   * are computed, not hand-written).
   */
  const variants: Record<string, Record<string, unknown>> = {};
  for (const v of PROFILE_VARIANTS) {
    if (variants[String(v.mainGoal)]) continue;
    // One owner profile per variant, built from answers that genuinely produce
    // its archetype — the scores and dimension blobs are computed by the real
    // engine, not hand-written.
    const op = await postHttp("/strategy/owner-profile", {
      answers: {
        mainGoal: v.mainGoal,
        holdPeriod: 3,
        renovationAppetite: 3,
        cashSensitivity: 3,
        disruptionTolerance: 3,
      },
    });
    const ownerProfileId = op?.profile?.id ?? null;
    const producedArchetype = op?.profile?.primaryArchetype ?? null;
    if (!ownerProfileId) {
      console.error(`  ! variant ${v.mainGoal}: owner profile not created`);
      continue;
    }
    if (producedArchetype !== v.archetype) {
      // Loud, because a silent mismatch means the reveal step and the plan page
      // would name different profiles for the same answers.
      console.error(
        `  ! variant ${v.mainGoal}: engine produced "${producedArchetype}", table says "${v.archetype}" — update PROFILE_VARIANTS`,
      );
    }
    const bp = await postHttp("/strategy/building-profile", {
      buildingId,
      ownerProfileId,
      roleIntent: v.roleIntent,
    });
    if (!bp) continue;
    const [gs, npv] = await Promise.all([
      captureHttp(`/buildings/${buildingId}/yield-goalseek?from=${from}&to=${to}&target=3&mgmtFeePct=5`),
      planId ? captureHttp(`/cashflow-plans/${planId}/npv-scenarios`) : Promise.resolve(null),
    ]);
    const entry: Record<string, unknown> = {};
    if (gs) entry[`/buildings/${buildingId}/yield-goalseek`] = gs;
    if (npv && planId) entry[`/cashflow-plans/${planId}/npv-scenarios`] = npv;
    variants[String(v.mainGoal)] = entry;
  }

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
      [`/buildings/${DEMO_BUILDING_ID}/renovation-opportunities`]: wrap(renovationOpportunities),
      [`/buildings/${DEMO_BUILDING_ID}/yield-goalseek`]: wrap(yieldGoalSeek),
      [`/buildings/${DEMO_BUILDING_ID}/renovation-opportunities`]: wrap(renovationOpportunities),
      [`/buildings/${DEMO_BUILDING_ID}/yield-goalseek`]: wrap(yieldGoalSeek),
      ...(plans ? { "/cashflow-plans": plans } : {}),
      ...(planId && planDetail ? { [`/cashflow-plans/${planId}`]: planDetail } : {}),
      ...(planId && planNpv ? { [`/cashflow-plans/${planId}/npv-scenarios`]: planNpv } : {}),
      ...perUnit,
    },
    variants,
  };

  // Scratch UUIDs → stable demo ids, so every link the UI builds stays inside
  // the demo's fixture scope.
  const idMap = new Map<string, string>();
  idMap.set(buildingId, DEMO_BUILDING_ID);
  if (planId) idMap.set(planId, "demo-plan");
  for (const u of unitDtos as any[]) idMap.set(u.id, `demo-unit-${u.unitNumber}`);

  const rewritten = JSON.parse(rewriteIds(JSON.stringify(fixtures), idMap));

  const banner = (what: string) =>
    `/* GENERATED — do not edit by hand.\n * ${what}\n * Regenerate: npx tsx apps/api/scripts/generate-demo-fixtures.ts [package-dir]\n */\n`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    banner("Frozen output of the real ingestion + reporting pipeline.") +
      "export default " + JSON.stringify(rewritten, null, 2) + ";\n",
  );
  fs.writeFileSync(
    META_OUT,
    banner("Small companion to fixtures.js — safe to import client-side.") +
      "export default " + JSON.stringify(rewritten.meta, null, 2) + ";\n",
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
  console.log(`  reno opportunities ${renovationOpportunities ? `${(renovationOpportunities as any[]).length} item(s)` : "MISSING"}`);
  console.log(`  yield goal-seek    ${yieldGoalSeek ? "captured" : "MISSING"}`);
  console.log(`  cashflow plan      ${planId ? "captured (+npv " + (planNpv ? "yes" : "no") + ")" : "MISSING"}`);
  console.log(`  per-unit routes    ${Object.keys(perUnit).length}`);
  console.log(`  routes total       ${Object.keys(rewritten.routes).length}`);
  console.log(`  intent variants    ${Object.keys(rewritten.variants ?? {}).join(", ") || "NONE"}`);
  console.log(`  size              ${(fs.statSync(OUT).size / 1024).toFixed(0)} kB`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
