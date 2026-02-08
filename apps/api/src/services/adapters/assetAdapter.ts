export type AssetDTO = {
  id: string;
  name: string;
  unitId: string;
  unit?: {
    id: string;
    unitNumber: string;
    buildingId: string;
  } | null;
  model?: {
    id: string;
    manufacturer: string;
    model: string;
    category: string;
  } | null;
  serial?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function assetFromAppliance(appliance: {
  id: string;
  name: string;
  unitId: string;
  unit?: { id: string; unitNumber: string; buildingId: string } | null;
  assetModel?: { id: string; manufacturer: string; model: string; category: string } | null;
  serial?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AssetDTO {
  return {
    id: appliance.id,
    name: appliance.name,
    unitId: appliance.unitId,
    unit: appliance.unit ?? null,
    model: appliance.assetModel
      ? {
          id: appliance.assetModel.id,
          manufacturer: appliance.assetModel.manufacturer,
          model: appliance.assetModel.model,
          category: appliance.assetModel.category,
        }
      : null,
    serial: appliance.serial ?? null,
    isActive: appliance.isActive,
    createdAt: appliance.createdAt.toISOString(),
    updatedAt: appliance.updatedAt.toISOString(),
  };
}
