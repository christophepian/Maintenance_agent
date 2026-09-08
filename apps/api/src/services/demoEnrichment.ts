/**
 * Demo building enrichment — everything the ingested régie package can't carry.
 *
 * A régie package gives you tenants, rents and accounts. It says nothing about
 * what the building is worth, how old its boiler is, or what state a unit was
 * handed back in — and those are exactly the inputs behind the yield → renovation
 * → investment-simulation journey the demo needs to tell. This adds them.
 *
 * Deterministic by design: ages, values and conditions are fixed tables, not
 * random draws, so regenerating the demo never moves the numbers a walkthrough
 * was scripted around. ("Random-looking", not random.)
 *
 * Figures are chosen to stay consistent with the seeded accounts: the property
 * value matches the balance sheet's 6.45M, and the mortgage matches its 3.9M
 * liability, so NET YIELD and LTV agree with the reporting tab rather than
 * contradicting it.
 *
 * SANDBOX / FIXTURE-GENERATION ONLY. Like demoSeedService, this writes into
 * whatever org it is handed and must never be reachable in production.
 */

import type { PrismaClient } from "@prisma/client";
import { seedDefaultBuildingAssets, seedDefaultUnitAssets } from "./defaultAssets";
import { getAssetInventoryForBuilding } from "./assetInventory";
import * as demoRepo from "../repositories/demoRepository";

/** Balance-sheet figures the package already carries, mirrored here so the
 *  valuation and the accounts can't drift apart. */
const PROPERTY_VALUE_CHF = 6_450_000;
const MORTGAGE_BALANCE_CHF = 3_900_000;

/**
 * Wear profile, expressed as a fraction of each asset's ACTUAL useful life.
 *
 * Expressing it in years was the first attempt and it doesn't work: the useful
 * life varies per topic (a kitchen is not a roof) and comes from the standards
 * tables, so a fixed "15 years old" made kitchens overdue and roofs pristine —
 * 21 overdue items instead of three. Fractions are life-relative, so the profile
 * holds whatever the standards say.
 *
 * The lives are read back from the same analysis the UI runs (see
 * applyWearProfile), then installedAt is set to hit these fractions exactly.
 */

/** Past end of life — the demo's headline opportunities. */
const URGENT_WEAR = 1.08;

/**
 * Everything else, cycled deterministically.
 *
 * The spread matters: getBuildingRenovationOpportunities lists anything NOT
 * rated REPAIR, so a building where every asset sits below ~70% wear produces an
 * empty accordion with nothing to browse. These values deliberately include a
 * band in the 0.74–0.92 range, which surfaces as MONITOR / PLAN_REPLACEMENT —
 * the middle of the ranking, under the urgent items and above the healthy ones.
 */
const BASELINE_WEAR = [
  0.31, 0.86, 0.44, 0.78, 0.25, 0.91, 0.52, 0.36, 0.83, 0.28, 0.74, 0.47,
  0.62, 0.89, 0.33, 0.57, 0.80, 0.41,
];

/**
 * The end-of-life items. `unit: null` means the building-level asset.
 *
 * Deliberately three, and deliberately coherent with the rest of the demo: the
 * kitchen is in unit 0008, the vacant one, whose move-out report records water
 * damage to exactly that kitchen and whose ledger carries the CHF 4,250
 * "Remise en état après départ".
 */
const URGENT: { unit: string | null; topic: string }[] = [
  // The boiler is aged too, but note it can never appear in the renovation
  // ACCORDION: getBuildingRenovationOpportunities walks the building's units and
  // never looks at building-level assets. It shows on the Assets tab and drives
  // the seeded cashflow plan, which is where the demo picks it up.
  { unit: null,   topic: "BOILER" },
  // The three the accordion actually ranks to the top.
  { unit: "0008", topic: "KITCHEN_CABINET_CHIPBOARD" },
  { unit: "0003", topic: "WINDOW_INSULATED_PLASTIC_WOOD" },
  { unit: "0005", topic: "PARQUET_MOSAIC" },
];

/** Small deterministic string hash — stable across runs and machines, which is
 *  the only property required of it here. */
