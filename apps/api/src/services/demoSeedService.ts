/**
 * Demo building seeder — the data behind the public onboarding demo.
 *
 * Creates (or refreshes) one building owned by the demo user and populates it by
 * running the synthetic package from `demoPackage` through the REAL onboarding
 * pipeline (`commitPackage`). Two consecutive fiscal years are committed so the
 * Reporting tab has a prior period to compare against — year-over-year is most of
 * what makes that page worth showing.
 *
 * Idempotent: the building is matched by name within the org and reused, and
 * commitPackage itself is keyed on the ledger piece numbers, so re-running adds
 * nothing. Safe to call on every demo sign-in.
 *
 * SANDBOX ONLY. The caller (routes/sandbox.ts) is registered only when
 * SANDBOX_MODE=true; this service must never be wired into a production route —
 * it writes buildings, leases and invoices into whatever org it is handed.
 */

import type { PrismaClient } from "@prisma/client";
import * as inventoryRepo from "../repositories/inventoryRepository";
import * as importedStatementRepo from "../repositories/importedStatementRepository";
import { commitPackage } from "./packageOnboardingService";
import { buildDemoPackage, demoPackageSummary, DEMO_BUILDING_NAME, DEMO_BUILDING_ADDRESS } from "./demoPackage";
import { enrichDemoBuilding, type DemoEnrichmentResult } from "./demoEnrichment";

export interface DemoSeedResult {
  buildingId: string;
  buildingName: string;
  created: boolean;
  years: { fiscalYear: number; committed: boolean; detail: string }[];
  summary: ReturnType<typeof demoPackageSummary>;
  enrichment: DemoEnrichmentResult;
}

/** The two fiscal years the demo shows: the last complete year and the one before. */
export function demoFiscalYears(now = new Date()): [number, number] {
  const lastComplete = now.getUTCFullYear() - 1;
  return [lastComplete - 1, lastComplete];
}

export async function seedDemoBuilding(
  prisma: PrismaClient,
  orgId: string,
  opts: { ownerUserId?: string; actorUserId?: string } = {},
): Promise<DemoSeedResult> {
  // 1. Find-or-create the building. Matched by name so a re-run reuses it rather
  //    than stacking up duplicates every time someone opens the demo.
  const existing = await inventoryRepo.findBuildingByNameAndOrg(prisma, orgId, DEMO_BUILDING_NAME);
  const building =
    existing ??
    (await inventoryRepo.createBuilding(prisma, orgId, {
      name: DEMO_BUILDING_NAME,
      address: DEMO_BUILDING_ADDRESS,
      city: "Genève",
      postalCode: "1203",
    }));
  const created = !existing;

  // 2. Link the demo owner so the building shows up under owner-scoped queries
  //    (the owner sees the intersection of orgId AND a BuildingOwner row).
  // addBuildingOwner is itself idempotent (returns the existing row on a unique
  // violation), so no pre-check is needed.
  if (opts.ownerUserId) {
    await inventoryRepo.addBuildingOwner(prisma, building.id, opts.ownerUserId);
  }

  // 3. Commit both fiscal years, oldest first, through the real pipeline. The
  //    older year is billed ~2.5% lower so the YoY comparison isn't flat — that's
  //    roughly what a Swiss indexed lease would do over a year.
  const [olderYear, lastYear] = demoFiscalYears();
  const years: DemoSeedResult["years"] = [];
  for (const [fiscalYear, rentFactor] of [
    [olderYear, 0.975],
    [lastYear, 1],
  ] as const) {
    // Skip a year that is already imported and approved. commitPackage is
    // idempotent on units/leases/ledger pieces, but it would still create a
    // fresh ImportedStatement each run — and this seeder is called on every
    // demo sign-in, so without this guard the statements pile up.
    const alreadyImported = await importedStatementRepo.findApprovedIncomeStatementForYear(
      prisma, orgId, building.id, fiscalYear,
    );
    if (alreadyImported) {
      years.push({ fiscalYear, committed: false, detail: "already imported — skipped" });
      continue;
    }

    const files = buildDemoPackage(fiscalYear, { rentFactor });
    try {
      const result = await commitPackage(prisma, orgId, building.id, files, {
        // snapshot: reference-only. The demo must never start generating rent
        // invoices or billing side-effects for imaginary tenants.
        billingMode: "snapshot",
        fiscalYear,
        actorUserId: opts.actorUserId,
        allowNewUnits: true,
      });
      years.push({
        fiscalYear,
        committed: true,
        detail: result.results.map((r) => `${r.type}: ${r.outcome}`).join("; "),
      });
    } catch (e: any) {
      // One year failing shouldn't leave the demo with no data at all.
      years.push({ fiscalYear, committed: false, detail: String(e?.message || e) });
    }
  }

  // Everything a régie package can't carry: valuation, mortgage, the per-unit
  // intrinsic-value worksheet, an aged asset inventory, inspection history and a
  // cashflow plan. Runs after the package so it can attach to the units and
  // leases the rent roll created.
  const enrichment = await enrichDemoBuilding(prisma, orgId, building.id);

  return {
    buildingId: building.id,
    buildingName: DEMO_BUILDING_NAME,
    created,
    years,
    summary: demoPackageSummary(lastYear),
    enrichment,
  };
}
