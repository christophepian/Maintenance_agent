/**
 * Default Asset Seeding
 *
 * Provides canonical default asset lists for buildings and units,
 * and idempotent seed functions that call upsertAsset.
 *
 * Seeding is idempotent: running it on an existing building/unit that
 * already has some defaults will only create the missing ones.
 *
 * Topics use the same normalization as normalizeTopicKey() so they
 * resolve correctly against DepreciationStandard records.
 */

import { PrismaClient, AssetType } from "@prisma/client";
import { upsertAsset } from "../repositories/assetRepository";

interface DefaultAsset {
  name: string;
  type: AssetType;
  topic: string;
}

// ─── Building-level defaults ───────────────────────────────────
// Attached directly to the building (buildingId set, unitId null).

export const DEFAULT_BUILDING_ASSETS: DefaultAsset[] = [
  { name: "Roof covering",             type: "STRUCTURAL", topic: "ROOF_COVERING" },
  { name: "Exterior facade",           type: "STRUCTURAL", topic: "EXTERIOR_WALL_COATING" },
  { name: "Staircase",                 type: "STRUCTURAL", topic: "STAIRCASE" },
  { name: "Entrance door",             type: "FIXTURE",    topic: "ENTRANCE_DOOR" },
  { name: "Central heating",           type: "SYSTEM",     topic: "CENTRAL_HEATING" },
  { name: "Water pipes",               type: "SYSTEM",     topic: "WATER_PIPES" },
  { name: "Electrical installation",   type: "SYSTEM",     topic: "ELECTRICAL_INSTALLATION" },
];

/** Additional asset added when building.hasElevator is true */
export const ELEVATOR_ASSET: DefaultAsset = {
  name: "Elevator",
  type: "SYSTEM",
  topic: "ELEVATOR",
};

// ─── Unit-level defaults ───────────────────────────────────────
// Attached to the unit (unitId set, buildingId null).

export const DEFAULT_UNIT_ASSETS: DefaultAsset[] = [
  { name: "Floor covering",    type: "FINISH",     topic: "PARQUET_MOSAIC" },
  { name: "Wall coating",      type: "FINISH",     topic: "WALL_COATING" },
  { name: "Ceiling",           type: "FINISH",     topic: "CEILING_PAINT" },
  { name: "Bathroom",          type: "FIXTURE",    topic: "BATHROOM_INSTALLATION" },
  { name: "Kitchen",           type: "FIXTURE",    topic: "KITCHEN_INSTALLATION" },
  { name: "Windows",           type: "FIXTURE",    topic: "WINDOWS" },
  { name: "Interior doors",    type: "FIXTURE",    topic: "INTERIOR_DOORS" },
  { name: "Balcony",           type: "STRUCTURAL", topic: "BALCONY" },
];

// ─── Seed functions ────────────────────────────────────────────

/**
 * Seed default building-level assets for a building.
 * Idempotent — skips assets that already exist (upsert).
 * Pass building.hasElevator to conditionally include the elevator.
 */
export async function seedDefaultBuildingAssets(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  options: { hasElevator?: boolean } = {},
): Promise<void> {
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
 * Seed default unit-level assets for a unit.
 * Idempotent — skips assets that already exist (upsert).
 */
export async function seedDefaultUnitAssets(
  prisma: PrismaClient,
  orgId: string,
  unitId: string,
): Promise<void> {
  for (const asset of DEFAULT_UNIT_ASSETS) {
    await upsertAsset(prisma, orgId, {
      unitId,
      type: asset.type,
      topic: asset.topic,
      name: asset.name,
    });
  }
}