function stableIndex(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface DemoEnrichmentResult {
  valuation: { propertyValueChf: number; mortgageBalanceChf: number; ltvPct: number };
  assets: { building: number; unit: number; overdue: number };
  conditionReports: number;
  cashflowPlanId: string | null;
}

export async function enrichDemoBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
): Promise<DemoEnrichmentResult> {
  /* ── 1. Building identity + valuation ─────────────────────────────────────
   * marketValueChf is what NET YIELD divides by; without it that KPI renders
   * as an em-dash. LTV additionally needs the mortgage below. */
  await demoRepo.updateBuildingProfile(prisma, buildingId, {
      marketValueChf: PROPERTY_VALUE_CHF,
      fiscalValueChf: 4_820_000,
      insuranceValueChf: 7_100_000,
      ppeEstimateChf: 6_180_000,
      constructionDate: new Date(Date.UTC(1974, 4, 1)),
      lastRenovationDate: new Date(Date.UTC(2009, 8, 1)),
      hasElevator: true,
      hasConcierge: true,
      yearBuilt: 1974,
  });

  /* ── 2. Mortgage — lights up LTV and the levered NPV path ───────────────── */
  const existingMortgage = await demoRepo.findMortgage(prisma, orgId, buildingId);
  if (!existingMortgage) {
    await demoRepo.createMortgage(prisma, {
        orgId,
        buildingId,
        lenderName: "Banque Cantonale de Genève",
        originalPrincipalChf: 4_300_000,
        currentBalanceChf: MORTGAGE_BALANCE_CHF,
        interestRatePct: 1.85,
        amortizationType: "ANNUITY",
        annualAmortizationChf: 43_000,
        startDate: new Date(Date.UTC(2016, 5, 1)),
        fixedUntil: new Date(Date.UTC(2029, 5, 1)),
        maturityDate: new Date(Date.UTC(2041, 5, 1)),
    });
  }

  /* ── 3. Per-unit valuation worksheet (valeur intrinsèque) ─────────────────
   * The intrinsic value is COMPUTED from these inputs, not stored, so seeding
   * the worksheet is what makes the Overview tab's valuation section real.
   * Vétusté rises with the unit's age profile. */
  const units = await demoRepo.findBuildingUnits(prisma, orgId, buildingId);

  for (const [i, u] of units.entries()) {
    const isParking = u.type === "PARKING";
    await demoRepo.updateUnitValuation(prisma, u.id, isParking
        ? {
            // Parking and garages are valued as flat lines, not per m².
            extParkingValueChf: 35_000,
            garageValueChf: null,
            intrinsicPricePerSqmChf: null,
          }
        : {
            // Calibrated so the COMPUTED intrinsic value lands near the 6.45M
            // on the balance sheet. This matters more than it looks: LTV and net
            // yield are both taken from the intrinsic value, not marketValueChf,
            // so an under-priced worksheet produced an LTV of 116% against a
            // building that is 60% geared.
            intrinsicPricePerSqmChf: 13_500,
            // 1974 build, partial 2009 renovation → a realistic mid-range
            // obsolescence discount, nudged per unit so the column isn't flat.
            vetustePct: 26 + ((i * 3) % 9),
            gardenAreaSqm: i === 0 ? 42 : null, // only the ground-floor flat
            gardenWeightPct: i === 0 ? 10 : null,
            lastRenovationYear: 2009 + ((i * 2) % 6),
          });
  }

  /* ── 4. Assets, aged into a mixed condition profile ───────────────────── */
  await seedDefaultBuildingAssets(prisma, orgId, buildingId, { hasElevator: true });
  for (const u of units) {
    // Parking objects have no kitchens or parquet — skip the unit asset set.
    if (u.type === "PARKING") continue;
    await seedDefaultUnitAssets(prisma, orgId, u.id);
  }

  const assets = await demoRepo.findBuildingAndUnitAssets(prisma, orgId, buildingId, units.map((u) => u.id));

  const unitNumberById = new Map(units.map((u) => [u.id, u.unitNumber]));
  const { overdue: overdueCount, urgentAssetIds } = await applyWearProfile(
    prisma, orgId, buildingId, assets, unitNumberById,
  );

  /* ── 5. Condition reports ─────────────────────────────────────────────────
   * A MOVE_OUT on the vacant unit, with damage that explains the CHF 4,250
   * "Remise en état après départ" already sitting in that unit's ledger, and a
   * clean MOVE_IN on the most recent tenancy. The point is that the inspection
   * history and the accounts tell the same story. */
  const reports = await seedConditionReports(prisma, orgId, buildingId, units);

  /* ── 6. A cashflow plan the simulator can hand off to ─────────────────── */
  const cashflowPlanId = await seedCashflowPlan(prisma, orgId, buildingId, assets, urgentAssetIds);

  return {
    valuation: {
      propertyValueChf: PROPERTY_VALUE_CHF,
      mortgageBalanceChf: MORTGAGE_BALANCE_CHF,
      ltvPct: Math.round((MORTGAGE_BALANCE_CHF / PROPERTY_VALUE_CHF) * 1000) / 10,
    },
    assets: {
      building: assets.filter((a) => a.buildingId).length,
      unit: assets.filter((a) => a.unitId).length,
      overdue: overdueCount,
    },
    conditionReports: reports,
    cashflowPlanId,
  };
}


