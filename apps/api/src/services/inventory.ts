import { UnitType, LocationSegment, InsulationQuality, EnergyLabel, HeatingType } from "@prisma/client";
import prisma from './prismaClient';
const activeFilter = (includeInactive?: boolean) =>
  includeInactive ? {} : { isActive: true };

const assetModelName = (model: { manufacturer: string; model: string }) => {
  if (!model.manufacturer || model.manufacturer.toLowerCase() === "unknown") return model.model;
  return `${model.manufacturer} ${model.model}`.trim();
};

// =========================
// Buildings
// =========================
export async function listBuildings(orgId: string, includeInactive?: boolean) {
  return prisma.building.findMany({
    where: { orgId, ...activeFilter(includeInactive) },
    orderBy: { createdAt: "desc" },
  });
}
export async function createBuilding(
  orgId: string,
  data: { name: string; address?: string }
) {
  const address = data.address?.trim() || data.name;
  return prisma.building.create({
    data: {
  orgId,
  name: data.name,
  address,
    },
  });
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
  }
) {
  const existing = await prisma.building.findFirst({ where: { id: buildingId, orgId } });
  if (!existing) return null;
  return prisma.building.update({
    where: { id: buildingId },
    data: {
      name: data.name ?? undefined,
      address: data.address ?? undefined,
      yearBuilt: data.yearBuilt ?? undefined,
      hasElevator: data.hasElevator ?? undefined,
      hasConcierge: data.hasConcierge ?? undefined,
    },
  });
}

export async function deactivateBuilding(orgId: string, buildingId: string) {
  const existing = await prisma.building.findFirst({ where: { id: buildingId, orgId } });
  if (!existing) return { success: false, reason: "NOT_FOUND" };

  const activeUnits = await prisma.unit.count({
    where: { buildingId, ...activeFilter(false) },
  });
  if (activeUnits > 0) {
    return { success: false, reason: "HAS_ACTIVE_UNITS" };
  }

  await prisma.building.update({
    where: { id: buildingId },
    data: { isActive: false },
  });
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
  return prisma.unit.findMany({
    where: {
      orgId,
  buildingId,
  ...activeFilter(includeInactive),
  ...(type ? { type } : {}),
    },
    orderBy: { unitNumber: "asc" },
  });
}

export async function createUnit(
  orgId: string,
  buildingId: string,
  data: { unitNumber: string; floor?: string; type?: UnitType }
) {
  const building = await prisma.building.findFirst({ where: { id: buildingId, orgId } });
  if (!building) return null;

  return prisma.unit.create({
    data: {
      buildingId,
      orgId,
  unitNumber: data.unitNumber,
  floor: data.floor ?? null,
  type: data.type ?? UnitType.RESIDENTIAL,
    },
  });
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
  const existing = await prisma.unit.findFirst({ where: { id: unitId, orgId } });
  if (!existing) return null;

  return prisma.unit.update({
    where: { id: unitId },
    data: {
      unitNumber: data.unitNumber ?? undefined,
      floor: data.floor ?? undefined,
      type: data.type ?? undefined,
      livingAreaSqm: data.livingAreaSqm ?? undefined,
      rooms: data.rooms ?? undefined,
      hasBalcony: data.hasBalcony ?? undefined,
      hasTerrace: data.hasTerrace ?? undefined,
      hasParking: data.hasParking ?? undefined,
      locationSegment: data.locationSegment ?? undefined,
      lastRenovationYear: data.lastRenovationYear ?? undefined,
      insulationQuality: data.insulationQuality ?? undefined,
      energyLabel: data.energyLabel ?? undefined,
      heatingType: data.heatingType ?? undefined,
      ...(data.monthlyRentChf !== undefined ? { monthlyRentChf: data.monthlyRentChf } : {}),
      ...(data.monthlyChargesChf !== undefined ? { monthlyChargesChf: data.monthlyChargesChf } : {}),
    },
  });
}

export async function getUnitById(orgId: string, unitId: string) {
  return prisma.unit.findFirst({
    where: { id: unitId, orgId },
    include: { building: true },
  });
}

export async function deactivateUnit(orgId: string, unitId: string) {
  const existing = await prisma.unit.findFirst({ where: { id: unitId, orgId } });
  if (!existing) return { success: false, reason: "NOT_FOUND" };

  const activeAppliances = await prisma.appliance.count({
    where: { unitId, ...activeFilter(false) },
  });
  if (activeAppliances > 0) {
    return { success: false, reason: "HAS_ACTIVE_APPLIANCES" };
  }

  await prisma.unit.update({
    where: { id: unitId },
    data: { isActive: false },
  });
  return { success: true };
}

