import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

/**
 * Building CRUD operations
 */

export async function createBuilding(orgId: string, data: { name: string; address: string }) {
  const building = await prisma.building.create({
    data: {
      orgId,
      name: data.name,
      address: data.address,
    },
    include: {
      units: true,
    },
  });
  return building;
}

export async function getBuilding(id: string) {
  return await prisma.building.findUnique({
    where: { id },
    include: {
      units: {
        include: {
          appliances: {
            include: {
              assetModel: true,
            },
          },
          tenants: true,
        },
      },
    },
  });
}

export async function listBuildings(orgId: string) {
  return await prisma.building.findMany({
    where: { orgId },
    include: {
      units: {
        include: {
          appliances: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateBuilding(
  id: string,
  data: { name?: string; address?: string }
) {
  return await prisma.building.update({
    where: { id },
    data,
    include: {
      units: true,
    },
  });
}

export async function deleteBuilding(id: string) {
  return await prisma.building.delete({
    where: { id },
  });
}

/**
 * Unit CRUD operations
 */

export async function createUnit(
  buildingId: string,
  data: { unitNumber: string; floor?: string }
) {
  const unit = await prisma.unit.create({
    data: {
      buildingId,
      unitNumber: data.unitNumber,
      floor: data.floor || null,
    },
    include: {
      appliances: {
        include: {
          assetModel: true,
        },
      },
      tenants: true,
    },
  });
  return unit;
}

export async function getUnit(id: string) {
  return await prisma.unit.findUnique({
    where: { id },
    include: {
      building: true,
      appliances: {
        include: {
          assetModel: true,
        },
      },
      tenants: true,
    },
  });
}

export async function listUnits(buildingId: string) {
  return await prisma.unit.findMany({
    where: { buildingId },
    include: {
      appliances: {
        include: {
          assetModel: true,
        },
      },
      tenants: true,
    },
    orderBy: { unitNumber: "asc" },
  });
}

export async function updateUnit(
  id: string,
  data: { unitNumber?: string; floor?: string }
) {
  return await prisma.unit.update({
    where: { id },
    data,
    include: {
      appliances: {
        include: {
          assetModel: true,
        },
      },
      tenants: true,
    },
  });
}

export async function deleteUnit(id: string) {
  return await prisma.unit.delete({
    where: { id },
  });
}

/**
 * Appliance CRUD operations
 */

export async function createAppliance(
  unitId: string,
  data: {
    name: string;
    assetModelId?: string;
    serial?: string;
    installDate?: string;
    notes?: string;
  }
) {
  const appliance = await prisma.appliance.create({
    data: {
      unitId,
      name: data.name,
      assetModelId: data.assetModelId || null,
      serial: data.serial || null,
      installDate: data.installDate ? new Date(data.installDate) : null,
      notes: data.notes || null,
    },
    include: {
      assetModel: true,
    },
  });
  return appliance;
}

export async function getAppliance(id: string) {
  return await prisma.appliance.findUnique({
    where: { id },
    include: {
      unit: true,
      assetModel: true,
    },
  });
}

export async function listAppliances(unitId: string) {
  return await prisma.appliance.findMany({
    where: { unitId },
    include: {
      assetModel: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateAppliance(
  id: string,
  data: {
    name?: string;
    assetModelId?: string;
    serial?: string;
    installDate?: string;
    notes?: string;
  }
) {
  return await prisma.appliance.update({
    where: { id },
    data: {
      name: data.name,
      assetModelId: data.assetModelId,
      serial: data.serial,
      installDate: data.installDate ? new Date(data.installDate) : undefined,
      notes: data.notes,
    },
    include: {
      assetModel: true,
    },
  });
}

export async function deleteAppliance(id: string) {
  return await prisma.appliance.delete({
    where: { id },
  });
}

/**
 * AssetModel CRUD operations
 */

export async function createAssetModel(
  orgId: string,
  data: {
    manufacturer: string;
    model: string;
    category: string;
    specs?: string;
  }
) {
  const assetModel = await prisma.assetModel.create({
    data: {
      orgId,
      manufacturer: data.manufacturer,
      model: data.model,
      category: data.category,
      specs: data.specs || null,
    },
  });
  return assetModel;
}

export async function getAssetModel(id: string) {
  return await prisma.assetModel.findUnique({
    where: { id },
    include: {
      appliances: true,
    },
  });
}

export async function listAssetModels(orgId: string, category?: string) {
  return await prisma.assetModel.findMany({
    where: {
      orgId,
      ...(category && { category }),
    },
    include: {
      appliances: true,
    },
    orderBy: [{ category: "asc" }, { manufacturer: "asc" }, { model: "asc" }],
  });
}

export async function updateAssetModel(
  id: string,
  data: {
    manufacturer?: string;
    model?: string;
    category?: string;
    specs?: string;
  }
) {
  return await prisma.assetModel.update({
    where: { id },
    data,
  });
}

export async function deleteAssetModel(id: string) {
  return await prisma.assetModel.delete({
    where: { id },
  });
}