/**
 * Set every asset's installedAt so its wear lands on the intended fraction of
 * its useful life.
 *
 * Two passes, because the useful life isn't knowable here: it's resolved inside
 * assetInventory from per-asset overrides, asset models and the cantonal
 * standards tables. So pass one dates everything arbitrarily, pass two reads the
 * resolved usefulLifeMonths straight off the analysis the UI itself renders, and
 * back-dates each asset to hit its target wear. Whatever the standards say, the
 * profile comes out as designed.
 */
async function applyWearProfile(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  assets: { id: string; topic: string; unitId: string | null }[],
  unitNumberById: Map<string, string>,
): Promise<{ overdue: number; urgentAssetIds: string[] }> {
  // Pass 1 — any date at all, so the analysis can compute a life for each asset.
  const provisional = new Date();
  provisional.setUTCFullYear(provisional.getUTCFullYear() - 10);
  await demoRepo.setAssetsInstalledAt(prisma, assets.map((a) => a.id), provisional);

  // The FULL inventory, not getBuildingRenovationOpportunities — that one only
  // returns assets already near end of life, so using it here is circular: the
  // mid-life assets whose dates we're trying to set aren't in it.
  const inventory = await getAssetInventoryForBuilding(prisma, orgId, buildingId);
  const lifeByAssetId = new Map<string, number>();
  for (const row of inventory) {
    const life = row.depreciation?.usefulLifeMonths;
    if (typeof life === "number" && life > 0) lifeByAssetId.set(row.id, life);
  }

  // Pass 2 — back-date to the intended wear.
  const urgentAssetIds: string[] = [];
  let overdue = 0;
  for (const a of assets) {
    const unitNumber = a.unitId ? unitNumberById.get(a.unitId) ?? null : null;
    const isUrgent = URGENT.some((u) => u.topic === a.topic && u.unit === unitNumber);
    const life = lifeByAssetId.get(a.id);

    // No resolvable life (no standard for the topic) — leave the provisional
    // date rather than inventing a wear level the UI won't show anyway.
    if (!life) continue;

    // Keyed on (unit, topic), NOT the loop index: findMany's row order isn't
    // guaranteed, and an index-based pick made the wear — and therefore the
    // whole opportunity ranking — shift between regenerations. A walkthrough
    // scripted around these numbers has to survive a re-run.
    const wear = isUrgent
      ? URGENT_WEAR
      : BASELINE_WEAR[stableIndex(`${unitNumber ?? "building"}:${a.topic}`) % BASELINE_WEAR.length];
    const monthsOld = Math.max(1, Math.round(life * wear));
    const installed = new Date();
    installed.setUTCMonth(installed.getUTCMonth() - monthsOld);
    installed.setUTCHours(0, 0, 0, 0);

    if (isUrgent) {
      urgentAssetIds.push(a.id);
      overdue += 1;
    }

    await demoRepo.updateAssetDates(prisma, a.id, {
      installedAt: installed,
      lastRenovatedAt: a.topic === "RENDER_MINERAL" ? new Date(Date.UTC(2009, 8, 1)) : null,
    });
  }

  return { overdue, urgentAssetIds };
}

