/**
 * Default Asset Seeding
 *
 * Provides canonical default asset lists for buildings and units using
 * ASLOCA/FRI 2007 topic keys so depreciation resolves automatically.
 *
 * The 14 ASLOCA categories (Chauffage, Cuisine, Salle de bains, etc.) act
 * as display headers in the UI; each individual item here is a concrete asset
 * with its own useful life from the DepreciationStandard table.
 *
 * Seeding is idempotent: the seed functions first remove any stale legacy
 * defaults (topics from the old non-ASLOCA list), then upsert the new ones.
 * Manually-added assets whose topics are not in either default list are
 * never touched.
 */

import { PrismaClient, AssetType } from "@prisma/client";
import { upsertAsset } from "../repositories/assetRepository";

interface DefaultAsset {
  name: string;
  type: AssetType;
  topic: string;
}

// ─── Stale legacy topics (non-ASLOCA) to remove on reseed ─────
// These were the original defaults; topics don't exist in the
// DepreciationStandard table so depreciation never resolved for them.

const LEGACY_BUILDING_TOPICS = [
  "ROOF_COVERING",
  "EXTERIOR_WALL_COATING",
  "STAIRCASE",
  "ENTRANCE_DOOR",
  "CENTRAL_HEATING",
  "WATER_PIPES",
  "ELECTRICAL_INSTALLATION",
];

const LEGACY_UNIT_TOPICS = [
  "BATHROOM_INSTALLATION",
  "KITCHEN_INSTALLATION",
  "WALL_COATING",
  "CEILING_PAINT",
  "WINDOWS",
  "INTERIOR_DOORS",
  "BALCONY",
];

// ─── Building-level defaults ───────────────────────────────────
// Attached directly to the building (buildingId set, unitId null).
// ASLOCA categories: Chauffage · Enveloppe · Conduites · Électricité · Commun

export const DEFAULT_BUILDING_ASSETS: DefaultAsset[] = [
  // Chauffage (Heating)
  { name: "Boiler",                        type: "SYSTEM",     topic: "BOILER" },
  { name: "Circulation pump",              type: "SYSTEM",     topic: "CIRCULATION_PUMP" },
  { name: "Heating control",               type: "SYSTEM",     topic: "HEATING_CONTROL" },
  // Enveloppe (Building Envelope)
  { name: "Pitched roof tiles",            type: "STRUCTURAL", topic: "PITCHED_ROOF_TILES" },
  { name: "Mineral facade render",         type: "FINISH",     topic: "RENDER_MINERAL" },
  // Conduites (Plumbing)
  { name: "Cold water pipes (copper)",     type: "SYSTEM",     topic: "PIPE_COLD_COPPER" },
  { name: "Hot water pipes (copper)",      type: "SYSTEM",     topic: "PIPE_HOT_COPPER_INSULATED" },
  // Électricité (Electrical)
  { name: "Electrical cables",             type: "SYSTEM",     topic: "ELECTRICAL_CABLES" },
  // Commun (Common Areas)
  { name: "Intercom system",               type: "SYSTEM",     topic: "INTERCOM" },
  { name: "Combined lock system",          type: "FIXTURE",    topic: "COMBINED_LOCK_SYSTEM" },
  { name: "Washing machine (common)",      type: "APPLIANCE",  topic: "WASHING_MACHINE_COMMON" },
  { name: "Dryer (common)",                type: "APPLIANCE",  topic: "DRYER_COMMON" },
];

/** Ascenseur — added only when building.hasElevator is true */
export const ELEVATOR_ASSET: DefaultAsset = {
  name: "Elevator",
  type: "SYSTEM",
  topic: "ELEVATOR",
};

// ─── Unit-level defaults ───────────────────────────────────────
// Attached to the unit (unitId set, buildingId null).
// ASLOCA categories: Enveloppe · Intérieurs · Sols · Cuisine · Salle de bains
//                    Électricité · Extérieurs

