import { UnitType, LocationSegment, InsulationQuality, EnergyLabel, HeatingType, ParkingKind } from "@prisma/client";
import prisma from './prismaClient';
import * as inventoryRepo from "../repositories/inventoryRepository";
import { countAssetsByModel } from "../repositories/assetRepository";
import { countOpenRequestsForBuilding } from "../repositories/requestRepository";
import { countOpenJobsForBuilding } from "../repositories/jobRepository";
import { seedDefaultBuildingAssets, seedDefaultUnitAssets } from "./defaultAssets";

/** Not-found signal for org-scoped building lookups. */
export class BuildingNotFoundError extends Error {
  constructor(message = "Building not found") {
    super(message);
    this.name = "BuildingNotFoundError";
  }
}

export interface BuildingKpis {
  openRequests: number;
  openJobs: number;
}

/**
 * Aggregate operational KPIs for a building — open request and job counts —
 * computed as scalar DB counts. Replaces the frontend anti-pattern of fetching
 * up to 2,000 requests + 2,000 jobs org-wide and filtering client-side.
 */
export async function getBuildingKpis(orgId: string, buildingId: string): Promise<BuildingKpis> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new BuildingNotFoundError();

  const [openRequests, openJobs] = await Promise.all([
    countOpenRequestsForBuilding(prisma, orgId, buildingId),
    countOpenJobsForBuilding(prisma, orgId, buildingId),
  ]);
  return { openRequests, openJobs };
}

const assetModelName = (model: { manufacturer: string; model: string }) => {
  if (!model.manufacturer || model.manufacturer.toLowerCase() === "unknown") return model.model;
  return `${model.manufacturer} ${model.model}`.trim();
};

// =========================
// Buildings
// =========================
export async function listBuildings(orgId: string, includeInactive?: boolean, ownerId?: string, managerId?: string) {
  return inventoryRepo.listBuildings(prisma, orgId, includeInactive, ownerId, managerId);
}
export async function createBuilding(
  orgId: string,
  data: { name: string; address?: string; managerId?: string | null; city?: string; postalCode?: string },
) {
  const address = data.address?.trim() || data.name;
  const building = await inventoryRepo.createBuilding(prisma, orgId, { name: data.name, address, managerId: data.managerId, city: data.city, postalCode: data.postalCode });
  // Seed default building-level assets (fire-and-forget; non-blocking)
  seedDefaultBuildingAssets(prisma, orgId, building.id, { hasElevator: false }).catch((e) =>
    console.warn("[createBuilding] Failed to seed default assets:", e),
  );
  return building;
}
export async function updateBuilding(
  orgId: string,
  buildingId: string,
  data: {
    name?: string;
    address?: string;
    yearBuilt?: number;
    hasElevator?: boolean;
    hasConcierge?: boolean;
    managedSince?: Date | null;
    houseRulesText?: string | null;
    parcelNumber?: string | null;
    easementsText?: string | null;
    ecaVolumeM3?: number | null;
    netAreaSqm?: number | null;
    weightedAreaSqm?: number | null;
    lotsApartments?: number | null;
    lotsGarages?: number | null;
    lotsExteriorParking?: number | null;
    constructionDate?: Date | null;
    lastRenovationDate?: Date | null;
    fiscalValueChf?: number | null;
    insuranceValueChf?: number | null;
    ppeEstimateChf?: number | null;
  }
) {
  const existing = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!existing) return null;
  return inventoryRepo.updateBuilding(prisma, buildingId, data);
}

export async function deactivateBuilding(orgId: string, buildingId: string) {
  const existing = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!existing) return { success: false, reason: "NOT_FOUND" };

  const activeUnits = await inventoryRepo.countActiveUnits(prisma, buildingId);
  if (activeUnits > 0) {
    return { success: false, reason: "HAS_ACTIVE_UNITS" };
  }

  await inventoryRepo.deactivateBuilding(prisma, buildingId);
  return { success: true };
}

// =========================
// Units
// =========================

export async function listUnits(
  orgId: string,
  buildingId: string,
  includeInactive?: boolean,
  type?: UnitType
) {
  return inventoryRepo.listUnits(prisma, orgId, buildingId, includeInactive, type);
}