// =========================
// Appliances
// =========================

export async function listAppliances(
  orgId: string,
  unitId: string,
  includeInactive?: boolean
) {
  return prisma.appliance.findMany({
    where: { orgId, unitId, ...activeFilter(includeInactive) },
    include: { assetModel: true },
    orderBy: { createdAt: "desc" },
  });
}
export async function createAppliance(
  orgId: string,
  unitId: string,
  data: {
  name: string;
  assetModelId?: string;
  serial?: string;
    installDate?: string;
    notes?: string;
  }
) {
  const unit = await prisma.unit.findFirst({ where: { id: unitId, orgId } });
  if (!unit) return null;

  return prisma.appliance.create({
    data: {
      unitId,
      orgId,
  name: data.name,
  assetModelId: data.assetModelId ?? null,
  serial: data.serial ?? null,
      installDate: data.installDate ? new Date(data.installDate) : null,
      notes: data.notes ?? null,
    },
    include: { assetModel: true },
  });
}
export async function updateAppliance(
  orgId: string,
  applianceId: string,
  data: {
  name?: string;
  assetModelId?: string;
  serial?: string;
    installDate?: string;
    notes?: string;
  }
) {
  const existing = await prisma.appliance.findFirst({ where: { id: applianceId, orgId } });
  if (!existing) return null;

  return prisma.appliance.update({
    where: { id: applianceId },
    data: {
      name: data.name ?? undefined,
  assetModelId: data.assetModelId ?? undefined,
  serial: data.serial ?? undefined,
  installDate: data.installDate ? new Date(data.installDate) : undefined,
      notes: data.notes ?? undefined,
    },
    include: { assetModel: true },
  });
}

export async function deactivateAppliance(orgId: string, applianceId: string) {
  const existing = await prisma.appliance.findFirst({ where: { id: applianceId, orgId } });
  if (!existing) return { success: false, reason: "NOT_FOUND" };

  const requestCount = await prisma.request.count({ where: { applianceId } });
  if (requestCount > 0) {
    return { success: false, reason: "HAS_REQUESTS" };
  }

  await prisma.appliance.update({
    where: { id: applianceId },
    data: { isActive: false },
  });
  return { success: true };
}

// =========================
// Asset Models
// =========================

export async function listAssetModels(orgId: string, includeInactive?: boolean) {
  return prisma.assetModel.findMany({
    where: {
      ...activeFilter(includeInactive),
      OR: [{ orgId: null }, { orgId }],
    },
    orderBy: [{ category: "asc" }, { manufacturer: "asc" }, { model: "asc" }],
  });
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

  const assetModel = await prisma.assetModel.create({
    data: {
      orgId,
  manufacturer,
  model,
  category,
      specs: data.specs ?? null,
      isActive: true,
    },
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
  const existing = await prisma.assetModel.findFirst({ where: { id: modelId } });
  if (!existing) return null;
  if (!existing.orgId || existing.orgId !== orgId) return null;

  const manufacturer = data.manufacturer ?? (data.name ? "Unknown" : undefined);
  const model = data.model ?? data.name;

  return prisma.assetModel.update({
    where: { id: modelId },
    data: {
      manufacturer: manufacturer ?? undefined,
  model: model ?? undefined,
  category: data.category ? data.category.trim() : undefined,
  specs: data.specs ?? undefined,
    },
  });
}

export async function deactivateAssetModel(orgId: string, modelId: string) {
  const existing = await prisma.assetModel.findFirst({ where: { id: modelId } });
  if (!existing) return { success: false, reason: "NOT_FOUND" };
  if (!existing.orgId || existing.orgId !== orgId) return { success: false, reason: "FORBIDDEN" };

  const applianceCount = await prisma.appliance.count({ where: { assetModelId: modelId } });
  if (applianceCount > 0) {
    return { success: false, reason: "HAS_APPLIANCES" };
  }

  await prisma.assetModel.update({
    where: { id: modelId },
    data: { isActive: false },
  });
  return { success: true };
}

export function addAssetModelName(model: { manufacturer: string; model: string }) {
  return assetModelName(model);
}