export const DEFAULT_UNIT_ASSETS: DefaultAsset[] = [
  // Enveloppe (Windows & Shutters)
  { name: "Insulated windows (PVC/wood)",      type: "FIXTURE",    topic: "WINDOW_INSULATED_PLASTIC_WOOD" },
  { name: "Roller shutters (plastic)",         type: "FIXTURE",    topic: "ROLLER_SHUTTER_PLASTIC" },
  // Intérieurs (Walls & Doors)
  { name: "Wall paint (dispersion)",           type: "FINISH",     topic: "PAINT_WALLS_DISPERSION" },
  { name: "Interior doors (chipboard)",        type: "FIXTURE",    topic: "DOOR_CHIPBOARD" },
  // Sols (Flooring)
  { name: "Parquet flooring (mosaic)",         type: "FINISH",     topic: "PARQUET_MOSAIC" },
  // Cuisine (Kitchen)
  { name: "Kitchen cabinets (chipboard)",      type: "FIXTURE",    topic: "KITCHEN_CABINET_CHIPBOARD" },
  { name: "Kitchen worktop (synthetic)",       type: "FIXTURE",    topic: "COUNTERTOP_SYNTHETIC" },
  { name: "Kitchen tap",                       type: "FIXTURE",    topic: "KITCHEN_TAP" },
  { name: "Kitchen tiles (ceramic)",           type: "FINISH",     topic: "KITCHEN_TILES_CERAMIC" },
  // Salle de bains (Bathroom)
  { name: "Bathtub (acrylic)",                 type: "FIXTURE",    topic: "BATHTUB_ACRYLIC" },
  { name: "Sanitary ceramics (WC/basin)",      type: "FIXTURE",    topic: "SANITARY_CERAMIC" },
  { name: "Bathroom tap",                      type: "FIXTURE",    topic: "BATHROOM_TAP" },
  { name: "Bathroom tiles (ceramic)",          type: "FINISH",     topic: "BATHROOM_TILES_CERAMIC" },
  // Électricité (Electrical)
  { name: "Power sockets",                     type: "SYSTEM",     topic: "POWER_SOCKET" },
  { name: "Light switches",                    type: "SYSTEM",     topic: "SWITCH" },
  // Extérieurs (Balcony)
  { name: "Balcony (metal)",                   type: "STRUCTURAL", topic: "BALCONY_METAL" },
  { name: "Balcony railing (metal)",           type: "FIXTURE",    topic: "BALCONY_RAILING_METAL" },
];

// ─── Helpers ──────────────────────────────────────────────────

/** Delete stale legacy defaults so they don't linger after a reseed. */
async function deleteLegacyAssets(
  prisma: PrismaClient,
  orgId: string,
  scope: { buildingId: string } | { unitId: string },
  legacyTopics: string[],
): Promise<void> {
  const where =
    "buildingId" in scope
      ? { orgId, buildingId: scope.buildingId, topic: { in: legacyTopics } }
      : { orgId, unitId: scope.unitId, topic: { in: legacyTopics } };
  await (prisma.asset as any).deleteMany({ where });
}

// ─── Seed functions ────────────────────────────────────────────

/**
 * Seed default building-level assets.
 * First removes stale legacy topics, then upserts the canonical ASLOCA set.
 * Manually-added assets (topics outside either default list) are untouched.
 */
export async function seedDefaultBuildingAssets(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  options: { hasElevator?: boolean } = {},
): Promise<void> {
  await deleteLegacyAssets(prisma, orgId, { buildingId }, LEGACY_BUILDING_TOPICS);

  const list = [...DEFAULT_BUILDING_ASSETS];
  if (options.hasElevator) list.push(ELEVATOR_ASSET);

  for (const asset of list) {
    await upsertAsset(prisma, orgId, {
      buildingId,
      type: asset.type,
      topic: asset.topic,
      name: asset.name,
    });
  }
}

/**
 * Seed default unit-level assets.
 * First removes stale legacy topics, then upserts the canonical ASLOCA set.
 * Manually-added assets (topics outside either default list) are untouched.
 */
export async function seedDefaultUnitAssets(
  prisma: PrismaClient,
  orgId: string,
  unitId: string,
): Promise<void> {
  await deleteLegacyAssets(prisma, orgId, { unitId }, LEGACY_UNIT_TOPICS);

  for (const asset of DEFAULT_UNIT_ASSETS) {
    await upsertAsset(prisma, orgId, {
      unitId,
      type: asset.type,
      topic: asset.topic,
      name: asset.name,
    });
  }
}