export async function createUnit(
  orgId: string,
  buildingId: string,
  data: { unitNumber: string; floor?: string; type?: UnitType; parkingKind?: ParkingKind | null; linkedFlatId?: string | null }
) {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) return null;

  // A parking spot may only be linked to a flat in the SAME building.
  if (data.linkedFlatId) {
    const flat = await inventoryRepo.findUnitByIdAndOrg(prisma, data.linkedFlatId, orgId);
    if (!flat || flat.buildingId !== buildingId) throw new Error("INVALID_LINKED_FLAT");
  }

  const unit = await inventoryRepo.createUnit(prisma, orgId, buildingId, data);
  // Seed default unit-level assets only for residential units (fire-and-forget)
  if (!data.type || data.type === "RESIDENTIAL") {
    seedDefaultUnitAssets(prisma, orgId, unit.id).catch((e) =>
      console.warn("[createUnit] Failed to seed default assets:", e),
    );
  }
  return unit;
}
export async function updateUnit(
  orgId: string,
  unitId: string,
  data: {
    unitNumber?: string;
    floor?: string;
    type?: UnitType;
    parkingKind?: ParkingKind | null;
    linkedFlatId?: string | null;
    livingAreaSqm?: number;
    rooms?: number;
    hasBalcony?: boolean;
    hasTerrace?: boolean;
    hasParking?: boolean;
    locationSegment?: LocationSegment;
    lastRenovationYear?: number;
    insulationQuality?: InsulationQuality;
    energyLabel?: EnergyLabel;
    heatingType?: HeatingType;
    monthlyRentChf?: number | null;
    monthlyChargesChf?: number | null;
    intrinsicPricePerSqmChf?: number | null;
    vetustePct?: number | null;
    gardenAreaSqm?: number | null;
    gardenWeightPct?: number | null;
    extParkingValueChf?: number | null;
    garageValueChf?: number | null;
    isListedPublicly?: boolean;
  }
) {
  const existing = await inventoryRepo.findUnitByIdAndOrg(prisma, unitId, orgId);
  if (!existing) return null;

  // Safeguard: net rent / charges are governed by any binding (SIGNED/ACTIVE) lease.
  // Editing them on the unit would create a discrepancy with the signed lease and the
  // tenant's invoices (both read from Lease.netRentChf / chargesTotalChf), so reject a
  // *change* while a binding lease exists. Unchanged values pass through (the edit form
  // always sends these two fields), so other unit edits still work while occupied.
  const bindingLeases = existing.leases ?? [];
  if (bindingLeases.length > 0) {
    const rentChanged =
      data.monthlyRentChf !== undefined && data.monthlyRentChf !== existing.monthlyRentChf;
    const chargesChanged =
      data.monthlyChargesChf !== undefined && data.monthlyChargesChf !== existing.monthlyChargesChf;
    if (rentChanged || chargesChanged) {
      throw new Error("RENT_LOCKED_BY_LEASE");
    }
  }

  // A parking spot may only be linked to another unit in the same building, and
  // never to itself. (null clears the link.)
  if (data.linkedFlatId) {
    if (data.linkedFlatId === unitId) throw new Error("INVALID_LINKED_FLAT");
    const flat = await inventoryRepo.findUnitByIdAndOrg(prisma, data.linkedFlatId, orgId);
    if (!flat || flat.buildingId !== existing.buildingId) throw new Error("INVALID_LINKED_FLAT");
  }

  return inventoryRepo.updateUnit(prisma, unitId, data);
}

export async function getUnitById(orgId: string, unitId: string) {
  return inventoryRepo.findUnitByIdAndOrg(prisma, unitId, orgId);
}

export async function getMarketPriceByZip(orgId: string, postalCode: string) {
  if (!postalCode) return null;
  return inventoryRepo.findMarketPriceByZip(prisma, orgId, postalCode);
}

export async function upsertMarketPriceByZip(
  orgId: string,
  data: { postalCode: string; city?: string | null; pricePerSqmChf: number; source?: string | null; asOf?: Date | null },
) {
  return inventoryRepo.upsertMarketPriceByZip(prisma, orgId, data);
}

export async function deactivateUnit(orgId: string, unitId: string) {
  const existing = await inventoryRepo.findUnitByIdAndOrg(prisma, unitId, orgId);
  if (!existing) return { success: false, reason: "NOT_FOUND" };

  await inventoryRepo.deactivateUnit(prisma, unitId);
  return { success: true };
}

// =========================
// Asset Models
// =========================

export async function listAssetModels(orgId: string, includeInactive?: boolean) {
  return inventoryRepo.listAssetModels(prisma, orgId, includeInactive);
}

export async function createAssetModel(
  orgId: string,
  data: {
    name: string;
  category: string;
  manufacturer?: string;
  model?: string;
    specs?: string;
  }
) {
  const manufacturer = data.manufacturer?.trim() || "Unknown";
  const model = data.model?.trim() || data.name.trim();
  const category = data.category.trim();

  const assetModel = await inventoryRepo.createAssetModel(prisma, orgId, {
    manufacturer,
    model,
    category,
    specs: data.specs ?? null,
  });

  return { ...assetModel, name: assetModelName(assetModel) };
}

export async function updateAssetModel(
  orgId: string,
  modelId: string,
  data: {
  name?: string;
  category?: string;
  manufacturer?: string;
    model?: string;
    specs?: string;
  }
) {
  const existing = await inventoryRepo.findAssetModelById(prisma, modelId);
  if (!existing) return null;
  if (!existing.orgId || existing.orgId !== orgId) return null;

  const manufacturer = data.manufacturer ?? (data.name ? "Unknown" : undefined);
  const model = data.model ?? data.name;

  return inventoryRepo.updateAssetModel(prisma, modelId, {
    manufacturer: manufacturer ?? undefined,
    model: model ?? undefined,
    category: data.category ? data.category.trim() : undefined,
    specs: data.specs ?? undefined,
  });
}

export async function deactivateAssetModel(orgId: string, modelId: string) {
  const existing = await inventoryRepo.findAssetModelById(prisma, modelId);
  if (!existing) return { success: false, reason: "NOT_FOUND" };
  if (!existing.orgId || existing.orgId !== orgId) return { success: false, reason: "FORBIDDEN" };

  const assetCount = await countAssetsByModel(prisma, modelId);
  if (assetCount > 0) {
    return { success: false, reason: "HAS_ASSETS" };
  }

  await inventoryRepo.deactivateAssetModel(prisma, modelId);
  return { success: true };
}

export function addAssetModelName(model: { manufacturer: string; model: string }) {
  return assetModelName(model);
}