async function seedConditionReports(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  units: { id: string; unitNumber: string; type: string }[],
): Promise<number> {
  const existing = await demoRepo.countConditionReportsForBuilding(prisma, orgId, buildingId);
  if (existing > 0) return existing;

  // The vacant unit — its lease has ended, which is what a move-out attaches to.
  const vacant = units.find((u) => u.unitNumber === "0008");
  // Any occupied unit for the clean move-in.
  const occupied = units.find((u) => u.unitNumber === "0006");

  let created = 0;

  for (const [unit, type, items] of [
    [
      vacant,
      "MOVE_OUT" as const,
      [
        { roomLabel: "Cuisine", itemLabel: "Kitchen cabinets", condition: "DAMAGED" as const, notes: "Water damage under the sink; door fronts swollen. Replacement agreed with the outgoing tenant." },
        { roomLabel: "Séjour", itemLabel: "Wall paint", condition: "POOR" as const, notes: "Repainting required throughout — beyond normal wear for a 7-year tenancy." },
        { roomLabel: "Séjour", itemLabel: "Parquet flooring", condition: "FAIR" as const, notes: "Scratched near the balcony door; sanding sufficient." },
        { roomLabel: "Salle de bain", itemLabel: "Bathroom fittings", condition: "GOOD" as const, notes: null },
      ],
    ],
    [
      occupied,
      "MOVE_IN" as const,
      [
        { roomLabel: "Cuisine", itemLabel: "Kitchen cabinets", condition: "GOOD" as const, notes: null },
        { roomLabel: "Séjour", itemLabel: "Wall paint", condition: "GOOD" as const, notes: "Freshly repainted before handover." },
        { roomLabel: "Séjour", itemLabel: "Parquet flooring", condition: "GOOD" as const, notes: null },
        { roomLabel: "Salle de bain", itemLabel: "Bathroom fittings", condition: "GOOD" as const, notes: null },
      ],
    ],
  ] as const) {
    if (!unit) continue;

    // A report is anchored to a unit + tenant + lease. Occupied units already
    // have all three from the rent roll. The vacant unit has none — its tenant
    // left — so the departed tenancy is recreated here, which is what the
    // move-out is a record OF.
    let tenantId: string | null = null;
    let leaseId: string | null = null;

    const occupancy = await demoRepo.findUnitOccupancy(prisma, unit.id);
    const lease = await demoRepo.findLatestLeaseForUnit(prisma, unit.id);

    if (occupancy && lease) {
      tenantId = occupancy.tenantId;
      leaseId = lease.id;
    } else if (type === "MOVE_OUT") {
      const departed = await demoRepo.upsertTenantByPhone(prisma, orgId, "demo-departed-0008", {
        name: "PERRET Claude",
        email: null,
        isActive: false,
      });
      const endedLease = await demoRepo.createLease(prisma, {
          orgId,
          unitId: unit.id,
          isTemplate: false,
          status: "TERMINATED",
          landlordName: "Résidence des Charmilles",
          landlordAddress: "18 rue des Charmilles",
          landlordZipCity: "1203 Genève",
          tenantName: "PERRET Claude",
          startDate: yearsAgo(8),
          endDate: yearsAgo(1),
          netRentChf: 2480,
      });
      tenantId = departed.id;
      leaseId = endedLease.id;
    }

    if (!tenantId || !leaseId) continue;

    await demoRepo.createConditionReport(prisma, {
        orgId,
        unitId: unit.id,
        tenantId,
        leaseId,
        type,
        status: "APPROVED",
        submittedAt: yearsAgo(type === "MOVE_OUT" ? 1 : 2),
        approvedAt: yearsAgo(type === "MOVE_OUT" ? 1 : 2),
        managerNotes:
          type === "MOVE_OUT"
            ? "Kitchen replacement and full repaint charged against the deposit; balance returned."
            : "Handover clean, no reserves.",
        items: { create: items.map((i) => ({ ...i })) },
    });
    created += 1;
  }

  return created;
}

/**
 * A plan the simulator's "Plan this work" can hand off to. Scoped to the three
 * end-of-life items so the plan the visitor lands on matches the opportunities
 * the accordion ranked to the top.
 */
async function seedCashflowPlan(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  assets: { id: string; topic: string }[],
  urgentAssetIds: string[],
): Promise<string | null> {
  const existing = await demoRepo.findCashflowPlanForBuilding(prisma, orgId, buildingId);
  if (existing) return existing.id;

  // Exactly the three end-of-life items, so the plan the visitor lands on
  // matches the opportunities the accordion ranked to the top.
  const targets = urgentAssetIds
    .map((id) => assets.find((a) => a.id === id))
    .filter((a): a is { id: string; topic: string } => Boolean(a));
  if (targets.length === 0) return null;

  const thisYear = new Date().getUTCFullYear();
  const plan = await demoRepo.createCashflowPlan(prisma, {
      orgId,
      buildingId,
      name: "Envelope & kitchens — 3-year programme",
      status: "DRAFT",
      horizonMonths: 120,
      incomeGrowthRatePct: 1,
      discountRatePct: 4,
      capRatePct: 4.5,
      deferYears: 3,
      propertyValueChf: PROPERTY_VALUE_CHF,
      overrides: {
        create: targets.map((a, i) => ({
          assetId: a.id,
          originalYear: thisYear,
          overriddenYear: thisYear + (i % 3),
          costChf: a.topic === "BOILER" ? 78_000 : a.topic === "KITCHEN_CABINET_CHIPBOARD" ? 24_000 : 9_500,
          rentUpliftChfPerMonth: a.topic === "BOILER" ? 0 : a.topic === "KITCHEN_CABINET_CHIPBOARD" ? 95 : 40,
          riskAvoidedChfPerYear: a.topic === "BOILER" ? 6_500 : 900,
          vacancyDays: a.topic === "KITCHEN_CABINET_CHIPBOARD" ? 21 : 0,
          oblfPassthroughPct: 60,
        })),
      },
  });
  return plan.id;
}
