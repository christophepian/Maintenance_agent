import { UnitType, LocationSegment, InsulationQuality, EnergyLabel, HeatingType } from "@prisma/client";
import prisma from './prismaClient';
import * as inventoryRepo from "../repositories/inventoryRepository";

const assetModelName = (model: { manufacturer: string; model: string }) => {
  if (!model.manufacturer || model.manufacturer.toLowerCase() === "unknown") return model.model;
  return `${model.manufacturer} ${model.model}`.trim();
};

// =========================
// Buildings
// =========================
export async function listBuildings(orgId: string, includeInactive?: boolean) {
  return inventoryRepo.listBuildings(prisma, orgId, includeInactive);
}
export async function createBuilding(
  orgId: string,
  data: { name: string; address?: string }
) {
  const address = data.address?.trim() || data.name;
  return inventoryRepo.createBuilding(prisma, orgId, { name: data.name, address });
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
  data: { unitNumber: string; floor?: string; type?: UnitType }
) {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) return null;

  return inventoryRepo.createUnit(prisma, orgId, buildingId, data);
}
export async function updateUnit(
  orgId: string,
  unitId: string,
  data: {
    unitNumber?: string;
    floor?: string;
    type?: UnitType;
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
  }
) {
  const existing = await inventoryRepo.findUnitByIdAndOrg(prisma, unitId, orgId);
  if (!existing) return null;

  return inventoryRepo.updateUnit(prisma, unitId, data);
}

export async function getUnitById(orgId: string, unitId: string) {
  return inventoryRepo.findUnitByIdAndOrg(prisma, unitId, orgId);
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

  const assetCount = await prisma.asset.count({ where: { assetModelId: modelId } });
  if (assetCount > 0) {
    return { success: false, reason: "HAS_ASSETS" };
  }

  await inventoryRepo.deactivateAssetModel(prisma, modelId);
  return { success: true };
}

export function addAssetModelName(model: { manufacturer: string; model: string }) {
  return assetModelName(model);
}
